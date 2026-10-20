// Kernel v2 parity: approvals and compaction, on today's eve and on eve with
// the native kernel. The same agent, tools, scripted model, and replies run
// in both modes; each test checks the outcome, and the last one checks that
// both modes publish the same protocol events.

import { appendFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mockModel, type MockModelRequest } from "#evals/mock-model.js";
import { workflowEntry } from "#execution/session/entry.js";
import {
  sessionCommandHookToken,
  sessionInboxHookToken,
} from "#execution/session-inbox/address.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { buildSerializedContext } from "#internal/testing/entry-test-helpers.js";
import { captureTurnEvents } from "#internal/testing/events.js";
import { startSessionOwner } from "#internal/testing/workflow-test-helpers.js";
import { resumeHook } from "#internal/workflow/runtime.js";
import type { MessageStreamEvent } from "#protocol/message.js";
import { always, once } from "#tools/approval/policies.js";
import { defineTool } from "#tools/definition.js";

process.env.NODE_ENV = "production";

type Mode = "eve" | "eve-native";
type Reply = { optionId: "approve" | "cancel"; text?: string };

/** One user turn: its prompt, and the replies to each approval it asks for. */
interface TurnScript {
  readonly prompt: string;
  readonly replies?: readonly Reply[];
}

interface Run {
  readonly ws: string;
  readonly events: MessageStreamEvent[];
  readonly prompts: MockModelRequest[];
}

const COMPACTION_SYSTEM = "CONTEXT CHECKPOINT COMPACTION";

function tools(ws: string, approval: "always" | "once") {
  return [
    {
      logicalPath: "tools/write_file.ts",
      loadNamespace: async () => ({
        default: defineTool({
          description: "Append to a file.",
          approval: approval === "always" ? always() : once(),
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" }, content: { type: "string" } },
            required: ["path", "content"],
          },
          execute: async (input: { path: string; content: string }) => {
            appendFileSync(join(ws, input.path), input.content);
            return "ok";
          },
        }),
      }),
    },
  ];
}

/** Each user turn writes once, then says what happened. */
function model(prompts: MockModelRequest[]) {
  return mockModel((request) => {
    prompts.push(request);
    if (request.messages[0]?.text.includes(COMPACTION_SYSTEM)) return "Alice asked for notes.";
    const last = request.messages.at(-1);
    if (last?.role === "tool")
      return request.toolResults.at(-1)?.isError ? "Not written." : "Written.";
    return {
      toolCalls: [
        {
          id: `w${request.userMessageCount}`,
          name: "write_file",
          input: { path: "out.txt", content: `${request.lastUserMessage}\n` },
        },
      ],
    };
  });
}

async function run(
  mode: Mode,
  script: readonly TurnScript[],
  options: { approval?: "always" | "once"; contextWindow?: number } = {},
): Promise<Run> {
  const ws = mkdtempSync(join(tmpdir(), `kernel-spike-hitl-${mode}-`));
  const prompts: MockModelRequest[] = [];
  const definition: Record<string, unknown> = { model: model(prompts), defaultTools: false };
  if (options.contextWindow !== undefined)
    definition.modelContextWindowTokens = options.contextWindow;
  const runtime = await createTestRuntime({
    agent: { name: "hitl", definition },
    modules: tools(ws, options.approval ?? "always"),
  });
  const serializedContext: Record<string, unknown> = {
    ...buildSerializedContext({ channelKind: "http" }),
    "eve.capabilities": { requestInput: true },
  };
  if (mode === "eve-native") serializedContext["eve.kernelMode"] = "native";
  return await runtime.run(async () => {
    const owner = await startSessionOwner(workflowEntry, [
      {
        kind: "initial",
        ownerDeploymentId: "dpl_inline",
        input: { message: script[0]!.prompt },
        serializedContext,
      },
    ]);
    const stream = captureTurnEvents(owner);
    const inbox = sessionInboxHookToken(sessionCommandHookToken(owner.runId));
    const events: MessageStreamEvent[] = [];
    try {
      for (const [index, turn] of script.entries()) {
        if (index > 0) await resumeHook(inbox, { kind: "send", payload: { message: turn.prompt } });
        const replies = [...(turn.replies ?? [])];
        for (;;) {
          const segment = await stream.nextTurn();
          events.push(...segment);
          const failed = segment.find(
            (e) => e.type === "session.failed" || e.type === "turn.failed",
          );
          if (failed !== undefined)
            throw new Error(`The session failed: ${JSON.stringify(failed.data)}`);
          const asked = segment.findLast((e) => e.type === "input.requested");
          if (asked === undefined || asked.type !== "input.requested") break;
          const reply = replies.shift();
          if (reply === undefined)
            throw new Error("The turn asked for an approval the script has no reply for.");
          await resumeHook(inbox, {
            kind: "send",
            payload: {
              inputResponses: asked.data.requests.map((r) => ({
                requestId: r.requestId,
                ...reply,
              })),
            },
          });
        }
      }
      return { ws, events, prompts };
    } finally {
      stream.dispose();
      await owner.cancel();
    }
  });
}

const out = (r: Run) =>
  existsSync(join(r.ws, "out.txt")) ? readFileSync(join(r.ws, "out.txt"), "utf8") : "";
const count = (r: Run, type: string) => r.events.filter((e) => e.type === type).length;
const lastText = (r: Run) =>
  r.events.findLast((e) => e.type === "message.completed")?.data.message as string | undefined;

/** The protocol events both modes must publish in the same order. */
const PARITY = new Set([
  "turn.started",
  "turn.completed",
  "turn.waiting",
  "input.requested",
  "input.resolved",
  "actions.requested",
  "action.result",
  "message.completed",
  "compaction.requested",
  "compaction.completed",
]);
const shape = (r: Run) => r.events.filter((e) => PARITY.has(e.type)).map((e) => e.type);

const runs: Record<string, Partial<Record<Mode, Run>>> = {};

for (const mode of ["eve", "eve-native"] as const) {
  describe(mode, () => {
    it("always: an approved call runs", async () => {
      const r = await run(mode, [{ prompt: "alpha", replies: [{ optionId: "approve" }] }]);
      (runs.approve ??= {})[mode] = r;
      expect(out(r)).toBe("alpha\n");
      expect(count(r, "input.requested")).toBe(1);
      expect(lastText(r)).toBe("Written.");
    });

    it("always: a denied call does not run, and the model is told", async () => {
      const r = await run(mode, [
        { prompt: "alpha", replies: [{ optionId: "cancel", text: "Not now." }] },
      ]);
      (runs.deny ??= {})[mode] = r;
      expect(out(r)).toBe("");
      expect(lastText(r)).toBe("Not written.");
      const denial = r.prompts.at(-1)!.toolResults.at(-1)!;
      expect(denial.isError).toBe(true);
      expect(JSON.stringify(denial.output)).toContain("Not now.");
    });

    it("once: the second turn does not ask", async () => {
      const r = await run(
        mode,
        [{ prompt: "alpha", replies: [{ optionId: "approve" }] }, { prompt: "beta" }],
        { approval: "once" },
      );
      (runs.once ??= {})[mode] = r;
      expect(out(r)).toBe("alpha\nbeta\n");
      expect(count(r, "input.requested")).toBe(1);
    });

    it("compaction: a long session is summarized before the model call", async () => {
      const turns = ["a", "b", "c", "d", "e", "f"].map((t) => ({
        prompt: `${t} ${"x".repeat(1500)}`,
        replies: [{ optionId: "approve" as const }],
      }));
      const r = await run(mode, turns, { contextWindow: 2000 });
      (runs.compaction ??= {})[mode] = r;
      expect(count(r, "compaction.completed")).toBeGreaterThan(0);
      const after = r.prompts.findLast((p) => !p.messages[0]?.text.includes(COMPACTION_SYSTEM))!;
      expect(
        after.messages.some((m) => m.text.includes("Summary of our conversation so far:")),
      ).toBe(true);
      expect(after.messages.some((m) => m.text.includes("Alice asked for notes."))).toBe(true);
      expect(out(r).split("\n").filter(Boolean)).toHaveLength(6);
    });
  });
}

describe("parity", () => {
  for (const name of ["approve", "deny", "once", "compaction"]) {
    it(`${name}: eve and eve-native publish the same events`, () => {
      const r = runs[name]!;
      expect(shape(r["eve-native"]!)).toEqual(shape(r.eve!));
    });
  }
});
