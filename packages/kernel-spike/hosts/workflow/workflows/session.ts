// Host B: the kernel on Workflow SDK workflows (the eve case).
//
// The workflow is the runner and the World is the store. The workflow value
// holds the kernel state. Each effect is a step. User input arrives on a
// hook, the way eve's session inbox works. Two ways to call the kernel:
//   - "steps": the native kernel in a step (open item 2, option A)
//   - "wasm": the WASM kernel directly in workflow code (option B)

import { createHook } from "workflow";

import { KERNEL_WASM_BASE64 } from "../../../dist/kernel-wasm-base64.ts";
import type {
  Advanced,
  Command,
  EffectRequest,
  EffectResult,
  Input,
  KernelEvent,
  KernelState,
} from "../../../src/contract.ts";
import { base64Decode, createWasmKernel } from "../../../src/wasm.ts";
import {
  cancelStep,
  inboxToken,
  kernelAdvanceStep,
  kernelOpenStep,
  loadScenarioStep,
  runEffectStep,
} from "./steps.ts";

type Next = { kind: "input"; input: Input } | { kind: "effect"; key: string; result: EffectResult };

/** `turns` > 1 sends `Turn <n>` prompts one after another, for the growth scenario. */
export async function kernelSession(name: string, ws: string, mode: "steps" | "wasm", turns = 1) {
  "use workflow";

  const { config, scenario } = await loadScenarioStep(name, ws);
  const wasm = mode === "wasm" ? createWasmKernel(base64Decode(KERNEL_WASM_BASE64)) : undefined;
  let state: KernelState = wasm ? wasm.open(config) : await kernelOpenStep(config);
  const advance = async (inputs: Input[]): Promise<Advanced> =>
    wasm ? wasm.advance(state, inputs) : kernelAdvanceStep(state, inputs);

  const hook = createHook<Input>({ token: inboxToken(ws) });
  const inbox = hook[Symbol.asyncIterator]();
  let nextInput = inbox.next();

  const commands: Command[] = [];
  const events: KernelEvent[] = [];
  const open = new Map<string, EffectRequest>();
  const running = new Map<string, Promise<Next>>();
  let queue: Input[] = [{ type: "prompt", id: "prompt-1", text: scenario.prompt }];
  let sent = 1;

  for (;;) {
    if (queue.length > 0) {
      const out = await advance(queue);
      queue = [];
      state = out.state;
      commands.push(...out.commands);
      events.push(...out.events);
      for (const e of out.effects) open.set(e.key, e);
      for (const c of out.commands) {
        if (running.has(c.key)) await cancelStep(ws, c.key);
        else if (open.delete(c.key)) {
          queue.push({
            type: "effect_result",
            key: c.key,
            result: { status: "interrupted", reason: "cancelled" },
          });
        }
      }
      continue;
    }
    for (const [key, req] of open) {
      if (running.has(key) || !req.after.every((k) => !open.has(k))) continue;
      running.set(
        key,
        runEffectStep(name, ws, req).then((result): Next => ({ kind: "effect", key, result })),
      );
    }
    if (open.size === 0 && state.turn === null && state.queued.length === 0) {
      if (sent >= turns) break;
      sent += 1;
      queue.push({ type: "prompt", id: `prompt-${sent}`, text: `Turn ${sent}: read big.txt.` });
      continue;
    }
    const next = await Promise.race([
      ...running.values(),
      nextInput.then((r): Next => ({ kind: "input", input: r.value as Input })),
    ]);
    if (next.kind === "input") {
      queue.push(next.input);
      nextInput = inbox.next();
    } else {
      running.delete(next.key);
      open.delete(next.key);
      queue.push({ type: "effect_result", key: next.key, result: next.result });
    }
  }
  return { state, commands, events };
}
