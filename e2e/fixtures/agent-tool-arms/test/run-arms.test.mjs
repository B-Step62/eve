import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const fixture = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(fixture, "scripts/run-arms.mjs");
// Stands in for `eve eval`: appends one row per task, as measure.ts would.
const fakeEval = [
  process.execPath,
  "-e",
  `const fs = require("node:fs"); const e = process.env;
   for (let i = 0; i < 10; i++) fs.appendFileSync(e.EVE_ARMS_OUTPUT, JSON.stringify({
     id: "t" + i, model: e.EVE_E2E_MODEL, size: e.EVE_ARMS_SIZE, arm: e.EVE_ARMS_MODE,
     repetition: Number(e.EVE_ARMS_REPETITION), success: true, errorClass: null,
     inputTokens: 100, cacheReadTokens: 50, modelCalls: 2, actions: 1, programAttempts: 0,
     latencyMs: 1000, programErrorClasses: [] }) + "\\n");
   console.log("Results: 10 passed (10 total)");`,
];
const run = (env, args = []) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      EVE_ARMS_EVAL_COMMAND: JSON.stringify(fakeEval),
      EVE_ARMS_MODELS: "m/one",
      EVE_ARMS_SIZES: "moderate",
      EVE_ARMS_MODES: "direct",
      EVE_ARMS_REPETITIONS: "1",
      ...env,
    },
  });
const rows = (path) => readFileSync(path, "utf8").split("\n").filter(Boolean);

test("repeated executions each get their own dataset", () => {
  const before = new Set(safeList(join(fixture, "results/runs")));
  const first = run({ EVE_ARMS_OUTPUT: undefined });
  const second = run({ EVE_ARMS_OUTPUT: undefined });
  const created = safeList(join(fixture, "results/runs")).filter((d) => !before.has(d));
  try {
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(created.length, 2);
    for (const dir of created) {
      const path = join(fixture, "results/runs", dir);
      assert.equal(rows(join(path, "measurements.jsonl")).length, 10);
      assert.match(readFileSync(join(path, "summary.md"), "utf8"), /\| 10\/10 \| 10\/10 \|/);
    }
    assert.match(second.stdout, /\| 10\/10 \| 10\/10 \|/);
  } finally {
    for (const dir of created) rmSync(join(fixture, "results/runs", dir), { recursive: true });
  }
});

test("an output that already has rows is refused and left as it was", () => {
  const dir = mkdtempSync(join(tmpdir(), "arms-"));
  const output = join(dir, "m.jsonl");
  assert.equal(run({ EVE_ARMS_OUTPUT: output }).status, 0);
  const second = run({ EVE_ARMS_OUTPUT: output });
  assert.equal(second.status, 1);
  assert.match(second.stderr, /already has rows/);
  assert.equal(rows(output).length, 10);
  rmSync(dir, { recursive: true });
});

test("--summary prints the table and writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "arms-"));
  const output = join(dir, "m.jsonl");
  run({ EVE_ARMS_OUTPUT: output });
  rmSync(join(dir, "summary.md"));
  const files = readdirSync(dir).sort();
  const baseline = join(fixture, "results/baseline/measurements.jsonl");
  const baselineBefore = statSync(baseline).mtimeMs;
  const summary = run({}, ["--summary", output]);
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /\| m\/one \| moderate \| direct \| 10\/10 \| 10\/10 \|/);
  assert.deepEqual(readdirSync(dir).sort(), files);
  const fromBaseline = run({}, ["--summary"]);
  assert.match(fromBaseline.stdout, /\| 27\/30 \| 30\/30 \|/);
  assert.equal(statSync(baseline).mtimeMs, baselineBefore);
  rmSync(dir, { recursive: true });
});

function safeList(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
