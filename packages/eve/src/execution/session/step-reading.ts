import { sessionView } from "#harness/session-machine/commit.js";
import { ownOpenRequestIds, runtimeWait, storedProjection } from "#harness/session-machine/view.js";
import { hasQueuedTurnInput } from "#harness/step/park.js";
import { readTaskTable, tasksWithResults, workingTasks } from "#execution/tasks/table.js";
import type { HarnessSession, StepResult } from "#harness/types.js";
import { activeTurn, openWork } from "#protocol/session-projection/selectors.js";
import type { StepState } from "./step-decision.js";

/** Samples the fold, private continuations, and the engine's reported progress. */
export function readStepState(
  session: Pick<HarnessSession, "state">,
  engineReading?: StepResult["engineReading"],
): StepState {
  const projection = storedProjection(session.state);
  const tables = projection.view;
  const machine = sessionView(projection, session.state);
  const turnId = activeTurn(tables)?.turnId;
  const tasks = readTaskTable(session.state);
  const calls = runtimeWait(session.state);
  return {
    ended: tables.session.status === "ended",
    queuedInput: hasQueuedTurnInput(machine),
    requestIds: [...ownOpenRequestIds(machine)],
    signIns: machine.signIns,
    turnOpen: turnId !== undefined,
    unreadInput:
      engineReading?.unreadInput === true ||
      (machine.turn.receipts?.length ?? 0) > 0 ||
      tasksWithResults(tasks).length > 0,
    unweighedAnswers:
      turnId !== undefined &&
      (() => {
        const open = openWork(tables, { turnId });
        const signingIn = new Set(
          open.interactions.flatMap((row) =>
            "responseId" in row.subject ? [row.subject.responseId] : [],
          ),
        );
        return open.responses.some(
          (response) =>
            response.status === "submitted" &&
            !signingIn.has(response.responseId) &&
            tables.interactions[response.interactionId]?.origin === undefined,
        );
      })(),
    workingTaskIds: workingTasks(tasks).map((record) => record.id),
    ...(calls !== undefined && {
      calls: {
        callIds: calls.callIds,
        // Runs dispatch once; a call whose run already started needs none.
        dispatch: calls.tasks.some((task) => {
          const status = tables.calls[task.callId]?.status;
          return status === undefined || status === "requested";
        }),
        taskToolCalls: calls.taskToolCalls,
      },
    }),
  };
}
