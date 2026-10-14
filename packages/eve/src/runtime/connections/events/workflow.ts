import { createHook } from "#compiled/@workflow/core/index.js";
import { claimHookOwnership, disposeHook, isHookConflictError } from "#execution/hook-ownership.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
import type {
  ConnectionEventHandlerState,
  EventBinding,
} from "#runtime/connections/events/state.js";
import {
  prepareConnectionEventStep,
  dispatchConnectionEventStep,
} from "#runtime/connections/events/dispatch-step.js";

export type ConnectionEventMessage = ConnectionEventPayload | { readonly kind: "retire" };

export function connectionEventHookToken(bindingId: string): string {
  return `eve:connection-event:${bindingId}`;
}

/** Owns callback state and receipts independently of conversation sessions. */
export async function connectionEventWorkflow(input: {
  readonly binding: EventBinding;
  readonly serializedContext: Record<string, unknown>;
}): Promise<void> {
  "use workflow";
  const hook = createHook<ConnectionEventMessage>({
    token: connectionEventHookToken(input.binding.id),
  });
  try {
    await claimHookOwnership(hook);
  } catch (error) {
    // Retrying the subscribing tool may start a duplicate owner.
    if (isHookConflictError(error)) return;
    throw error;
  }
  let serializedContext = input.serializedContext;
  let state: ConnectionEventHandlerState = { binding: input.binding, receipts: {} };
  try {
    for await (const message of hook) {
      if (message.kind === "retire") return;
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
      }
      if (
        prepared.accepted &&
        "control" in message.delivery &&
        message.delivery.control.type === "terminated"
      )
        return;
    }
  } finally {
    await disposeHook(hook);
  }
}
