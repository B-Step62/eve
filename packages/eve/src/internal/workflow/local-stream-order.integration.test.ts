import fs from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

import { createWorld } from "@workflow/world-local";
import { expect, it, vi } from "vitest";

// Files become visible before their notifications; a snapshot can overlap both.
it("keeps snapshot chunks in order when live notifications overlap the disk read", async () => {
  const dir = await fs.mkdtemp(join(os.tmpdir(), "eve-stream-order-"));
  const world = createWorld({ dataDir: dir, recoverActiveRuns: false });
  await world.streams.write("run", "stream", new Uint8Array());
  const turn = Promise.withResolvers<void>();
  const step = Promise.withResolvers<void>();
  const files = Promise.withResolvers<void>();
  const rename = fs.rename.bind(fs);
  const readFile = fs.readFile.bind(fs);
  let count = 0;
  let delayed = false;
  const renameSpy = vi.spyOn(fs, "rename").mockImplementation(async (...args) => {
    await rename(...args);
    if (!String(args[1]).endsWith(".bin")) return;
    const index = ++count;
    if (count === 3) files.resolve();
    // Keep notifications pending after their files are atomically installed.
    if (index === 2) await turn.promise;
    if (index === 3) await step.promise;
  });
  const readSpy = vi.spyOn(fs, "readFile").mockImplementation(async (...args) => {
    if (!delayed && String(args[0]).endsWith(".bin")) {
      delayed = true;
      turn.resolve();
      // Drain the released writer's microtasks before the snapshot read resumes.
      await setImmediate();
    }
    return await readFile(...args);
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let writing: Promise<void> | undefined;
  try {
    const expected = ["session.started", "turn.started", "step.started"];
    writing = Promise.all(
      expected.map((s) => world.streams.write("run", "stream", new TextEncoder().encode(s))),
    ).then(() => {});
    await files.promise;
    reader = (await world.streams.get("run", "stream")).getReader();
    const actual: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      actual.push(new TextDecoder().decode((await reader.read()).value));
    }
    step.resolve();
    await writing;
    await world.streams.close("run", "stream");
    expect(actual).toEqual(expected);
    expect((await reader.read()).done).toBe(true);
  } finally {
    turn.resolve();
    step.resolve();
    await writing;
    await reader?.cancel();
    renameSpy.mockRestore();
    readSpy.mockRestore();
    await world.close?.();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

it("does not expose a later batch chunk while an earlier file is still being installed", async () => {
  const dir = await fs.mkdtemp(join(os.tmpdir(), "eve-stream-batch-"));
  const world = createWorld({ dataDir: dir, recoverActiveRuns: false });
  await world.streams.write("run", "stream", new Uint8Array());
  const blocked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const rename = fs.rename.bind(fs);
  let count = 0;
  const spy = vi.spyOn(fs, "rename").mockImplementation(async (...args) => {
    if (String(args[1]).endsWith(".bin") && ++count === 2) {
      blocked.resolve();
      await release.promise;
    }
    await rename(...args);
  });
  let writing: Promise<void> | undefined;
  try {
    writing = world.streams.writeMulti!(
      "run",
      "stream",
      ["session", "turn", "step"].map((s) => new TextEncoder().encode(s)),
    );
    await blocked.promise;
    // Let any independently scheduled later writes complete.
    await setImmediate();
    await setImmediate();
    const names = await fs.readdir(join(dir, "streams/chunks/stream"));
    const chunks = await Promise.all(
      names
        .filter((n) => n.endsWith(".bin"))
        .map((n) => fs.readFile(join(dir, "streams/chunks/stream", n))),
    );
    expect(chunks.map((b) => b.subarray(1).toString())).not.toContain("step");
  } finally {
    release.resolve();
    await writing;
    spy.mockRestore();
    await world.close?.();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
