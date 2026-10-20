// Host B's half of baseline 1: the same `plain` and `growth` runs as
// baseline/test/eve.integration.test.ts, measured the same way.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";
import { start } from "workflow/api";
import { getWorld } from "workflow/runtime";

import { measureRun } from "../../../src/metrics.ts";
import { spikeRoot } from "../../../src/native.ts";
import { kernelSession } from "../workflows/session.ts";

const OUT = () => join(spikeRoot(), ".spike-tmp/baseline");
const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function runB(name: string, mode: "steps" | "wasm", turns: number) {
  const ws = mkdtempSync(join(tmpdir(), `kernel-spike-bb-${mode}-${name}-`));
  const t = performance.now();
  const run = await start(kernelSession, [name, ws, mode, turns]);
  const result = (await run.returnValue) as { state: { history: unknown[] } };
  const totalMs = performance.now() - t;
  const metrics = await measureRun((await getWorld()) as never, run.runId);
  return {
    host: `b-${mode}`,
    name,
    turns,
    ws,
    totalMs,
    metrics,
    historyLength: result.state.history.length,
  };
}

function save(r: { host: string; name: string; turns: number }) {
  mkdirSync(OUT(), { recursive: true });
  writeFileSync(join(OUT(), `${r.host}-${r.name}-${r.turns}.json`), JSON.stringify(r, null, 2));
}

for (const mode of ["steps", "wasm"] as const) {
  describe(`baseline, host B ${mode}`, () => {
    beforeAll(async () => {
      await runB("plain", mode, 1);
    });

    it("plain", async () => {
      const runs = [];
      for (let i = 0; i < 5; i++) runs.push(await runB("plain", mode, 1));
      save({
        ...runs.at(-1)!,
        totalMs: median(runs.map((x) => x.totalMs)),
        samplesMs: runs.map((x) => x.totalMs),
      } as never);
    });

    for (const turns of [1, 5, 10, 20]) {
      it(`growth, ${turns} turns`, async () => {
        const r = await runB("growth", mode, turns);
        save(r);
        // Each turn adds the prompt, a tool call, its result, and the reply.
        expect(r.historyLength).toBe(4 * turns);
      }, 300_000);
    }
  });
}
