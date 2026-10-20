import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it } from "vitest";
import { start } from "workflow/api";

import { SCENARIOS } from "../../../src/scenario.ts";
import { check, type RunResult } from "../../../test/assertions.ts";
import { kernelSession } from "../workflows/session.ts";

for (const mode of ["steps", "wasm"] as const) {
  describe(`host B: Workflow SDK, kernel in ${mode === "steps" ? "step code (Node-API)" : "workflow code (WASM)"}`, () => {
    it.each(SCENARIOS)("%s", async (name) => {
      const ws = mkdtempSync(join(tmpdir(), `kernel-spike-b-${mode}-${name}-`));
      const run = await start(kernelSession, [name, ws, mode]);
      const result = (await run.returnValue) as Omit<RunResult, "ws">;
      check(name, { ws, ...result }, { parallelReads: true, replayNever: false });
    });
  });
}
