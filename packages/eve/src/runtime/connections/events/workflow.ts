import { createHook } from "#compiled/@workflow/core/index.js";
import { claimHookOwnership, disposeHook, isHookConflictError } from "#execution/hook-ownership.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
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
  readonly bindingId: string;
  readonly serializedContext: Record<string, unknown>;
}): Promise<void> {
  "use workflow";
  const hook = createHook<ConnectionEventMessage>({
    token: connectionEventHookToken(input.bindingId),
  });
  try {
    await claimHookOwnership(hook);
  } catch (error) {
    // Retrying the subscribing tool may start a duplicate owner.
    if (isHookConflictError(error)) return;
    throw error;
  }
  let serializedContext = input.serializedContext;
  try {
    for await (const message of hook) {
      if (message.kind === "retire") return;
      const prepared = await prepareConnectionEventStep({ serializedContext, payload: message });
      serializedContext = prepared.serializedContext;
      if (prepared.accepted) {
        const dispatched = await dispatchConnectionEventStep({
          serializedContext,
          payload: message,
        });
        serializedContext = dispatched.serializedContext;
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
