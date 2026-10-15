import { ContextContainer } from "#context/container.js";
import { AuthKey, SessionIdKey, SessionTraceSeedKey } from "#context/keys.js";
import { serializeContext } from "#context/serialize.js";
import { BundleKey, type CompiledBundle } from "#runtime/sessions/runtime-context-keys.js";
import type { ConnectionEventPayload } from "#runtime/connections/events/delivery.js";
import {
  CONNECTION_EVENT_SUBSCRIPTION_NAMESPACE,
  type ConnectionEventSubscribeOutcome,
  type ConnectionEventSubscribeResult,
  type EventBinding,
} from "#runtime/connections/events/state.js";
import {
  connectionEventDeliveryWorkflowReference,
  connectionEventWorkflowReference,
  startWorkflowOnCurrentDeployment,
} from "#execution/workflow-runtime.js";
import { getHookByToken, getRun, resumeHook } from "#internal/workflow/runtime.js";
import { HookNotFoundError } from "#compiled/@workflow/errors/index.js";
import { connectionEventHookToken } from "#runtime/connections/events/path.js";
import type { ManagedEventSubscription } from "#shared/connection-events.js";

/** Bounds the wait for a run's first step, which itself subscribes with a 30 s timeout. */
const SUBSCRIBE_OUTCOME_TIMEOUT_MS = 90_000;

/** The context a watch's runs execute in: its creator's auth and origin session. */
function bindingContext(binding: EventBinding, bundle: CompiledBundle): Record<string, unknown> {
  const ctx = new ContextContainer({ localDevRequest: undefined });
  ctx.set(BundleKey, bundle);
  ctx.set(AuthKey, binding.auth);
  if (binding.traceSeed !== undefined) ctx.set(SessionTraceSeedKey, binding.traceSeed);
  // This is origin metadata, not a conversation owner or a state snapshot.
  ctx.set(SessionIdKey, binding.sessionId);
  return serializeContext(ctx);
}

/**
 * Starts the watch's run, which subscribes once its hook is registered.
 * Returns undefined when the subscription is still being created after the
 * caller stops waiting: the watch exists under the binding's id either way.
 */
export async function startConnectionEventOwner(
  binding: EventBinding,
  bundle: CompiledBundle,
  signal?: AbortSignal,
): Promise<ManagedEventSubscription | undefined> {
  const run = await startWorkflowOnCurrentDeployment(connectionEventWorkflowReference, [
    { binding, serializedContext: bindingContext(binding, bundle) },
  ]);
  const outcome = await readSubscribeOutcome(run.runId, signal);
  return outcome && subscriptionFromOutcome(outcome);
}

/**
 * Starts a run for one delivery under the binding its watch's hook carries.
 * Returns false when the watch has ended, so the receiver can tell Connect.
 */
export async function startConnectionEventDelivery(
  payload: ConnectionEventPayload,
  bundle: CompiledBundle,
): Promise<boolean> {
  const watch = await findWatch(payload.bindingId);
  if (watch === undefined || !(await isLive(watch.runId))) return false;
  const { binding } = watch;
  await startWorkflowOnCurrentDeployment(connectionEventDeliveryWorkflowReference, [
    { binding, serializedContext: bindingContext(binding, bundle), payload },
  ]);
  return true;
}

async function findWatch(
  bindingId: string,
): Promise<{ runId: string; binding: EventBinding } | undefined> {
  try {
    const hook = await getHookByToken(connectionEventHookToken(bindingId));
    return { runId: hook.runId, binding: (await hook.metadata) as EventBinding };
  } catch (error) {
    if (HookNotFoundError.is(error)) return undefined;
    throw error;
  }
}

/** A watch's hook outlives its run; the run's status says whether the watch is still open. */
async function isLive(runId: string): Promise<boolean> {
  const status = await getRun(runId).status;
  return status === "pending" || status === "running";
}

/** Connect's refusal reaches the caller with its status, so a 401 is classified as a sign-in request. */
export function subscriptionFromOutcome(
  outcome: ConnectionEventSubscribeResult,
): ManagedEventSubscription {
  if ("error" in outcome) throw Object.assign(new Error(outcome.error), { status: outcome.status });
  return outcome.subscription;
}

/**
 * A watch, live or ended: who owns it and what it subscribed to. The
 * subscription is undefined while it is still being created.
 */
export async function findConnectionEventOwner(
  bindingId: string,
): Promise<
  { owner: EventBinding; subscription: ManagedEventSubscription | undefined } | undefined
> {
  const watch = await findWatch(bindingId);
  if (watch === undefined) return undefined;
  const outcome = await readSubscribeOutcome(watch.runId);
  if (outcome !== undefined && "error" in outcome) return undefined;
  return { owner: watch.binding, subscription: outcome?.subscription };
}

/** Ends the watch's run; an ended watch's hook has no run left to resume. */
export async function retireConnectionEventOwner(bindingId: string): Promise<void> {
  const watch = await findWatch(bindingId);
  if (watch === undefined || !(await isLive(watch.runId))) return;
  try {
    await resumeHook(connectionEventHookToken(bindingId), { kind: "retire" });
  } catch (error) {
    if (!HookNotFoundError.is(error)) throw error;
  }
}

/** What the run that owns this binding subscribed to, following a duplicate run to that owner. */
async function readSubscribeOutcome(
  runId: string,
  signal?: AbortSignal,
): Promise<ConnectionEventSubscribeResult | undefined> {
  const outcome = await readPublishedOutcome(runId, signal);
  if (outcome === undefined || !("ownerRunId" in outcome)) return outcome;
  const owned = await readPublishedOutcome(outcome.ownerRunId, signal);
  if (owned !== undefined && "ownerRunId" in owned)
    throw new Error("Event handler ownership did not resolve.");
  return owned;
}

/** The run's published outcome, or undefined if the caller stops waiting before it is published. */
async function readPublishedOutcome(
  runId: string,
  signal?: AbortSignal,
): Promise<ConnectionEventSubscribeOutcome | undefined> {
  const reader = getRun(runId)
    .getReadable<ConnectionEventSubscribeOutcome>({
      namespace: CONNECTION_EVENT_SUBSCRIPTION_NAMESPACE,
    })
    .getReader();
  const deadline = AbortSignal.any([
    AbortSignal.timeout(SUBSCRIBE_OUTCOME_TIMEOUT_MS),
    ...(signal === undefined ? [] : [signal]),
  ]);
  const abandoned = new Promise<{ value: undefined; abandoned: true }>((resolve) => {
    const abort = () => resolve({ value: undefined, abandoned: true });
    if (deadline.aborted) abort();
    else deadline.addEventListener("abort", abort, { once: true });
  });
  try {
    const read = await Promise.race([reader.read(), abandoned]);
    if ("abandoned" in read) return undefined;
    if (read.value === undefined) throw new Error("Event handler ended before subscribing.");
    return read.value;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
