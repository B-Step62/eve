import type { WorkflowToolRunControlMessage } from "#execution/tools/workflow/messages.js";
import type { WorkflowToolRunAddress } from "#execution/tools/workflow/types.js";
import { isTaskWorkflowTargetGone } from "#execution/tasks/workflow-target.js";
import { getRun, resumeHook } from "#internal/workflow/runtime.js";

const INTERRUPT: WorkflowToolRunControlMessage = { kind: "interrupt" };

/**
 * Aborts the `execute` call's `abortSignal`. Only a finished run makes a missing
 * hook moot: a fresh run may not have registered its hook yet. Let the durable
 * step retry delivery in that case instead of silently losing the interrupt.
 */
export async function interruptWorkflowToolRun(run: WorkflowToolRunAddress): Promise<void> {
  "use step";

  try {
    await resumeHook(run.hookToken, INTERRUPT);
  } catch (error) {
    if (!isTaskWorkflowTargetGone(error)) throw error;
    try {
      const status = await getRun(run.runId).status;
      if (status !== "pending" && status !== "running") return;
    } catch (statusError) {
      if (isTaskWorkflowTargetGone(statusError)) return;
      throw statusError;
    }
    throw error;
  }
}
