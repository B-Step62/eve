import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  initializeProgramStep: vi.fn(),
  runProgramStep: vi.fn(),
  approveProgramCallStep: vi.fn(),
  recordProgramCallStartedStep: vi.fn(),
  dispatchProgramCallStep: vi.fn(),
  ask: vi.fn(),
}));
vi.mock("./program-step.js", () => mocks);
vi.mock("#execution/tools/workflow/ask.js", () => ({ ask: mocks.ask }));
vi.mock("#compiled/@workflow/core/index.js", () => ({ sleep: () => new Promise(() => {}) }));
import { executeProgramWorkflow } from "./workflow.js";
const ctx = { callId: "execute", abortSignal: new AbortController().signal } as never;
const input = { source: "return 1;", language: "js", context: {} } as never;
const first = {
  status: "parked",
  state: { token: "first" },
  calls: [
    { index: 0, tool: "read", input: {} },
    { index: 1, tool: "read", input: {} },
  ],
};

describe("code-mode durable driver", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.initializeProgramStep.mockResolvedValue({
      limits: { deadlineAt: Date.now() + 300000 },
      toolNames: ["read", "write"],
    });
    mocks.approveProgramCallStep.mockResolvedValue({ status: "approved", key: "read" });
    mocks.recordProgramCallStartedStep.mockImplementation(async (callId) => ({
      callId,
      status: "started",
    }));
    mocks.dispatchProgramCallStep.mockImplementation(async (_ctx, _context, call) => ({
      index: call.index,
      status: "completed",
      output: call.index,
    }));
  });

  it("dispatches a parked batch concurrently, recording each start before dispatch", async () => {
    mocks.runProgramStep
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ status: "completed", output: [0, 1], logs: [] });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    mocks.dispatchProgramCallStep.mockImplementation(async (_ctx, _context, call) => {
      if (++started === 2) release();
      await pending;
      return { index: call.index, status: "completed", output: call.index };
    });
    expect(await executeProgramWorkflow(input, ctx)).toEqual({
      status: "completed",
      output: [0, 1],
      logs: [],
    });
    expect(started).toBe(2);
    for (let i = 0; i < 2; i++)
      expect(mocks.recordProgramCallStartedStep.mock.invocationCallOrder[i]).toBeLessThan(
        mocks.dispatchProgramCallStep.mock.invocationCallOrder[i]!,
      );
    expect(mocks.runProgramStep.mock.calls[1]![1]).toMatchObject({
      results: [
        { index: 0, status: "completed", output: 0 },
        { index: 1, status: "completed", output: 1 },
      ],
    });
  });

  it("suspends for approval before starting the side effect", async () => {
    mocks.runProgramStep
      .mockResolvedValueOnce({ ...first, calls: [first.calls[0]] })
      .mockResolvedValueOnce({ status: "completed", output: 0, logs: [] });
    mocks.approveProgramCallStep.mockResolvedValue({ status: "required", key: "read" });
    mocks.ask.mockImplementation(async () => {
      expect(mocks.recordProgramCallStartedStep).not.toHaveBeenCalled();
      expect(mocks.dispatchProgramCallStep).not.toHaveBeenCalled();
      return { status: "answered", optionId: "approve" };
    });
    await executeProgramWorkflow(input, ctx);
    expect(mocks.ask).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      {},
      { kind: "tool-call", callId: "execute:program:0", toolName: "read", input: {} },
    );
    expect(mocks.dispatchProgramCallStep).toHaveBeenCalledTimes(1);
  });

  it("passes unknown outcomes back without retrying dispatch", async () => {
    mocks.runProgramStep
      .mockResolvedValueOnce({ ...first, calls: [first.calls[0]] })
      .mockResolvedValueOnce({
        status: "failed",
        error: "unknown",
        errorClass: "runtime",
        logs: ["before"],
      });
    mocks.dispatchProgramCallStep.mockResolvedValue({
      index: 0,
      status: "unknown",
      error: "side effect may or may not have happened",
    });
    expect(await executeProgramWorkflow(input, ctx)).toMatchObject({
      status: "failed",
      logs: ["before"],
    });
    expect(mocks.dispatchProgramCallStep).toHaveBeenCalledTimes(1);
    expect(mocks.runProgramStep.mock.calls[1]![1]).toMatchObject({
      results: [{ index: 0, status: "unknown" }],
    });
  });

  it("preserves failure logs and identifies truncation after interpreter termination", async () => {
    mocks.runProgramStep.mockResolvedValue({
      status: "failed",
      error: "timeout",
      errorClass: "deadline",
      logs: ["last park"],
    });
    expect(await executeProgramWorkflow(input, ctx)).toEqual({
      status: "failed",
      error: "timeout",
      errorClass: "deadline",
      logs: ["last park"],
      logsMayBeTruncated: true,
    });
  });
});
