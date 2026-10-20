// Prints baseline 1: eve against host B, from .spike-tmp/baseline/*.json.
//
//   node baseline/report.ts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { RunMetrics } from "../src/metrics.ts";
import { spikeRoot } from "../src/native.ts";

interface Row {
  host: string;
  name: string;
  turns: number;
  totalMs: number;
  metrics: RunMetrics;
}

const dir = join(spikeRoot(), ".spike-tmp/baseline");
const rows: Row[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Row);
const hosts = ["eve", "b-steps", "b-wasm"];
const find = (host: string, name: string, turns: number) =>
  rows.find((r) => r.host === host && r.name === name && r.turns === turns);
const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`;

console.log("plain turn (2 model calls, 3 tool calls), median of 5");
console.table(
  hosts.map((h) => {
    const r = find(h, "plain", 1)!;
    return {
      host: h,
      ms: r.totalMs.toFixed(0),
      steps: r.metrics.steps,
      events: r.metrics.events,
      written: kb(r.metrics.bytes),
      stepNames: JSON.stringify(r.metrics.stepNames),
    };
  }),
);

console.log("growth: N turns, each a 5 KB tool result and a reply");
const table: Record<string, string | number>[] = [];
for (const n of [1, 5, 10, 20]) {
  for (const h of hosts) {
    const r = find(h, "growth", n)!;
    table.push({
      turns: n,
      host: h,
      ms: r.totalMs.toFixed(0),
      steps: r.metrics.steps,
      events: r.metrics.events,
      written: kb(r.metrics.bytes),
    });
  }
}
console.table(table);

console.log("bytes written by the last turns (per turn, from 10 to 20 turns)");
console.table(
  hosts.map((h) => {
    const a = find(h, "growth", 10)!.metrics.bytes;
    const b = find(h, "growth", 20)!.metrics.bytes;
    return { host: h, "per turn at 10–20 turns": kb((b - a) / 10) };
  }),
);

console.log("one model step against history size (ms per turn: prompt, model call, text reply)");
const harness = JSON.parse(readFileSync(join(dir, "harness.json"), "utf8")) as {
  stateBytes: number;
  turnMs: number;
}[];
const kernel = JSON.parse(readFileSync(join(dir, "kernel-turn.json"), "utf8")) as {
  handleMs: number;
  jsonMs: number;
  wasmMs: number;
}[];
console.table(
  harness.map((h, i) => ({
    history: kb(h.stateBytes),
    "eve harness": h.turnMs.toFixed(2),
    "kernel, state in Rust": kernel[i]!.handleMs.toFixed(2),
    "kernel, JSON state": kernel[i]!.jsonMs.toFixed(2),
    "kernel, WASM": kernel[i]!.wasmMs.toFixed(2),
  })),
);
