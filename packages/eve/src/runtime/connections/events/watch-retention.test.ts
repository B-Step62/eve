import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, expect, it, vi } from "vitest";

// This storage contract test deliberately uses real filesystem I/O, not the unit guard.
const { mkdtemp, rm } =
  await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const require = createRequire(import.meta.url);
const url = pathToFileURL(require.resolve("@workflow/world-local"));
const { createWorld }: typeof import("@workflow/world-local") = await import(
  /* @vite-ignore */ url.href
);
const dataDirs: string[] = [];

afterEach(async () => {
  await Promise.all(dataDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

it.each([true, false])(
  "completed watch hook retains its token only with retention: %s",
  async (retain) => {
    const dataDir = await mkdtemp(join(tmpdir(), "eve-watch-retention-"));
    dataDirs.push(dataDir);
    const world = createWorld({ dataDir });
    const specVersion = world.specVersion;
    const { event } = await world.events.create(null, {
      eventType: "run_created",
      specVersion,
      eventData: {
        deploymentId: "test-deployment",
        workflowName: "watch-retention",
        input: new Uint8Array(),
      },
    });
    assert(event);
    const runId = event.runId;
    await world.events.create(runId, { eventType: "run_started", specVersion });
    const token = "watch-token";
    const metadata = new TextEncoder().encode('{"watchId":"watch-1"}');
    await world.events.create(runId, {
      eventType: "hook_created",
      specVersion,
      correlationId: "hook_watch",
      eventData: {
        token,
        metadata,
        ...(retain ? { tokenRetentionUntil: new Date(Date.now() + 86_400_000) } : {}),
      },
    });
    expect(await world.hooks.getByToken(token)).toMatchObject({ runId, metadata });

    await world.events.create(runId, {
      eventType: "run_completed",
      specVersion,
      eventData: { output: new Uint8Array() },
    });

    expect((await world.runs.get(runId)).status).toBe("completed");
    if (retain) {
      expect(await world.hooks.getByToken(token)).toMatchObject({ runId, metadata });
    } else {
      await expect(world.hooks.getByToken(token)).rejects.toThrow(/not found/i);
    }
  },
);
