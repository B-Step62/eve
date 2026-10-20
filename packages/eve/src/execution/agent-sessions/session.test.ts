import { beforeEach, expect, it, vi } from "vitest";

import { createAgentSessions } from "#execution/agent-sessions/session.js";
import { createRunUsageTally } from "#execution/agent-sessions/usage.js";
import type { WorkflowToolRunContext } from "#execution/tools/workflow/ask.js";

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  openAgentSessionStep: vi.fn(),
  renewAgentSessionsStep: vi.fn(),
  sendAgentSessionMessageStep: vi.fn(),
}));

vi.mock("#compiled/@workflow/core/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#compiled/@workflow/core/index.js")>()),
  // A reply hook whose turn never ends: these tests are about what reaches the session.
  createHook: () => ({
    token: "reply",
    dispose: async () => {},
    async *[Symbol.asyncIterator]() {
      await new Promise(() => {});
    },
  }),
}));
vi.mock("#execution/agent-sessions/steps.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#execution/agent-sessions/steps.js")>()),
  openAgentSessionStep: mocks.openAgentSessionStep,
  renewAgentSessionsStep: mocks.renewAgentSessionsStep,
  sendAgentSessionMessageStep: mocks.sendAgentSessionMessageStep,
}));

const address = {
  continuationToken: "worker-token",
  kind: "local",
  name: "worker",
  sessionId: "worker-session",
};

const run = {
  agentContext: {},
  auth: {},
  from: { runId: "run-1" },
  owner: { send: async () => {} },
} as unknown as WorkflowToolRunContext;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.calls.length = 0;
  mocks.openAgentSessionStep.mockResolvedValue(address);
  mocks.sendAgentSessionMessageStep.mockImplementation(async () => {
    mocks.calls.push("send");
  });
});

it("renews a session a failed renewal missed before its next message", async () => {
  const sessions = createAgentSessions(run, createRunUsageTally(), "");
  const worker = sessions.open("worker");
  await worker.send("first page");

  // The renewal can't reach the worker, even after the step's retries.
  mocks.renewAgentSessionsStep.mockRejectedValueOnce(new Error("inbox unavailable"));
  sessions.renew("R");
  await vi.waitFor(() => expect(mocks.renewAgentSessionsStep).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 0));
  // A repeat of the same renewal is ignored, so it can't repair the miss.
  sessions.renew("R");
  expect(mocks.renewAgentSessionsStep).toHaveBeenCalledOnce();

  mocks.renewAgentSessionsStep.mockImplementationOnce(async () => {
    mocks.calls.push("renew");
  });
  await worker.send("next page");

  expect(mocks.renewAgentSessionsStep).toHaveBeenLastCalledWith({
    renewalId: "R",
    sessions: [expect.objectContaining({ address })],
  });
  expect(mocks.calls).toEqual(["renew", "send"]);
});

it("doesn't send the next message while the session still can't be renewed", async () => {
  const sessions = createAgentSessions(run, createRunUsageTally(), "");
  const worker = sessions.open("worker");
  await worker.send("first page");
  mocks.renewAgentSessionsStep.mockRejectedValue(new Error("inbox unavailable"));
  sessions.renew("R");
  await new Promise((resolve) => setTimeout(resolve, 0));

  await expect(worker.send("next page")).rejects.toThrow("inbox unavailable");
  expect(mocks.calls).toEqual([]);
});

it("sends nothing extra after a renewal that reached the session", async () => {
  const sessions = createAgentSessions(run, createRunUsageTally(), "");
  const worker = sessions.open("worker");
  await worker.send("first page");
  mocks.renewAgentSessionsStep.mockResolvedValue(undefined);
  sessions.renew("R");
  await new Promise((resolve) => setTimeout(resolve, 0));

  await worker.send("next page");

  expect(mocks.renewAgentSessionsStep).toHaveBeenCalledOnce();
});
