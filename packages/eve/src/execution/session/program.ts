import { STUB_CONTEXT_KEY, type StubScope } from "#tool-stubs/types.js";
import { withStubPlayback } from "#execution/tool-stubs/playback.js";
import type { SessionCapabilities, TurnCaller } from "#channel/types.js";
import type { AgentWorkflowRetentionDefinition } from "#shared/agent-definition.js";
import { resolveInitialTurnCallerStep } from "#subagents/parent-notification.js";
import type { DurableSessionState } from "#execution/durable-session-store.js";
import type { HarnessModelMessage } from "#harness/messages.js";
import type { SessionEnd, SessionStart } from "#execution/session/scheduler/state.js";
import { SessionLoop } from "#execution/session/session-loop.js";
import { createTurnControl, type TurnControl } from "#execution/session/turn-control.js";
import { SessionStateCursor } from "#execution/session/state-cursor.js";
import { finalizeSession, type SessionTerminalOutcome } from "#execution/session/finalization.js";
import { type SessionInboxHandle } from "#execution/session-inbox/inbox.js";
import type { SessionTimeoutControl } from "#execution/session/timeout-control.js";
import { SessionHandoff, sessionAnchorToken } from "#execution/session/handoff.js";
import { signalSessionAnchorStep } from "#execution/session/handoff-steps.js";
import type { WorkflowEntryResult } from "#execution/session/entry-input.js";

export type { SessionStart } from "#execution/session/scheduler/state.js";

/** The run's own failure never carries internals; the terminal event already logged them. */
function createSafeOuterWorkflowError(): Error {
  const error = new Error("Agent workflow failed. Inspect the private session trace for details.");
  error.name = "EveWorkflowFailure";
  return error;
}

/**
 * Who to tell when this owner exits. The original run anchors the public
 * stream itself; a successor signals the original run. A `self` anchor may
 * also name a `notify` step that runs with the final result, which lets an
 * importer settle whatever predecessor still holds the stream open.
 */
export type SessionAnchor =
  | {
      readonly kind: "self";
      readonly notify?: (result: WorkflowEntryResult) => Promise<void>;
    }
  | { readonly kind: "successor" };

export interface SessionBoot {
  readonly anchor: SessionAnchor;
  readonly caller: TurnCaller | undefined;
  readonly capabilities?: SessionCapabilities;
  readonly deploymentId: string;
  readonly history: HarnessModelMessage[];
  readonly initialTurnControl?: TurnControl;
  readonly start: SessionStart;
  readonly retention?: AgentWorkflowRetentionDefinition;
  readonly serializedContext: Record<string, unknown>;
  readonly sessionId: string;
  readonly sessionState: DurableSessionState;
  readonly sessionTimeoutControl?: SessionTimeoutControl;
  readonly sessionTimeoutDeadline?: Date;
  readonly sessionTimeoutMs: number | false;
  readonly sessionWritable: WritableStream<Uint8Array>;
}

type SessionLoopOutcome =
  | { readonly kind: "terminal"; readonly outcome: SessionTerminalOutcome }
  | { readonly kind: "transferred" };

/** Runs an already prepared owner against its session's existing stream. */
export async function runPreparedSession(
  boot: SessionBoot,
  inbox: SessionInboxHandle,
): Promise<WorkflowEntryResult> {
  const scope = boot.serializedContext[STUB_CONTEXT_KEY] as StubScope | undefined;
  if (scope !== undefined && scope.rootSessionId === undefined) {
    boot.serializedContext[STUB_CONTEXT_KEY] = { ...scope, rootSessionId: boot.sessionId };
  }
  const cursor = new SessionStateCursor({
    history: boot.history,
    inbox,
    sessionWritable: boot.sessionWritable,
    serializedContext: boot.serializedContext,
    sessionState: boot.sessionState,
  });
  const handoff = new SessionHandoff({
    checkpoint: {
      capabilities: boot.capabilities,
      retention: boot.retention,
      sessionTimeoutMs: boot.sessionTimeoutMs,
    },
    deploymentId: boot.deploymentId,
    inbox,
    isInitialOwner: boot.anchor.kind === "self",
    sessionId: boot.sessionId,
  });
  const session = new SessionLoop({
    caller: boot.caller,
    capabilities: boot.capabilities,
    cursor,
    handoff,
    inbox,
    sessionId: boot.sessionId,
    sessionTimeoutDeadline: boot.sessionTimeoutDeadline,
    start: boot.start,
  });
  let result: WorkflowEntryResult = { output: "", isError: true };
  let loop: SessionLoopOutcome | undefined;
  let terminalEmitted = false;
  try {
    result = await withStubPlayback(scope, boot.sessionId, async () => {
      try {
        loop = outcomeOf(await runSession(boot, session));
      } finally {
        await inbox.dispose();
      }
      if (loop.kind === "transferred") {
        if (boot.anchor.kind !== "self") return { output: "" };
        result = await handoff.awaitAnchoredResult();
        return result;
      }
      result = await finalizeSession(loop.outcome, {
        caller: session.caller,
        cursor,
        sessionWritable: boot.sessionWritable,
      });
      terminalEmitted = true;
      return result;
    });
    return result;
  } catch (error) {
    if (!terminalEmitted) {
      await finalizeSession(
        { error, kind: "failed", turnId: session.turnId },
        { caller: session.caller, cursor, sessionWritable: boot.sessionWritable },
      );
    }
    throw createSafeOuterWorkflowError();
  } finally {
    // Also dispose if playback setup fails before the session loop starts. Disposal is idempotent.
    await inbox.dispose();
    await reportResultToAnchor(boot, result, handoff, loop);
  }
}

/**
 * Terminal path for a boot that failed before the session loop could run.
 * The caller is re-resolved from context because no turn ever bound it.
 */
export async function failSession(input: {
  readonly error: unknown;
  readonly serializedContext: Record<string, unknown>;
  readonly sessionId: string;
  readonly sessionState: DurableSessionState | undefined;
  readonly sessionWritable: WritableStream<Uint8Array>;
}): Promise<never> {
  let caller: TurnCaller | undefined;
  try {
    caller = await resolveInitialTurnCallerStep({ serializedContext: input.serializedContext });
  } catch {
    // Best effort: when resolution fails again there is no reachable caller to notify.
  }
  await finalizeSession(
    { error: input.error, kind: "failed" },
    {
      caller,
      cursor: {
        serializedContext: input.serializedContext,
        sessionState: input.sessionState,
      },
      sessionWritable: input.sessionWritable,
    },
  );
  throw createSafeOuterWorkflowError();
}

async function reportResultToAnchor(
  boot: SessionBoot,
  result: WorkflowEntryResult,
  handoff: SessionHandoff,
  loop: SessionLoopOutcome | undefined,
): Promise<void> {
  switch (boot.anchor.kind) {
    case "self":
      await handoff.disposeAnchor();
      await boot.anchor.notify?.(result);
      return;
    case "successor":
      if (loop?.kind === "transferred") return;
      await signalSessionAnchorStep({ result, token: sessionAnchorToken(boot.sessionId) });
      return;
  }
}

/**
 * Runs the session until it ends or moves. The session's timer starts beside its first action, so
 * the first turn doesn't wait for it.
 */
async function runSession(boot: SessionBoot, session: SessionLoop): Promise<SessionEnd> {
  const sessionTimeout = boot.sessionTimeoutControl;
  try {
    return await session.run({
      control:
        boot.initialTurnControl ?? (boot.anchor.kind === "self" ? createTurnControl() : undefined),
      startup: sessionTimeout?.start(),
    });
  } finally {
    await sessionTimeout?.dispose();
  }
}

function outcomeOf(end: SessionEnd): SessionLoopOutcome {
  switch (end.kind) {
    case "transferred":
      return { kind: "transferred" };
    case "done":
      return { kind: "terminal", outcome: { action: end.outcome, kind: "done" } };
    case "expired":
      return { kind: "terminal", outcome: end };
  }
}
