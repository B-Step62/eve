import type { ContextContainer } from "#context/container.js";
import { SandboxKey } from "#context/keys.js";
import type { HarnessSessionBase } from "#harness/types.js";
import { runtimeWait } from "#harness/session-machine/view.js";
import { BundleKey } from "#runtime/sessions/runtime-context-keys.js";
import { AGENT_TOOL_NAME } from "#tools/framework/agent-contract.js";

/**
 * Create a shared sandbox in its owner's turn before a child receives its
 * snapshot. A child's context cannot persist the owner's selector state.
 */
export async function prepareInheritedSandbox(
  ctx: ContextContainer,
  session: HarnessSessionBase,
): Promise<void> {
  const bundle = ctx.get(BundleKey);
  if (bundle === undefined || session.sandboxState?.session != null) return;
  const sandbox = ctx.get(SandboxKey);
  // The dispatching node's own sandbox, which may be a declared subagent's.
  const node =
    bundle.nodeId === undefined ? bundle.graph.root : bundle.graph.nodesByNodeId.get(bundle.nodeId);
  if (sandbox === undefined || (node?.sandboxRegistry.sandbox ?? null) === null) return;

  const inherits = runtimeWait(session.state)?.tasks.some((task) => {
    if (task.entry.entryPoint === "receive") return false;
    if (task.toolName === AGENT_TOOL_NAME && bundle.nodeId === undefined) return true;
    const child = bundle.subagentRegistry.subagentsByName.get(task.toolName);
    return (
      child !== undefined &&
      bundle.graph.nodesByNodeId.get(child.definition.nodeId)?.sandboxRegistry.sandbox?.definition
        .kind === "parent"
    );
  });
  if (inherits === true) await sandbox.get();
}
