import type { SessionAuthContext } from "#channel/types.js";
import {
  createNamedCrossChannelTargetHandle,
  toCrossChannelTargets,
} from "#channel/cross-channel-receive.js";
import { ContextContainer, contextStorage } from "#context/container.js";
import type { AgentSessionContext } from "#execution/agent-sessions/context.js";
import { createWorkflowRuntime } from "#execution/workflow-runtime.js";
import { resolveDurableCompiledArtifactsSource } from "#runtime/durable-compiled-artifacts-source.js";
import { getCompiledRuntimeAgentBundle } from "#runtime/sessions/compiled-agent-cache.js";
import type { SessionHistoryMessage } from "#shared/session-history.js";

export interface ChannelHandoffInput {
  readonly auth: SessionAuthContext | null;
  readonly bundle: AgentSessionContext["bundle"];
  readonly channel: string;
  readonly history?: readonly SessionHistoryMessage[];
  readonly localDevRequest?: AgentSessionContext["localDevRequest"];
  readonly target: Readonly<Record<string, unknown>>;
}

export async function sendToChannelStep(
  input: ChannelHandoffInput & { readonly message: string },
): Promise<{ readonly sessionId: string }> {
  "use step";

  const session = await withChannelTarget(input, (handle) =>
    handle.send(input.message, { auth: input.auth, history: input.history }),
  );
  return { sessionId: session.id };
}

/** Runs the channel's `receive()` against the root agent, outside the calling session's context. */
async function withChannelTarget<T>(
  input: ChannelHandoffInput,
  run: (handle: ReturnType<typeof createNamedCrossChannelTargetHandle>) => Promise<T>,
): Promise<T> {
  const compiledArtifactsSource = resolveDurableCompiledArtifactsSource(input.bundle.source);
  const bundle = await getCompiledRuntimeAgentBundle({ compiledArtifactsSource });
  const handle = createNamedCrossChannelTargetHandle(
    createWorkflowRuntime({ compiledArtifactsSource }),
    toCrossChannelTargets(bundle.graph.root.channels),
    input.channel,
    input.target,
  );
  return await contextStorage.run(
    new ContextContainer({ localDevRequest: input.localDevRequest }),
    () => run(handle),
  );
}
