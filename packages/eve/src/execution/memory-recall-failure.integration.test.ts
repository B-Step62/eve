import { afterEach, describe, expect, it, vi } from "vitest";

import { mockModel } from "#evals/mock-model.js";
import { sessionInboxHookToken } from "#execution/session-inbox/address.js";
import { workflowEntry } from "#execution/session/entry.js";
import { createTestRuntime, type TestRuntime } from "#internal/testing/app-harness.js";
import { captureTurnEvents } from "#internal/testing/events.js";
import { startSessionOwner, waitForHook } from "#internal/testing/workflow-test-helpers.js";
import { resumeHook } from "#internal/workflow/runtime.js";
import { defineAgent } from "#public/definitions/agent.js";
import { defineMemory, type MemoryProvider } from "#public/memory/index.js";
import { createBundledRuntimeCompiledArtifactsSource } from "#runtime/compiled-artifacts-source.js";
import { defineTool } from "#tools/definition.js";

function memoryModule(recall: MemoryProvider["recall"], capture?: MemoryProvider["capture"]) {
  return {
    loadNamespace: async () => ({
      default: defineMemory({
        description: "Plants the person has told the agent about.",
        provider: { capture, recall },
        scope: "test",
      }),
    }),
    logicalPath: "memory/plants.ts",
  };
}

/** An agent whose first step reports most of the context window, so eve compacts before the next step. */
function compactingAgent(onSummary: () => void) {
  return defineAgent({
    modelContextWindowTokens: 128_000,
    model: mockModel(({ messages, toolResults }) => {
      if (/checkpoint/i.test(messages[0]?.text ?? "")) {
        onSummary();
        return "Summary: the person's fern has brown tips and dry soil.";
      }
      if (toolResults.length === 0) {
        return {
          toolCalls: [{ name: "check_soil" }],
          usage: { inputTokens: 120_000, outputTokens: 10 },
        };
      }
      return "Water it when the top inch of soil is dry.";
    }),
  });
}

const checkSoilTool = {
  loadNamespace: async () => ({
    default: defineTool({
      description: "Reads the soil moisture sensor.",
      inputSchema: { properties: {}, type: "object" },
      execute: async () => ({ moisture: "dry" }),
    }),
  }),
  logicalPath: "tools/check_soil.ts",
};

/** Runs two turns on one session and returns each turn's event types, cancelling the parked session. */
async function twoTurnEventTypes(runtime: TestRuntime, name: string): Promise<string[][]> {
  const continuationToken = `http:${name}`;
  return await runtime.run(async () => {
    const run = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: "My fern has brown tips." },
        serializedContext: {
          "eve.auth": null,
          "eve.bundle": { source: createBundledRuntimeCompiledArtifactsSource() },
          "eve.channel": { kind: "http", state: {} },
          "eve.continuationToken": continuationToken,
          "eve.stateLayout": 1,
        },
      },
    ]);
    const stream = captureTurnEvents(run);
    const turns: string[][] = [];
    try {
      turns.push((await stream.nextTurn()).map((event) => event.type));
      if (turns[0]?.at(-1) !== "session.waiting") return turns;
      const inboxToken = sessionInboxHookToken(continuationToken);
      await waitForHook({ runId: run.runId }, { token: inboxToken });
      await resumeHook(inboxToken, { kind: "send", payload: { message: "It's still drooping." } });
      turns.push((await stream.nextTurn()).map((event) => event.type));
      if (turns[1]?.at(-1) === "session.waiting") await run.cancel();
      return turns;
    } finally {
      stream.dispose();
    }
  });
}

function expectFailedThenRecovered(turns: string[][]): void {
  expect(turns).toHaveLength(2);
  const [first = [], second = []] = turns;
  expect(first.slice(-2)).toEqual(["turn.failed", "session.waiting"]);
  expect(first.filter((type) => type === "turn.failed")).toHaveLength(1);
  expect(second).not.toContain("turn.failed");
  expect(second.slice(-2)).toEqual(["turn.completed", "session.waiting"]);
  expect(turns.flat()).not.toContain("session.failed");
}

// #4896: a recall error fails the turn once instead of escaping `turnStep` into step retries,
// and the session answers the next message once the provider recovers.
describe("memory recall failures", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails the turn once and keeps the session when turn.started recall throws", async () => {
    let recalls = 0;
    const runtime = await createTestRuntime({
      agent: { name: "turn-started-recall-failure" },
      modules: [
        memoryModule({
          "turn.started": async () => {
            recalls += 1;
            if (recalls === 1) throw new Error("plant store is down");
            return null;
          },
        }),
      ],
    });

    const turns = await twoTurnEventTypes(runtime, "turn-started-recall-failure");

    expectFailedThenRecovered(turns);
    expect(recalls).toBe(2);
  });

  it("fails the turn once and keeps the session when compaction.completed recall throws", async () => {
    let recalls = 0;
    let summaries = 0;
    // Test runs swap authored models for a canned mock; this case scripts its own.
    vi.stubEnv("NODE_ENV", "development");
    const runtime = await createTestRuntime({
      agent: {
        definition: compactingAgent(() => {
          summaries += 1;
        }),
        name: "compaction-recall-failure",
      },
      modules: [
        memoryModule({
          "turn.started": async () => null,
          "compaction.completed": async () => {
            recalls += 1;
            if (recalls === 1) throw new Error("plant store is down");
            return null;
          },
        }),
        checkSoilTool,
      ],
    });

    const turns = await twoTurnEventTypes(runtime, "compaction-recall-failure");

    expectFailedThenRecovered(turns);
    expect({ recalls, summaries }).toEqual({ recalls: 2, summaries: 2 });
  });

  it("fails the turn once and keeps the session when compaction.requested capture throws", async () => {
    let captures = 0;
    let summaries = 0;
    vi.stubEnv("NODE_ENV", "development");
    const runtime = await createTestRuntime({
      agent: {
        definition: compactingAgent(() => {
          summaries += 1;
        }),
        name: "compaction-capture-failure",
      },
      modules: [
        memoryModule(
          { "turn.started": async () => null, "compaction.completed": async () => null },
          {
            "compaction.requested": async () => {
              captures += 1;
              if (captures === 1) throw new Error("plant store is down");
            },
          },
        ),
        checkSoilTool,
      ],
    });

    const turns = await twoTurnEventTypes(runtime, "compaction-capture-failure");

    expectFailedThenRecovered(turns);
    expect({ captures, summaries }).toEqual({ captures: 2, summaries: 1 });
  });
});
