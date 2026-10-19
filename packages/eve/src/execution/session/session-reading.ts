import type { SessionReading } from "#execution/session/scheduler/next.js";
import { readTaskTable, taskWaitResult, workingTasks } from "#execution/tasks/table.js";
import { activeTurnId, storedProjection, turnPosition } from "#harness/session-machine/view.js";
import type { SessionStateMap } from "#harness/types.js";
import { isInboxToolResultFromRecordedWorkflowToolRun } from "#harness/workflow-tool-runs.js";
import { activeTurnIdOf } from "#protocol/session-projection.js";
import { openRequests } from "#protocol/session-reader.js";

/**
 * What the scheduler reads of a session: its durable `state`, read when the scheduler asks, and
 * what only the world around the session knows, such as who its context acts as.
 */
export function sessionReading(
  state: () => SessionStateMap | undefined,
  world: Pick<
    SessionReading,
    "canAskPeople" | "contextPrincipal" | "earlierRemoteCaller" | "inboxPending" | "now"
  >,
): SessionReading {
  const projection = () => storedProjection(state());
  return {
    ...world,
    budgetOpen: () => openRequests(projection().view).some((row) => row.request.kind === "budget"),
    onStream: (deliveryId) => projection().view.deliveries[deliveryId] !== undefined,
    openTurnId: () => activeTurnIdOf(projection()),
    recordedRun: (result) =>
      result.kind === "tool-result" &&
      isInboxToolResultFromRecordedWorkflowToolRun(state(), result),
    taskWait: (wake) => taskWaitResult(readTaskTable(state()), wake),
    turnId: () => activeTurnId(turnPosition(projection())),
    workingTasks: () => workingTasks(readTaskTable(state())).length > 0,
  };
}
