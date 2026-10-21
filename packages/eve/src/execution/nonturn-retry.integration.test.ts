import type { AnyEventRequest } from "@workflow/world";
import { expect, it, vi } from "vitest";
import { streamSessionEvents } from "#execution/session-event-stream.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { buildSerializedContext } from "#internal/testing/entry-test-helpers.js";
import {
  nonturnRetryWorkflow,
  nonturnCancellationRetryWorkflow,
  terminalAfterStaleCheckpointWorkflow,
} from "#internal/testing/nonturn-retry-workflow.js";
import { getWorld, start } from "#internal/workflow/runtime.js";
import { defineHook } from "#public/definitions/hook.js";

it("adopts a non-turn publication after its step loses the checkpoint", async () => {
  const positions: number[] = [];
  const runtime = await createTestRuntime({
    agent: { name: "nonturn-retry" },
    modules: [
      {
        logicalPath: "hooks/audit.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "session.started"(_event, ctx) {
                positions.push(ctx.position.line);
              },
            },
          }),
        }),
      },
    ],
  });
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
        throw new Error("Process exited after non-turn publication");
      }
      return await createEvent(...args);
    });
    try {
      const run = await start(nonturnRetryWorkflow, [
        buildSerializedContext({ channelKind: "http" }),
      ]);
      sessionId = run.runId;
      expect(await run.returnValue).toBe(sessionId);
      expect(interrupted).toBe(true);
      expect(positions).toEqual([0, 0]);
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

it("preserves a hook cancellation on an adopted publication", async () => {
  let deliveries = 0;
  const runtime = await createTestRuntime({
    agent: { name: "retry-hook-cancellation" },
    modules: [
      {
        logicalPath: "hooks/cancel.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "session.started"(_event, ctx) {
                if (++deliveries === 2) ctx.cancel();
              },
            },
          }),
        }),
      },
    ],
  });
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
        throw new Error("Process exited after publication");
      }
      return await createEvent(...args);
    });
    try {
      const run = await start(nonturnCancellationRetryWorkflow, [
        buildSerializedContext({ channelKind: "http" }),
      ]);
      sessionId = run.runId;
      expect(await run.returnValue).toBe(true);
      expect(interrupted).toBe(true);
      expect(deliveries).toBe(2);
      const events = [];
      for await (const event of streamSessionEvents(sessionId, { follow: false }))
        events.push(event);
      expect(events.map((event) => event.type)).toEqual(["session.started"]);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
    }
  });
}, 60_000);

it("writes a terminal closure at the physical tail when providers cannot restore", async () => {
  const runtime = await createTestRuntime({ agent: { name: "terminal-fallback" } });
  await runtime.run(async () => {
    const run = await start(terminalAfterStaleCheckpointWorkflow, [
      buildSerializedContext({ channelKind: "http" }),
      true,
    ]);
    expect(await run.returnValue).toBe(run.runId);
    const events = [];
    for await (const event of streamSessionEvents(run.runId, { follow: false })) events.push(event);
    expect(events.map((event) => [event.type, event.meta.position.line])).toEqual([
      ["session.started", 0],
      ["turn.started", 1],
      ["turn.settled", 2],
      ["session.ended", 2],
    ]);
  });
}, 60_000);

it("folds orphan writes before the first terminal attempt and redispatches at physical positions", async () => {
  const positions: number[] = [];
  const runtime = await createTestRuntime({
    agent: { name: "terminal-orphan" },
    modules: [
      {
        logicalPath: "hooks/audit.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "turn.started"(_event, ctx) {
                positions.push(ctx.position.line);
              },
            },
          }),
        }),
      },
    ],
  });
  await runtime.run(async () => {
    const run = await start(terminalAfterStaleCheckpointWorkflow, [
      buildSerializedContext({ channelKind: "http" }),
    ]);
    expect(await run.returnValue).toBe(run.runId);
    const events = [];
    for await (const event of streamSessionEvents(run.runId, { follow: false })) events.push(event);
    expect(events.map((event) => [event.type, event.meta.position.line])).toEqual([
      ["session.started", 0],
      ["turn.started", 1],
      ["turn.settled", 2],
      ["session.ended", 2],
    ]);
    expect(positions).toEqual([1, 1]);
  });
}, 60_000);
