import { principalOf } from "#execution/session/principal.js";
import { deserializeContext, serializeContext } from "#context/serialize.js";
import { AuthKey, SessionIdKey } from "#context/keys.js";
import { withConnectionEventSpan } from "#tracing/eve/connection-events.js";
import { BundleKey } from "#runtime/sessions/runtime-context-keys.js";
import { createWorkflowRuntime } from "#execution/workflow-runtime.js";
import { createAttachSessionFn } from "#channel/session.js";
import type {
  ConnectionEventHandlerState,
  EventBinding,
} from "#runtime/connections/events/state.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
import {
  principalKey,
  resolveConnectionPrincipalFromAuth,
} from "#runtime/connections/principal.js";
import type { AlsContext } from "#context/container.js";

/** Re-checks the run's saved binding against the deployed connection before any work runs as its creator. */
export function resolveBinding(ctx: AlsContext, binding: EventBinding) {
  const connection = ctx
    .require(BundleKey)
    .resolvedAgent.connections.find(
      (connection) => connection.connectionName === binding.connectionName,
    );
  if (
    connection?.experimental_events === undefined ||
    binding.sessionId !== ctx.require(SessionIdKey) ||
    binding.instanceId !== connection.instanceId ||
    binding.executionPrincipal !== principalOf(binding.auth)
  )
    return undefined;
  const authorization = connection.authorization;
  if (
    authorization === undefined ||
    typeof authorization === "function" ||
    authorization.vercelConnect?.connector !== binding.connector ||
    authorization.vercelConnect.experimental_events === undefined
  )
    return undefined;
  const principal = resolveConnectionPrincipalFromAuth(
    connection.connectionName,
    authorization,
    binding.auth,
  );
  if (principalKey(principal) !== binding.principalKey) return undefined;
  return {
    binding,
    connection,
    principal,
    backend: authorization.vercelConnect.experimental_events,
  };
}

/** Context only locates the handler: the run's own binding and subscription decide acceptance. */
function accepts(state: ConnectionEventHandlerState, payload: ConnectionEventPayload): boolean {
  const { delivery } = payload;
  return (
    payload.bindingId === state.binding.id &&
    payload.connectionName === state.binding.connectionName &&
    delivery.subscriptionId === state.subscription.id &&
    !("event" in delivery && delivery.event.name !== state.binding.request.name)
  );
}

export async function prepareConnectionEventStep(input: {
  serializedContext: Record<string, unknown>;
  state: ConnectionEventHandlerState;
  payload: ConnectionEventPayload;
}) {
  "use step";
  const ctx = await deserializeContext(input.serializedContext);
  const { state, payload } = input;
  const result = (accepted: boolean, next = state) => ({
    accepted,
    state: next,
    serializedContext: serializeContext(ctx),
  });
  const { deliveryId } = payload.delivery;
  if (
    !accepts(state, payload) ||
    resolveBinding(ctx, state.binding) === undefined ||
    state.receipts[deliveryId] === "complete"
  )
    return result(false);
  return result(true, { ...state, receipts: { ...state.receipts, [deliveryId]: "pending" } });
}

export async function dispatchConnectionEventStep(input: {
  serializedContext: Record<string, unknown>;
  state: ConnectionEventHandlerState;
  payload: ConnectionEventPayload;
}) {
  "use step";
  const ctx = await deserializeContext(input.serializedContext);
  const resolved = accepts(input.state, input.payload)
    ? resolveBinding(ctx, input.state.binding)
    : undefined;
  if (resolved === undefined)
    return { serializedContext: input.serializedContext, state: input.state };
  const { binding, connection } = resolved;
  const state = input.state;
  const { delivery } = input.payload;
  if (state.receipts[delivery.deliveryId] !== "pending")
    return { serializedContext: input.serializedContext, state };
  const bundle = ctx.require(BundleKey);
  const callbacks = connection.experimental_events!;
  // The callback runs as its creator without replacing the last conversational caller.
  ctx.setVirtualContext(AuthKey, binding.auth);
  const operation =
    "event" in delivery ? "onEvent" : delivery.control.type === "gap" ? "onGap" : "onTerminated";
  await withConnectionEventSpan(
    {
      ctx,
      connectionName: connection.connectionName,
      operation,
      bindingId: binding.id,
      subscriptionId: delivery.subscriptionId,
      deliveryId: delivery.deliveryId,
      requestTraceContext: input.payload.requestTraceContext,
    },
    async (reference) => {
      const common = {
        auth: binding.auth,
        deliveryId: delivery.deliveryId,
        origin: {
          sessionId: binding.sessionId,
          connectionName: binding.connectionName,
          subscriptionId: delivery.subscriptionId,
        },
        attachSession: createAttachSessionFn(
          createWorkflowRuntime({ compiledArtifactsSource: bundle.compiledArtifactsSource }),
          {
            turnPolicy: "queue",
            channelKind: "mcp-events",
            channelName: binding.connectionName,
            requestId: delivery.deliveryId,
            requestTraceContext: reference,
          },
        ),
      };
      if ("event" in delivery) await callbacks.onEvent({ ...common, event: delivery.event });
      else if (delivery.control.type === "gap")
        await callbacks.onGap?.({
          ...common,
          cursor: delivery.control.cursor,
          truncated: delivery.control.truncated,
        });
      else await callbacks.onTerminated?.({ ...common, error: delivery.control.error });
    },
  );
  // Bound checkpoint size; durable external effects still use deliveryId as
  // their idempotency key when Connect redelivers beyond this recent window.
  const completed = Object.entries(state.receipts)
    .filter(([id, status]) => status === "complete" && id !== delivery.deliveryId)
    .slice(-999);
  const pending = Object.entries(state.receipts).filter(
    ([id, status]) => status === "pending" && id !== delivery.deliveryId,
  );
  const next: ConnectionEventHandlerState = {
    ...state,
    receipts: {
      ...Object.fromEntries([...completed, ...pending]),
      [delivery.deliveryId]: "complete",
    },
  };
  return { serializedContext: serializeContext(ctx), state: next };
}
