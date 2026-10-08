import { contextStorage, type ContextContainer } from "#context/container.js";
import { AuthKey, TurnDeliveryIdsKey } from "#context/keys.js";
import { preserveSerializedSessionDynamicModelSelection } from "#context/serialized-dynamic-model-selection.js";
import { serializeContext } from "#context/serialize.js";
import { preserveCancelledTurnMessage } from "#execution/cancelled-turn-message.js";
import { createDurableSessionValues } from "#execution/durable-session-store.js";
import type { DurableStepResult } from "#execution/session/turn-step-types.js";
import type { HarnessSession, StepInput, StepResult } from "#harness/types.js";
import { appliedSession, saveSessionProjection } from "#harness/session-machine/current.js";
import { preserveSerializedInstrumentationState } from "#instrumentation/state.js";
import { preserveSerializedAgentTraceState } from "#tracing/agent-trace-context-store.js";

export interface CompletedModelCallCheckpoint {
  readonly result: StepResult;
  readonly serializedContext: Record<string, unknown>;
}

/**
 * The session the cut call applied, or the one the batch started with, with the delivery's message
 * kept in history, as an ordinary cancelled turn's message is. A message the call deferred behind
 * the answers it resolved is kept instead, so it reaches the model once.
 */
async function cancelledWithoutCheckpoint(
  ctx: ContextContainer,
  initial: HarnessSession,
  stepInput: StepInput | undefined,
): Promise<HarnessSession> {
  const applied = appliedSession<HarnessSession>(ctx);
  const preserved =
    applied?.deferredMessage === undefined
      ? stepInput
      : { ...stepInput, message: applied.deferredMessage };
  return await contextStorage.run(ctx, () =>
    preserveCancelledTurnMessage(applied?.session ?? initial, preserved),
  );
}

/** Builds the successful step result that commits a cancelled batch's completed model calls. */
export async function createCancelledModelCallBatchResult(input: {
  readonly beforeBatchContext: Record<string, unknown>;
  readonly checkpoint: CompletedModelCallCheckpoint | undefined;
  readonly ctx: ContextContainer;
  readonly initialSession: HarnessSession;
  readonly stepInput: StepInput | undefined;
}): Promise<DurableStepResult> {
  const interruptedContext = serializeContext(input.ctx);
  // Without a completed call, the batch keeps what its last call applied before the cut, such as
  // answers it resolved and published, so the session never rolls back past its own events.
  const cancelledSession =
    input.checkpoint?.result.session ??
    (await cancelledWithoutCheckpoint(input.ctx, input.initialSession, input.stepInput));
  // The stream keeps every event the cancelled batch published, so the projection does too.
  const checkpointContext = {
    ...(input.checkpoint?.serializedContext ?? input.beforeBatchContext),
    [AuthKey.name]: interruptedContext[AuthKey.name],
    [TurnDeliveryIdsKey.name]: interruptedContext[TurnDeliveryIdsKey.name],
  };

  return {
    action: "cancelled",
    serializedContext: preserveSerializedInstrumentationState(
      preserveSerializedAgentTraceState(
        preserveSerializedSessionDynamicModelSelection(checkpointContext, interruptedContext),
        interruptedContext,
      ),
      interruptedContext,
    ),
    ...createDurableSessionValues(saveSessionProjection(cancelledSession, input.ctx)),
  };
}
