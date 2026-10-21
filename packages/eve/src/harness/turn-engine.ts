import type { GenerationSteering } from "#harness/generation-steering.js";
import { compactHistory } from "#harness/compaction/step.js";
import { runModelStep } from "#harness/model-call/run.js";
import { handleStepResult } from "#harness/step/after-model.js";
import type { Step } from "#harness/step/context.js";
import { prepareTurnInput, type TurnInput } from "#harness/step/intake.js";
import type { StepResult, HarnessStepInput } from "#harness/types.js";
import type { CallReceipt } from "#harness/session-machine/view.js";
import type { MessageContent } from "#shared/message-content.js";

export interface EngineStepResult extends StepResult {
  readonly engineSnapshot?: unknown;
}

/**
 * What runs the open turn's next step once the step has taken what arrived and run what people
 * approved. This is a trusted internal adapter, not a public engine API: the adapter must route
 * proposals through eve's gate and must not expose Step or its executable tools to the engine.
 * Results reach the engine through the steps its calls suspend.
 */
export interface TurnEngine {
  compact?(step: Step): Promise<StepResult>;
  prepareInput(
    step: Step,
    input: HarnessStepInput | undefined,
    options: { readonly consumedMessage: boolean },
  ): Promise<TurnInput>;
  run(
    step: Step,
    input: {
      readonly generation: GenerationSteering;
      readonly turn: TurnInput;
      readonly message?: MessageContent;
      readonly receipts: readonly CallReceipt[];
    },
  ): Promise<EngineStepResult>;
}

/** The native engine: one model call through the AI SDK, whose history is the session's. */
export const nativeTurnEngine: TurnEngine = {
  compact: compactHistory,
  prepareInput: prepareTurnInput,
  run: (step, { generation, turn }) =>
    runModelStep(step, {
      generation,
      onResponse: (response) => handleStepResult(step, response),
      turn,
    }),
};
