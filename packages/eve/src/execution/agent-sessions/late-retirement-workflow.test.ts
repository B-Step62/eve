import { expect, it, vi } from "vitest";
import { lateAgentSessionRetirementWorkflow } from "#execution/agent-sessions/late-retirement-workflow.js";

const mocks = vi.hoisted(() => ({
  sleep: vi.fn(async () => {}),
  probe: vi.fn(async (): Promise<boolean> => false),
  report: vi.fn(async () => {}),
}));

vi.mock("#compiled/@workflow/core/index.js", () => ({ sleep: mocks.sleep }));
vi.mock("#execution/agent-sessions/late-retirement-steps.js", () => ({
  tryRetireLateAgentSessionStep: mocks.probe,
  reportLateAgentSessionRetirementFailureStep: mocks.report,
}));

const input = { sessionId: "child-1", deliveryId: "reset-1", reason: "Parent ended" };

it("bounds retirement of a child whose inbox never appears", async () => {
  await lateAgentSessionRetirementWorkflow(input);

  expect(mocks.probe).toHaveBeenCalledTimes(60);
  expect(mocks.sleep).toHaveBeenCalledTimes(59);
  expect(mocks.sleep).toHaveBeenCalledWith(1_000);
  expect(mocks.report).toHaveBeenCalledOnce();
  expect(mocks.report).toHaveBeenCalledWith("child-1");
});
