import { createHook, sleep, type HookOptions } from "#compiled/@workflow/core/index.js";
import { claimHookOwnership, disposeHook, isHookConflictError } from "#execution/hook-ownership.js";
import { parseJsonObject } from "#shared/json.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
import { connectionEventHookToken } from "#runtime/connections/events/path.js";
import { MAX_WATCH_TTL_MS, type EventBinding } from "#runtime/connections/events/state.js";
import { dispatchConnectionEventStep } from "#runtime/connections/events/dispatch-step.js";
import {
  openConnectionEventStep,
  publishConnectionEventOutcomeStep,
} from "#runtime/connections/events/lifecycle-step.js";

export type ConnectionEventWatchMessage = { readonly kind: "retire" };

/**
 * How long an ended watch stays findable by its id, so get and a repeated
 * stop still reach Connect while it finishes upstream cleanup.
 */
const ENDED_WATCH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Holds one watch: its hook carries the binding every delivery runs under,
 * and the run waits until the watch is stopped, terminated or expires.
 * Deliveries run in their own {@link connectionEventDeliveryWorkflow}, so
 * this run's log stays a few entries long however many events arrive.
 *
 * The run never disposes a subscribed watch's hook. Its retention outlasts
 * the watch, so once the run ends Workflow keeps the hook findable by its id
 * but no longer resumable: the run's status is what says the watch ended.
 */
export async function connectionEventWorkflow(input: {
  readonly binding: EventBinding;
  readonly serializedContext: Record<string, unknown>;
}): Promise<void> {
  "use workflow";
  const hook = createHook<ConnectionEventWatchMessage>({
    token: connectionEventHookToken(input.binding.id),
    metadata: parseJsonObject(input.binding) as HookOptions["metadata"],
    experimental_minRetention:
      (input.binding.request.ttlMs ?? MAX_WATCH_TTL_MS) + ENDED_WATCH_RETENTION_MS,
  });
  try {
    await claimHookOwnership(hook);
  } catch (error) {
    if (!isHookConflictError(error) || typeof error.conflictingRunId !== "string") throw error;
    // A retried subscribing tool started a second run: its caller reads the first one.
    await publishConnectionEventOutcomeStep({ ownerRunId: error.conflictingRunId });
    return;
  }
  const opened = await openConnectionEventStep({
    serializedContext: input.serializedContext,
    binding: input.binding,
  });
  if ("error" in opened) {
    // Nothing was subscribed: a retried call with this id may try again.
    await disposeHook(hook);
    return;
  }
  const { expiresAt } = opened.subscription;
  // Connect ends the subscription at expiresAt and sends nothing more.
  await (expiresAt === null ? hook : Promise.race([hook, sleep(new Date(expiresAt))]));
}

/** Runs one delivery's callback in its own short run. */
export async function connectionEventDeliveryWorkflow(input: {
  readonly binding: EventBinding;
  readonly serializedContext: Record<string, unknown>;
  readonly payload: ConnectionEventPayload;
}): Promise<void> {
  "use workflow";
  await dispatchConnectionEventStep(input);
}
