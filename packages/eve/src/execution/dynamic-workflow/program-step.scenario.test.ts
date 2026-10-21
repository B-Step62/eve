import { describe, expect, it, vi } from "vitest";

vi.mock("#execution/dynamic-workflow/schema.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#execution/dynamic-workflow/schema.js")>()),
  // Keeps the runaway-program case fast; every other program here finishes far sooner.
  WORKFLOW_PROGRAM_CPU_TIMEOUT_MS: 1_000,
}));

import { runWorkflowProgramStep } from "#execution/dynamic-workflow/program-step.js";
import type {
  WorkflowProgramCallResult,
  WorkflowProgramInput,
} from "#execution/dynamic-workflow/schema.js";
import { runJsProgram } from "#execution/dynamic-workflow/workflow.js";

const continuationSecurity = {
  maxAgeMs: 60_000,
  signingKey: "workflow-program-scenario-test-signing-key",
};

function program(js: string, maxSubagents = 10): WorkflowProgramInput {
  return {
    continuationSecurity,
    js,
    maxSubagents,
  };
}

/** Resumes a parked program with one result per pending call, in pending order. */
function resume(
  outcome: Awaited<ReturnType<typeof runWorkflowProgramStep>>,
  values: readonly WorkflowProgramCallResult[],
) {
  if (outcome.status !== "interrupted") throw new Error("Expected pending agent calls.");
  return {
    continuation: outcome.continuation,
    resolutions: outcome.pending.map((pending, index) => ({
      interruptionId: pending.id,
      value: values[index]!,
    })),
  };
}

describe("workflow program sandbox", () => {
  it("returns JSON-normalized values and reports syntax failures", async () => {
    await expect(
      runWorkflowProgramStep({
        callId: "pure",
        program: program(
          'return { answer: 42, nested: ["ok", undefined], at: new Date(0), skipped: undefined };',
        ),
      }),
    ).resolves.toEqual({
      output: { answer: 42, at: "1970-01-01T00:00:00.000Z", nested: ["ok", null] },
      status: "completed",
    });

    await expect(
      runWorkflowProgramStep({ callId: "syntax", program: program("return (") }),
    ).rejects.toThrow();
  });

  it("resumes a parallel batch together and then runs a dependent call", async () => {
    const input = program(`
const pair = await Promise.all([
  ctx.agent("researcher", { message: "alpha" }),
  ctx.agent("reviewer", { message: "beta" }),
]);
return ctx.agent("researcher", { message: pair.join("|") });`);
    const first = await runWorkflowProgramStep({ callId: "dependent", program: input });
    expect(first.status).toBe("interrupted");
    if (first.status !== "interrupted") throw new Error("Expected initial calls.");
    expect(first.pending.map((entry) => entry.call)).toEqual([
      { input: { message: "alpha" }, target: "researcher" },
      { input: { message: "beta" }, target: "reviewer" },
    ]);

    const second = await runWorkflowProgramStep({
      callId: "dependent",
      program: input,
      resume: resume(first, [
        { status: "completed", output: "A" },
        { status: "completed", output: "B" },
      ]),
    });
    expect(second.status).toBe("interrupted");
    if (second.status !== "interrupted") throw new Error("Expected dependent call.");
    expect(second.pending.map((entry) => entry.call)).toEqual([
      { input: { message: "A|B" }, target: "researcher" },
    ]);

    await expect(
      runWorkflowProgramStep({
        callId: "dependent",
        program: input,
        resume: resume(second, [{ status: "completed", output: { done: true } }]),
      }),
    ).resolves.toEqual({ output: { done: true }, status: "completed" });
  });

  it("lets generated code catch a failed child, including on later replays", async () => {
    const input = program(`
let caught;
try {
  await ctx.agent("researcher", { message: "fail" });
} catch (error) {
  caught = error.message;
}
return { caught, next: await ctx.agent("reviewer", { message: caught }) };`);
    const first = await runWorkflowProgramStep({ callId: "failure", program: input });
    const second = await runWorkflowProgramStep({
      callId: "failure",
      program: input,
      resume: resume(first, [{ status: "failed", error: "child failed" }]),
    });
    expect(second.status === "interrupted" && second.pending.map((entry) => entry.call)).toEqual([
      { input: { message: "child failed" }, target: "reviewer" },
    ]);

    await expect(
      runWorkflowProgramStep({
        callId: "failure",
        program: input,
        resume: resume(second, [{ status: "completed", output: "reviewed" }]),
      }),
    ).resolves.toEqual({
      output: { caught: "child failed", next: "reviewed" },
      status: "completed",
    });
  });

  it("lets generated code catch a malformed agent call without parking it", async () => {
    await expect(
      runWorkflowProgramStep({
        callId: "malformed",
        program: program(`
try {
  await ctx.agent("researcher", { prompt: "no message" });
  return "unexpected";
} catch (error) {
  return error.message;
}`),
      }),
    ).resolves.toEqual({
      output: 'Workflow program ctx.agent() requires a "message" string.',
      status: "completed",
    });
  });

  it("enforces the total call budget through the real sandbox", async () => {
    const agent = vi.fn(() => ({
      send: async () => ({
        result: async () => ({ data: undefined, message: "ok", status: "waiting" }),
      }),
    }));
    const ctx = {
      abortSignal: new AbortController().signal,
      agent,
      callId: "policy",
    } as never;

    await expect(
      runJsProgram(
        `
try {
  await ctx.agent("researcher", { message: "one" });
  await ctx.agent("researcher", { message: "two" });
  return "unexpected";
} catch (error) {
  return error.message;
}`,
        ctx,
        { maxSubagents: 1 },
      ),
    ).resolves.toBe(
      'WORKFLOW_PROGRAM_SUBAGENT_LIMIT_REACHED: workflow may invoke at most 1 agents; "researcher" was not called.',
    );
    expect(agent).toHaveBeenCalledTimes(1);
  });

  it("stops a runaway program at the CPU limit", async () => {
    await expect(
      runWorkflowProgramStep({ callId: "cpu", program: program("while (true) {}") }),
    ).rejects.toThrow("JavaScript runtime exceeded its CPU time limit of 1000ms.");
  });

  it("rejects oversized source and tampered continuations", async () => {
    await expect(
      runWorkflowProgramStep({
        callId: "large",
        program: program(`return ${JSON.stringify("x".repeat(300 * 1024))};`),
      }),
    ).rejects.toThrow(/source|large|bytes/i);

    const input = program('return ctx.agent("researcher", { message: "x" });');
    const first = await runWorkflowProgramStep({ callId: "tamper", program: input });
    const valid = resume(first, [{ status: "completed", output: "no" }]);
    const middle = Math.floor(valid.continuation.length / 2);
    const flipped = valid.continuation[middle] === "A" ? "B" : "A";
    const tampered = `${valid.continuation.slice(0, middle)}${flipped}${valid.continuation.slice(middle + 1)}`;

    await expect(
      runWorkflowProgramStep({
        callId: "tamper",
        program: input,
        resume: { ...valid, continuation: tampered },
      }),
    ).rejects.toThrow();
    await expect(
      runWorkflowProgramStep({ callId: "another-call", program: input, resume: valid }),
    ).rejects.toThrow();
    await expect(
      runWorkflowProgramStep({ callId: "tamper", program: input, resume: valid }),
    ).resolves.toEqual({ output: "no", status: "completed" });
  });
});
