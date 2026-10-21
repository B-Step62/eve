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
import { startSessionOwner } from "#internal/testing/workflow-test-helpers.js";
import { getWorld, resumeHook } from "#internal/workflow/runtime.js";
import { defineDynamic } from "#dynamic/definition.js";
import { defineAgent } from "#public/definitions/agent.js";
import { defineHook } from "#public/definitions/hook.js";
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
