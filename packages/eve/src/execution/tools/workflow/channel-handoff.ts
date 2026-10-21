import type { AgentSessionContext } from "#execution/agent-sessions/context.js";
import { sendToChannelStep } from "#execution/tools/workflow/channel-handoff-steps.js";
import { ROOT_RUNTIME_AGENT_NODE_ID } from "#runtime/graph.js";
import type { WorkflowChannel } from "#tools/workflow-definition.js";

/** `ctx.channel()` for a workflow body: each send is one step against the root agent's channels. */
export function createWorkflowChannel(
  context: AgentSessionContext,
  channel: string,
): WorkflowChannel {
  const { nodeId } = context.bundle;
  // A channel session runs the root agent with all its tools, so a subagent's
  // tool must not start one.
  if (nodeId !== undefined && nodeId !== ROOT_RUNTIME_AGENT_NODE_ID) {
    throw new Error(
      "ctx.channel() is only available to workflow tools on the root agent. Channels belong to " +
        "the root agent, and a subagent's tools cannot start sessions on them.",
    );
  }
  if (typeof channel !== "string" || channel.trim() === "") {
    throw new TypeError(
      'ctx.channel() requires the channel\'s path-derived name, such as "slack".',
    );
  }
  return {
    send: async (message, options) =>
      await sendToChannelStep({
        auth: options.auth,
        bundle: context.bundle,
        channel,
        history: options.history,
        localDevRequest: context.localDevRequest,
        message,
        target: options.target as Readonly<Record<string, unknown>>,
      }),
  };
}
