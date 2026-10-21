import type { DeliverHookPayload } from "#channel/types.js";
import {
  type DurableSession,
  type DurableSessionState,
  readDurableSession,
  replaceDurableSessionSnapshot,
} from "#execution/durable-session-store.js";
import type { SessionStepState } from "#execution/publish-session-events.js";
import type { DeliveryAdmission, SessionInputQueue } from "#execution/session/input-queue.js";
import type { SessionStateCursor } from "#execution/session/state-cursor.js";
import {
  type SessionStateTransition,
  withSessionStateDelta,
} from "#execution/session/state-delta.js";
import { readTaskTable } from "#execution/tasks/table.js";
import { ignoreGoneTarget } from "#execution/tasks/workflow-target.js";
import type { WorkflowToolRunControlMessage } from "#execution/tools/workflow/messages.js";
import { SESSION_LIMIT_CONTINUE_OPTION_ID } from "#harness/hitl/budget-request.js";
import { readHitlState } from "#harness/hitl/requests.js";
import { storedProjection } from "#harness/session-machine/view.js";
import { resetSessionUsageWindow, type TokenUsageDelta } from "#harness/turn-tag-state.js";
import { getBlockingWorkflowToolRuns } from "#harness/workflow-tool-runs.js";
import { createLogger, logError } from "#internal/logging.js";
import { resumeHook } from "#internal/workflow/runtime.js";
import { openInputs } from "#protocol/session-projection.js";

// A Continue on a session-limit prompt raises the allowance of every session
// in the tree that asked. Each session the answer passes through starts a new
// window and pushes `USAGE_CONTINUED` down to its runs, which pass it to the
// sessions they opened. The push is best-effort: a session that misses it asks
// once itself. It carries no principal, so it never starts a turn or changes
// a turn's auth.

const log = createLogger("eve:session-usage");

const USAGE_CONTINUED: WorkflowToolRunControlMessage = { kind: "usage-continued" };

/**
 * Starts a new usage window at the session's totals plus what its direct
 * children's open session-limit prompts show they spent and haven't reported,
 * so that spend counts once, in the window being approved.
 */
export function continueSessionUsage(session: DurableSession): DurableSession {
  const relays = readHitlState(session.state).relays;
  const tasks = readTaskTable(session.state).tasks;
  const unreported = { cacheReadTokens: 0, cacheWriteTokens: 0, inputTokens: 0, outputTokens: 0 };
  for (const { request } of openInputs(storedProjection(session.state))) {
    const relay = relays.get(request.requestId);
    const child = relay?.childSessionInbox?.sessionId;
    // A prompt id starts with the id of the session that asked.
    if (request.kind !== "session-limit" || !request.requestId.startsWith(`${child}:`)) continue;
    const total = request.action.input["total"] as TokenUsageDelta | undefined;
    const counted = tasks.find((task) => task.run?.runId === relay?.runId)?.run?.usage;
    for (const field of Object.keys(unreported) as (keyof typeof unreported)[]) {
      unreported[field] += Math.max(0, (total?.[field] ?? 0) - (counted?.[field] ?? 0));
    }
  }
  return resetSessionUsageWindow(session, unreported);
}

/** Tells the session's started task runs and blocking workflow tool runs. */
export async function pushSessionUsageContinuation(session: DurableSession): Promise<void> {
  const runs = [
    ...readTaskTable(session.state).tasks.flatMap((task) => (task.run?.started ? [task.run] : [])),
    ...getBlockingWorkflowToolRuns(session.state).map((run) => run.address),
  ];
  await Promise.all(
    runs.map((run) =>
      ignoreGoneTarget(resumeHook(run.hookToken, USAGE_CONTINUED)).catch((error: unknown) => {
        logError(log, "usage continuation not delivered", error, { runId: run.runId });
      }),
    ),
  );
}

/**
 * Applies a continuation pushed from above, passes it on, and answers the
 * session's own open session-limit prompts with Continue: the new window
 * starts at the session's totals, so they no longer hold.
 */
export async function applySessionUsageContinuationStep(
  input: SessionStepState,
): Promise<SessionStateTransition & { readonly approved: readonly string[] }> {
  "use step";
  return await withSessionStateDelta(input, async (state) => {
    const session = continueSessionUsage(readDurableSession(state.sessionState));
    await pushSessionUsageContinuation(session);
    const relays = readHitlState(session.state).relays;
    return {
      approved: openInputs(storedProjection(session.state))
        .filter(({ request }) => request.kind === "session-limit" && !relays.has(request.requestId))
        .map(({ request }) => request.requestId),
      sessionState: replaceDurableSessionSnapshot({ session, state: state.sessionState }),
    };
  });
}

/** Tells the session's runs about a Continue it applied in a turn step. */
export async function pushSessionUsageContinuationStep(input: {
  readonly sessionState: DurableSessionState;
}): Promise<void> {
  "use step";
  await pushSessionUsageContinuation(readDurableSession(input.sessionState));
}

/**
 * Applies a pushed continuation and queues a Continue for the session's own
 * prompts it settled, so a turn parked on one goes on. The answer carries no
 * auth, so it acts as the turn's own identity. Returns its admission.
 */
export async function applySessionUsageContinuation(input: {
  readonly cursor: SessionStateCursor;
  readonly queue: SessionInputQueue;
}): Promise<DeliveryAdmission | undefined> {
  const { approved } = await input.cursor.advance((state) =>
    applySessionUsageContinuationStep(state),
  );
  if (approved.length === 0) return undefined;
  const delivery: DeliverHookPayload = {
    kind: "deliver",
    payloads: [
      {
        inputResponses: approved.map((requestId) => ({
          optionId: SESSION_LIMIT_CONTINUE_OPTION_ID,
          requestId,
        })),
      },
    ],
  };
  return input.queue.enqueueDelivery(delivery);
}
