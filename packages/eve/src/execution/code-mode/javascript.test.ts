import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  continueWorkflowSandboxInterrupt: vi.fn(),
  createParkingHostTool: vi.fn((input) => input),
  createWorkflowSandboxTool: vi.fn(),
  getWorkflowSandboxPendingInterrupts: vi.fn(),
  unwrapWorkflowSandboxResult: vi.fn(),
}));
vi.mock("#shared/workflow-sandbox.js", () => mocks);
import { JavaScriptProgramRuntime } from "./javascript.js";
import type { ProgramStart } from "./runtime.js";

const program: ProgramStart = {
  source: "return await tools.read({});",
  toolNames: ["read"],
  limits: {
    deadlineAt: Number.MAX_SAFE_INTEGER,
    memoryBytes: 123456,
    maxTotalCalls: 256,
    maxInFlightCalls: 32,
  },
};
const runtime = new JavaScriptProgramRuntime();
const interrupt = {
  input: { index: 0, input: { ok: true }, tool: "read", logs: ["before"] },
  payload: { kind: "eve/code-mode/tool-call" },
};

describe("JavaScriptProgramRuntime bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorkflowSandboxTool.mockResolvedValue({
      execute: vi.fn().mockResolvedValue("raw"),
    });
    mocks.getWorkflowSandboxPendingInterrupts.mockReturnValue([interrupt]);
  });

  it("only exposes the parking bridge and configures resource limits", async () => {
    mocks.unwrapWorkflowSandboxResult.mockResolvedValue({ status: "interrupted", interrupt });
    const first = await runtime.start(program);
    expect(first.status).toBe("parked");
    expect(mocks.createWorkflowSandboxTool).toHaveBeenCalledWith(
      expect.objectContaining({
        executionPolicy: expect.objectContaining({
          memoryLimitBytes: 123456,
          maxInFlightBridgeRequests: 33,
          maxBridgeRequests: 257,
        }),
        hostTools: { call: expect.anything() },
      }),
    );
    const bridge = mocks.createParkingHostTool.mock.calls[0]![0];
    expect(bridge.interrupt({ index: 0, tool: "read", input: {}, logs: [] })).toEqual({
      kind: "eve/code-mode/tool-call",
    });
    expect(() => bridge.interrupt({ index: 0, tool: "forbidden", input: {}, logs: [] })).toThrow(
      "Unknown program tool",
    );
    expect(() => bridge.interrupt({ index: -1, tool: "read", input: {}, logs: [] })).toThrow(
      "call limit",
    );
  });

  it("does not restart the sandbox when a recorded continuation is resumed", async () => {
    mocks.unwrapWorkflowSandboxResult.mockResolvedValue({
      status: "completed",
      output: { status: "completed", output: 42, logs: [] },
    });
    mocks.continueWorkflowSandboxInterrupt.mockResolvedValue("raw");
    const state = { interrupt, security: { signingKey: "key" }, logs: ["before"] } as never;
    expect(
      await runtime.resume({
        ...program,
        state,
        results: [{ index: 0, status: "completed", output: 42 }],
      }),
    ).toMatchObject({ status: "completed", output: 42 });
    expect(mocks.createWorkflowSandboxTool).not.toHaveBeenCalled();
    expect(mocks.continueWorkflowSandboxInterrupt).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: { status: "completed", output: 42 },
      }),
    );
  });

  it("converts unknown outcomes into rejected tool calls", async () => {
    mocks.unwrapWorkflowSandboxResult.mockResolvedValue({
      status: "completed",
      output: { status: "failed", errorClass: "runtime", error: "unknown", logs: [] },
    });
    const state = { interrupt, security: { signingKey: "key" }, logs: ["before"] } as never;
    await runtime.resume({
      ...program,
      state,
      results: [{ index: 0, status: "unknown", error: "crash" }],
    });
    expect(mocks.continueWorkflowSandboxInterrupt).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: {
          status: "failed",
          error: expect.stringContaining("side effect may or may not have happened"),
        },
      }),
    );
  });

  it("rejects an expired deadline without starting the interpreter", async () => {
    expect(
      await runtime.start({ ...program, limits: { ...program.limits, deadlineAt: 0 } }),
    ).toMatchObject({ status: "failed", errorClass: "deadline" });
    expect(mocks.createWorkflowSandboxTool).not.toHaveBeenCalled();
  });

  it("returns interpreter errors as classified failures", async () => {
    for (const [error, errorClass] of [
      ["SyntaxError: unexpected token", "syntax"],
      ["out of memory", "memory"],
      ["Code mode execution timed out", "deadline"],
    ]) {
      mocks.createWorkflowSandboxTool.mockRejectedValueOnce(new Error(error));
      expect(await runtime.start(program)).toMatchObject({
        status: "failed",
        error,
        errorClass,
        logs: [],
      });
    }
  });
});
