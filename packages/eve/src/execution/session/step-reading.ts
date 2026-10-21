import { sessionView } from "#harness/session-machine/commit.js";
import { ownOpenRequestIds, runtimeWait, storedProjection } from "#harness/session-machine/view.js";
import { hasQueuedTurnInput } from "#harness/step/park.js";
import { readTaskTable, tasksWithResults, workingTasks } from "#execution/tasks/table.js";
import type { HarnessSession } from "#harness/types.js";
import { activeTurn, openWork } from "#protocol/session-projection/selectors.js";
import type { StepState } from "./step-decision.js";
import type { HarnessModelMessage } from "#harness/messages.js";

/**
 * Samples private records, native-engine history, and opaque-history engines' receipts before a
 * synchronous step decision.
 */
export function readStepState(session: Pick<HarnessSession, "history" | "state">): StepState {
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
      awaitsModel(session.history) ||
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

/**
 * Whether the native history ends on input the model hasn't answered: a person's message, a
 * tool's result, or a provider's tool result after the model's last text.
 */
export function awaitsModel(history: readonly HarnessModelMessage[]): boolean {
  const last = history.at(-1);
  if (last === undefined) return false;
  if (last.role !== "assistant") return last.role === "user" || last.role === "tool";
  if (!Array.isArray(last.content)) return false;
  let result = -1;
  let text = -1;
  last.content.forEach((part, index) => {
    if (part.type === "tool-result") result = index;
    else if (part.type === "text" && part.text.trim().length > 0) text = index;
  });
  return result > text;
}
