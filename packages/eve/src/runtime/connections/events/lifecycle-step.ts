import { getWritable } from "#compiled/@workflow/core/index.js";
import { deserializeContext } from "#context/serialize.js";
import {
  connectionEventWorkflowReference,
  startWorkflowOnCurrentDeployment,
} from "#execution/workflow-runtime.js";
import { resolveBinding } from "#runtime/connections/events/dispatch-step.js";
import { retireConnectionEventOwner } from "#runtime/connections/events/owner.js";
import { connectionEventDestination } from "#runtime/connections/events/path.js";
import {
  CONNECTION_EVENT_SUBSCRIPTION_NAMESPACE,
  type ConnectionEventReceipts,
  type ConnectionEventSubscribeOutcome,
  type EventBinding,
} from "#runtime/connections/events/state.js";
import type { ManagedEventSubscription } from "#shared/connection-events.js";
import { withConnectionEventSpan } from "#tracing/eve/connection-events.js";

/**
 * Subscribes from inside the handler run, after its hook is registered, so a
 * delivery that beats the subscribe response waits on the hook. A successor
 * run republishes the subscription it inherited instead of subscribing again.
 */
export async function openConnectionEventStep(input: {
  readonly serializedContext: Record<string, unknown>;
  readonly binding: EventBinding;
  readonly subscription: ManagedEventSubscription | undefined;
}): Promise<ConnectionEventSubscribeOutcome> {
  "use step";
  const outcome: ConnectionEventSubscribeOutcome =
    input.subscription === undefined
      ? await subscribeConnectionEvent(input.serializedContext, input.binding)
      : { subscription: input.subscription };
  const writer = getWritable<ConnectionEventSubscribeOutcome>({
    namespace: CONNECTION_EVENT_SUBSCRIPTION_NAMESPACE,
  }).getWriter();
  try {
    await writer.write(outcome);
  } finally {
    writer.releaseLock();
  }
  return outcome;
}

/** The model sees any failure, and the run then ends without a watch. */
export async function subscribeConnectionEvent(
  serializedContext: Record<string, unknown>,
  binding: EventBinding,
): Promise<ConnectionEventSubscribeOutcome> {
  try {
    const ctx = await deserializeContext(serializedContext);
    const resolved = resolveBinding(ctx, binding);
    if (resolved === undefined)
      return { error: "This connection no longer accepts the subscription's binding." };
    const { connection, principal, backend } = resolved;
    const subscription = await withConnectionEventSpan(
      {
        ctx,
        connectionName: connection.connectionName,
        bindingId: binding.id,
        operation: "subscribe",
      },
      async () => {
        const adapter = await backend.createAdapter({
          principal,
          connection: { url: connection.url },
          destination: { path: connectionEventDestination(connection.connectionName) },
        });
        return adapter.subscribe({ ...binding.request, options: { timeout: 30_000 } });
      },
    );
    // Snapshot the SDK's readonly JSON into the run's owned state.
    return { subscription: structuredClone(subscription) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Starts the run that takes over this watch's hook, so no run's log grows without bound. */
export async function handOverConnectionEventStep(input: {
  readonly serializedContext: Record<string, unknown>;
  readonly binding: EventBinding;
  readonly subscription: ManagedEventSubscription;
  readonly receipts: ConnectionEventReceipts;
}): Promise<void> {
  "use step";
  await startWorkflowOnCurrentDeployment(connectionEventWorkflowReference, [
    {
      binding: input.binding,
      serializedContext: input.serializedContext,
      handover: { subscription: input.subscription, receipts: input.receipts },
    },
  ]);
}

/** Forwards a stop that reached a run after its successor took the hook. */
export async function retireConnectionEventStep(bindingId: string): Promise<void> {
  "use step";
  await retireConnectionEventOwner(bindingId);
}
