import { beforeEach, describe, expect, it, vi } from "vitest";

import { codeModeRunWorkflow } from "#execution/code-mode-run/workflow.js";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  dispose: vi.fn(),
  execute: vi.fn(),
  resume: vi.fn(),
  iteratorNext: vi.fn(),
}));

vi.mock("#compiled/@workflow/core/index.js", () => ({
  createHook: () => ({
    [Symbol.asyncIterator]: () => ({ next: mocks.iteratorNext }),
    token: "owned-hook",
  }),
}));
vi.mock("#execution/hook-ownership.js", () => ({
  claimHookOwnership: mocks.claim,
  disposeHook: mocks.dispose,
  isHookConflictError: (error: unknown) =>
    error instanceof Error && error.name === "HookConflictError",
}));
vi.mock("#execution/code-mode-run/execute-step.js", () => ({
  executeCodeModeProgramStep: mocks.execute,
}));
vi.mock("#execution/code-mode-run/outcome-step.js", () => ({
  sendCodeModeOutcomeStep: ({ parentInboxToken, result, sessionState }: any) =>
    mocks.resume(parentInboxToken, { kind: "code-mode-result", result, sessionState }),
}));

const input = {
  callId: "call-1",
  hookToken: "owned-hook",
  input: { js: "return 1" },
  mode: "eager" as const,
  parentInboxToken: "parent-inbox",
  parentSessionId: "parent-session",
  parentTurnId: "turn-1",
  serializedContext: {},
  stepIndex: 1,
  toolNames: ["read_file"],
};

describe("codeModeRunWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.iteratorNext.mockResolvedValue({
      done: false,
      value: { kind: "ready", sessionState: { version: 1 } },
    });
    mocks.execute.mockResolvedValue({
      outcome: { output: { ok: true }, status: "completed" },
      sessionState: { version: 1 },
    });
  });

  it("waits for readiness, executes once, and reports the tool result", async () => {
    await codeModeRunWorkflow(input);

    expect(mocks.iteratorNext).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.resume).toHaveBeenCalledWith("parent-inbox", {
      kind: "code-mode-result",
      result: {
        callId: "call-1",
        kind: "tool-result",
        output: { ok: true },
        toolName: "code_mode",
      },
      sessionState: { version: 1 },
    });
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
  });

  it("exits before execution when another run owns the call", async () => {
    mocks.claim.mockRejectedValueOnce(
      Object.assign(new Error("owned"), { name: "HookConflictError" }),
    );

    await codeModeRunWorkflow(input);

    expect(mocks.iteratorNext).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("reports an abandoned execution as lost without restarting it", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("step attempt abandoned"));

    await codeModeRunWorkflow(input);

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.resume).toHaveBeenCalledWith("parent-inbox", {
      kind: "code-mode-result",
      result: expect.objectContaining({
        isError: true,
        output: expect.objectContaining({
          code: "CODE_MODE_EXECUTION_LOST",
          retryable: false,
        }),
      }),
      sessionState: { version: 1 },
    });
  });
});
