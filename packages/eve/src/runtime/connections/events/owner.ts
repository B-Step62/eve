import { ContextContainer } from "#context/container.js";
import { AuthKey, SessionIdKey, SessionTraceSeedKey } from "#context/keys.js";
import { serializeContext } from "#context/serialize.js";
import { BundleKey, type CompiledBundle } from "#runtime/sessions/runtime-context-keys.js";
import { ConnectionEventsStateKey, type EventBinding } from "#runtime/connections/events/state.js";
import {
  connectionEventWorkflowReference,
  pollUntil,
  startWorkflowOnCurrentDeployment,
} from "#execution/workflow-runtime.js";
import { getHookByToken, resumeHook } from "#internal/workflow/runtime.js";
import { HookNotFoundError } from "#compiled/@workflow/errors/index.js";
import { connectionEventHookToken } from "#runtime/connections/events/workflow.js";

export async function startConnectionEventOwner(
  binding: EventBinding,
  bundle: CompiledBundle,
): Promise<void> {
  const ctx = new ContextContainer({ localDevRequest: undefined });
  ctx.set(BundleKey, bundle);
  ctx.set(AuthKey, binding.auth);
  if (binding.traceSeed !== undefined) ctx.set(SessionTraceSeedKey, binding.traceSeed);
  // This is origin metadata, not a conversation owner or a state snapshot.
  ctx.set(SessionIdKey, binding.sessionId);
  ctx.set(ConnectionEventsStateKey, { bindings: { [binding.id]: binding }, receipts: {} });
  await startWorkflowOnCurrentDeployment(connectionEventWorkflowReference, [
    {
      bindingId: binding.id,
      serializedContext: serializeContext(ctx),
    },
  ]);
  const registered = await pollUntil(async () => {
    try {
      return await getHookByToken(connectionEventHookToken(binding.id));
    } catch (error) {
      if (HookNotFoundError.is(error)) return undefined;
      throw error;
    }
  }, 30_000);
  if (registered === undefined) throw new Error("Event handler registration timed out.");
}

export async function retireConnectionEventOwner(bindingId: string): Promise<void> {
  try {
    await resumeHook(connectionEventHookToken(bindingId), { kind: "retire" });
  } catch (error) {
    if (!HookNotFoundError.is(error)) throw error;
  }
}
