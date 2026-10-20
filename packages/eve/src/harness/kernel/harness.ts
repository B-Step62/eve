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
import {
  type KernelBinding,
  type KernelEffectRequest,
  type KernelInput,
  type KernelMode,
  type KernelState,
  kernelToolDescriptor,
  kernelTurnEnded,
  lastAssistantText,
  readyEffects,
} from "#harness/kernel/contract.js";
import { flushStepCompleted, runKernelEffect } from "#harness/kernel/effects.js";
import { KernelStepInputKey, KernelStepOutputKey } from "#harness/kernel/keys.js";
import { nativeKernel } from "#harness/kernel/native.js";
import { acceptHumanInput } from "#harness/hitl/index.js";
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

interface StoredKernel {
  readonly state: KernelState;
  readonly open: readonly KernelEffectRequest[];
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

export function kernelConfig(step: Pick<Step, "config" | "session">) {
  return {
    system: step.session.agent.system ?? "",
    tools: [...step.config.tools.values()].map((t) => kernelToolDescriptor(t.name, t.description)),
    step_limit: 0,
  };
}

/** `native`: one model call and its tools, with the kernel in this step. */
async function runNative(step: Step, prompt: string | undefined): Promise<StepResult> {
  const kernel: KernelBinding = nativeKernel();
  const stored = step.session.state?.[KERNEL_STATE] as StoredKernel | undefined;
  let state = stored?.state ?? kernel.open(kernelConfig(step));
  let open = [...(stored?.open ?? [])];
  let ended: string | undefined;
  const feed = (inputs: KernelInput[]) => {
    const out = kernel.advance(state, inputs);
    state = out.state;
    const resolved = new Set(inputs.flatMap((i) => (i.type === "effect_result" ? [i.key] : [])));
    open = [...open.filter((e) => !resolved.has(e.key)), ...out.effects];
    const end = kernelTurnEnded(out.events);
    if (end !== undefined) ended = lastAssistantText(state);
  };
  if (prompt !== undefined)
    feed([{ type: "prompt", id: `prompt:${step.position().turnId}`, text: prompt }]);

  let ranModel = false;
  for (;;) {
    if (ended !== undefined) {
      step.session = {
        ...step.session,
        state: { ...step.session.state, [KERNEL_STATE]: { state, open } },
      };
      return await endTurn(step, ended);
    }
    const ready = readyEffects(open);
    const model = ready.find((e) => e.effect.kind === "model_call");
    if (model !== undefined && ranModel) {
      step.session = {
        ...step.session,
        state: { ...step.session.state, [KERNEL_STATE]: { state, open } },
      };
      return { next: step.runStep, session: step.session };
    }
    if (model !== undefined) {
      ranModel = true;
      feed([{ type: "effect_result", key: model.key, result: await runKernelEffect(step, model) }]);
      continue;
    }
    if (ready.length === 0) throw new Error("The kernel has open effects but none can run.");
    const results = await Promise.all(
      ready.map(async (e) => ({ key: e.key, result: await runKernelEffect(step, e) })),
    );
    feed(results.map((r) => ({ type: "effect_result" as const, ...r })));
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
    effects.map(async (e) => ({ key: e.key, result: await runKernelEffect(step, e) })),
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
