// EXPERIMENTAL (kernel-spike): the kernel in workflow code (`wasm` mode).
//
// The session workflow (execution/session/turn.ts) calls this between turn
// steps. The kernel state lives in workflow memory, so it is rebuilt by
// replay and never written to the log. Each turn step runs one batch: a model
// call alone, or a group of tool calls the kernel lets run together. A `never`
// tool is alone in its group.

import {
  type KernelEffectRequest,
  type KernelInput,
  type KernelSessionConfig,
  type KernelState,
  type KernelStepInput,
  type KernelStepOutput,
  kernelTurnEnded,
  lastAssistantText,
  readyEffects,
} from "#harness/kernel/contract.js";
import { wasmKernel } from "#harness/kernel/wasm.js";

export class WorkflowKernel {
  private state: KernelState | undefined;
  private open: KernelEffectRequest[] = [];
  private prompts = 0;

  get configured(): boolean {
    return this.state !== undefined;
  }

  configure(config: KernelSessionConfig): void {
    this.state ??= wasmKernel().open(config);
  }

  /** The first step of a turn: its prompt's first batch. */
  startTurn(text: string): KernelStepInput {
    this.prompts += 1;
    return this.feed([{ type: "prompt", id: `prompt:${this.prompts}`, text }]);
  }

  /** After a turn step: the next batch, or the turn's end. */
  afterStep(output: KernelStepOutput): KernelStepInput {
    return this.feed(
      output.results.map((r) => ({ type: "effect_result" as const, key: r.key, result: r.result })),
    );
  }

  private feed(inputs: KernelInput[]): KernelStepInput {
    const out = wasmKernel().advance(this.state!, inputs);
    this.state = out.state;
    const resolved = new Set(inputs.flatMap((i) => (i.type === "effect_result" ? [i.key] : [])));
    this.open = [...this.open.filter((e) => !resolved.has(e.key)), ...out.effects];
    if (kernelTurnEnded(out.events) !== undefined) {
      return { finish: { text: lastAssistantText(this.state) } };
    }
    const ready = readyEffects(this.open);
    const model = ready.find((e) => e.effect.kind === "model_call");
    return { effects: model === undefined ? ready : [model] };
  }
}

/** The text of a delivery's messages, for the kernel prompt. */
export function deliveryText(delivery: {
  readonly payloads: readonly { readonly message?: unknown }[];
}): string {
  return delivery.payloads
    .flatMap((p) => (typeof p.message === "string" ? [p.message] : []))
    .join("\n\n");
}
