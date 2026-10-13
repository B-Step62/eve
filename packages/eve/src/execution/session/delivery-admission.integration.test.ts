import type { MessageStreamEvent } from "#channel/types.js";
import { describe, expect, it } from "vitest";
import { start } from "#internal/workflow/runtime.js";
import { captureTurnEvents } from "#internal/testing/events.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { waitForParkedTurnStep } from "#internal/testing/session-test-helpers.js";
import { createBundledRuntimeCompiledArtifactsSource } from "#runtime/compiled-artifacts-source.js";
import { workflowEntry } from "#execution/session/entry.js";
import {
  sessionCommandHookToken,
  sessionInboxHookToken,
} from "#execution/session-inbox/address.js";
import { createWorkflowRuntime, waitForCommandHookOwner } from "#execution/workflow-runtime.js";
import { buildSerializedContext, handoffFollowUp } from "#internal/testing/entry-test-helpers.js";

/** The user messages a turn answered, read from its completed message. */
function answered(turn: readonly MessageStreamEvent[]): string[] {
  return turn.flatMap((event) =>
    event.type === "message.completed" && typeof event.data.message === "string"
      ? [event.data.message]
      : [],
  );
}

describe("delivery id admission", () => {
  it("runs one turn for overlapping follow-ups that share a delivery id", async () => {
    const runtime = await createTestRuntime({ agent: { name: "delivery-admission-overlap" } });
    await runtime.run(async () => {
      const run = await start(workflowEntry, [
        {
          kind: "initial",
          ownerDeploymentId: "dpl_a",
          input: { message: "first message" },
          serializedContext: buildSerializedContext({
            acceptedDeploymentId: "dpl_a",
            channelKind: "http",
          }),
        },
      ]);
      const stream = captureTurnEvents(run);
      const workflowRuntime = createWorkflowRuntime({
        compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      });
      const send = (message: string, deliveryId: string) =>
        workflowRuntime.dispatchSession({
          command: handoffFollowUp("dpl_a", message, deliveryId),
          sessionId: run.runId,
        });
      try {
        await stream.nextTurn();
        await waitForParkedTurnStep(run.runId);

        // A lost response makes the host send the same delivery again while the
        // first is still in flight. Both are accepted; only one may start a turn.
        const results = await Promise.all([
          send("re-sent message", "delivery-1"),
          send("re-sent message", "delivery-1"),
        ]);
        expect(results.map((result) => result.status)).toEqual(["accepted", "accepted"]);
        expect(answered(await stream.nextTurn()).join("")).toContain("re-sent message");

        // A late re-send after the turn ran is a no-op too: the next turn answers
        // the next delivery, not the repeat.
        await expect(send("re-sent message", "delivery-1")).resolves.toMatchObject({
          status: "accepted",
        });
        await send("next message", "delivery-2");
        const next = answered(await stream.nextTurn()).join("");
        expect(next).toContain("next message");
        expect(next).not.toContain("re-sent message");
      } finally {
        stream.dispose();
        await run.cancel();
      }
    });
  });

  it("keeps earlier delivery ids admitted after a deployment handoff", async () => {
    const runtime = await createTestRuntime({ agent: { name: "delivery-admission-handoff" } });
    await runtime.run(async () => {
      const anchor = await start(workflowEntry, [
        {
          kind: "initial",
          ownerDeploymentId: "dpl_a",
          input: { message: "first message" },
          serializedContext: buildSerializedContext({
            acceptedDeploymentId: "dpl_a",
            channelKind: "http",
          }),
        },
      ]);
      const stream = captureTurnEvents(anchor);
      const workflowRuntime = createWorkflowRuntime({
        compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      });
      const send = (deployment: string, message: string, deliveryId: string) =>
        workflowRuntime.dispatchSession({
          command: handoffFollowUp(deployment, message, deliveryId),
          sessionId: anchor.runId,
        });
      try {
        await stream.nextTurn();
        await waitForParkedTurnStep(anchor.runId);
        await send("dpl_a", "before the deploy", "delivery-a");
        expect(answered(await stream.nextTurn()).join("")).toContain("before the deploy");
        await waitForParkedTurnStep(anchor.runId);

        // A delivery from the new deployment moves the session to a successor run.
        await send("dpl_b", "after the deploy", "delivery-b");
        expect(answered(await stream.nextTurn()).join("")).toContain("after the deploy");
        const successor = await waitForCommandHookOwner(
          sessionInboxHookToken(sessionCommandHookToken(anchor.runId)),
        );
        expect(successor.runId).not.toBe(anchor.runId);
        await waitForParkedTurnStep(successor.runId);

        // Re-sends of deliveries the previous owner and the handoff admitted.
        await send("dpl_b", "before the deploy", "delivery-a");
        await send("dpl_b", "after the deploy", "delivery-b");
        await send("dpl_b", "last message", "delivery-c");
        const last = answered(await stream.nextTurn()).join("");
        expect(last).toContain("last message");
        expect(last).not.toContain("before the deploy");
        expect(last).not.toContain("after the deploy");
      } finally {
        stream.dispose();
        await anchor.cancel();
      }
    });
  });
});
