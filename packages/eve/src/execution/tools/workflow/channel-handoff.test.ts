import { expect, it, vi } from "vitest";

import type { AgentSessionContext } from "#execution/agent-sessions/context.js";
import { createWorkflowChannel } from "#execution/tools/workflow/channel-handoff.js";
import { ROOT_RUNTIME_AGENT_NODE_ID } from "#runtime/graph.js";

vi.mock("#execution/tools/workflow/channel-handoff-steps.js", () => ({
  sendToChannelStep: vi.fn(),
}));

function contextOnNode(nodeId: string | undefined): AgentSessionContext {
  const bundle: AgentSessionContext["bundle"] = {
    nodeId,
    source: {} as AgentSessionContext["bundle"]["source"],
  };
  return { bundle } as AgentSessionContext;
}

it.each([undefined, ROOT_RUNTIME_AGENT_NODE_ID])(
  "allows tools on the root agent (%s)",
  (nodeId) => {
    expect(() => createWorkflowChannel(contextOnNode(nodeId), "slack")).not.toThrow();
  },
);

it("rejects tools on a subagent, which would otherwise start a root-agent session", () => {
  expect(() => createWorkflowChannel(contextOnNode("researcher"), "slack")).toThrow(
    "ctx.channel() is only available to workflow tools on the root agent.",
  );
});
