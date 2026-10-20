import type { AgentSessionContext } from "#execution/agent-sessions/context.js";
import { sendToChannelStep } from "#execution/tools/workflow/channel-handoff-steps.js";
import { ROOT_RUNTIME_AGENT_NODE_ID } from "#runtime/graph.js";
import type { WorkflowChannelTarget } from "#tools/workflow-definition.js";

/** `ctx.to()` for a workflow body: each send is one step against the root agent's channels. */
export function createWorkflowChannelTarget(
  context: AgentSessionContext,
  channel: string,
  target: Readonly<Record<string, unknown>>,
): WorkflowChannelTarget {
  const { nodeId } = context.bundle;
  // A channel session runs the root agent with all its tools, so a subagent's
  // tool must not start one.
  if (nodeId !== undefined && nodeId !== ROOT_RUNTIME_AGENT_NODE_ID) {
    throw new Error(
      "ctx.to() is only available to workflow tools on the root agent. Channels belong to the " +
        "root agent, and a subagent's tools cannot start sessions on them.",
    );
  }
  if (typeof channel !== "string" || channel.trim() === "") {
    throw new TypeError('ctx.to() requires the channel\'s path-derived name, such as "slack".');
  }
  const base = {
    bundle: context.bundle,
    channel,
    localDevRequest: context.localDevRequest,
    target,
  };
  return {
    send: async (message, options) =>
      await sendToChannelStep({
        ...base,
        auth: options.auth,
        history: options.history,
        message,
      }),
  };
}
