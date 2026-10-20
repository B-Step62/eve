// Baseline 2: the CPU cost of one eve model step as history grows, with no
// Workflow. Drives eve's harness (createToolLoopHarness, the AI SDK
// ToolLoopAgent) directly: one prompt, one scripted text reply, one
// completed turn. Compare with bench/kernel-turn.ts, which does the same turn
// through the kernel.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { contextStorage } from "#context/container.js";
import { mockModel } from "#evals/mock-model.js";
import { createToolLoopHarness } from "#harness/tool-loop.js";
import type { HarnessSession, StepInput } from "#harness/types.js";
import { createApprovalContext } from "#internal/testing/approval-resume.js";
import { inlineTool, toolMap } from "#internal/testing/catalog-fixtures.js";

// The harness runs outside a workflow body here, where run attributes cannot be written.
vi.mock("#runtime/attributes/emit.js", () => ({ setEveAttributes: vi.fn(async () => {}) }));

const OUT = join(process.env.KERNEL_SPIKE_ROOT!, ".spike-tmp/baseline");

function history(bytes: number): HarnessSession["history"] {
  const filler = "x".repeat(1000);
  const out: HarnessSession["history"] = [];
  while (JSON.stringify(out).length < bytes) {
    out.push({ role: "user", kind: "user", content: filler } as HarnessSession["history"][number], {
      role: "assistant",
      content: [{ type: "text", text: filler }],
    });
  }
  return out;
}

it("one model step against history size", async () => {
  const ctx = createApprovalContext();
  const harness = createToolLoopHarness({
    capabilities: { requestInput: true },
    handleEvent: async () => {},
    resolveModel: async () => mockModel("ok"),
    tools: toolMap(inlineTool("read_file")),
  });
  const turn = async (session: HarnessSession) => {
    let result = await contextStorage.run(ctx, () =>
      harness(session, { message: "hi" } as StepInput),
    );
    let steps = 1;
    while (typeof result.next === "function") {
      const next = result.next;
      const s = result.session;
      result = await contextStorage.run(ctx, () => next(s));
      steps++;
    }
    return { result, steps };
  };

  const rows = [];
  for (const size of [10_000, 100_000, 1_000_000, 10_000_000]) {
    const session: HarnessSession = {
      agent: {
        modelReference: { id: "m" },
        compactionModelReference: { id: "m" },
        system: "Help Alice.",
        tools: [],
      },
      compaction: { recentWindowSize: 10, threshold: 1e12 },
      continuationToken: "http:baseline",
      history: history(size),
      sessionId: "baseline",
    };
    const n = size >= 10_000_000 ? 3 : size >= 1_000_000 ? 10 : 50;
    await turn(session);
    const start = performance.now();
    let last;
    for (let i = 0; i < n; i++) last = await turn(session);
    const turnMs = (performance.now() - start) / n;
    const t = performance.now();
    const snapshot = JSON.stringify(last!.result.session);
    const stringifyMs = performance.now() - t;
    expect(last!.result.session.history.length).toBe(session.history.length + 2);
    rows.push({
      stateBytes: JSON.stringify(session).length,
      turnMs,
      harnessSteps: last!.steps,
      snapshotBytes: snapshot.length,
      stringifyMs,
    });
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "harness.json"), JSON.stringify(rows, null, 2));
  console.table(rows);
}, 600_000);
