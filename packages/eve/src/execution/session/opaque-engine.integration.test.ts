import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonSchema } from "ai";

import { defaultDeliverResult } from "#channel/adapter.js";
import type { DeliverHookPayload } from "#channel/types.js";
import { contextStorage } from "#context/container.js";
import { ChannelKey } from "#runtime/sessions/runtime-context-keys.js";
import { createApprovalContext } from "#internal/testing/approval-resume.js";
import { createTestSessionState } from "#internal/testing/session-state.js";
import { readDurableSession } from "#execution/durable-session-store.js";
import { openSessionEventPublisher } from "#execution/publish-session-events.js";
import { admitDeliveries } from "#execution/session/delivery-facts.js";
import { SessionLoop } from "#execution/session/session-loop.js";
import { SessionStateCursor } from "#execution/session/state-cursor.js";
import { withSessionStateDelta } from "#execution/session/state-delta.js";
import { announcesWaiting, decideStep } from "#execution/session/step-decision.js";
import { readStepState } from "#execution/session/step-reading.js";
import { resolveSessionStepResult } from "#execution/session/turn-step-result.js";
import type { TurnStepInput } from "#execution/session/turn-step-types.js";
import type { SessionInboxPayload, SessionInbox } from "#execution/session-inbox/inbox.js";
import { executeInlineCalls } from "#harness/call-executor.js";
import { callRequested, callSettledFrom } from "#harness/call-facts.js";
import { failedCall } from "#harness/approval-outcome.js";
import { checkToolCallInput } from "#harness/tool-call-io.js";
import { fact, runRequested, runStarted, runSettledFacts, turnSettled } from "#harness/facts.js";
import { humanInputContext, holdStep } from "#harness/hitl/index.js";
import { coalesceTurnInputs } from "#harness/messages.js";
import { enterSessionProjection, currentProjection } from "#harness/session-machine/current.js";
import { activeTurnId, storedProjection } from "#harness/session-machine/view.js";
import { settle, suspendStep } from "#harness/session-machine/transitions.js";
import type { CallReceipt, ToolResultPart } from "#harness/session-machine/state.js";
import { createToolLoopHarness } from "#harness/tool-loop.js";
import type { TurnEngine } from "#harness/turn-engine.js";
import type { HarnessToolDefinition } from "#harness/execute-tool.js";
import type { HarnessSession, HarnessStepInput, ToolLoopHarnessConfig } from "#harness/types.js";
import { nextRunId } from "#protocol/session-projection.js";
import { emptySessionView, foldLines } from "#protocol/session-projection/fold.js";
import {
  activeTurn,
  openInteractions,
  replyText,
  waiting,
} from "#protocol/session-projection/selectors.js";

// This engine's checkpoint is a private tuple log, not a sequence of ModelMessages.
// Its adapter may carry the checkpoint, but only the engine decodes it.
function scriptEngine() {
  type Entry = readonly [string, unknown];
  const encode = (log: Entry[]) => Buffer.from(JSON.stringify(log)).toString("base64");
  return vi.fn(
    (input: { snapshot: unknown; message?: unknown; receipts: readonly CallReceipt[] }) => {
      const log: Entry[] =
        input.snapshot === undefined
          ? []
          : JSON.parse(Buffer.from(String(input.snapshot), "base64").toString());
      if (log.length === 0) {
        log.push(["Alice", input.message], ["proposal", "deploy"]);
        return {
          snapshot: encode(log),
          calls: [
            { callId: "opaque-deploy", toolName: "deploy", input: { environment: "production" } },
          ],
        };
      }
      const results = input.receipts.flatMap((receipt) => receipt.results);
      if (results.length !== 1) throw new Error("The engine expected one delivered result.");
      log.push(["result", results[0]!.output]);
      if (results[0]!.toolCallId === "opaque-deploy" && results[0]!.output.type === "text") {
        log.push(["proposal", "record"]);
        return {
          snapshot: encode(log),
          calls: [{ callId: "opaque-record", toolName: "record", input: {} }],
        };
      }
      return {
        snapshot: encode(log),
        reply:
          results[0]!.toolCallId === "opaque-record" ? "Release deployed." : "Release did not run.",
      };
    },
  );
}

/** A restricted engine adapter: no native history, delegated work, or model implementation. */
function backend(advance: ReturnType<typeof scriptEngine>): TurnEngine {
  return {
    async prepareInput(step, input, { consumedMessage }) {
      if (input?.history?.length || input?.context?.length || input?.outputSchema)
        throw new Error("This engine tracer supports plain messages and local calls only.");
      return {
        turnId: activeTurnId(step.position()),
        clientContext: undefined,
        storedClientContext: undefined,
        ephemeral: [],
        messages: [],
        hasUserMessage: input?.message !== undefined && !consumedMessage,
      };
    },
    async run(step, { message, receipts, generation }) {
      const observation = advance({ snapshot: step.view().turn.engineSnapshot, message, receipts });
      const turnId = activeTurnId(step.position());
      const runId = nextRunId(step.view().projection);
      await step.apply([
        runRequested({ turnId }, runId),
        runStarted({ runId, attempt: 1, modelId: "opaque-tracer" }),
      ]);
      if (observation.reply !== undefined) {
        await step.apply([
          fact("content.completed", {
            kind: "text",
            partId: `${runId}.reply`,
            phase: "reply",
            runId,
            value: observation.reply,
          }),
          ...runSettledFacts({ runId, outcome: "completed", finishReason: "stop" }),
          ...turnSettled(step.view().projection, { outcome: "completed" }),
        ]);
        return {
          next: null,
          session: step.session,
          settledTurn: { output: observation.reply },
          engineSnapshot: observation.snapshot,
        };
      }
      const valid = [];
      const parts: ToolResultPart[] = [];
      for (const call of observation.calls) {
        const definition = step.config.tools.get(call.toolName);
        if (definition?.execute === undefined || definition.workflowId !== undefined)
          throw new Error("The engine tracer only supports local tools.");
        const checked = await checkToolCallInput(definition, call.input, call.callId);
        await step.publish(
          callRequested({ action: { ...call, kind: "tool-call" }, owner: { runId } }),
        );
        if (checked.kind === "threw") throw checked.error;
        if (checked.kind === "invalid") {
          const failed = failedCall({ ...call, message: checked.message });
          await step.publish(callSettledFrom(failed.result));
          parts.push(failed.part);
        } else
          valid.push({
            type: "tool-call" as const,
            toolCallId: call.callId,
            toolName: call.toolName,
            input: checked.value,
          });
      }
      const gated = await executeInlineCalls({
        toolCalls: valid,
        excludedCallIds: new Set(),
        tools: step.config.tools,
        approvalGrants: humanInputContext(step).approvalGrants,
        messages: [],
        publish: step.publish,
        abortSignal: step.config.abortSignal,
        beforeExecute: () => generation.protectToolExecution(),
      });
      parts.push(...gated.parts);
      if (gated.signIns.length > 0) throw new Error("The engine tracer does not support sign-in.");
      await step.apply(
        runSettledFacts({ runId, outcome: "completed", finishReason: "tool-calls" }),
      );
      const response = {
        event: { sequence: step.position().sequence, stepIndex: step.position().stepIndex, turnId },
        proposed: { calls: observation.calls, results: parts },
        tasks: [],
      };
      const held =
        gated.approvals.length > 0
          ? await holdStep(step, {
              ...response,
              requests: gated.approvals,
              tools: step.config.tools,
            })
          : (await step.apply(suspendStep(step.view(), response)),
            await step.apply(settle(step.view(), { results: [] })),
            { next: step.runStep, session: step.session });
      return { ...held, engineSnapshot: observation.snapshot };
    },
  };
}

function inbox() {
  const queue: SessionInboxPayload[] = [];
  const observers = new Set<(payload: SessionInboxPayload) => void>();
  let closed = false;
  let wake: (() => void) | undefined;
  let parked!: () => void;
  const whenParked = new Promise<void>((resolve) => {
    parked = resolve;
  });
  const reader: SessionInbox = {
    claimedTokens: [],
    claimSessionHook: async () => {},
    claimSessionHooks: async () => {},
    drain: () => queue.splice(0),
    hasPending: () => queue.length > 0,
    async whenPending() {
      if (closed || queue.length > 0) return;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    },
    async next() {
      if (!closed && queue.length === 0) {
        parked();
        await reader.whenPending();
      }
      return queue.shift();
    },
    takeLeading: () => [],
    onInterrupt: () => () => {},
    onDelivery: (observe) => {
      observers.add(observe);
      return () => {
        observers.delete(observe);
      };
    },
    restore: (payloads) => {
      queue.unshift(...payloads);
      wake?.();
    },
  };
  return {
    reader,
    whenParked,
    push(payload: SessionInboxPayload) {
      queue.push(payload);
      for (const observe of observers) observe(payload);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
  };
}

function delivery(message: string): DeliverHookPayload {
  return {
    kind: "deliver",
    payloads: [{ message }],
    deliveryMetadata: [
      { payloadIndex: 0, deliveryId: "alice-message", channelKind: "http", channelName: "http" },
    ],
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("a history-owning engine on the shared session and approval path", () => {
  it.each(["approved", "human-denied", "policy-denied"] as const)(
    "completes the %s round-trip without native conversation messages",
    async (outcome) => {
      vi.stubEnv("EVE_CHECK_SESSION_EVENTS", "1");
      const input = inbox();
      const chunks: string[] = [];
      const writable = new WritableStream<Uint8Array>({
        write(bytes) {
          chunks.push(new TextDecoder().decode(bytes));
        },
      });
      const cursor = new SessionStateCursor({
        history: [],
        inbox: input.reader,
        sessionWritable: writable,
        serializedContext: {},
        sessionState: createTestSessionState({ sessionId: "opaque-session" }),
      });
      let frozen = false;
      const principals: (string | undefined)[] = [];
      const execute = vi.fn(() => "deployed");
      const record = vi.fn(() => "recorded");
      const advance = scriptEngine();
      const engine = backend(advance);
      const tools: ToolLoopHarnessConfig["tools"] = new Map<string, HarnessToolDefinition>([
        [
          "deploy",
          {
            name: "deploy",
            description: "Deploy Alice's release.",
            inputSchema: jsonSchema({
              type: "object",
              properties: { environment: { type: "string" } },
              required: ["environment"],
            }),
            execute,
            approval: (context) => {
              principals.push(context.session.auth.current?.principalId);
              return frozen
                ? { type: "denied" as const, reason: "A release freeze is active." }
                : ("user-approval" as const);
            },
          },
        ],
        [
          "record",
          {
            name: "record",
            description: "Record the release.",
            inputSchema: jsonSchema({ type: "object" }),
            execute: record,
            approval: () => false,
          },
        ],
      ]);
      const checkpoints: HarnessSession[] = [];
      const step = (original: TurnStepInput) =>
        withSessionStateDelta(original, async (state) => {
          const durable: ReturnType<typeof readDurableSession> = JSON.parse(
            JSON.stringify(readDurableSession(state.sessionState)),
          );
          const session: HarnessSession = {
            ...durable,
            agent: { ...durable.agent, modelReference: { id: "opaque-tracer" }, tools: [] },
            compaction: { ...durable.compaction, recentWindowSize: 10, threshold: 100_000 },
            history: state.history,
          };
          const ctx = createApprovalContext();
          ctx.set(ChannelKey, { kind: "http" });
          enterSessionProjection(ctx, session.state);
          const publisher = openSessionEventPublisher({
            ctx,
            origin: "own",
            sessionWritable: writable,
          });
          try {
            return await contextStorage.run(ctx, async () => {
              const wire = state.input?.delivery;
              let received: HarnessStepInput | undefined;
              if (wire !== undefined) {
                const admitted = admitDeliveries({
                  delivery: wire,
                  channelKind: "http",
                  sessionStarted: currentProjection(ctx).view.session.status !== "new",
                  payloads: wire.payloads.map((payload) => ({
                    payload,
                    input: defaultDeliverResult(payload),
                  })),
                });
                await publisher.publish([
                  ...(currentProjection(ctx).view.session.status === "new"
                    ? [fact("session.started", {})]
                    : []),
                  ...admitted.facts,
                ]);
                received = admitted.inputs.reduce<HarnessStepInput | undefined>(
                  (all, next) => (all === undefined ? next : coalesceTurnInputs(all, next)),
                  undefined,
                );
              }
              const result = await createToolLoopHarness(
                {
                  tools,
                  capabilities: { requestInput: true },
                  abortSignal: state.abortSignal,
                  steeringSignal: state.steeringSignal,
                  handleEvent: publisher.publish,
                  resolveModel: async () => {
                    throw new Error("An opaque engine must not resolve a model.");
                  },
                },
                engine,
              )(session, received);
              await publisher.finish({
                announce: announcesWaiting(decideStep(readStepState(result.session))),
              });
              checkpoints.push(JSON.parse(JSON.stringify(result.session)));
              return resolveSessionStepResult(result, {});
            });
          } finally {
            publisher.writer.release();
          }
        });
      const loop = new SessionLoop({
        step,
        cursor,
        inbox: input.reader,
        sessionId: "opaque-session",
        ownerRunId: "opaque-owner",
        admittedDeliveryKeys: [],
        capabilities: { requestInput: true },
        start: { kind: "turn", input: delivery("Help Alice deploy her release.") },
      });
      const running = loop.run();
      await Promise.race([
        input.whenParked,
        running.then(() => {
          throw new Error("The session ended before waiting for approval.");
        }),
      ]);
      const held = storedProjection(cursor.sessionState.snapshot.session.state).view;
      const turnId = activeTurn(held)!.turnId;
      expect(waiting(held, turnId)?.on).toBe("interaction");
      expect(execute).not.toHaveBeenCalled();
      expect(advance).toHaveBeenCalledOnce();
      expect(checkpoints[0]?.history).toEqual([]);
      frozen = outcome === "policy-denied";
      const request = openInteractions(held)[0]!;
      input.push({
        kind: "deliver",
        payloads: [
          {
            answers: [
              {
                interactionId: request.interactionId,
                optionId: outcome === "human-denied" ? "deny" : "approve",
              },
            ],
          },
        ],
        deliveryMetadata: [
          {
            payloadIndex: 0,
            deliveryId: "alice-approval",
            channelKind: "http",
            channelName: "http",
          },
        ],
      });
      input.close();
      await running;
      const successful = outcome === "approved";
      expect(execute).toHaveBeenCalledTimes(successful ? 1 : 0);
      expect(record).toHaveBeenCalledTimes(successful ? 1 : 0);
      expect(principals).toEqual(outcome === "human-denied" ? ["user-1"] : ["user-1", "user-1"]);
      expect(checkpoints.every((snapshot) => snapshot.history.length === 0)).toBe(true);
      const view = emptySessionView();
      foldLines(
        view,
        chunks
          .join("")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line)),
        0,
      );
      expect(view.turns[turnId]?.outcome).toBe("completed");
      expect(replyText(view, turnId)).toBe(
        successful ? "Release deployed." : "Release did not run.",
      );
      expect(view.calls["opaque-deploy"]?.outcome).toBe(successful ? "completed" : "rejected");
      expect(openInteractions(view)).toEqual([]);
      expect(advance).toHaveBeenCalledTimes(successful ? 3 : 2);
      expect(
        readStepState({ ...readDurableSession(cursor.sessionState), history: cursor.history })
          .unreadInput,
      ).toBe(false);
      expect(checkpoints.at(-1)?.state).toBeDefined();
    },
  );
});
