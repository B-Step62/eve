import type { AnyEventRequest } from "@workflow/world";
import { expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { workflowEntry } from "#execution/session/entry.js";
import { streamSessionEvents } from "#execution/session-event-stream.js";
import { defineDynamic } from "#dynamic/definition.js";
import { markMockModel } from "#internal/mock-model-identity.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { textStreamResult, toolCallStreamResult } from "#internal/testing/approval-resume.js";
import { mockTool } from "#internal/testing/mocks/mock-tool.js";
import { buildSerializedContext } from "#internal/testing/entry-test-helpers.js";
import { startSessionOwner } from "#internal/testing/workflow-test-helpers.js";
import { getWorld } from "#internal/workflow/runtime.js";
import { defineAgent } from "#public/definitions/agent.js";
import { defineHook } from "#public/definitions/hook.js";
import { always } from "#tools/approval/policies.js";
import { forgetSessionLive } from "#reactions/state.js";
import { waitingForCleanupWorkflow } from "#internal/testing/workflow-tool-fixtures.js";
import { defineWorkflowTool } from "#tools/workflow-definition.js";
import { workflowToolRunWorkflowReference } from "#execution/workflow-runtime.js";

it.each(["completed", "paused", "task"] as const)(
  "ends the session without replaying a %s turn whose publication outlived its checkpoint",
  async (ending) => {
    let modelCalls = 0;
    let modelSelections = 0;
    let toolCalls = 0;
    let published = false;
    let interrupted = false;
    const positions: number[] = [];
    const model = markMockModel(
      new MockLanguageModelV4({
        modelId: "retry-owner",
        provider: "eve-test",
        doStream: async () => {
          modelCalls++;
          return modelCalls === 1
            ? toolCallStreamResult({ input: "{}", toolCallId: "lookup", toolName: "lookup" })
            : textStreamResult("Alice's record is ready.");
        },
      }),
    );
    const runtime = await createTestRuntime({
      tools:
        ending === "task"
          ? []
          : [
              {
                ...mockTool({
                  name: "lookup",
                  description: "Look up Alice's record.",
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
          model: defineDynamic(() => {
            modelSelections++;
            return { model, modelContextWindowTokens: 200_000 };
          }),
        }),
      },
      modules: [
        ...(ending === "task"
          ? [
              {
                logicalPath: "tools/lookup.ts",
                loadNamespace: async () => ({
                  default: defineWorkflowTool({
                    description: "Keep Alice's task running until the session ends.",
                    inputSchema: { type: "object" },
                    task: waitingForCleanupWorkflow,
                  }),
                }),
              },
            ]
          : []),
        {
          logicalPath: "hooks/positions.ts",
          loadNamespace: async () => ({
            default: defineHook({
              events: {
                "turn.paused"() {
                  published = true;
                },
                "task.started"() {
                  published = true;
                },
                "turn.settled"(_event, ctx) {
                  published = true;
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
          !interrupted &&
          published &&
          runId === sessionId &&
          event.eventType === "step_completed"
        ) {
          interrupted = true;
          forgetSessionLive(runId);
          throw new Error("Process exited after publication, before checkpoint");
        }
        return await createEvent(...args);
      });
      const run = await startSessionOwner(workflowEntry, [
        {
          kind: "initial",
          ownerDeploymentId: "dpl_inline",
          input: { message: "Help Alice look up her record." },
          serializedContext: buildSerializedContext({
            channelKind: "http",
            continuationToken: "http:retry-owner",
          }),
        },
      ]);
      sessionId = run.runId;
      try {
        await expect(run.returnValue).rejects.toThrow("Agent workflow failed");
        const events = [];
        for await (const event of streamSessionEvents(run.runId, { follow: false }))
          events.push(event);
        expect(interrupted).toBe(true);
        expect(modelCalls).toBe(ending === "completed" ? 2 : 1);
        expect(modelSelections).toBe(modelCalls);
        expect(toolCalls).toBe(ending === "completed" ? 1 : 0);
        expect(events.filter(({ type }) => type === "session.started")).toHaveLength(1);
        expect(events.filter(({ type }) => type === "turn.started")).toHaveLength(1);
        expect(events.filter(({ type }) => type === "turn.settled")).toMatchObject([
          { data: { outcome: ending === "completed" ? "completed" : "cancelled" } },
        ]);
        expect(events.filter(({ type }) => type === "session.ended")).toMatchObject([
          { data: { outcome: "failed", error: { code: "STEP_INTERRUPTED" } } },
        ]);
        expect(positions).toEqual(
          ending === "completed"
            ? events
                .filter(({ type }) => type === "turn.settled")
                .map(({ meta }) => meta.position.line)
            : [],
        );
        const lines = [...new Set(events.map(({ meta }) => meta.position.line))];
        expect(lines).toEqual(Array.from({ length: lines.length }, (_, index) => index));
        const requested = events
          .filter((event) => event.type === "model.requested")
          .map((event) => event.data.runId);
        expect(new Set(requested).size).toBe(requested.length);
        if (ending === "task") {
          expect(events.filter(({ type }) => type === "task.ended")).toHaveLength(1);
          const runs = await world.runs.list({
            workflowName: workflowToolRunWorkflowReference.workflowId,
            pagination: { limit: 100 },
            resolveData: "none",
          });
          expect(runs.data).toHaveLength(1);
          expect(runs.data[0]?.status).not.toMatch(/^(pending|running)$/u);
        }
        if (ending === "paused") {
          expect(events.filter(({ type }) => type === "interaction.settled")).toHaveLength(1);
          expect(events.filter(({ type }) => type === "call.settled")).toMatchObject([
            { data: { outcome: "interrupted" } },
          ]);
        }
      } finally {
        spy.mockRestore();
        world.events.createBatch = createBatch;
        await run.cancel().catch(() => {});
      }
    });
  },
  90_000,
);
