import type { CodeModeRunInput } from "#execution/code-mode-run/types.js";
import {
  codeModeRunWorkflowReference,
  startWorkflowPreferLatest,
  waitForCommandHookOwner,
} from "#execution/workflow-runtime.js";
import { deriveAgentOperationId } from "#harness/handles/operation-id.js";
import { HookNotFoundError } from "#compiled/@workflow/errors/index.js";
import { getHookByToken } from "#internal/workflow/runtime.js";

export function deriveCodeModeRunHookToken(input: {
  readonly callId: string;
  readonly parentSessionId: string;
  readonly parentTurnId: string;
}): string {
  return `eve:code-mode-run:${deriveAgentOperationId(input)}`;
}

export async function startCodeModeRun(
  input: Omit<CodeModeRunInput, "hookToken">,
): Promise<{ readonly hookToken: string; readonly runId: string }> {
  const hookToken = deriveCodeModeRunHookToken(input);
  try {
    const existing = await getHookByToken(hookToken);
    if (
      typeof existing === "object" &&
      existing !== null &&
      "runId" in existing &&
      typeof existing.runId === "string"
    ) {
      return { hookToken, runId: existing.runId };
    }
  } catch (error) {
    if (!HookNotFoundError.is(error)) throw error;
  }
  await startWorkflowPreferLatest(codeModeRunWorkflowReference, [{ ...input, hookToken }]);
  const owner = await waitForCommandHookOwner(hookToken);
  return { hookToken, runId: owner.runId };
}
