import { describe, expect, it } from "vitest";
import { JavaScriptProgramRuntime } from "./javascript.js";
import type { ProgramStart, ProgramStep } from "./runtime.js";

const runtime = new JavaScriptProgramRuntime();
function input(source: string, overrides: Partial<ProgramStart["limits"]> = {}): ProgramStart {
  return {
    source,
    toolNames: ["read", "write"],
    limits: {
      deadlineAt: Date.now() + 30_000,
      maxInFlightCalls: 32,
      maxTotalCalls: 256,
      memoryBytes: 64 * 1024 * 1024,
      ...overrides,
    },
  };
}
function parked(step: ProgramStep) {
  expect(step.status).toBe("parked");
  if (step.status !== "parked") throw new Error(JSON.stringify(step));
  return step;
}

describe("JavaScriptProgramRuntime (real QuickJS)", () => {
  it("returns JSON and captured logs", async () => {
    expect(await runtime.start(input('console.log("hello"); return { ok: true };'))).toEqual({
      status: "completed",
      output: { ok: true },
      logs: ["hello"],
    });
  });

  it("parks a concurrent batch, resumes, then parks the next sequential call", async () => {
    const program = input(
      "const values = await Promise.all([tools.read({ n: 1 }), tools.read({ n: 2 })]); return await tools.write(values);",
    );
    const first = parked(await runtime.start(program));
    expect(first.calls).toEqual([
      { index: 0, tool: "read", input: { n: 1 } },
      { index: 1, tool: "read", input: { n: 2 } },
    ]);
    const results = [
      { index: 0, status: "completed" as const, output: "one" },
      { index: 1, status: "completed" as const, output: "two" },
    ];
    const next = parked(await runtime.resume({ ...program, state: first.state, results }));
    expect(next.calls).toEqual([{ index: 2, tool: "write", input: ["one", "two"] }]);
    expect(
      await runtime.resume({
        ...program,
        state: next.state,
        results: [...results, { index: 2, status: "completed", output: "saved" }],
      }),
    ).toEqual({
      status: "completed",
      output: "saved",
      logs: [],
    });
    // Resuming the same recorded continuation replays interpreter work, not a tool.
    expect(parked(await runtime.resume({ ...program, state: first.state, results })).calls).toEqual(
      next.calls,
    );
  });

  it("reports unknown outcomes without asking the host to call again", async () => {
    const program = input('console.log("before"); await tools.write({ value: 1 }); return true;');
    const first = parked(await runtime.start(program));
    expect(
      await runtime.resume({
        ...program,
        state: first.state,
        results: [{ index: 0, status: "unknown", error: "worker crashed" }],
      }),
    ).toEqual({
      status: "failed",
      errorClass: "runtime",
      logs: ["before"],
      error: expect.stringContaining("side effect may or may not have happened"),
    });
  });

  it("enforces total and in-flight call caps", async () => {
    const program = input("await tools.read(null); return await tools.read(null);", {
      maxTotalCalls: 1,
    });
    const first = parked(await runtime.start(program));
    expect(
      await runtime.resume({
        ...program,
        state: first.state,
        results: [{ index: 0, status: "completed", output: null }],
      }),
    ).toMatchObject({ status: "failed", errorClass: "call-limit" });
    expect(
      await runtime.start(
        input("return await Promise.all([tools.read(null), tools.read(null)]);", {
          maxInFlightCalls: 1,
        }),
      ),
    ).toMatchObject({ status: "failed", errorClass: "call-limit" });
  });

  it("does not allow raw bridge access to reuse a recorded call index", async () => {
    const program = input(
      'await __host.call({ index: 0, tool: "read", input: null, logs: [] }); return await __host.call({ index: 0, tool: "read", input: null, logs: [] });',
    );
    const first = parked(await runtime.start(program));
    expect(
      await runtime.resume({
        ...program,
        state: first.state,
        results: [{ index: 0, status: "completed", output: null }],
      }),
    ).toMatchObject({ status: "failed", errorClass: "call-limit" });
  });

  it("enforces a hard deadline even for a busy loop", async () => {
    expect(
      await runtime.start(input("for (;;) {}", { deadlineAt: Date.now() + 100 })),
    ).toMatchObject({ status: "failed", errorClass: "deadline" });
    expect(await runtime.start(input("return 1;", { deadlineAt: 0 }))).toMatchObject({
      status: "failed",
      errorClass: "deadline",
    });
  });

  it("preserves bounded console logs on program errors and rejects unknown tools", async () => {
    const result = await runtime.start(
      input('console.error("failure context"); throw new Error("broken");'),
    );
    expect(result).toEqual({
      status: "failed",
      error: "broken",
      errorClass: "runtime",
      logs: ["failure context"],
    });
    expect(await runtime.start(input("return await tools.missing({});"))).toMatchObject({
      status: "failed",
      errorClass: "unknown-tool",
    });
    const capped = await runtime.start(
      input('console.log("x".repeat(100000)); throw new Error("broken");'),
    );
    expect(capped.status).toBe("failed");
    if (capped.status === "failed")
      expect(capped.logs.join("\n").length).toBeLessThanOrEqual(16 * 1024);
  });
});
