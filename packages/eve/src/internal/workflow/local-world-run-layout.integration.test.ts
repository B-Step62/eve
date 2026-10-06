import { mkdtemp, readdir, rename, rm, rmdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createWorld } from "#compiled/@workflow/world-local/index.js";

// Pins the patched `@workflow/world-local` (patches/@workflow__world-local@5.0.1.patch):
// event and step files live in one directory per run, so writing an event or
// listing a run costs time proportional to that run rather than to every file
// a long-lived agent's store has accumulated. Stores written in the old flat
// layout are converted on first use.

type LocalWorld = ReturnType<typeof createWorld>;

async function seedRun(world: LocalWorld): Promise<string> {
  const created = await world.events.create(null, {
    eventType: "run_created",
    eventData: { deploymentId: "dpl_test", workflowName: "wf", input: new Uint8Array([1]) },
  });
  const runId = created.event!.runId;
  await world.events.create(runId, { eventType: "run_started" });
  for (const i of [0, 1]) {
    const correlationId = `step_${i}`;
    await world.events.create(runId, {
      eventType: "step_created",
      correlationId,
      eventData: { stepName: "s", input: new Uint8Array([i]) },
    });
    await world.events.create(runId, { eventType: "step_started", correlationId });
    await world.events.create(runId, {
      eventType: "step_completed",
      correlationId,
      eventData: { result: new Uint8Array([i, i]) },
    });
  }
  return runId;
}

async function readRun(world: LocalWorld, runId: string) {
  const events = await world.events.list({ runId, pagination: { limit: 100, sortOrder: "asc" } });
  const steps = await world.steps.list({ runId, pagination: { limit: 100, sortOrder: "asc" } });
  return { events: events.data, steps: steps.data };
}

describe("local workflow world run layout", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    roots.length = 0;
  });

  async function tempDataDir() {
    const root = await mkdtemp(join(tmpdir(), "eve-run-layout-"));
    roots.push(root);
    return join(root, ".workflow-data");
  }

  it("stores each run's events and steps in its own directory", async () => {
    const dataDir = await tempDataDir();
    const runId = await seedRun(createWorld({ dataDir }));

    expect(await readdir(join(dataDir, "events"))).toEqual([runId]);
    expect(await readdir(join(dataDir, "steps"))).toEqual([runId]);
    expect((await readdir(join(dataDir, "events", runId))).length).toBe(8);
    expect((await readdir(join(dataDir, "steps", runId))).length).toBe(2);
  });

  it("converts a store written in the flat layout without losing data", async () => {
    const dataDir = await tempDataDir();
    const runIds = [
      await seedRun(createWorld({ dataDir })),
      await seedRun(createWorld({ dataDir })),
    ];
    const before = await Promise.all(runIds.map((id) => readRun(createWorld({ dataDir }), id)));

    // Rewrite the store into the layout every earlier release wrote.
    for (const entity of ["events", "steps"]) {
      for (const runId of runIds) {
        const runDir = join(dataDir, entity, runId);
        for (const name of await readdir(runDir)) {
          await rename(join(runDir, name), join(dataDir, entity, name));
        }
        await rmdir(runDir);
      }
    }

    // The conversion runs once per data directory per process, so open the
    // flat store under a path this process has not seen, as a restart would.
    const restarted = join(dataDir, "..", "restarted");
    await rename(dataDir, restarted);
    const after = await Promise.all(
      runIds.map((id) => readRun(createWorld({ dataDir: restarted }), id)),
    );
    expect(after).toEqual(before);

    for (const entity of ["events", "steps"]) {
      const entries = await readdir(join(restarted, entity));
      expect(entries.sort()).toEqual([...runIds].sort());
      for (const entry of entries) {
        expect((await stat(join(restarted, entity, entry))).isDirectory()).toBe(true);
      }
    }
  });
});
