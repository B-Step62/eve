import { describe, expect, it, vi } from "vitest";

import { buildSessionHandle } from "#channel/session.js";
import type { SubagentAuthorizationEventHookPayload } from "#channel/types.js";
import { ContextContainer } from "#context/container.js";
import { ContinuationTokenKey, SessionIdKey } from "#context/keys.js";
import { forwardAgentSessionRequest } from "#execution/agent-sessions/requests.js";

import { handleWorkflowToolRunMessage } from "#execution/session-workflow-tool-run.js";
import { SessionStateCursor } from "#execution/session/state-cursor.js";
import { applyTaskRunMessageStep, cancelTasksStep } from "#execution/tasks/steps.js";
import {
  createTask,
  markTaskRunStarted,
  readTaskTable,
  recordTaskRun,
  writeTaskTable,
} from "#execution/tasks/table.js";
import type { WorkflowToolRunRef } from "#execution/tools/workflow/messages.js";
import { getProxyInputRequests } from "#harness/proxy-input-requests.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { containsEventSequence, filterEventsByType } from "#internal/testing/events.js";
import { createTestSessionState } from "#internal/testing/session-state.js";
import type { MessageStreamEvent, UnstampedMessageStreamEvent } from "#protocol/message.js";
import { foldSession, initialSessionProjection, openInputs } from "#protocol/session-projection.js";
import { createBundledRuntimeCompiledArtifactsSource } from "#runtime/compiled-artifacts-source.js";
import { SUBAGENT_ADAPTER } from "#subagents/adapter.js";

const resumedHooks = vi.hoisted(() => [] as { token: string; payload: unknown }[]);

vi.mock("#internal/workflow/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#internal/workflow/runtime.js")>()),
  resumeHook: async (token: string, payload: unknown) => {
    resumedHooks.push({ payload, token });
  },
}));

const serializedContext = {
  "eve.auth": null,
  "eve.bundle": { source: createBundledRuntimeCompiledArtifactsSource() },
  "eve.channel": { kind: "http", state: {} },
  "eve.continuationToken": "test-token",
  "eve.sessionId": "support-session",
};

/** Alice's support session, which runs a resumable reviewer task. */
function reviewerTaskSession() {
  const created = createTask(readTaskTable(undefined), {
    callId: "reviewer-call",
    kind: "agent",
    name: "reviewer",
    resumable: true,
    turnId: "turn_1",
  });
  const table = markTaskRunStarted(
    recordTaskRun(created.table, created.taskId, {
      hookToken: "reviewer-run-control",
      runId: "reviewer-run",
    }),
    created.taskId,
    "reviewer-run",
  ).table;
  const base = createTestSessionState(
    {
      sessionId: "support-session",
    },
    { sequence: 2, stepIndex: 0, turnId: "turn_1" },
  );
  const events: MessageStreamEvent[] = [];
  const decoder = new TextDecoder();
  const cursor = new SessionStateCursor({
    history: [],
    inbox: { claimSessionHooks: async () => {} },
    serializedContext,
    sessionState: {
      ...base,
      snapshot: { session: writeTaskTable(base.snapshot.session, table) },
    },
    sessionWritable: new WritableStream<Uint8Array>({
      write(chunk) {
        events.push(JSON.parse(decoder.decode(chunk)) as MessageStreamEvent);
      },
    }),
  });
  const from: WorkflowToolRunRef = {
    callId: "reviewer-call",
    input: { message: "Review the release notes." },
    runId: "reviewer-run",
    sequence: 2,
    stepIndex: 0,
    taskId: created.taskId,
    toolName: "reviewer",
    turnId: "turn_1",
  };

  return { cursor, events, from, taskId: created.taskId };
}

describe("handleWorkflowToolRunMessage", () => {
  it("withdraws a request from a run's agent session once the run ends", async () => {
    // Alice's reviewer task asks her to approve creating an issue, then its
    // run fails before she answers, which also ends the reviewer's session.
    const { cursor, events, from } = reviewerTaskSession();

    const runtime = await createTestRuntime({ agent: { name: "support" } });
    await runtime.run(async () => {
      await handleWorkflowToolRunMessage({
        cursor,
        message: {
          from,
          kind: "request",
          replyTo: "reviewer-session-token",
          request: {
            kind: "input-batch",
            requests: [
              {
                action: {
                  callId: "create-issue-call",
                  input: {},
                  kind: "tool-call",
                  toolName: "create_issue",
                },
                kind: "tool-approval",
                options: [{ id: "approve", label: "Approve" }],
                prompt: "Approve creating the release issue?",
                requestId: "approval-1",
              },
            ],
          },
          requestCoordinates: { sequence: 2, stepIndex: 0, turnId: "turn_1" },
        },
      });
      await cursor.advance((state) =>
        applyTaskRunMessageStep({
          ...state,
          message: {
            from,
            kind: "outcome",
            result: { error: "The reviewer's model call failed.", status: "failed" },
          },
        }),
      );
    });

    expect(
      filterEventsByType(events, "input.resolved").map((event) => event.data.resolutions),
    ).toEqual([[{ kind: "tool-approval", outcome: "cancelled", requestId: "approval-1" }]]);
    expect(
      containsEventSequence(events, ["input.requested", "input.resolved", "task.settled"]),
    ).toBe(true);
    expect(getProxyInputRequests(cursor.sessionState.snapshot.session.state).size).toBe(0);
  });

  it("withdraws a cancelled task's agent question once its session withdraws it", async () => {
    // Alice's reviewer asks her which release to review. She cancels the
    // task instead; the task stays available, and the cancel stops the
    // reviewer's turn, which withdraws its question.
    const { cursor, events, from, taskId } = reviewerTaskSession();
    const question = {
      action: {
        callId: "ask-call",
        input: {},
        kind: "tool-call" as const,
        toolName: "ask_question",
      },
      kind: "question" as const,
      prompt: "Which release should I review?",
      requestId: "question-1",
    };
    const childTurn = { sequence: 1, stepIndex: 0, turnId: "reviewer-turn" };
    const childContext = new ContextContainer();
    childContext.set(ContinuationTokenKey, "reviewer-session-token");
    childContext.set(SessionIdKey, "reviewer-session");

    const runtime = await createTestRuntime({ agent: { name: "support" } });
    await runtime.run(async () => {
      await handleWorkflowToolRunMessage({
        cursor,
        message: {
          from,
          kind: "request",
          replyTo: "reviewer-session-token",
          request: { kind: "input-batch", requests: [question] },
          requestCoordinates: childTurn,
        },
      });
      await cursor.advance((state) =>
        cancelTasksStep({ ...state, reason: "task_cancel", taskIds: [taskId] }),
      );

      resumedHooks.length = 0;
      await SUBAGENT_ADAPTER["input.resolved"]?.(
        {
          ...childTurn,
          resolutions: [{ kind: "question", outcome: "cancelled", requestId: "question-1" }],
        },
        {
          ctx: childContext,
          session: buildSessionHandle(childContext),
          state: {
            callId: "reviewer-call",
            parentContinuationToken: "reviewer-agent-session-hook",
            parentSessionId: "reviewer-run",
            subagentName: "reviewer",
          },
        },
      );
      // The reviewer's run passes what its session forwarded to Alice's session.
      for (const { payload } of resumedHooks.splice(0)) {
        await forwardAgentSessionRequest({
          from,
          owner: {
            send: async (message) => {
              await handleWorkflowToolRunMessage({ cursor, message });
            },
            sent: 0,
          },
          replyTo: "reviewer-agent-session-hook",
          request: payload as SubagentAuthorizationEventHookPayload,
        });
      }
    });

    const projection = events.reduce(
      (state, event) => foldSession(state, event as UnstampedMessageStreamEvent),
      initialSessionProjection(),
    );
    expect(filterEventsByType(events, "task.settled").map((event) => event.data)).toMatchObject([
      { status: "cancelled", taskId },
    ]);
    expect(openInputs(projection)).toEqual([]);
    expect(
      filterEventsByType(events, "input.resolved").map((event) => event.data.resolutions),
    ).toEqual([[{ kind: "question", outcome: "cancelled", requestId: "question-1" }]]);
    expect(getProxyInputRequests(cursor.sessionState.snapshot.session.state).size).toBe(0);
  });
});
