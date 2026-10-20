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
import { classifyModelCallError } from "#harness/model-call/errors.js";
import { evaluateApproval } from "#harness/tools.js";
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
  approvedTools: ReadonlySet<string>,
): Promise<KernelEffectResult> {
  const effect = request.effect;
  switch (effect.kind) {
    case "model_call":
      return effect.purpose === "agent"
        ? await runModelCall(step, effect.request.messages, effect.request.system)
        : await runSideModelCall(step, effect.request.messages, effect.request.system);
    case "tool_call":
      return await runToolCall(step, effect.call_id, effect.name, effect.input);
    case "policy_decide":
      return await decideByToolPolicy(step, effect, approvedTools);
    case "wait":
      await new Promise((resolve) => setTimeout(resolve, effect.ms));
      return { status: "completed", output: null };
    case "user_ask":
    case "blob_put":
      // `user_ask` parks the turn in the harness; eve keeps no compaction records.
      throw new Error(`The kernel harness does not run ${effect.kind} as an effect.`);
  }
}

/** The tool's own eve policy function decides (kernel approval `host`). */
async function decideByToolPolicy(
  step: Step,
  call: {
    readonly call_id: string;
    readonly name: string;
    readonly input: Record<string, unknown>;
  },
  approvedTools: ReadonlySet<string>,
): Promise<KernelEffectResult> {
  const definition = step.config.tools.get(call.name);
  if (definition === undefined) return { status: "completed", output: { decision: "default" } };
  const status = await evaluateApproval(definition, {
    abortSignal: step.config.abortSignal,
    approvedTools,
    callId: call.call_id,
    input: call.input,
    recheck: false,
  });
  if (status === undefined || status === "not-applicable" || status === "approved")
    return { status: "completed", output: { decision: "allow" } };
  if (status === "denied") return { status: "completed", output: { decision: "deny" } };
  if (typeof status === "object" && status !== null && status.type === "denied")
    return { status: "completed", output: { decision: "deny", reason: status.reason } };
  return { status: "completed", output: { decision: "ask" } };
}

/** A compaction or review call: the session's model, no tools, no stream events. */
async function runSideModelCall(
  step: Step,
  messages: readonly KernelMessage[],
  system: string,
): Promise<KernelEffectResult> {
  const reference =
    step.session.agent.compactionModelReference ?? requireSessionModelReference(step.session);
  const model = await step.config.resolveModel(reference);
  if (typeof model === "string")
    return {
      status: "failed",
      error: `The kernel prototype needs a model object, not "${model}".`,
    };
  try {
    const result = await (model as LanguageModelV4).doGenerate({
      prompt: toPrompt(system, messages),
      abortSignal: step.config.abortSignal,
    });
    return { status: "completed", output: { text: textOf(result.content) } };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

function textOf(content: readonly { readonly type: string; readonly text?: string }[]): string {
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

/** Input tokens from either usage shape the AI SDK providers report. */
function inputTokens(usage: unknown): number | undefined {
  const input = (usage as { inputTokens?: unknown } | undefined)?.inputTokens;
  if (typeof input === "number") return input;
  const total = (input as { total?: unknown } | undefined)?.total;
  return typeof total === "number" ? total : undefined;
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
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      retryable: classifyModelCallError(error) === "retry",
    };
  }
  const text = textOf(result.content);
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
  return {
    status: "completed",
    output: { text, tool_calls: toolCalls, usage: { input_tokens: inputTokens(result.usage) } },
  };
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
