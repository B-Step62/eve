import { createHook } from "#compiled/@workflow/core/index.js";
import {
  claimHookOwnership,
  disposeHook,
  isHookConflictError,
  isHookForceClaimedError,
} from "#execution/hook-ownership.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
import {
  connectionEventHandoverToken,
  connectionEventHookToken,
} from "#runtime/connections/events/path.js";
import {
  eventOwner,
  type ConnectionEventHandlerState,
  type ConnectionEventHandover,
  type EventBinding,
} from "#runtime/connections/events/state.js";
import {
  prepareConnectionEventStep,
  dispatchConnectionEventStep,
} from "#runtime/connections/events/dispatch-step.js";
import {
  openConnectionEventStep,
  passConnectionEventHandoverStep,
  startConnectionEventSuccessorStep,
} from "#runtime/connections/events/lifecycle-step.js";

export type ConnectionEventMessage = ConnectionEventPayload | { readonly kind: "retire" };

/**
 * Every resume replays the run's whole log, about six entries per delivery.
 * Handing over well before Workflow's replay slowdown (2,000 entries) keeps
 * each resume short and each run far below the 25,000-entry cap.
 */
export const CONNECTION_EVENT_HANDOVER_DELIVERIES = 250;

/**
 * Holds one watch: its binding, subscription and receipts live only in this
 * run and its successors. After {@link CONNECTION_EVENT_HANDOVER_DELIVERIES}
 * deliveries it starts a successor, which takes the hook; this run processes
 * every delivery it received before the takeover, then sends the successor its
 * final state.
 */
export async function connectionEventWorkflow(input: {
  readonly binding: EventBinding;
  readonly serializedContext: Record<string, unknown>;
  /** Set on a successor: how many runs held this watch before it. */
  readonly generation?: number;
}): Promise<void> {
  "use workflow";
  const generation = input.generation ?? 0;
  // A successor registers where its predecessor will send the final state
  // before it takes the watch hook, so that send always finds it.
  const inbound =
    generation === 0
      ? undefined
      : createHook<ConnectionEventHandover>({
          token: connectionEventHandoverToken(input.binding.id, generation),
        });
  if (inbound !== undefined) await claimHookOwnership(inbound);
  const hook = createHook<ConnectionEventMessage>({
    token: connectionEventHookToken(input.binding.id),
    metadata: eventOwner(input.binding),
    // Every delivery after the takeover reaches this run, without a gap.
    experimental_force: generation > 0,
  });
  try {
    await claimHookOwnership(hook);
  } catch (error) {
    if (inbound !== undefined) await disposeHook(inbound);
    // Retrying the subscribing tool may start a duplicate owner.
    if (isHookConflictError(error)) return;
    throw error;
  }
  let serializedContext = input.serializedContext;
  let state: ConnectionEventHandlerState;
  let deliveries = 0;
  let handedOver = false;
  let ended = false;
  try {
    if (inbound === undefined) {
      const opened = await openConnectionEventStep({ serializedContext, binding: input.binding });
      if ("error" in opened) return;
      state = { binding: input.binding, subscription: opened.subscription, receipts: {} };
    } else {
      const carried = await inbound;
      await disposeHook(inbound);
      if (carried.ended) return;
      serializedContext = carried.serializedContext;
      state = carried.state;
    }
    try {
      for await (const message of hook) {
        // A stopped watch ignores the rest; after a handover it waits for the takeover.
        if (ended) continue;
        if (message.kind === "retire") ended = true;
        else {
          const prepared = await prepareConnectionEventStep({
            serializedContext,
            state,
            payload: message,
          });
          serializedContext = prepared.serializedContext;
          state = prepared.state;
          if (prepared.accepted) {
            const dispatched = await dispatchConnectionEventStep({
              serializedContext,
              state,
              payload: message,
            });
            serializedContext = dispatched.serializedContext;
            state = dispatched.state;
            ended = "control" in message.delivery && message.delivery.control.type === "terminated";
          }
          if (++deliveries === CONNECTION_EVENT_HANDOVER_DELIVERIES && !ended) {
            await startConnectionEventSuccessorStep({
              serializedContext,
              binding: state.binding,
              generation: generation + 1,
            });
            handedOver = true;
          }
        }
        if (ended && !handedOver) return;
      }
    } catch (error) {
      // Only this watch's next generation forces its token.
      if (!isHookForceClaimedError(error)) throw error;
      await passConnectionEventHandoverStep({
        bindingId: input.binding.id,
        generation: generation + 1,
        handover: { serializedContext, state, ended },
      });
    }
  } finally {
    await disposeHook(hook);
  }
}
