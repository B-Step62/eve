import { beforeEach, expect, it, vi } from "vitest";

import { HookNotFoundError } from "#compiled/@workflow/errors/index.js";
import { getRun, resumeHook } from "#internal/workflow/runtime.js";
import { interruptWorkflowToolRun } from "./interrupt.js";

vi.mock("#compiled/@workflow/core/runtime.js", () => ({
  getRun: vi.fn(),
  resumeHook: vi.fn(),
}));

const address = { hookToken: "control", runId: "run" };

beforeEach(() => vi.resetAllMocks());

it("delivers an interrupt to a registered hook", async () => {
  await interruptWorkflowToolRun(address);
  expect(resumeHook).toHaveBeenCalledWith("control", { kind: "interrupt" });
  expect(getRun).not.toHaveBeenCalled();
});

it.each(["pending", "running"])(
  "does not discard an interrupt while the run is %s",
  async (status) => {
    const error = new HookNotFoundError("control");
    vi.mocked(resumeHook).mockRejectedValue(error);
    vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(status) } as ReturnType<
      typeof getRun
    >);
    await expect(interruptWorkflowToolRun(address)).rejects.toBe(error);
  },
);

it.each(["completed", "failed", "cancelled"])(
  "ignores a missing hook once the run is %s",
  async (status) => {
    vi.mocked(resumeHook).mockRejectedValue(new HookNotFoundError("control"));
    vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(status) } as ReturnType<
      typeof getRun
    >);
    await expect(interruptWorkflowToolRun(address)).resolves.toBeUndefined();
  },
);

it("does not hide unrelated delivery failures", async () => {
  const error = new Error("transport unavailable");
  vi.mocked(resumeHook).mockRejectedValue(error);
  await expect(interruptWorkflowToolRun(address)).rejects.toBe(error);
  expect(getRun).not.toHaveBeenCalled();
});
