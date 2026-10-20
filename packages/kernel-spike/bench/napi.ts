// Measures the cost of crossing the kernel boundary as the session grows.
//
//   node bench/napi.ts
//
// For each state size it times three advance calls:
//   small:  a steer during a tool (small output)
//   model:  a tool result that makes the next model request (output carries the history)
// in three shapes: JSON state every call (Node-API), state kept in Rust (Node-API
// handle), and JSON state every call through WASM.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Input, KernelState } from "../src/contract.ts";
import { advance, native, open, spikeRoot } from "../src/native.ts";
import { loadScenarios } from "../src/scenario.ts";
import { createWasmKernel } from "../src/wasm.ts";

const { config } = loadScenarios();
const wasm = createWasmKernel(new Uint8Array(readFileSync(join(spikeRoot(), "dist/kernel.wasm"))));

function stateOfSize(bytes: number): KernelState {
  let s = open(config);
  s = advance(s, [{ type: "prompt", id: "p", text: "go" }]).state;
  s = advance(s, [
    {
      type: "effect_result",
      key: "t1.s0.a0.model",
      result: {
        status: "completed",
        output: { tool_calls: [{ id: "x", name: "read_file", input: { path: "a" } }] },
      },
    },
  ]).state;
  const filler = "x".repeat(1000);
  while (JSON.stringify(s).length < bytes) s.history.unshift({ role: "user", text: filler });
  return s;
}

function time(iterations: number, fn: (i: number) => void): number {
  for (let i = 0; i < Math.min(3, iterations); i++) fn(i);
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn(i);
  return Number(process.hrtime.bigint() - start) / 1000 / iterations;
}

const steer = (i: number): Input[] => [{ type: "steer", id: `s${i}`, text: "also this" }];
const toolResult: Input[] = [
  { type: "effect_result", key: "t1.tool.x", result: { status: "completed", output: "A" } },
];

const rows: Record<string, string>[] = [];
for (const size of [10_000, 100_000, 1_000_000, 10_000_000]) {
  const state = stateOfSize(size);
  const stateJson = JSON.stringify(state);
  const n = size >= 10_000_000 ? 5 : size >= 1_000_000 ? 20 : 200;
  const fromState = () => native().Kernel.fromState(stateJson);
  const k = fromState();

  const r = {
    state: `${(stateJson.length / 1000).toFixed(0)} KB`,
    "small, JSON state (µs)": time(n, (i) =>
      native().advance(stateJson, JSON.stringify(steer(i))),
    ).toFixed(0),
    "small, Rust handle (µs)": time(n, (i) => k.advance(JSON.stringify(steer(i)))).toFixed(0),
    "small, WASM JSON (µs)": time(n, (i) => wasm.advance(state, steer(i))).toFixed(0),
    "model, JSON state (µs)": time(n, () =>
      native().advance(stateJson, JSON.stringify(toolResult)),
    ).toFixed(0),
    "model, Rust handle (µs)": time(n, () => {
      fromState().advance(JSON.stringify(toolResult));
    }).toFixed(0),
    "JSON.stringify only (µs)": time(n, () => JSON.stringify(state)).toFixed(0),
  };
  rows.push(r);
}
console.table(rows);
