import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveCodeModeRunHookToken, startCodeModeRun } from "#execution/code-mode-run/start.js";

const mocks = vi.hoisted(() => ({
  getHook: vi.fn(),
  start: vi.fn(),
  wait: vi.fn(),
}));

vi.mock("#internal/workflow/runtime.js", () => ({
  getHookByToken: mocks.getHook,
}));

vi.mock("#execution/workflow-runtime.js", () => ({
  codeModeRunWorkflowReference: { workflowId: "workflow//eve//codeModeRunWorkflow" },
  startWorkflowPreferLatest: mocks.start,
  waitForCommandHookOwner: mocks.wait,
}));

describe("startCodeModeRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue({ runId: "candidate-run" });
    mocks.wait.mockResolvedValue({ runId: "owner-run" });
    mocks.getHook.mockRejectedValue(
      Object.assign(new Error("not found"), { name: "HookNotFoundError" }),
    );
  });

  it("derives one identity token and adopts its owner", async () => {
    const base = {
      callId: "call-1",
      input: { js: "return 1" },
      mode: "eager" as const,
      parentInboxToken: "parent-inbox",
      parentSessionId: "parent-session",
      parentTurnId: "turn-1",
      serializedContext: {},
      sessionState: {} as never,
      stepIndex: 2,
      toolNames: ["read_file"],
    };
    const expectedToken = deriveCodeModeRunHookToken(base);
    const started = await startCodeModeRun(base);

    expect(started).toEqual({ hookToken: expectedToken, runId: "owner-run" });
    expect(mocks.start).toHaveBeenCalledWith({ workflowId: "workflow//eve//codeModeRunWorkflow" }, [
      { ...base, hookToken: expectedToken },
    ]);
    expect(mocks.wait).toHaveBeenCalledWith(expectedToken);
  });

  it("joins an existing owner without starting another candidate", async () => {
    mocks.getHook.mockResolvedValueOnce({ runId: "existing-run" });
    const started = await startCodeModeRun({
      callId: "call-1",
      input: { js: "return 1" },
      mode: "eager",
      parentInboxToken: "parent-inbox",
      parentSessionId: "parent-session",
      parentTurnId: "turn-1",
      serializedContext: {},
      stepIndex: 2,
      toolNames: ["read_file"],
    });

    expect(started.runId).toBe("existing-run");
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
