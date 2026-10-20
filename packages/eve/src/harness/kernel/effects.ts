// EXPERIMENTAL (kernel-spike): runs the kernel's effects with eve's own model
// and tools, and publishes eve's protocol events for them.
//
// A model call publishes `step.started` (through the session machine),
// `message.*`, and `actions.requested`. Its `step.completed` waits until the
// call's tools have results, as in eve's harness, so it is kept on the
// session and published before the next model call or the turn's end.

import type { LanguageModelV4, LanguageModelV4Prompt } from "@ai-sdk/provider";

import type {
  KernelEffectRequest,
  KernelEffectResult,
  KernelMessage,
  KernelToolCall,
} from "#harness/kernel/contract.js";
import { startStep } from "#harness/session-machine/transitions.js";
import type { Step } from "#harness/step/context.js";
import { requireSessionModelReference } from "#harness/types.js";
import {
  type AssistantStepFinishReason,
  createActionResultEvent,
  createActionsRequestedEvent,
  createMessageAppendedEvent,
  createMessageCompletedEvent,
  createStepCompletedEvent,
} from "#protocol/message.js";
import type { RuntimeToolResultActionResult } from "#shared/action-types.js";
import type { JsonObject, JsonValue } from "#shared/json.js";

const PENDING_STEP = "eve.kernelPendingStep";

interface PendingStep {
  readonly finishReason: AssistantStepFinishReason;
  readonly sequence: number;
  readonly stepIndex: number;
  readonly turnId: string;
}

function setPendingStep(step: Step, pending: PendingStep | undefined): void {
  step.session = { ...step.session, state: { ...step.session.state, [PENDING_STEP]: pending } };
}

/** Publishes the last model call's `step.completed`, once its tools are done. */
export async function flushStepCompleted(step: Step): Promise<void> {
  const pending = step.session.state?.[PENDING_STEP] as PendingStep | undefined;
  if (pending === undefined) return;
  await step.publish(createStepCompletedEvent(pending));
  setPendingStep(step, undefined);
}

export async function runKernelEffect(
  step: Step,
  request: KernelEffectRequest,
): Promise<KernelEffectResult> {
  const effect = request.effect;
  if (effect.kind === "model_call")
    return await runModelCall(step, effect.request.messages, effect.request.system);
  if (effect.kind === "tool_call")
    return await runToolCall(step, effect.call_id, effect.name, effect.input);
  await new Promise((resolve) => setTimeout(resolve, effect.ms));
  return { status: "completed", output: null };
}

async function runModelCall(
  step: Step,
  messages: readonly KernelMessage[],
  system: string,
): Promise<KernelEffectResult> {
  await flushStepCompleted(step);
  const reference = requireSessionModelReference(step.session);
  await step.apply(startStep(step.view(), { modelId: reference.id }));
  const position = step.position();
  const at = {
    sequence: position.sequence,
    stepIndex: position.stepIndex,
    turnId: position.turnId,
  };
  const model = await step.config.resolveModel(reference);
  if (typeof model === "string") {
    return {
      status: "failed",
      error: `The kernel prototype needs a model object, not "${model}".`,
    };
  }
  const tools = [...step.config.tools.values()].map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    inputSchema: { type: "object" as const },
  }));
  let result;
  try {
    result = await (model as LanguageModelV4).doGenerate({
      prompt: toPrompt(system, messages),
      tools,
      abortSignal: step.config.abortSignal,
    });
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
  const text = result.content
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
  const toolCalls: KernelToolCall[] = result.content.flatMap((p) =>
    p.type === "tool-call"
      ? [{ id: p.toolCallId, name: p.toolName, input: parseInput(p.input) }]
      : [],
  );
  const finishReason: AssistantStepFinishReason = toolCalls.length > 0 ? "tool-calls" : "stop";
  if (text !== "") {
    await step.publish(createMessageAppendedEvent({ ...at, messageDelta: text }));
    await step.publish(createMessageCompletedEvent({ ...at, finishReason, message: text }));
  }
  if (toolCalls.length > 0) {
    await step.publish(
      createActionsRequestedEvent({
        ...at,
        actions: toolCalls.map((c) => ({
          callId: c.id,
          input: c.input as JsonObject,
          kind: "tool-call" as const,
          toolName: c.name,
        })),
      }),
    );
  }
  setPendingStep(step, { ...at, finishReason });
  return { status: "completed", output: { text, tool_calls: toolCalls } };
}

async function runToolCall(
  step: Step,
  callId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<KernelEffectResult> {
  const pending = step.session.state?.[PENDING_STEP] as PendingStep | undefined;
  const position = step.position();
  const at = pending ?? {
    sequence: position.sequence,
    stepIndex: position.stepIndex,
    turnId: position.turnId,
  };
  const definition = step.config.tools.get(name);
  let output: unknown;
  let isError = false;
  try {
    if (definition?.execute === undefined) throw new Error(`No tool ${name}.`);
    output = await definition.execute(input, { toolCallId: callId, messages: [] });
  } catch (error) {
    output = error instanceof Error ? error.message : String(error);
    isError = true;
  }
  const result: {
    -readonly [K in keyof RuntimeToolResultActionResult]: RuntimeToolResultActionResult[K];
  } = {
    callId,
    kind: "tool-result",
    output: (output ?? null) as JsonValue,
    toolName: name,
  };
  if (isError) result.isError = true;
  await step.publish(
    createActionResultEvent({
      sequence: at.sequence,
      stepIndex: at.stepIndex,
      turnId: at.turnId,
      result,
    }),
  );
  return isError ? { status: "failed", error: String(output) } : { status: "completed", output };
}

function parseInput(input: unknown): Record<string, unknown> {
  if (typeof input !== "string") return (input ?? {}) as Record<string, unknown>;
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toPrompt(system: string, messages: readonly KernelMessage[]): LanguageModelV4Prompt {
  const prompt: LanguageModelV4Prompt = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user" || m.role === "steering") {
      prompt.push({ role: "user", content: [{ type: "text", text: m.text }] });
    } else if (m.role === "assistant") {
      prompt.push({
        role: "assistant",
        content: [
          ...(m.text === "" ? [] : [{ type: "text" as const, text: m.text }]),
          ...m.tool_calls.map((c) => ({
            type: "tool-call" as const,
            toolCallId: c.id,
            toolName: c.name,
            input: c.input,
          })),
        ],
      });
    } else if (m.role === "tool") {
      prompt.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: m.call_id,
            toolName: m.name,
            output: m.is_error
              ? { type: "error-text", value: m.content }
              : { type: "text", value: m.content },
          },
        ],
      });
    }
  }
  return prompt;
}
