// EXPERIMENTAL (kernel-spike): eve's harness step with the Rust kernel as the
// agent loop. Intake (parked work, human input, opening the turn) is eve's own,
// as in `createToolLoopHarness`; the model and tool loop is the kernel's.
//
// - `native`: the kernel (Node-API) runs inside this step. Like eve's harness,
//   one step makes one model call and runs that call's tools; the kernel state
//   rides the session state between steps.
// - `wasm`: the kernel runs in workflow code (execution/session/turn.ts). This
//   step only runs the effects the workflow sends, or ends the turn.

import { contextStorage } from "#context/container.js";
import { StaticModelReferenceKey } from "#context/keys.js";
import { resolveApprovalPolicy } from "#approval/definition.js";
import type { HarnessToolDefinition } from "#harness/execute-tool.js";
import {
  type KernelApproval,
  type KernelBinding,
  type KernelEffectRequest,
  type KernelEvent,
  type KernelInput,
  type KernelMode,
  type KernelSessionConfig,
  type KernelState,
  kernelTurnEnded,
  lastAssistantText,
  readyEffects,
} from "#harness/kernel/contract.js";
import { flushStepCompleted, runKernelEffect } from "#harness/kernel/effects.js";
import { KernelStepInputKey, KernelStepOutputKey } from "#harness/kernel/keys.js";
import { nativeKernel } from "#harness/kernel/native.js";
import { acceptHumanInput, holdForInput, parkOnApprovals } from "#harness/hitl/index.js";
import type { SuspendedStep } from "#harness/session-machine/view.js";
import { createRuntimeToolCallActionFromToolCall } from "#harness/tool-call-action.js";
import {
  createCompactionCompletedEvent,
  createCompactionRequestedEvent,
} from "#protocol/message.js";
import type { InputRequest } from "#shared/input.js";
import { builtinApprovalPolicy } from "#tools/approval/policies.js";
import type { Publish } from "#harness/session-machine/commit.js";
import { saveProjection, stepProjection } from "#harness/session-machine/current.js";
import { finishTurn } from "#harness/session-machine/transitions.js";
import { createStep, openTurn, type Step } from "#harness/step/context.js";
import { prepareTurnInput, settleRuntimeWork } from "#harness/step/intake.js";
import type {
  HarnessSession,
  StepFn,
  StepInput,
  StepResult,
  ToolLoopHarnessConfig,
} from "#harness/types.js";
import { createHistoryViewPreparer } from "#shared/history-view.js";

const KERNEL_STATE = "eve.kernel";

/**
 * The kernel snapshot this step commits with eve's session, inside the same
 * Workflow step result. Open effects are not stored: `resume` rebuilds them
 * from the state, so the history is not stored a second time inside an open
 * model call.
 */
interface StoredKernel {
  readonly state: KernelState;
  /** Open `user_ask` effect keys, and the eve input request each one parked on. */
  readonly asked?: Readonly<Record<string, string>>;
}

export function createKernelHarness(config: ToolLoopHarnessConfig, mode: KernelMode): StepFn {
  async function runStep(initialSession: HarnessSession, input?: StepInput): Promise<StepResult> {
    const ctx = contextStorage.getStore();
    const live = stepProjection(ctx, initialSession.state);
    const prepareHistory = createHistoryViewPreparer({
      previous: config.historyView,
      projector: config.historyProjector,
    });
    prepareHistory(initialSession.history, initialSession.state);
    if (ctx !== undefined && !ctx.has(StaticModelReferenceKey)) {
      ctx.setVirtualContext(StaticModelReferenceKey, initialSession.agent.modelReference ?? null);
    }
    const emit = config.handleEvent;
    const publish: Publish = async (event, messages) => {
      if (emit !== undefined) await emit(event, messages);
      if (emit === undefined || ctx === undefined) live.record(event);
    };
    const step = createStep({
      config,
      ctx,
      emit,
      instrumentation: undefined,
      live,
      prepareHistory,
      publish,
      runStep,
      session: initialSession,
    });

    const runtime = await settleRuntimeWork(step, input);
    if (runtime === undefined) return done(live, { next: null, session: step.session });
    const intake = await acceptHumanInput(step, runtime.input, { takeQueued: !runtime.waited });
    if (intake.kind === "stop") return intake.result;
    const turn = await prepareTurnInput(step, intake.input, {
      consumedMessage: intake.consumedMessage,
    });
    if (intake.opensTurn) {
      const failed = await openTurn(step, {
        input: [...turn.ephemeral, ...turn.messages],
        message: intake.message,
      });
      if (failed !== undefined) return failed;
    }

    const result =
      mode === "native"
        ? await runNative(step, intake.opensTurn ? messageText(intake.message) : undefined)
        : await runFromWorkflow(step);
    return done(live, result);
  }

  return runStep;
}

function done(live: ReturnType<typeof stepProjection>, result: StepResult): StepResult {
  return { ...result, session: saveProjection(result.session, live.read()) };
}

export function kernelConfig(step: Pick<Step, "config" | "session">): KernelSessionConfig {
  const { compaction } = step.session;
  return {
    system: step.session.agent.system ?? "",
    tools: [...step.config.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      approval: kernelApproval(t),
    })),
    step_limit: 0,
    // eve's threshold is already an absolute token count.
    compaction: {
      context_window_tokens: compaction.threshold,
      threshold_percent: 1,
      recent_messages: compaction.recentWindowSize,
    },
  };
}

/**
 * eve's built-in policies are decided in the kernel. `auto()` and policy
 * functions stay eve's (`host`). So does `once()` with an `approvalKey`, whose
 * grant is not the tool name.
 */
function kernelApproval(tool: HarnessToolDefinition): KernelApproval {
  if (tool.approval === undefined) return "never";
  const builtin = builtinApprovalPolicy(resolveApprovalPolicy(tool.approval));
  if (builtin === undefined || (builtin === "once" && tool.approvalKey !== undefined))
    return "host";
  return builtin;
}

/** `native`: one model call and its tools, with the kernel in this step. */
async function runNative(step: Step, prompt: string | undefined): Promise<StepResult> {
  const kernel: KernelBinding = nativeKernel();
  const stored = step.session.state?.[KERNEL_STATE] as StoredKernel | undefined;
  let state = stored?.state ?? kernel.open(kernelConfig(step));
  let open = stored === undefined ? [] : [...kernel.resume(state).effects];
  const asked = new Map(Object.entries(stored?.asked ?? {}));
  let ended: string | undefined;
  const feed = async (inputs: KernelInput[]) => {
    const out = kernel.advance(state, inputs);
    state = out.state;
    const resolved = new Set(inputs.flatMap((i) => (i.type === "effect_result" ? [i.key] : [])));
    open = [...open.filter((e) => !resolved.has(e.key)), ...out.effects];
    for (const key of resolved) asked.delete(key);
    await publishKernelEvents(step, out.events);
    if (kernelTurnEnded(out.events) !== undefined) ended = lastAssistantText(state);
  };
  const save = () => {
    step.session = {
      ...step.session,
      state: {
        ...step.session.state,
        [KERNEL_STATE]: { state, asked: Object.fromEntries(asked) } satisfies StoredKernel,
      },
    };
  };
  if (prompt !== undefined)
    await feed([{ type: "prompt", id: `prompt:${step.position().turnId}`, text: prompt }]);
  const answers = await takeApprovalAnswers(step, asked);
  if (answers.length > 0) await feed(answers);

  let ranModel = false;
  for (;;) {
    if (ended !== undefined) {
      save();
      return await endTurn(step, ended);
    }
    const ready = readyEffects(open);
    const model = ready.find((e) => e.effect.kind === "model_call" && e.effect.purpose === "agent");
    if (model !== undefined && ranModel) {
      save();
      return { next: step.runStep, session: step.session };
    }
    if (model !== undefined) {
      ranModel = true;
      await feed([
        { type: "effect_result", key: model.key, result: await run(step, model, state) },
      ]);
      continue;
    }
    const runnable = ready.filter((e) => e.effect.kind !== "user_ask");
    if (runnable.length > 0) {
      const results = await Promise.all(
        runnable.map(async (e) => ({ key: e.key, result: await run(step, e, state) })),
      );
      await feed(results.map((r) => ({ type: "effect_result" as const, ...r })));
      continue;
    }
    const asks = ready.filter((e) => e.effect.kind === "user_ask" && !asked.has(e.key));
    if (ready.length === 0) throw new Error("The kernel has open effects but none can run.");
    for (const ask of asks) asked.set(ask.key, `kernel:${ask.key}`);
    save();
    return await parkOnKernelAsks(step, asks, asked);
  }
}

/** `once()` grants: the kernel's for built-in policies, eve's for `host` ones. */
function run(step: Step, request: KernelEffectRequest, state: KernelState) {
  const granted = [...((state.approved_tools ?? []) as string[]), ...step.view().turn.grants];
  return runKernelEffect(step, request, new Set(granted));
}

/**
 * The kernel asks a person: eve's own approval machinery parks the turn, so
 * channels, response policies, and `input.resolved` behave as in eve.
 */
async function parkOnKernelAsks(
  step: Step,
  asks: readonly KernelEffectRequest[],
  asked: ReadonlyMap<string, string>,
): Promise<StepResult> {
  if (asks.length === 0) return await holdForInput(step);
  await flushStepCompleted(step);
  const requests: InputRequest[] = asks.map((ask) => {
    if (ask.effect.kind !== "user_ask") throw new Error("not an ask");
    const { call_id, name, input } = ask.effect.request;
    return {
      action: createRuntimeToolCallActionFromToolCall({
        toolCall: { input, toolCallId: call_id, toolName: name },
      }),
      allowFreeform: false,
      display: "confirmation",
      kind: "tool-approval",
      options: [
        { id: "approve", label: "Approve" },
        { id: "cancel", label: "Cancel" },
      ],
      prompt: `Approve ${name}?`,
      requestId: asked.get(ask.key)!,
    };
  });
  const position = step.position();
  return await parkOnApprovals(step, {
    event: { sequence: position.sequence, stepIndex: position.stepIndex, turnId: position.turnId },
    messages: [],
    requests,
    tasks: [],
    tools: step.config.tools,
    waitsOn: undefined,
  });
}

/**
 * Reads what eve's approval machinery decided for the kernel's asks, and
 * removes the parked steps: the kernel, not eve, runs the approved calls and
 * keeps the denials in its history.
 */
async function takeApprovalAnswers(
  step: Step,
  asked: ReadonlyMap<string, string>,
): Promise<KernelInput[]> {
  const keyOf = new Map([...asked].map(([key, requestId]) => [requestId, key]));
  const turn = step.view().turn;
  const inputs: KernelInput[] = [];
  const settled = new Set<SuspendedStep>();
  for (const parked of turn.suspended) {
    const ours = [...parked.requests, ...(parked.approved ?? [])].some((r) =>
      keyOf.has(r.requestId),
    );
    const denials = parked.messages.flatMap((m) =>
      m.role === "tool" && Array.isArray(m.content) ? m.content : [],
    );
    if (!ours && denials.length === 0) continue;
    if (parked.requests.some((r) => keyOf.has(r.requestId))) continue;
    for (const request of parked.approved ?? []) {
      const key = keyOf.get(request.requestId);
      if (key !== undefined)
        inputs.push({
          type: "effect_result",
          key,
          result: { status: "completed", output: { approved: true } },
        });
    }
    for (const part of denials) {
      if (part.type !== "tool-result") continue;
      const key = [...asked.keys()].find((k) => k.endsWith(`.tool.${part.toolCallId}.ask`));
      const output = part.output as { type?: string; reason?: string };
      if (key !== undefined && output.type === "execution-denied")
        inputs.push({
          type: "effect_result",
          key,
          result: { status: "completed", output: { approved: false, reason: output.reason } },
        });
    }
    settled.add(parked);
  }
  if (settled.size > 0) {
    await step.apply({
      events: [],
      turn: { ...turn, suspended: turn.suspended.filter((p) => !settled.has(p)) },
    });
  }
  return inputs;
}

async function publishKernelEvents(step: Step, events: readonly KernelEvent[]): Promise<void> {
  for (const event of events) {
    if (event.type !== "compaction_started" && event.type !== "compaction_completed") continue;
    const position = step.position();
    const at = {
      modelId: step.session.agent.modelReference?.id ?? "unknown",
      sequence: position.sequence,
      sessionId: step.session.sessionId,
      stepIndex: position.stepIndex,
      turnId: position.turnId,
    };
    await step.publish(
      event.type === "compaction_started"
        ? createCompactionRequestedEvent({
            ...at,
            usageInputTokens: event.estimated_tokens as number,
          })
        : createCompactionCompletedEvent(at),
    );
  }
}

/** `wasm`: run what the workflow sent, or end the turn. */
async function runFromWorkflow(step: Step): Promise<StepResult> {
  const input = step.ctx?.get(KernelStepInputKey);
  if (input?.finish !== undefined) return await endTurn(step, input.finish.text);
  if (input?.describe === true) {
    step.ctx?.setVirtualContext(KernelStepOutputKey, { config: kernelConfig(step), results: [] });
    return { next: step.runStep, session: step.session };
  }
  const effects = input?.effects ?? [];
  const results = await Promise.all(
    effects.map(async (e) => ({ key: e.key, result: await runKernelEffect(step, e, new Set()) })),
  );
  step.ctx?.setVirtualContext(KernelStepOutputKey, { results });
  return { next: step.runStep, session: step.session };
}

async function endTurn(step: Step, text: string): Promise<StepResult> {
  await flushStepCompleted(step);
  await step.apply(finishTurn(step.view()), step.session.history);
  return { next: null, session: step.session, settledTurn: { output: text } };
}

function messageText(message: StepInput["message"]): string | undefined {
  if (message === undefined) return undefined;
  if (typeof message === "string") return message;
  return message.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}
