// The kernel's half of baseline 2: one prompt, one text reply, one finished
// turn, against history size. The host also parses each output, as it must to
// send the model request. Compare with baseline/test/harness.integration.test.ts.
//
//   node bench/kernel-turn.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Input, KernelState, Message } from "../src/contract.ts";
import { native, open, spikeRoot } from "../src/native.ts";
import { loadScenarios } from "../src/scenario.ts";
import { createWasmKernel } from "../src/wasm.ts";

const { config } = loadScenarios();
const wasm = createWasmKernel(new Uint8Array(readFileSync(join(spikeRoot(), "dist/kernel.wasm"))));

function stateWithHistory(bytes: number): KernelState {
  const s = open(config);
  const filler = "x".repeat(1000);
  const history: Message[] = [];
  while (JSON.stringify(history).length < bytes) {
    history.push(
      { role: "user", text: filler },
      { role: "assistant", text: filler, tool_calls: [], partial: false },
    );
  }
  return { ...s, history };
}

const prompt: Input[] = [{ type: "prompt", id: "p", text: "hi" }];
const reply = (key: string): Input[] => [
  { type: "effect_result", key, result: { status: "completed", output: { text: "ok" } } },
];

function time(n: number, fn: () => void): number {
  fn();
  const t = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t) / n;
}

const rows = [];
for (const size of [10_000, 100_000, 1_000_000, 10_000_000]) {
  const state = stateWithHistory(size);
  const stateJson = JSON.stringify(state);
  const n = size >= 10_000_000 ? 5 : size >= 1_000_000 ? 20 : 200;
  const key = "t1.s0.a0.model";

  // State kept in Rust: handles are made before the clock starts.
  const handles = Array.from({ length: n + 1 }, () => native().Kernel.fromState(stateJson));
  let h = 0;
  const handleMs = time(n, () => {
    const k = handles[h++]!;
    JSON.parse(k.advance(JSON.stringify(prompt)));
    JSON.parse(k.advance(JSON.stringify(reply(key))));
  });

  const jsonMs = time(n, () => {
    const a = JSON.parse(native().advance(stateJson, JSON.stringify(prompt))) as {
      state: KernelState;
    };
    JSON.parse(native().advance(JSON.stringify(a.state), JSON.stringify(reply(key))));
  });

  const wasmMs = time(Math.max(1, Math.floor(n / 4)), () => {
    const a = wasm.advance(state, prompt);
    wasm.advance(a.state, reply(key));
  });

  rows.push({ stateBytes: stateJson.length, handleMs, jsonMs, wasmMs });
}
mkdirSync(join(spikeRoot(), ".spike-tmp/baseline"), { recursive: true });
writeFileSync(
  join(spikeRoot(), ".spike-tmp/baseline/kernel-turn.json"),
  JSON.stringify(rows, null, 2),
);
console.table(rows);
