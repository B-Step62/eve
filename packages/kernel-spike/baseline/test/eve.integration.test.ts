// Baseline 1: today's eve on the same scenarios as host B.
//
// A real eve session (workflowEntry, turnStep, the AI SDK ToolLoopAgent) on
// eve's integration-tier world-local, with a scripted mockModel and the same
// two tools as the prototype. Writes one JSON file per run to
// .spike-tmp/baseline/ for baseline/report.ts.

import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mockModel } from "#evals/mock-model.js";
import { workflowEntry } from "#execution/session/entry.js";
import {
  sessionCommandHookToken,
  sessionInboxHookToken,
} from "#execution/session-inbox/address.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { buildSerializedContext } from "#internal/testing/entry-test-helpers.js";
import { captureTurnEvents } from "#internal/testing/events.js";
import { startSessionOwner } from "#internal/testing/workflow-test-helpers.js";
import { getWorld, resumeHook } from "#internal/workflow/runtime.js";
import { defineTool } from "#tools/definition.js";

import { measureRun } from "../../src/metrics.ts";
import { loadScenarios, type Scenario, scriptStep, seedWorkspace } from "../../src/scenario.ts";

// eve's test tiers route authored models to a deterministic adapter when
// NODE_ENV is "test"; the scripted mockModel below must run instead.
process.env.NODE_ENV = "production";

const OUT = join(process.env.KERNEL_SPIKE_ROOT!, ".spike-tmp/baseline");

function trace(ws: string, line: Record<string, unknown>) {
  appendFileSync(join(ws, ".trace.jsonl"), `${JSON.stringify(line)}\n`);
}

function tools(ws: string) {
  const schema = (props: Record<string, unknown>) => ({
    type: "object",
    properties: props,
    required: ["path"],
  });
  return [
    {
      logicalPath: "tools/read_file.ts",
      loadNamespace: async () => ({
        default: defineTool({
          description: "Read a file.",
          inputSchema: schema({ path: { type: "string" }, delay_ms: { type: "number" } }),
          execute: async (input: { path: string; delay_ms?: number }, ctx: { callId: string }) => {
            trace(ws, { kind: "tool_start", id: ctx.callId, name: "read_file" });
            await new Promise((r) => setTimeout(r, input.delay_ms ?? 0));
            const text = readFileSync(join(ws, input.path), "utf8");
            trace(ws, { kind: "tool_end", id: ctx.callId, name: "read_file" });
            return text;
          },
        }),
      }),
    },
    {
      logicalPath: "tools/write_file.ts",
      loadNamespace: async () => ({
        default: defineTool({
          description: "Append to a file.",
          inputSchema: schema({ path: { type: "string" }, content: { type: "string" } }),
          execute: async (input: { path: string; content: string }, ctx: { callId: string }) => {
            trace(ws, { kind: "tool_start", id: ctx.callId, name: "write_file" });
            appendFileSync(join(ws, input.path), input.content);
            trace(ws, { kind: "tool_end", id: ctx.callId, name: "write_file" });
            return "ok";
          },
        }),
      }),
    },
  ];
}

function scriptedModel(scenario: Scenario) {
  return mockModel(({ messages }) => {
    const step = scriptStep(scenario, messages.filter((m) => m.role === "assistant").length);
    return step.tool_calls
      ? { toolCalls: step.tool_calls.map((c) => ({ id: c.id, name: c.name, input: c.input })) }
      : (step.text ?? "");
  });
}

type Mode = "eve" | "eve-native" | "eve-wasm";

async function runEve(name: string, turns: number, mode: Mode = "eve") {
  const scenario = loadScenarios().scenarios[name]!;
  const ws = mkdtempSync(join(tmpdir(), `kernel-spike-eve-${name}-`));
  seedWorkspace(ws, scenario);
  const runtime = await createTestRuntime({
    agent: {
      name: "baseline",
      definition: { model: scriptedModel(scenario), defaultTools: false },
    },
    modules: tools(ws),
  });
  return await runtime.run(async () => {
    const start = performance.now();
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: scenario.prompt },
        serializedContext: {
          ...buildSerializedContext({ channelKind: "http" }),
          ...(mode === "eve"
            ? {}
            : { "eve.kernelMode": mode === "eve-native" ? "native" : "wasm" }),
        },
      },
    ]);
    const stream = captureTurnEvents(run);
    const turnMs: number[] = [];
    let last: unknown[] = [];
    try {
      let t = start;
      last = await stream.nextTurn();
      turnMs.push(performance.now() - t);
      for (let k = 2; k <= turns; k++) {
        t = performance.now();
        await resumeHook(sessionInboxHookToken(sessionCommandHookToken(run.runId)), {
          kind: "send",
          payload: { message: `Turn ${k}: read big.txt.` },
        });
        last = await stream.nextTurn();
        turnMs.push(performance.now() - t);
      }
      const totalMs = performance.now() - start;
      const metrics = await measureRun((await getWorld()) as never, run.runId);
      return { host: mode, name, turns, ws, totalMs, turnMs, metrics, lastTurnEvents: last };
    } finally {
      stream.dispose();
      await run.cancel();
    }
  });
}

function save(result: { host: string; name: string; turns: number }) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, `${result.host}-${result.name}-${result.turns}.json`),
    JSON.stringify(result, null, 2),
  );
}

const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)]!;

for (const mode of ["eve", "eve-native", "eve-wasm"] as const) {
  describe(mode, () => {
    beforeAll(async () => {
      // The first session pays for bundle loading and compilation.
      await runEve("plain", 1, mode);
    });

    it("plain", async () => {
      const runs = [];
      for (let i = 0; i < 5; i++) runs.push(await runEve("plain", 1, mode));
      const r = runs.at(-1)!;
      save({
        ...r,
        totalMs: median(runs.map((x) => x.totalMs)),
        samplesMs: runs.map((x) => x.totalMs),
      });
      expect(readFileSync(join(r.ws, "out.txt"), "utf8")).toBe("alpha+beta\n");
      expect(JSON.stringify(r.lastTurnEvents)).toContain("Done.");
    });

    for (const turns of [1, 5, 10, 20]) {
      it(`growth, ${turns} turns`, async () => {
        const r = await runEve("growth", turns, mode);
        save(r);
        expect(JSON.stringify(r.lastTurnEvents)).toContain("5000 characters");
      });
    }
  });
}
