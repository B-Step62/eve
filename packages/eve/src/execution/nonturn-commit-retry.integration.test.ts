import type { AnyEventRequest } from "@workflow/world";
import { expect, it, vi } from "vitest";
import { streamSessionEvents } from "#execution/session-event-stream.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { buildSerializedContext } from "#internal/testing/entry-test-helpers.js";
import {
  nonturnCommitRetryWorkflow,
  nonturnMultiCommitRetryWorkflow,
} from "#internal/testing/nonturn-retry-workflow.js";
import { getWorld, start } from "#internal/workflow/runtime.js";

it("adopts a retried control commit without losing its private state", async () => {
  const runtime = await createTestRuntime({ agent: { name: "nonturn-commit-retry" } });
  await runtime.run(async () => {
    const world = await getWorld();
    const createBatch = world.events.createBatch;
    world.events.createBatch = undefined;
    const createEvent = world.events.create.bind(world.events);
    let sessionId: string | undefined;
    let interrupted = false;
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (!interrupted && runId === sessionId && event.eventType === "step_completed") {
        interrupted = true;
        throw new Error("Process exited after control publication");
      }
      return await createEvent(...args);
    });
    try {
      const run = await start(nonturnCommitRetryWorkflow, [
        buildSerializedContext({ channelKind: "http" }),
      ]);
      sessionId = run.runId;
      expect(await run.returnValue).toMatchObject({
        sessionId,
        grants: [{ toolName: "lookup", interactionId: "approval-1" }],
      });
      expect(interrupted).toBe(true);
      const events = [];
      for await (const event of streamSessionEvents(sessionId, { follow: false }))
        events.push(event);
      expect(events.map((event) => [event.type, event.meta.position.line])).toEqual([
        ["session.started", 0],
        ["turn.started", 1],
      ]);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
    }
  });
}, 60_000);

it("fails a multi-commit step closed when its private intermediate result was lost", async () => {
  const runtime = await createTestRuntime({ agent: { name: "nonturn-multi-commit-retry" } });
  await runtime.run(async () => {
    const world = await getWorld();
    const createBatch = world.events.createBatch;
    world.events.createBatch = undefined;
    const createEvent = world.events.create.bind(world.events);
    let sessionId: string | undefined;
    let interrupted = false;
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (!interrupted && runId === sessionId && event.eventType === "step_completed") {
        interrupted = true;
        throw new Error("Process exited after both commits");
      }
      return await createEvent(...args);
    });
    try {
      const run = await start(nonturnMultiCommitRetryWorkflow, [
        buildSerializedContext({ channelKind: "http" }),
      ]);
      sessionId = run.runId;
      await expect(run.returnValue).rejects.toThrow(/STEP_INTERRUPTED/);
      expect(interrupted).toBe(true);
      const events = [];
      for await (const event of streamSessionEvents(sessionId, { follow: false }))
        events.push(event);
      expect(events.map((event) => event.type)).toEqual(["session.started", "turn.started"]);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
    }
  });
}, 60_000);
