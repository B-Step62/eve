import { createHook } from "#compiled/@workflow/core/index.js";

import { claimHookOwnership, disposeHook, isHookConflictError } from "#execution/hook-ownership.js";
import type {
  CodeModeRunInput,
  CodeModeRunOutcome,
  CodeModeRunReady,
} from "#execution/code-mode-run/types.js";
import { executeCodeModeProgramStep } from "#execution/code-mode-run/execute-step.js";
import { sendCodeModeOutcomeStep } from "#execution/code-mode-run/outcome-step.js";
import type { RuntimeToolResultActionResult } from "#shared/action-types.js";

export async function codeModeRunWorkflow(input: CodeModeRunInput): Promise<void> {
  "use workflow";

  const ownership = createHook<CodeModeRunReady>({ token: input.hookToken });
  const iterator = ownership[Symbol.asyncIterator]();
  let ownsHook = false;
  try {
    try {
      await claimHookOwnership(ownership);
      ownsHook = true;
    } catch (error) {
      if (isHookConflictError(error)) return;
      throw error;
    }

    const ready = await iterator.next();
    if (ready.done === true || ready.value.kind !== "ready") {
      throw new Error("code_mode run ended before the parent committed its ownership record");
    }

    let executed: Awaited<ReturnType<typeof executeCodeModeProgramStep>>;
    try {
      executed = await executeCodeModeProgramStep({
        run: input,
        sessionState: ready.value.sessionState,
      });
    } catch {
      executed = {
        outcome: {
          code: "CODE_MODE_EXECUTION_LOST",
          message: "The code-mode execution was abandoned after it began and was not replayed.",
          partialEffectsPossible: true,
          retryable: false,
          status: "failed",
        },
        sessionState: ready.value.sessionState,
      };
    }
    const outcome: CodeModeRunOutcome = executed.outcome;

    const result: RuntimeToolResultActionResult =
      outcome.status === "completed"
        ? {
            callId: input.callId,
            kind: "tool-result",
            output: outcome.output,
            toolName: "code_mode",
          }
        : {
            callId: input.callId,
            isError: true,
            kind: "tool-result",
            output: outcome,
            toolName: "code_mode",
          };
    await sendCodeModeOutcomeStep({
      parentInboxToken: input.parentInboxToken,
      result,
      sessionState: executed.sessionState,
    });
  } finally {
    if (ownsHook) await disposeHook(ownership);
  }
}
