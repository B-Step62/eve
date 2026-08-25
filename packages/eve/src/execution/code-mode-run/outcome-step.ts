import { resumeHook } from "#internal/workflow/runtime.js";
import type { RuntimeToolResultActionResult } from "#shared/action-types.js";
import type { DurableSessionState } from "#execution/durable-session-store.js";

export async function sendCodeModeOutcomeStep(input: {
  readonly parentInboxToken: string;
  readonly result: RuntimeToolResultActionResult;
  readonly sessionState: DurableSessionState;
}): Promise<void> {
  "use step";

  await resumeHook(input.parentInboxToken, {
    kind: "code-mode-result",
    result: input.result,
    sessionState: input.sessionState,
  });
}
