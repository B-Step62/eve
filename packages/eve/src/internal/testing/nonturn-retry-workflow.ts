import { getWorkflowMetadata, getWritable } from "#compiled/@workflow/core/index.js";
import { commitSessionStep, publishSessionEvents } from "#execution/publish-session-events.js";
import { readDurableSession, type DurableSessionState } from "#execution/durable-session-store.js";
import { readTurnState } from "#harness/session-machine/state.js";
import { fact } from "#harness/facts.js";
import { createTestSessionState } from "#internal/testing/session-state.js";
import { emitTerminalSessionCompletionStep } from "#execution/terminal-session-completion-step.js";

async function publishStart(context: Record<string, unknown>) {
  "use step";
  const sessionId = getWorkflowMetadata().workflowRunId;
  return await publishSessionEvents(
    {
      serializedContext: { ...context, "eve.sessionId": sessionId },
      sessionState: createTestSessionState({ sessionId }),
      sessionWritable: getWritable<Uint8Array>(),
    },
    [fact("session.started", {})],
  );
}

async function publishCancellableStart(context: Record<string, unknown>) {
  "use step";
  const sessionId = getWorkflowMetadata().workflowRunId;
  return await publishSessionEvents(
    {
      serializedContext: { ...context, "eve.sessionId": sessionId },
      sessionState: createTestSessionState({ sessionId }),
      sessionWritable: getWritable<Uint8Array>(),
    },
    [fact("session.started", {})],
    { canCancelTurn: true },
  );
}

export async function nonturnCancellationRetryWorkflow(context: Record<string, unknown>) {
  "use workflow";
  return (await publishCancellableStart(context)).cancelled;
}

async function publishNext(
  input: Pick<Awaited<ReturnType<typeof publishStart>>, "serializedContext" | "sessionState">,
) {
  "use step";
  await publishSessionEvents({ ...input, sessionWritable: getWritable<Uint8Array>() }, [
    fact("turn.started", { turnId: "turn_0", follows: null, cause: { policy: "test" } }),
  ]);
}

async function commitStart(context: Record<string, unknown>) {
  "use step";
  const sessionId = getWorkflowMetadata().workflowRunId;
  return await commitSessionStep(
    {
      serializedContext: { ...context, "eve.sessionId": sessionId },
      sessionState: createTestSessionState({ sessionId }),
      sessionWritable: getWritable<Uint8Array>(),
    },
    (view) => [
      {
        events: [fact("session.started", {})],
        turn: { ...view.turn, grants: [{ toolName: "lookup", interactionId: "approval-1" }] },
      },
    ],
    { origin: "own" },
  );
}

async function inspectCommit(state: DurableSessionState) {
  "use step";
  return readTurnState(readDurableSession(state).state).grants;
}

export async function nonturnCommitRetryWorkflow(context: Record<string, unknown>) {
  "use workflow";
  const started = await commitStart(context);
  await publishNext(started);
  return {
    sessionId: getWorkflowMetadata().workflowRunId,
    grants: await inspectCommit(started.sessionState),
  };
}

async function commitTwice(context: Record<string, unknown>) {
  "use step";
  const sessionId = getWorkflowMetadata().workflowRunId;
  const initial = {
    serializedContext: { ...context, "eve.sessionId": sessionId },
    sessionState: createTestSessionState({ sessionId }),
    sessionWritable: getWritable<Uint8Array>(),
  };
  const started = await commitSessionStep(
    initial,
    (view) => [{ events: [fact("session.started", {})], turn: view.turn }],
    { origin: "own" },
  );
  await commitSessionStep(
    { ...initial, ...started },
    (view) => [
      {
        events: [
          fact("turn.started", { turnId: "turn_0", follows: null, cause: { policy: "test" } }),
        ],
        turn: view.turn,
      },
    ],
    { origin: "own" },
  );
}

export async function nonturnMultiCommitRetryWorkflow(context: Record<string, unknown>) {
  "use workflow";
  await commitTwice(context);
  return getWorkflowMetadata().workflowRunId;
}

export async function terminalAfterStaleCheckpointWorkflow(
  context: Record<string, unknown>,
  unavailableProviders = false,
) {
  "use workflow";
  const started = await publishStart(context);
  await publishNext(started);
  await emitTerminalSessionCompletionStep({
    ...started,
    ...(unavailableProviders && {
      serializedContext: { "eve.sessionId": getWorkflowMetadata().workflowRunId },
    }),
    sessionWritable: getWritable<Uint8Array>(),
    usage: undefined,
  });
  return getWorkflowMetadata().workflowRunId;
}

export async function nonturnRetryWorkflow(context: Record<string, unknown>): Promise<string> {
  "use workflow";
  const sessionId = getWorkflowMetadata().workflowRunId;
  const started = await publishStart(context);
  await publishNext(started);
  return sessionId;
}
