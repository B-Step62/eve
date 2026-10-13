import { describe, expect, it } from "vitest";
import { MontyProgramRuntime } from "./monty-runtime.js";
import { renderPythonSignature } from "../catalog/python-signatures.js";
const runtime = new MontyProgramRuntime();
function input(source: string) {
  return {
    source,
    toolNames: ["echo"],
    limits: {
      deadlineAt: Date.now() + 10000,
      memoryBytes: 10000000,
      maxInFlightCalls: 32,
      maxTotalCalls: 256,
    },
  };
}
describe("Monty recorded-call replay", () => {
  it("starts, parks and replays deterministically", async () => {
    const program = input('x = await echo({"x": 1})\nawait echo(x)');
    const first = await runtime.start(program);
    expect(first).toEqual({
      status: "parked",
      calls: [{ index: 0, tool: "echo", input: { x: 1 } }],
      state: null,
    });
    const resume = {
      ...program,
      state: null,
      results: [{ index: 0, status: "completed" as const, output: { x: 2 } }],
    };
    expect(await runtime.resume(resume)).toEqual(await runtime.resume(resume));
    expect(
      await runtime.resume({
        ...resume,
        results: [...resume.results, { index: 1, status: "completed", output: 3 }],
      }),
    ).toMatchObject({ status: "completed", output: 3 });
  });
  it.each(["failed", "unknown"] as const)("raises %s in Python", async (status) => {
    const program = input(
      "try:\n    await echo({})\nexcept Exception as e:\n    result = str(e)\nresult",
    );
    expect(
      await runtime.resume({
        ...program,
        state: null,
        results: [{ index: 0, status, error: "boom" }],
      }),
    ).toMatchObject({ status: "completed", output: expect.stringContaining("boom") });
  });
  it.each(["import time\ntime.time()", "import random\nrandom.random()"])(
    "denies nondeterminism",
    async (source) => {
      expect(await runtime.start(input(source))).toMatchObject({ status: "failed" });
    },
  );
  it("enforces deadline and total calls", async () => {
    const program = input("await echo({})");
    expect(
      await runtime.start({ ...program, limits: { ...program.limits, deadlineAt: 0 } }),
    ).toMatchObject({ status: "failed", errorClass: "deadline" });
    expect(
      await runtime.start({ ...program, limits: { ...program.limits, maxTotalCalls: 0 } }),
    ).toMatchObject({ status: "failed", errorClass: "call-limit" });
  });
  it("batches asyncio.gather", async () => {
    expect(
      await runtime.start(
        input('import asyncio\nawait asyncio.gather(echo({"x": 1}), echo({"x": 2}))'),
      ),
    ).toMatchObject({ status: "parked", calls: [{ index: 0 }, { index: 1 }] });
  });
  it("renders Python TypedDict stubs", () => {
    expect(
      renderPythonSignature({
        name: "echo",
        inputSchema: {
          type: "object",
          properties: { "a-b": { type: "string" } },
          required: ["a-b"],
        },
        outputSchema: { type: "integer" },
      }),
    ).toContain('"a-b": Required[str]');
  });
});
