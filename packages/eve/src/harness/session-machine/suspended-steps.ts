// The response a step suspends while its calls run, and where their results go in it: a step
// releases once every call it made has a result, so an engine never reads a call without one. A
// native step commits its response to history; an opaque-history engine's results wait, private,
// as a receipt the engine reads next.

import type { ModelMessage, ToolCallPart } from "ai";

import type { StepTranscript, SuspendedStep, ToolResultPart, TurnState } from "./state.js";
import { answeredStepCallIds } from "./view.js";

export type { ToolResultPart } from "./state.js";

/** The turn with `step` suspended after the steps it already holds. */
export function suspend(turn: TurnState, step: SuspendedStep): TurnState {
  return { ...turn, suspended: [...turn.suspended, step] };
}

/** The ids of the calls a step made, except provider-executed ones. */
export function stepCallIds(step: StepTranscript): ReadonlySet<string> {
  if ("proposed" in step) return new Set(step.proposed.calls.map((call) => call.callId));
  const ids = new Set<string>();
  for (const message of step.messages) {
    if (message.role !== "assistant" || typeof message.content === "string") continue;
    for (const part of message.content) {
      if (part.type === "tool-call" && part.providerExecuted !== true) ids.add(part.toolCallId);
    }
  }
  return ids;
}

/** Every call the step made has a result: a pending approval's call has none yet. */
export function isComplete(step: StepTranscript): boolean {
  const answered = answeredStepCallIds(step);
  return [...stepCallIds(step)].every((callId) => answered.has(callId));
}

/** The step with `result` joined to the call that made it. */
export function withStepResult(step: SuspendedStep, result: ToolResultPart): SuspendedStep {
  if ("messages" in step) return { ...step, messages: withResult(step.messages, result) };
  const { calls, results } = step.proposed;
  const call = calls.find((proposed) => proposed.callId === result.toolCallId);
  const part = call === undefined ? result : { ...result, toolName: call.toolName };
  return {
    ...step,
    proposed: {
      calls,
      results: [...results.filter((other) => other.toolCallId !== part.toolCallId), part],
    },
  };
}

/** The step without the results of the calls in `callIds`, which stay as unanswered calls. */
export function withoutStepResults(
  step: SuspendedStep,
  callIds: ReadonlySet<string>,
): SuspendedStep {
  if ("messages" in step) return { ...step, messages: withoutResults(step.messages, callIds) };
  const { calls, results } = step.proposed;
  return {
    ...step,
    proposed: { calls, results: results.filter((part) => !callIds.has(part.toolCallId)) },
  };
}

/**
 * The step with every call that has no result answered with `output`. Provider-executed calls
 * answer themselves.
 */
export function withUnansweredResults(
  step: SuspendedStep,
  output: ToolResultPart["output"],
): SuspendedStep {
  const answered = answeredStepCallIds(step);
  const unanswered =
    "proposed" in step
      ? step.proposed.calls
      : step.messages.flatMap((message) =>
          message.role !== "assistant" || typeof message.content === "string"
            ? []
            : message.content.flatMap((part) =>
                part.type === "tool-call" && part.providerExecuted !== true
                  ? [{ callId: part.toolCallId, toolName: part.toolName }]
                  : [],
              ),
        );
  return unanswered
    .filter((call) => !answered.has(call.callId))
    .reduce(
      (next, call) =>
        withStepResult(next, {
          output,
          toolCallId: call.callId,
          toolName: call.toolName,
          type: "tool-result",
        }),
      step,
    );
}

/**
 * The turn once `done` leave it: a native step's response commits to history, and an
 * opaque-history engine's results wait as a receipt its engine reads next.
 */
export function release(
  turn: TurnState,
  done: readonly SuspendedStep[],
): { readonly commit: ModelMessage[]; readonly turn: TurnState } {
  const commit: ModelMessage[] = [];
  const receipts = [...(turn.receipts ?? [])];
  for (const step of done) {
    if ("messages" in step) commit.push(...step.messages);
    else receipts.push({ event: step.event, results: step.proposed.results });
  }
  return {
    commit,
    turn: {
      ...turn,
      suspended: turn.suspended.filter((step) => !done.includes(step)),
      ...(receipts.length > 0 && { receipts }),
    },
  };
}

/**
 * Places a result right after the message that made its call, under the call's name: a call
 * made through `eve__tool` or `eve__skill` keeps that name in history, whatever entry it ran.
 */
export function withResult(
  messages: readonly ModelMessage[],
  result: ToolResultPart,
): ModelMessage[] {
  const next = [...messages];
  const asking = findCall(next, result.toolCallId);
  if (asking === undefined) {
    next.push({ content: [result], role: "tool" });
    return next;
  }
  const part = { ...result, toolName: asking.call.toolName };
  const following = next[asking.index + 1];
  if (following?.role === "tool") {
    next[asking.index + 1] = { ...following, content: [...following.content, part] };
  } else {
    next.splice(asking.index + 1, 0, { content: [part], role: "tool" });
  }
  return next;
}

/** The messages without the results of the calls in `callIds`, which stay as unanswered calls. */
export function withoutResults(
  messages: readonly ModelMessage[],
  callIds: ReadonlySet<string>,
): ModelMessage[] {
  return messages.flatMap((message): ModelMessage[] => {
    if (message.role !== "tool") return [message];
    const content = message.content.filter(
      (part) => part.type !== "tool-result" || !callIds.has(part.toolCallId),
    );
    return content.length === 0 ? [] : [{ ...message, content }];
  });
}

/** The call with this id, and the index of the message that made it. */
function findCall(
  messages: readonly ModelMessage[],
  callId: string,
): { readonly call: ToolCallPart; readonly index: number } | undefined {
  for (const [index, message] of messages.entries()) {
    if (message.role !== "assistant" || typeof message.content === "string") continue;
    const call = message.content.find(
      (content): content is ToolCallPart =>
        content.type === "tool-call" && content.toolCallId === callId,
    );
    if (call !== undefined) return { call, index };
  }
  return undefined;
}
