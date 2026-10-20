// The same five scenarios on host A (in-process Rust runner, fx-mini) and
// host C (durable-harness). Host B (Workflow SDK) runs the same checks from
// hosts/workflow, which needs the Workflow vitest plugin.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it } from "vitest";

import { SCENARIOS } from "../src/scenario.ts";
import { check } from "./assertions.ts";
import { runHostA } from "./host-a.ts";
import { runHostC } from "./host-c.ts";

const workspace = (label: string) => mkdtempSync(join(tmpdir(), `kernel-spike-${label}-`));

describe("host A: in-process runner (fx-mini)", () => {
  it.each(SCENARIOS)("%s", (name) => {
    check(name, runHostA(name, workspace(`a-${name}`)), { parallelReads: true });
  });
});

describe("host C: durable-harness", () => {
  it.each(SCENARIOS)(
    "%s",
    async (name) => {
      check(name, await runHostC(name, workspace(`c-${name}`)), { parallelReads: true });
    },
    90_000,
  );
});
