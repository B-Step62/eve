import type { AnyEventRequest } from "@workflow/world";
import { expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createChannelDeliveryMetadata } from "#channel/delivery-metadata.js";
import { workflowEntry } from "#execution/session/entry.js";
import { sessionInboxHookToken } from "#execution/session-inbox/address.js";
import { streamSessionEvents } from "#execution/session-event-stream.js";
import { markMockModel } from "#internal/mock-model-identity.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { textStreamResult, toolCallStreamResult } from "#internal/testing/approval-resume.js";
import { mockTool } from "#internal/testing/mocks/mock-tool.js";
import { buildSerializedContext } from "#internal/testing/entry-test-helpers.js";
import { startSessionOwner, waitForHook } from "#internal/testing/workflow-test-helpers.js";
import { getWorld, resumeHook } from "#internal/workflow/runtime.js";
import { defineDynamic } from "#dynamic/definition.js";
import { defineMcpClientConnection } from "#public/definitions/connections/mcp.js";
import { loadContext } from "#context/container.js";
import { ConnectionRegistryKey } from "#context/providers/connection.js";
import { defineAgent } from "#public/definitions/agent.js";
import { defineHook } from "#public/definitions/hook.js";
import { defineChannel, POST } from "#public/definitions/channel.js";
import { always } from "#tools/approval/policies.js";

it.each(["completed", "paused"] as const)(
  "recovers a %s turn step whose publication outlived its checkpoint",
  async (ending) => {
    let modelCalls = 0;
    let toolCalls = 0;
    const prompts: string[] = [];
    let published = false;
    let interrupted = 0;
    const positions: number[] = [];
    let sandboxResolutions = 0;
    const model = markMockModel(
      new MockLanguageModelV4({
        modelId: "retry-owner",
        provider: "eve-test",
        doStream: async ({ prompt }) => {
          prompts.push(JSON.stringify(prompt));
          modelCalls++;
          if (modelCalls === 1)
            return toolCallStreamResult({
              input: "{}",
              toolCallId: "call_retry",
              toolName: "lookup",
            });
          return textStreamResult(`reply ${modelCalls}`);
        },
      }),
    );
    const runtime = await createTestRuntime({
      tools: [
        {
          ...mockTool({
            name: "lookup",
            description: "Look up a record.",
            execute: () => {
              toolCalls++;
              return { found: true };
            },
          }),
          approval: ending === "paused" ? { request: always() } : undefined,
        },
      ],
      agent: {
        name: "retry-owner",
        definition: defineAgent({
          model: defineDynamic({
            events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
          }),
        }),
      },
      modules: [
        {
          logicalPath: "hooks/positions.ts",
          loadNamespace: async () => ({
            default: defineHook({
              events: {
                "turn.paused"() {
                  published = true;
                },
                async "turn.settled"(_event, ctx) {
                  published = true;
                  if (ending === "paused") {
                    await ctx.getSandbox();
                    sandboxResolutions++;
                  }
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
      const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
        const [runId, event] = args as [string, AnyEventRequest];
        if (
          interrupted < 2 &&
          published &&
          runId === sessionId &&
          event.eventType === "step_completed"
        ) {
          interrupted++;
          throw new Error("Process exited after publication, before checkpoint");
        }
        return await createEvent(...args);
      });
      const run = await startSessionOwner(workflowEntry, [
        {
          kind: "initial",
          ownerDeploymentId: "dpl_inline",
          input: { message: "Hello" },
          serializedContext: buildSerializedContext({
            channelKind: "http",
            continuationToken: "http:retry-owner",
          }),
        },
      ]);
      sessionId = run.runId;
      try {
        const read = async () => {
          const events = [];
          for await (const event of streamSessionEvents(run.runId, { follow: false }))
            events.push(event);
          return events;
        };
        const until = async (predicate: (events: Awaited<ReturnType<typeof read>>) => boolean) => {
          for (let i = 0; i < 300; i++) {
            const events = await read();
            if (predicate(events)) return events;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          throw new Error("Timed out waiting for recovered turn");
        };
        await until(
          (events) => interrupted === 2 && events.some((event) => event.type === "turn.settled"),
        );
        await resumeHook(sessionInboxHookToken("http:retry-owner"), {
          kind: "send",
          auth: null,
          delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
          payload: { message: "Next" },
        });
        const events = await until(
          (events) => events.filter((event) => event.type === "turn.settled").length === 2,
        );
        expect(interrupted).toBe(2);
        expect(events.filter((event) => event.type === "session.started")).toHaveLength(1);
        const requested = events
          .filter((event) => event.type === "model.requested")
          .map((event) => event.data.runId);
        expect(new Set(requested).size).toBe(requested.length);
        expect(events.filter((event) => event.type === "turn.started")).toHaveLength(2);
        expect(modelCalls).toBe(ending === "completed" ? 3 : 2);
        expect(toolCalls).toBe(ending === "completed" ? 1 : 0);
        expect(prompts.at(-1)).toContain("Hello");
        if (ending === "completed") expect(prompts.at(-1)).toContain("reply 2");
        else {
          expect(events.find((event) => event.type === "turn.settled")?.data).toMatchObject({
            error: { code: "STEP_INTERRUPTED" },
          });
          expect(events.find((event) => event.type === "call.settled")?.data).toMatchObject({
            outcome: "interrupted",
          });
          expect(prompts.at(-1)).toContain("unsaved model and tool output is unavailable");
          expect(sandboxResolutions).toBe(3);
        }
        expect(
          events
            .filter((event) => event.type === "turn.settled")
            .map((event) => event.data.outcome),
        ).toEqual([ending === "completed" ? "completed" : "failed", "completed"]);
        const settledPositions = events
          .filter((event) => event.type === "turn.settled")
          .map((event) => event.meta.position.line);
        expect(positions).toEqual([
          ...(ending === "completed" ? [settledPositions[0]] : []),
          settledPositions[0],
          ...settledPositions,
        ]);
      } finally {
        spy.mockRestore();
        world.events.createBatch = createBatch;
        await run.cancel().catch(() => {});
      }
    });
  },
  90_000,
);

it("consumes create history only once when the first message loses its checkpoint twice", async () => {
  const seed = [{ role: "user" as const, text: "Seeded context" }];
  const prompts: string[] = [];
  let settled = false;
  let interrupted = 0;
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "history-retry",
      provider: "eve-test",
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return textStreamResult(`reply ${prompts.length}`);
      },
    }),
  );
  const runtime = await createTestRuntime({
    agent: {
      name: "history-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "hooks/history.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "turn.settled"() {
                settled = true;
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (
        interrupted < 2 &&
        settled &&
        runId === sessionId &&
        event.eventType === "step_completed"
      ) {
        interrupted++;
        throw new Error("Lost first message checkpoint");
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { history: seed },
        serializedContext: buildSerializedContext({
          channelKind: "http",
          continuationToken: "http:history-retry",
        }),
      },
    ]);
    sessionId = run.runId;
    try {
      const send = async (message: string) =>
        resumeHook(sessionInboxHookToken("http:history-retry"), {
          kind: "send",
          auth: null,
          delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
          payload: { message },
        });
      const until = async (count: number) => {
        for (let i = 0; i < 300; i++) {
          const events = [];
          for await (const event of streamSessionEvents(run.runId, { follow: false }))
            events.push(event);
          if (
            interrupted === 2 &&
            events.filter((event) => event.type === "turn.settled").length >= count
          )
            return events;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("Timed out waiting for recovered history turn");
      };
      await waitForHook(run, { token: sessionInboxHookToken("http:history-retry") });
      await send("First");
      await until(1);
      await send("Next");
      const events = await until(2);
      const consumed = events.filter((event) => event.type === "delivery.consumed");
      expect(consumed).toHaveLength(2);
      expect(consumed[0]?.data.history).toEqual(seed);
      expect(consumed[1]?.data.history ?? []).toEqual([]);
      expect(prompts).toHaveLength(2);
      expect(prompts[1]?.split("Seeded context")).toHaveLength(2);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);

it("retains create history after an identical context-only delivery loses its checkpoint", async () => {
  const seed = [{ role: "user" as const, text: "Seeded context" }];
  const prompts: string[] = [];
  let settled = false;
  let interrupted = false;
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "context-history-retry",
      provider: "eve-test",
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return textStreamResult("Done.");
      },
    }),
  );
  const runtime = await createTestRuntime({
    agent: {
      name: "context-history-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "channels/context-history.ts",
        loadNamespace: async () => ({
          default: defineChannel({
            routes: [POST("/context-history", async () => new Response("ok"))],
            deliver(payload) {
              return { message: payload.message ?? "Context review", context: payload.context };
            },
          }),
        }),
      },
      {
        logicalPath: "hooks/context-history.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "turn.settled"() {
                settled = true;
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (!interrupted && settled && runId === sessionId && event.eventType === "step_completed") {
        interrupted = true;
        throw new Error("Lost context-only turn checkpoint");
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { history: seed },
        serializedContext: buildSerializedContext({
          channelKind: "channel:context-history",
          continuationToken: "context-history-retry",
        }),
      },
    ]);
    sessionId = run.runId;
    const read = async () => {
      const events = [];
      for await (const event of streamSessionEvents(run.runId, { follow: false }))
        events.push(event);
      return events;
    };
    const until = async (predicate: (events: Awaited<ReturnType<typeof read>>) => boolean) => {
      for (let i = 0; i < 300; i++) {
        const events = await read();
        if (predicate(events)) return events;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Timed out waiting for context history recovery");
    };
    try {
      await waitForHook(run, { token: sessionInboxHookToken("context-history-retry") });
      const send = async (payload: {
        message?: string;
        context?: string[];
        history?: typeof seed;
      }) =>
        resumeHook(sessionInboxHookToken("context-history-retry"), {
          kind: "send",
          auth: null,
          delivery: createChannelDeliveryMetadata({
            channelKind: "channel:context-history",
            channelName: "context-history",
          }),
          payload,
        });
      await send({ context: ["Extra context"], history: seed });
      const first = await until(
        (events) => interrupted && events.some((event) => event.type === "turn.settled"),
      );
      expect(first.filter((event) => event.type === "delivery.consumed")[0]?.data.history).toEqual(
        seed,
      );
      await send({ message: "First message" });
      const events = await until(
        (events) => events.filter((event) => event.type === "turn.settled").length === 2,
      );
      expect(interrupted).toBe(true);
      expect(events.filter((event) => event.type === "delivery.consumed")[1]?.data.history).toEqual(
        seed,
      );
      expect(prompts.at(-1)?.split("Seeded context")).toHaveLength(3);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);

it("rehydrates checkpointed dynamic connections for a redispatched hook", async () => {
  let calls = 0;
  let interrupted = false;
  const seen: string[][] = [];
  const offeredReplyTool: boolean[] = [];
  const promptMessages: Array<{ role: string; content: unknown }[]> = [];
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "connection-retry",
      provider: "eve-test",
      doStream: async ({ tools, prompt }) => {
        promptMessages.push(prompt.map(({ role, content }) => ({ role, content })));
        offeredReplyTool.push(tools?.some((tool) => tool.name === "eve__reply") ?? false);
        calls++;
        if (calls === 1)
          return toolCallStreamResult({
            input: "{}",
            toolCallId: "schema_lookup",
            toolName: "lookup",
          });
        if (calls === 2)
          return toolCallStreamResult({
            input: '{"answer":"yes"}',
            toolCallId: "schema_reply",
            toolName: "eve__reply",
          });
        return textStreamResult(`reply ${calls}`);
      },
    }),
  );
  const runtime = await createTestRuntime({
    tools: [
      mockTool({
        name: "lookup",
        description: "Look up a record.",
        execute: () => ({ found: true }),
      }),
    ],
    agent: {
      name: "connection-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "connections/dynamic.ts",
        loadNamespace: async () => ({
          default: defineDynamic({
            events: {
              beforeSession: () =>
                defineMcpClientConnection({
                  url: "https://example.com/mcp",
                  description: "Local test binding",
                }),
            },
          }),
        }),
      },
      {
        logicalPath: "hooks/connections.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "turn.settled"() {
                seen.push([...loadContext().require(ConnectionRegistryKey).getConnectionNames()]);
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (
        !interrupted &&
        seen.length === 1 &&
        runId === sessionId &&
        event.eventType === "step_completed"
      ) {
        interrupted = true;
        throw new Error("Process exited after publication");
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "Hello", outputSchema: { type: "object" } },
        serializedContext: buildSerializedContext({
          channelKind: "http",
          continuationToken: "http:connection-retry",
        }),
      },
    ]);
    sessionId = run.runId;
    try {
      const until = async (count: number) => {
        for (let i = 0; i < 300; i++) {
          const events = [];
          for await (const event of streamSessionEvents(run.runId, { follow: false }))
            events.push(event);
          if (events.filter((event) => event.type === "turn.settled").length >= count)
            return events;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("Timed out waiting for turn");
      };
      await until(1);
      await resumeHook(sessionInboxHookToken("http:connection-retry"), {
        kind: "send",
        auth: null,
        delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
        payload: { message: "Next" },
      });
      await until(2);
      for (let i = 0; i < 300 && seen.length < 3; i++)
        await new Promise((resolve) => setTimeout(resolve, 100));
      expect(interrupted).toBe(true);
      expect(calls).toBe(3);
      expect(offeredReplyTool).toEqual([true, true, false]);
      const nextPrompt = promptMessages[2]!;
      const lastToolIndex = nextPrompt.findLastIndex(({ role }) => role === "tool");
      expect(lastToolIndex).toBeGreaterThan(-1);
      expect(nextPrompt.slice(lastToolIndex + 1)).toEqual([
        { role: "assistant", content: [{ type: "text", text: '{"answer":"yes"}' }] },
        { role: "user", content: [{ type: "text", text: "Next" }] },
      ]);
      const results = (await until(2)).flatMap((event) =>
        event.type === "content.completed" && event.data.kind === "result"
          ? [event.data.value]
          : [],
      );
      expect(results).toContainEqual({ answer: "yes" });
      expect(seen).toEqual([["dynamic"], ["dynamic"], ["dynamic"]]);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);

it("honors cancellation from a replayed cancellable turn hook", async () => {
  let requested = 0;
  let interrupted = false;
  let modelCalls = 0;
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "cancel-retry",
      provider: "eve-test",
      doStream: async () => {
        modelCalls++;
        return toolCallStreamResult({ input: "{}", toolCallId: "approval", toolName: "lookup" });
      },
    }),
  );
  const runtime = await createTestRuntime({
    tools: [
      {
        ...mockTool({
          name: "lookup",
          description: "Look up a record.",
          execute: () => ({ found: true }),
        }),
        approval: { request: always() },
      },
    ],
    agent: {
      name: "cancel-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "hooks/cancel-replay.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "call.requested"(_event, ctx) {
                if (++requested === 2) ctx.cancel();
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (
        !interrupted &&
        requested === 1 &&
        runId === sessionId &&
        event.eventType === "step_completed"
      ) {
        interrupted = true;
        throw new Error("Process exited after call.requested");
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "Hello" },
        serializedContext: buildSerializedContext({
          channelKind: "http",
          continuationToken: "http:cancel-retry",
        }),
      },
    ]);
    sessionId = run.runId;
    try {
      const until = async () => {
        for (let i = 0; i < 300; i++) {
          const events = [];
          for await (const event of streamSessionEvents(run.runId, { follow: false }))
            events.push(event);
          if (events.some((event) => event.type === "turn.settled")) return events;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("Timed out waiting for cancellation");
      };
      const events = await until();
      expect(interrupted).toBe(true);
      expect(requested).toBe(2);
      expect(modelCalls).toBe(1);
      expect(events.find((event) => event.type === "turn.settled")?.data.outcome).toBe("cancelled");
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);

it("terminates the owner when a lost turn checkpoint already ended the session", async () => {
  let interrupted = false;
  const runtime = await createTestRuntime({
    agent: {
      name: "terminal-turn-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: {
            beforeModel: () => {
              throw new Error("No model available");
            },
          },
        }),
      }),
    },
  });
  await runtime.run(async () => {
    const world = await getWorld();
    const createBatch = world.events.createBatch;
    world.events.createBatch = undefined;
    const createEvent = world.events.create.bind(world.events);
    let sessionId: string | undefined;
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (!interrupted && runId === sessionId && event.eventType === "step_completed") {
        const events = [];
        for await (const written of streamSessionEvents(runId, { follow: false }))
          events.push(written);
        if (events.some((written) => written.type === "session.ended")) {
          interrupted = true;
          throw new Error("Process exited after session.ended, before turn checkpoint");
        }
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "Hello" },
        serializedContext: buildSerializedContext({
          channelKind: "http",
          continuationToken: "http:terminal-turn-retry",
        }),
      },
    ]);
    sessionId = run.runId;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        run.returnValue,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Owner remained parked after session.ended")),
            20_000,
          );
        }),
      ]);
      expect(await run.status).toBe("completed");
      expect(interrupted).toBe(true);
      const events = [];
      for await (const event of streamSessionEvents(run.runId, { follow: false }))
        events.push(event);
      expect(events.filter((event) => event.type === "session.ended")).toHaveLength(1);
    } finally {
      clearTimeout(timeout);
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 60_000);

it("keeps typed approval text out of recovered model history", async () => {
  const prompts: string[] = [];
  let settled = false;
  let interrupted = false;
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "typed-retry",
      provider: "eve-test",
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return prompts.length === 1
          ? toolCallStreamResult({ input: "{}", toolCallId: "approval", toolName: "lookup" })
          : textStreamResult("Approved.");
      },
    }),
  );
  const runtime = await createTestRuntime({
    tools: [
      {
        ...mockTool({
          name: "lookup",
          description: "Look up a record.",
          execute: () => ({ found: true }),
        }),
        approval: { request: always() },
      },
    ],
    agent: {
      name: "typed-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "hooks/settled.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "turn.settled"() {
                settled = true;
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (!interrupted && settled && runId === sessionId && event.eventType === "step_completed") {
        interrupted = true;
        throw new Error("Lost approval turn checkpoint");
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "Look up Alice's record." },
        serializedContext: {
          ...buildSerializedContext({ channelKind: "http", continuationToken: "http:typed-retry" }),
          "eve.capabilities": { requestInput: true },
        },
      },
    ]);
    sessionId = run.runId;
    const read = async () => {
      const events = [];
      for await (const event of streamSessionEvents(run.runId, { follow: false }))
        events.push(event);
      return events;
    };
    const until = async (predicate: (events: Awaited<ReturnType<typeof read>>) => boolean) => {
      for (let i = 0; i < 300; i++) {
        const events = await read();
        if (predicate(events)) return events;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Timed out waiting for approval recovery");
    };
    try {
      await until((events) => events.some((event) => event.type === "interaction.opened"));
      await resumeHook(sessionInboxHookToken("http:typed-retry"), {
        kind: "send",
        auth: null,
        delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
        payload: { message: "approve" },
      });
      const recovered = await until(
        (events) => interrupted && events.some((event) => event.type === "turn.settled"),
      );
      expect(
        recovered.some(
          (event) =>
            event.type === "response.submitted" && event.data.responseId.includes("_typed_"),
        ),
      ).toBe(true);
      await resumeHook(sessionInboxHookToken("http:typed-retry"), {
        kind: "send",
        auth: null,
        delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
        payload: { message: "What was recorded for Alice?" },
      });
      await until((events) => events.filter((event) => event.type === "turn.settled").length === 2);
      expect(prompts.at(-1)).toContain("Look up Alice's record.");
      expect(prompts.at(-1)).toContain("What was recorded for Alice?");
      expect(prompts.at(-1)).not.toContain('"text":"approve"');
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);

it("retains checkpointed history after a failed manual compaction loses its checkpoint", async () => {
  const prompts: string[] = [];
  let summaryFailed = false;
  let interrupted = false;
  let calls = 0;
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "failed-summary-retry",
      provider: "eve-test",
      doStream: async ({ prompt }) => {
        calls++;
        prompts.push(JSON.stringify(prompt));
        if (calls === 7) throw new Error("Summary model unavailable");
        return textStreamResult("Noted.");
      },
    }),
  );
  const runtime = await createTestRuntime({
    agent: {
      name: "failed-summary-retry",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "hooks/summary.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "context.settled"(event) {
                if (event.data.kind === "compaction" && event.data.outcome === "failed")
                  summaryFailed = true;
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (
        !interrupted &&
        summaryFailed &&
        runId === sessionId &&
        event.eventType === "step_completed"
      ) {
        interrupted = true;
        throw new Error("Lost failed compaction checkpoint");
      }
      return await createEvent(...args);
    });
    const token = "http:failed-summary-retry";
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "Remember Alice's first note." },
        serializedContext: buildSerializedContext({
          channelKind: "http",
          continuationToken: token,
        }),
      },
    ]);
    sessionId = run.runId;
    const read = async () => {
      const events = [];
      for await (const event of streamSessionEvents(run.runId, { follow: false }))
        events.push(event);
      return events;
    };
    const until = async (predicate: (events: Awaited<ReturnType<typeof read>>) => boolean) => {
      for (let i = 0; i < 300; i++) {
        const events = await read();
        if (predicate(events)) return events;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Timed out waiting for compaction recovery");
    };
    try {
      for (let turn = 1; turn <= 6; turn++) {
        if (turn > 1)
          await resumeHook(sessionInboxHookToken(token), {
            kind: "send",
            auth: null,
            delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
            payload: { message: `Alice's note ${turn}.` },
          });
        await until(
          (events) => events.filter((event) => event.type === "turn.settled").length === turn,
        );
      }
      await resumeHook(sessionInboxHookToken(token), {
        deliveryId: "compact_failed_retry",
        kind: "compact",
      });
      const failed = await until(
        (events) =>
          interrupted &&
          events.some(
            (event) =>
              event.type === "context.settled" &&
              event.data.kind === "compaction" &&
              event.data.outcome === "failed",
          ),
      );
      expect(failed.some((event) => event.type === "session.ended")).toBe(false);
      await resumeHook(sessionInboxHookToken(token), {
        kind: "send",
        auth: null,
        delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
        payload: { message: "Recall Alice's notes." },
      });
      const events = await until(
        (written) => written.filter((event) => event.type === "turn.settled").length === 7,
      );
      expect(events.some((event) => event.type === "session.ended")).toBe(false);
      expect(prompts.at(-1)).toContain("Remember Alice's first note.");
      expect(prompts.at(-1)).toContain("Recall Alice's notes.");
      expect(prompts.at(-1)).not.toContain("unsaved model and tool output");
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);

it("does not restore pre-clear history after a lost clear checkpoint", async () => {
  const prompts: string[] = [];
  let cleared = false;
  let interrupted = false;
  const model = markMockModel(
    new MockLanguageModelV4({
      modelId: "retry-clear",
      provider: "eve-test",
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return textStreamResult("Noted.");
      },
    }),
  );
  const runtime = await createTestRuntime({
    agent: {
      name: "retry-clear",
      definition: defineAgent({
        model: defineDynamic({
          events: { beforeModel: () => ({ model, modelContextWindowTokens: 200_000 }) },
        }),
      }),
    },
    modules: [
      {
        logicalPath: "hooks/clear.ts",
        loadNamespace: async () => ({
          default: defineHook({
            events: {
              "context.settled": (event) => {
                if (event.data.kind === "clear" && event.data.outcome === "completed")
                  cleared = true;
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
    const spy = vi.spyOn(world.events, "create").mockImplementation(async (...args) => {
      const [runId, event] = args as [string, AnyEventRequest];
      if (!interrupted && cleared && runId === sessionId && event.eventType === "step_completed") {
        interrupted = true;
        throw new Error("Process exited after clear");
      }
      return await createEvent(...args);
    });
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "Remember the number 42." },
        serializedContext: buildSerializedContext({
          channelKind: "http",
          continuationToken: "http:retry-clear",
        }),
      },
    ]);
    sessionId = run.runId;
    const read = async () => {
      const events = [];
      for await (const event of streamSessionEvents(run.runId, { follow: false }))
        events.push(event);
      return events;
    };
    const until = async (predicate: (events: Awaited<ReturnType<typeof read>>) => boolean) => {
      for (let i = 0; i < 300; i++) {
        const events = await read();
        if (predicate(events)) return events;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Timed out waiting for clear recovery");
    };
    try {
      await until((events) => events.some((event) => event.type === "turn.settled"));
      await resumeHook(sessionInboxHookToken("http:retry-clear"), {
        kind: "clear",
        auth: null,
        deliveryId: "clear_retry",
      });
      await until(
        (events) => interrupted && events.some((event) => event.type === "context.settled"),
      );
      await resumeHook(sessionInboxHookToken("http:retry-clear"), {
        kind: "send",
        auth: null,
        delivery: createChannelDeliveryMetadata({ channelKind: "http", channelName: "test" }),
        payload: { message: "What number?" },
      });
      await until((events) => events.filter((event) => event.type === "turn.settled").length === 2);
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).not.toContain("42");
      expect(prompts[1]).not.toContain("unsaved model and tool output");
      expect(prompts[1]).toContain("What number?");
      expect((await read()).filter((event) => event.type === "context.settled")).toHaveLength(1);
    } finally {
      spy.mockRestore();
      world.events.createBatch = createBatch;
      await run.cancel().catch(() => {});
    }
  });
}, 90_000);
