import { ContextContainer } from "#context/container.js";
import { AuthKey, SessionIdKey, SessionTraceSeedKey } from "#context/keys.js";
import { serializeContext } from "#context/serialize.js";
import { BundleKey, type CompiledBundle } from "#runtime/sessions/runtime-context-keys.js";
import {
  CONNECTION_EVENT_SUBSCRIPTION_NAMESPACE,
  type ConnectionEventSubscribeOutcome,
  type EventBinding,
  type EventOwner,
} from "#runtime/connections/events/state.js";
import {
  connectionEventWorkflowReference,
  startWorkflowOnCurrentDeployment,
} from "#execution/workflow-runtime.js";
import { getHookByToken, getRun, resumeHook } from "#internal/workflow/runtime.js";
import { HookNotFoundError } from "#compiled/@workflow/errors/index.js";
import { connectionEventHookToken } from "#runtime/connections/events/path.js";
import type { ManagedEventSubscription } from "#shared/connection-events.js";

/** Bounds the wait for a run's first step, which itself subscribes with a 30 s timeout. */
const SUBSCRIBE_OUTCOME_TIMEOUT_MS = 90_000;

/** Starts the watch's handler run, which subscribes once its hook is registered. */
export async function startConnectionEventOwner(
  binding: EventBinding,
  bundle: CompiledBundle,
  signal?: AbortSignal,
): Promise<ManagedEventSubscription> {
  const ctx = new ContextContainer({ localDevRequest: undefined });
  ctx.set(BundleKey, bundle);
  ctx.set(AuthKey, binding.auth);
  if (binding.traceSeed !== undefined) ctx.set(SessionTraceSeedKey, binding.traceSeed);
  // This is origin metadata, not a conversation owner or a state snapshot.
  ctx.set(SessionIdKey, binding.sessionId);
  const run = await startWorkflowOnCurrentDeployment(connectionEventWorkflowReference, [
    { binding, serializedContext: serializeContext(ctx) },
  ]);
  const outcome = await readSubscribeOutcome(run.runId, signal);
  if ("error" in outcome) throw new Error(outcome.error);
  return outcome.subscription;
}

/** The live handler for a watch: who owns it and what it subscribed to. */
export async function findConnectionEventOwner(
  bindingId: string,
): Promise<{ owner: EventOwner; subscription: ManagedEventSubscription } | undefined> {
  let hook: Awaited<ReturnType<typeof getHookByToken>>;
  try {
    hook = await getHookByToken(connectionEventHookToken(bindingId));
  } catch (error) {
    if (HookNotFoundError.is(error)) return undefined;
    throw error;
  }
  const owner = (await hook.metadata) as EventOwner;
  const outcome = await readSubscribeOutcome(hook.runId);
  return "error" in outcome ? undefined : { owner, subscription: outcome.subscription };
}

export async function retireConnectionEventOwner(bindingId: string): Promise<void> {
  try {
    await resumeHook(connectionEventHookToken(bindingId), { kind: "retire" });
  } catch (error) {
    if (!HookNotFoundError.is(error)) throw error;
  }
}

async function readSubscribeOutcome(
  runId: string,
  signal?: AbortSignal,
): Promise<ConnectionEventSubscribeOutcome> {
  const reader = getRun(runId)
    .getReadable<ConnectionEventSubscribeOutcome>({
      namespace: CONNECTION_EVENT_SUBSCRIPTION_NAMESPACE,
    })
    .getReader();
  const deadline = AbortSignal.any([
    AbortSignal.timeout(SUBSCRIBE_OUTCOME_TIMEOUT_MS),
    ...(signal === undefined ? [] : [signal]),
  ]);
  const abandoned = new Promise<never>((_, reject) => {
    const abort = () => reject(deadline.reason);
    if (deadline.aborted) abort();
    else deadline.addEventListener("abort", abort, { once: true });
  });
  try {
    const { value } = await Promise.race([reader.read(), abandoned]);
    if (value === undefined) throw new Error("Event handler ended before subscribing.");
    return value;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
