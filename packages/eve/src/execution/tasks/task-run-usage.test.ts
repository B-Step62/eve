import { describe, expect, it, vi } from "vitest";

import type { DurableSession, DurableSessionState } from "#execution/durable-session-store.js";
import type { SessionView } from "#harness/session-machine/view.js";
import type { SessionEvent } from "#protocol/session-event.js";
import type { SessionInbox, SessionInboxPayload } from "#execution/session-inbox/inbox.js";
import { SessionStateCursor } from "#execution/session/state-cursor.js";
import { SessionLoop } from "#execution/session/session-loop.js";
import {
  createTask,
  readTaskTable,
  recordTaskRun,
  writeTaskTable,
} from "#execution/tasks/table.js";
import type { WorkflowToolRunRef } from "#execution/tools/workflow/messages.js";
import { getSessionUsageLimitViolation, sessionUsage } from "#harness/session-usage.js";
import type { HarnessSession } from "#harness/types.js";
import { createTestSessionState } from "#internal/testing/session-state.js";
import { withSessionUsage } from "#internal/testing/session-usage.js";
import type { TokenUsage } from "#shared/token-usage.js";

// A task step's commit folds what it decides into the session's saved view, as the writer does.
vi.mock("#execution/publish-session-events.js", async () => {
  const { readDurableSession, replaceDurableSessionSnapshot } =
    await import("#execution/durable-session-store.js");
  const { sessionView } = await import("#harness/session-machine/commit.js");
  const { SESSION_PROJECTION_STATE_KEY, storedProjection } =
    await import("#harness/session-machine/view.js");
  const { copyView, foldReceivedEvent } = await import("#protocol/session-projection/fold.js");
  return {
    commitSessionStep: async (
      target: { serializedContext: Record<string, unknown>; sessionState: DurableSessionState },
      decide: (view: SessionView) => readonly { readonly events: readonly SessionEvent[] }[],
    ) => {
      const session = readDurableSession(target.sessionState);
      const projection = storedProjection(session.state);
      const view = copyView(projection.view);
      for (const transition of decide(sessionView(projection, session.state)))
        for (const event of transition.events)
          foldReceivedEvent(view, { ...event, meta: { endOfLine: false } });
      const state = { ...session.state, [SESSION_PROJECTION_STATE_KEY]: { ...projection, view } };
      return {
        serializedContext: target.serializedContext,
        sessionState: replaceDurableSessionSnapshot({
          session: { ...session, state },
          state: target.sessionState,
        }),
      };
    },
  };
});

function usage(inputTokens: number, costUsd?: number): TokenUsage {
  return { cacheReadTokens: 0, cacheWriteTokens: 0, costUsd, inputTokens, outputTokens: 0 };
}

/**
 * A session that has spent `ownInputTokens` itself, under `limits`, with one
 * agent task, `name`, whose run is working on a call.
 */
function sessionWithTask(input: {
  readonly limits?: HarnessSession["limits"];
  readonly name: string;
  readonly ownInputTokens: number;
}): {
  readonly cursor: SessionStateCursor;
  readonly execution: SessionLoop;
  readonly from: WorkflowToolRunRef;
  readonly inbox: SessionInbox;
} {
  const base = createTestSessionState({ sessionId: `${input.name}-parent` });
  const created = createTask(readTaskTable(undefined), {
    callId: `${input.name}-call`,
    kind: "agent",
    name: input.name,
    resumable: true,
    turnId: "turn_1",
  });
  const runId = `${input.name}-run`;
  const table = recordTaskRun(created.table, created.taskId, {
    hookToken: `${runId}-control`,
    runId,
  });
  const snapshot = writeTaskTable(
    withSessionUsage(
      { ...base.snapshot.session, limits: input.limits },
      usage(input.ownInputTokens),
    ),
    table,
  );
  const inbox = {
    claimSessionHooks: vi.fn(),
    hasPending: () => false,
    onDelivery: () => () => {},
    onInterrupt: () => () => {},
    takeLeading: () => [],
  } as Partial<SessionInbox> as SessionInbox;
  const cursor = new SessionStateCursor({
    history: [],
    inbox,
    serializedContext: {},
    sessionState: { ...base, snapshot: { session: snapshot } },
    sessionWritable: new WritableStream<Uint8Array>(),
  });
  const execution = new SessionLoop({
    cursor,
    inbox,
    sessionId: base.sessionId,
  });
  const from: WorkflowToolRunRef = {
    callId: `${input.name}-call`,
    input: {},
    runId,
    sequence: 1,
    stepIndex: 0,
    taskId: created.taskId,
    toolName: input.name,
    turnId: "turn_1",
  };
  return { cursor, execution, from, inbox };
}

function committed(cursor: SessionStateCursor): DurableSession {
  return cursor.sessionState.snapshot.session;
}

function spent(cursor: SessionStateCursor): TokenUsage {
  return sessionUsage(committed(cursor));
}

describe("delegated agent usage", () => {
  it("counts a task's usage once from its replies, usage reports, and outcome, however often they arrive, against the session's limits", async () => {
    const alice = sessionWithTask({
      limits: { maxInputTokensPerSession: 1_000 },
      name: "reviewer",
      ownInputTokens: 100,
    });
    const { from } = alice;
    const reply = {
      callIds: [from.callId],
      from,
      kind: "reply" as const,
      output: "The plan looks ready.",
      usage: usage(300, 0.25),
    };
    const outcome = {
      from,
      kind: "outcome" as const,
      result: { output: "Reviewed.", status: "completed" as const },
      usage: usage(900, 0.75),
    };
    // What the session spent before each message arrives between Alice's turns: the reply is
    // delivered twice; then Alice cancels the reviewer's next turn, whose usage no reply carries;
    // then the outcome is delivered twice, the second after the task's run finished.
    const arrivals: [SessionInboxPayload | undefined, TokenUsage | undefined][] = [
      [reply, undefined],
      [reply, undefined],
      [{ from, kind: "usage", usage: usage(600, 0.5) }, usage(400, 0.25)],
      [outcome, usage(700, 0.5)],
      [outcome, undefined],
      [undefined, undefined],
    ];
    alice.inbox.next = async () => {
      const [payload, spentBefore] = arrivals.shift()!;
      if (spentBefore !== undefined) {
        expect(spent(alice.cursor)).toEqual(spentBefore);
        expect(getSessionUsageLimitViolation(committed(alice.cursor))).toBeNull();
      }
      return payload;
    };

    await expect(alice.execution.run()).resolves.toEqual({ kind: "expired" });

    expect(spent(alice.cursor)).toEqual(usage(1_000, 0.75));
    expect(getSessionUsageLimitViolation(committed(alice.cursor))).toEqual({
      kind: "input",
      limit: 1_000,
      usedTokens: 1_000,
    });
  });
});
