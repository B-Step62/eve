import { afterEach, describe, expect, it, vi } from "vitest";
import { defineHook } from "#public/definitions/hook.js";
import { hydrateStepReturnValue, hydrateWorkflowArguments } from "@workflow/core/serialization";
import { getWorld, start } from "#internal/workflow/runtime.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { captureTurnEvents } from "#internal/testing/events.js";
import { workflowEntry } from "#execution/session/entry.js";
import { deploymentPromotionWorkflow } from "#execution/deployment-promotion.js";
import { EVE_PROACTIVE_HANDOFF_ATTRIBUTE } from "#execution/deployment-promotion-protocol.js";
import { resolveInstalledPackageInfo } from "#internal/application/package.js";
import { buildSerializedContext, handoffFollowUp } from "#internal/testing/entry-test-helpers.js";
import { waitForHook } from "#internal/testing/workflow-test-helpers.js";
import { createWorkflowRuntime, waitForCommandHookOwner } from "#execution/workflow-runtime.js";
import { createBundledRuntimeCompiledArtifactsSource } from "#runtime/compiled-artifacts-source.js";
import {
  sessionCommandHookToken,
  sessionInboxHookToken,
} from "#execution/session-inbox/address.js";

const config = {
  webhookId: "hook_test",
  secret: "test-secret",
  projectId: "prj_test",
  ownerId: "team_test",
  url: "https://test.vercel.app/eve/v1/deployment/promoted",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("proactive deployment transfer", () => {
  it.each([false, true])(
    "moves an idle owner before the next message, preserving its stream (existing conversation: %s)",
    async (existing) => {
      vi.stubEnv("EVE_DEPLOYMENT_WEBHOOK_CONFIG", JSON.stringify(config));
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ projectId: config.projectId, deploymentId: "dpl_B" })),
      );
      const runtime = await createTestRuntime({ agent: { name: "promotion-transfer" } });
      await runtime.run(async () => {
        const namespace = process.env.WORKFLOW_QUEUE_NAMESPACE!;
        const anchor = await start(
          workflowEntry,
          [
            {
              kind: "initial",
              ownerDeploymentId: "dpl_A",
              sessionTimeoutMs: 60_000,
              input: existing ? { message: "Alice opens a research session." } : {},
              serializedContext: buildSerializedContext({
                acceptedDeploymentId: "dpl_A",
                channelKind: "http",
              }),
            },
          ],
          {
            allowReservedAttributes: true,
            attributes: {
              "$eve.version": resolveInstalledPackageInfo().version,
              "$eve.type": "session",
              [EVE_PROACTIVE_HANDOFF_ATTRIBUTE]: namespace,
            },
          },
        );
        const stream = captureTurnEvents(anchor);
        const token = sessionInboxHookToken(sessionCommandHookToken(anchor.runId));
        const workflowRuntime = createWorkflowRuntime({
          compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
        });
        try {
          if (existing) await stream.nextTurn();
          await waitForHook(anchor, { token });
          const originalDeadline = await readTimeoutDeadline(anchor.runId);
          const sweep = await start(deploymentPromotionWorkflow, [
            {
              eventId: "evt_test",
              promotedAt: Date.now(),
              targetDeploymentId: "dpl_B",
              queueNamespace: namespace,
            },
          ]);
          await sweep.returnValue;
          await vi.waitFor(
            async () => expect((await waitForCommandHookOwner(token)).runId).not.toBe(anchor.runId),
            { timeout: 10000 },
          );
          const successor = await waitForCommandHookOwner(token);
          expect(await readTimeoutDeadline(successor.runId)).toEqual(originalDeadline);
          expect((await (await getWorld()).runs.get(successor.runId)).deploymentId).toBe("dpl_B");
          await workflowRuntime.dispatchSession({
            sessionId: anchor.runId,
            command: handoffFollowUp(
              "dpl_B",
              "Bob requests a research summary.",
              "after-promotion",
            ),
          });
          const turn = await stream.nextTurn();
          expect(
            turn.some(
              (event) =>
                event.type === "message.completed" &&
                event.data.message?.includes("Bob requests a research summary."),
            ),
          ).toBe(true);
          expect((await waitForCommandHookOwner(token)).runId).toBe(successor.runId);
          if (existing) {
            const owner = await (
              await getWorld()
            ).runs.get(successor.runId, { resolveData: "all" });
            const checkpoint = await hydrateWorkflowArguments(
              owner.input,
              successor.runId,
              undefined,
            );
            expect(JSON.stringify(checkpoint)).toContain("Alice opens a research session.");
          }
          const duplicate = await start(deploymentPromotionWorkflow, [
            {
              eventId: "evt_duplicate",
              promotedAt: Date.now(),
              targetDeploymentId: "dpl_B",
              queueNamespace: namespace,
            },
          ]);
          await duplicate.returnValue;
          expect((await waitForCommandHookOwner(token)).runId).toBe(successor.runId);
        } finally {
          await workflowRuntime.dispatchSession({
            sessionId: anchor.runId,
            command: { kind: "reset", reason: "test cleanup" },
          });
          await anchor.returnValue;
          stream.dispose();
        }
      });
    },
  );
  it("finishes an active turn before honoring a promotion and rejects a superseded target", async () => {
    vi.stubEnv("EVE_DEPLOYMENT_WEBHOOK_CONFIG", JSON.stringify(config));
    let promoted = "dpl_B";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ projectId: config.projectId, deploymentId: promoted })),
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let blocked = false;
    const runtime = await createTestRuntime({
      agent: { name: "promotion-active-turn" },
      modules: [
        {
          logicalPath: "hooks/hold-turn.ts",
          loadNamespace: async () => ({
            default: defineHook({
              events: {
                async "step.started"() {
                  if (!blocked) {
                    blocked = true;
                    entered.resolve();
                    await release.promise;
                  }
                },
              },
            }),
          }),
        },
      ],
    });
    await runtime.run(async () => {
      const namespace = process.env.WORKFLOW_QUEUE_NAMESPACE!;
      const anchor = await start(
        workflowEntry,
        [
          {
            kind: "initial",
            ownerDeploymentId: "dpl_A",
            sessionTimeoutMs: false,
            input: { message: "Alice requests a research summary." },
            serializedContext: buildSerializedContext({
              acceptedDeploymentId: "dpl_A",
              channelKind: "http",
            }),
          },
        ],
        {
          allowReservedAttributes: true,
          attributes: {
            "$eve.version": resolveInstalledPackageInfo().version,
            "$eve.type": "session",
            [EVE_PROACTIVE_HANDOFF_ATTRIBUTE]: namespace,
          },
        },
      );
      const stream = captureTurnEvents(anchor);
      const token = sessionInboxHookToken(sessionCommandHookToken(anchor.runId));
      const workflowRuntime = createWorkflowRuntime({
        compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      });
      try {
        await entered.promise;
        const sweep = await start(deploymentPromotionWorkflow, [
          {
            eventId: "evt_busy",
            promotedAt: Date.now(),
            targetDeploymentId: "dpl_B",
            queueNamespace: namespace,
          },
        ]);
        await sweep.returnValue;
        expect((await waitForCommandHookOwner(token)).runId).toBe(anchor.runId);
        release.resolve();
        expect((await stream.nextTurn()).some((event) => event.type === "message.completed")).toBe(
          true,
        );
        await vi.waitFor(
          async () => expect((await waitForCommandHookOwner(token)).runId).not.toBe(anchor.runId),
          { timeout: 10000 },
        );
        const successor = await waitForCommandHookOwner(token);
        promoted = "dpl_C";
        const stale = await start(deploymentPromotionWorkflow, [
          {
            eventId: "evt_stale",
            promotedAt: Date.now(),
            targetDeploymentId: "dpl_B",
            queueNamespace: namespace,
          },
        ]);
        await stale.returnValue;
        expect((await waitForCommandHookOwner(token)).runId).toBe(successor.runId);
      } finally {
        release.resolve();
        await workflowRuntime.dispatchSession({
          sessionId: anchor.runId,
          command: { kind: "reset", reason: "test cleanup" },
        });
        await anchor.returnValue;
        stream.dispose();
      }
    });
  });
});

async function readTimeoutDeadline(ownerRunId: string): Promise<Date> {
  const world = await getWorld();
  let deadline: Date | undefined;
  await vi.waitFor(async () => {
    const steps = await world.steps.list({ runId: ownerRunId, resolveData: "all" });
    const timeout = steps.data.find((step) => step.stepName.endsWith("//startSessionTimeoutStep"));
    expect(timeout?.output).toBeDefined();
    const timer = (await hydrateStepReturnValue(timeout!.output, ownerRunId, undefined)) as {
      runId: string;
    };
    const run = await world.runs.get(timer.runId);
    const [input] = (await hydrateWorkflowArguments(run.input, run.runId, undefined)) as [
      { deadline: Date },
    ];
    deadline = input.deadline;
  });
  return deadline!;
}
