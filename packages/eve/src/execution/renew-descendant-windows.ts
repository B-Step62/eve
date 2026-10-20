import type { DurableSession } from "#execution/durable-session-store.js";
import { readTaskTable, startedTaskRuns } from "#execution/tasks/table.js";
import { ignoreGoneTarget } from "#execution/tasks/workflow-target.js";
import type { WorkflowToolRunControlMessage } from "#execution/tools/workflow/messages.js";
import { getBlockingWorkflowToolRuns } from "#harness/workflow-tool-runs.js";
import { resumeHook } from "#internal/workflow/runtime.js";

/**
 * Tells every running descendant run that an approval started a new usage
 * window, so the sessions they opened start one before their next budget
 * check. A task run that hasn't started has opened no session yet, and one it
 * opens later starts with a fresh window.
 */
export async function renewDescendantWindows(
  session: DurableSession,
  renewalId: string,
): Promise<void> {
  const message: WorkflowToolRunControlMessage = { kind: "renew-window", renewalId };
  const runs = [
    ...startedTaskRuns(readTaskTable(session.state)),
    ...getBlockingWorkflowToolRuns(session.state).map((run) => run.address),
  ];
  await Promise.all(runs.map((run) => ignoreGoneTarget(resumeHook(run.hookToken, message))));
}
