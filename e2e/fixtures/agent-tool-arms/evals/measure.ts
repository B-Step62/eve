import { appendFileSync } from "node:fs";
import { defineEval } from "eve/evals";
import { PROGRAM_TOOL, ROUTING_TOOLS } from "../agent/lib/arms";
import { referenceOf } from "../agent/lib/catalog";

/**
 * One measured run. A row is written for every run, including runs whose turn
 * failed or whose `t.send` threw, so the efficiency columns average over every
 * attempt rather than only over the ones that succeeded.
 *
 * Program fields read `eve__execute` results. A program-capable arm reports
 * interpreter timings by putting `interpreter: { startupMs, runMs }` on the
 * tool's output object, and its failure class as `errorClass` on the output
 * (or `action.result`'s `error.code`). Arms without programs leave them at
 * 0 / null.
 */
interface Row {
  id: string;
  arm: string | undefined;
  size: string | undefined;
  model: string | undefined;
  repetition: number;
  success: boolean;
  /** Why the run did not succeed; null when it did. */
  errorClass: string | null;
  harnessError?: string;
  latencyMs: number;
  modelCalls: number;
  missingUsage: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Calls to the task's tools, made by the model directly or from inside a program. */
  actions: number;
  /** `eve__search` / `eve__tool` / `eve__skill` calls. */
  routingCalls: number;
  programAttempts: number;
  programFailures: number;
  /** One class per failed program attempt, in order. */
  programErrorClasses: string[];
  /** Summed over the run's program attempts; null when no attempt reported it. */
  interpreterStartupMs: number | null;
  interpreterRunMs: number | null;
  tools: unknown[];
  message: string | undefined;
}

type Event = { type: string; data?: any };

export function measuredEval(id: string, prompt: string, expected: string[]) {
  return defineEval({
    tags: ["real-model"],
    async test(t) {
      const row: Row = {
        id,
        arm: process.env.EVE_ARMS_MODE,
        size: process.env.EVE_ARMS_SIZE,
        model: process.env.EVE_E2E_MODEL,
        repetition: Number(process.env.EVE_ARMS_REPETITION ?? 1),
        success: false,
        errorClass: null,
        latencyMs: 0,
        modelCalls: 0,
        missingUsage: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        actions: 0,
        routingCalls: 0,
        programAttempts: 0,
        programFailures: 0,
        programErrorClasses: [],
        interpreterStartupMs: null,
        interpreterRunMs: null,
        tools: [],
        message: undefined,
      };
      const start = performance.now();
      let usedExpectedTools = false;
      let turn: Awaited<ReturnType<typeof t.send>>;
      try {
        turn = await t.send(
          prompt + " Include the exact reference returned by each requested tool in your answer.",
        );
        row.latencyMs = performance.now() - start;
        row.message = turn.message;
        const events = await collectEvents(turn, t.signal);
        Object.assign(row, measure(events));
        const called = new Set(toolCalls(events).map((a) => a.toolName));
        usedExpectedTools = expected.every((name) => called.has(name));
        const quoted = expected.every((name) => turn.message?.includes(referenceOf(name)));
        // "waiting" is a turn that ended and left the session open for the next message.
        row.success = turn.status !== "failed" && usedExpectedTools && quoted;
        row.errorClass = row.success
          ? null
          : turn.status === "failed"
            ? `turn-failed:${turnErrorCode(events)}`
            : !usedExpectedTools
              ? "tool-not-called"
              : "reference-missing";
      } catch (error) {
        row.latencyMs ||= performance.now() - start;
        row.errorClass = `harness:${(error as Error)?.name ?? "Error"}`;
        row.harnessError = String((error as Error)?.message ?? error).slice(0, 500);
        throw error;
      } finally {
        if (process.env.EVE_ARMS_OUTPUT)
          appendFileSync(process.env.EVE_ARMS_OUTPUT, JSON.stringify(row) + "\n");
        t.log(JSON.stringify(row));
      }
      turn.expectOk();
      for (const name of expected) t.messageIncludes(referenceOf(name));
      turn.eventsSatisfy("requested tools ran in parent or child", () => usedExpectedTools);
    },
  });
}

/** The turn's events plus those of every session it opened (subagents, programs). */
async function collectEvents(
  turn: { events: readonly Event[]; session: any },
  signal: AbortSignal,
): Promise<Event[]> {
  const events: Event[] = [...turn.events];
  const seen = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.type !== "agent.started" || seen.has(event.data.sessionId)) continue;
    seen.add(event.data.sessionId);
    for await (const e of turn.session.agent(event).stream({ follow: false, signal }))
      events.push(e);
  }
  return events;
}

/**
 * Every requested call that names a tool, whatever its action kind. A call made
 * from inside a program counts the same as one the model made directly.
 */
function toolCalls(events: Event[]): { toolName: string }[] {
  return events
    .flatMap((e) => (e.type === "actions.requested" ? e.data.actions : []))
    .filter((a: any) => typeof a?.toolName === "string");
}

function measure(events: Event[]): Partial<Row> {
  const steps = events.filter((e) => e.type === "step.completed");
  const calls = toolCalls(events);
  const programs = events.filter(
    (e) => e.type === "action.result" && e.data.result?.toolName === PROGRAM_TOOL,
  );
  const failed = programs.filter((e) => e.data.status !== "completed" || e.data.result?.isError);
  const timing = (key: "startupMs" | "runMs") => {
    const values = programs
      .map((e) => e.data.result?.output?.interpreter?.[key])
      .filter((v): v is number => typeof v === "number");
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  return {
    modelCalls: steps.length,
    missingUsage: steps.filter((e) => !e.data.usage).length,
    inputTokens: sum(steps, "inputTokens"),
    cacheReadTokens: sum(steps, "cacheReadTokens"),
    cacheWriteTokens: sum(steps, "cacheWriteTokens"),
    actions: calls.filter((a) => a.toolName !== PROGRAM_TOOL && !ROUTING_TOOLS.has(a.toolName))
      .length,
    routingCalls: calls.filter((a) => ROUTING_TOOLS.has(a.toolName)).length,
    programAttempts: calls.filter((a) => a.toolName === PROGRAM_TOOL).length,
    programFailures: failed.length,
    programErrorClasses: failed.map(
      (e) => e.data.result?.output?.errorClass ?? e.data.error?.code ?? e.data.status ?? "unknown",
    ),
    interpreterStartupMs: timing("startupMs"),
    interpreterRunMs: timing("runMs"),
    tools: calls,
  };
}

function sum(steps: Event[], key: string): number {
  return steps.reduce((n, e) => n + (e.data.usage?.[key] ?? 0), 0);
}

function turnErrorCode(events: Event[]): string {
  const failure = events.find((e) => e.type === "step.failed" || e.type === "turn.failed");
  return failure?.data?.code ?? "unknown";
}
