import { createHook } from "#compiled/@workflow/core/index.js";
import {
  claimHookOwnership,
  disposeHook,
  isHookConflictError,
  isHookForceClaimedError,
} from "#execution/hook-ownership.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
import { connectionEventHookToken } from "#runtime/connections/events/path.js";
import {
  eventOwner,
  type ConnectionEventHandlerState,
  type ConnectionEventReceipts,
  type EventBinding,
} from "#runtime/connections/events/state.js";
import type { ManagedEventSubscription } from "#shared/connection-events.js";
import {
  prepareConnectionEventStep,
  dispatchConnectionEventStep,
} from "#runtime/connections/events/dispatch-step.js";
import {
  handOverConnectionEventStep,
  openConnectionEventStep,
  retireConnectionEventStep,
} from "#runtime/connections/events/lifecycle-step.js";

export type ConnectionEventMessage = ConnectionEventPayload | { readonly kind: "retire" };

/**
 * Every resume replays the run's whole log, about six entries per delivery.
 * Handing over well before Workflow's replay slowdown (2,000 entries) keeps
 * each resume short and each run far below the 25,000-entry cap.
 */
export const CONNECTION_EVENT_HANDOVER_DELIVERIES = 250;

/** Holds one watch: its binding, subscription and receipts live only in this run and its successors. */
export async function connectionEventWorkflow(input: {
  readonly binding: EventBinding;
  readonly serializedContext: Record<string, unknown>;
  /** Set when a predecessor hands this watch over; this run then takes its hook. */
  readonly handover?: {
    readonly subscription: ManagedEventSubscription;
    readonly receipts: ConnectionEventReceipts;
  };
}): Promise<void> {
  "use workflow";
  const hook = createHook<ConnectionEventMessage>({
    token: connectionEventHookToken(input.binding.id),
    metadata: eventOwner(input.binding),
    // A successor takes the token without a gap: the predecessor keeps every
    // delivery it already received, and every later one reaches this run.
    experimental_force: input.handover !== undefined,
  });
  try {
    await claimHookOwnership(hook);
  } catch (error) {
    // Retrying the subscribing tool may start a duplicate owner.
    if (isHookConflictError(error)) return;
    throw error;
  }
  let serializedContext = input.serializedContext;
  let deliveries = 0;
  // After a handover, the end of this watch must also reach the successor.
  let ended = false;
  try {
    const opened = await openConnectionEventStep({
      serializedContext,
      binding: input.binding,
      subscription: input.handover?.subscription,
    });
    if ("error" in opened) return;
    let state: ConnectionEventHandlerState = {
      binding: input.binding,
      subscription: opened.subscription,
      receipts: input.handover?.receipts ?? {},
    };
    for await (const message of hook) {
      if (ended) continue;
      if (message.kind === "retire") ended = true;
      else {
        if (++deliveries === CONNECTION_EVENT_HANDOVER_DELIVERIES)
          await handOverConnectionEventStep({
            serializedContext,
            binding: state.binding,
            subscription: state.subscription,
            receipts: state.receipts,
          });
        const prepared = await prepareConnectionEventStep({
          serializedContext,
          state,
          payload: message,
        });
        serializedContext = prepared.serializedContext;
        state = prepared.state;
        if (!prepared.accepted) continue;
        const dispatched = await dispatchConnectionEventStep({
          serializedContext,
          state,
          payload: message,
        });
        serializedContext = dispatched.serializedContext;
        state = dispatched.state;
        ended = "control" in message.delivery && message.delivery.control.type === "terminated";
      }
      if (ended && deliveries < CONNECTION_EVENT_HANDOVER_DELIVERIES) return;
    }
  } catch (error) {
    // The successor owns the hook now; this run's received deliveries are done.
    if (!isHookForceClaimedError(error)) throw error;
    if (ended) await retireConnectionEventStep(input.binding.id);
  } finally {
    await disposeHook(hook);
  }
}
