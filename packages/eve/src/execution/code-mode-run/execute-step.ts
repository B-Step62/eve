import { buildToolSet } from "#harness/tools.js";
import { getStepMetadata } from "#compiled/@workflow/core/index.js";
import { getApprovedTools } from "#harness/hitl/approval-input-requests.js";
import { createNodeHarnessTools } from "#execution/node-step.js";
import { deserializeContext } from "#context/serialize.js";
import { withContextScope } from "#context/run-step.js";
import { createDurableSessionState, readDurableSession } from "#execution/durable-session-store.js";
import { hydrateDurableSession } from "#execution/session.js";
import { resolveEffectiveAgentRuntime } from "#execution/effective-agent-config.js";
import type { CodeModeRunInput, CodeModeRunOutcome } from "#execution/code-mode-run/types.js";
import { executeCodeModeProgram } from "#harness/code-mode-sandbox.js";
import { getCodeModeContinuationSecurity } from "#harness/code-mode-continuation-security.js";
import { getResolvedRuntimeAgentNode } from "#runtime/graph.js";
import { BundleKey } from "#runtime/sessions/runtime-context-keys.js";
import { parseJsonValue } from "#shared/json.js";

export async function executeCodeModeProgramStep(input: {
  readonly run: CodeModeRunInput;
  readonly sessionState: Parameters<typeof readDurableSession>[0];
}): Promise<{
  readonly outcome: CodeModeRunOutcome;
  readonly sessionState: Parameters<typeof readDurableSession>[0];
}> {
  "use step";

  if (getStepMetadata().attempt !== 1) {
    return {
      outcome: {
        code: "CODE_MODE_EXECUTION_LOST",
        message: "The code-mode execution was abandoned after it began and was not replayed.",
        partialEffectsPossible: true,
        retryable: false,
        status: "failed",
      },
      sessionState: input.sessionState,
    };
  }

  try {
    const durable = await readDurableSession(input.sessionState);
    const ctx = await deserializeContext(input.run.serializedContext);
    const bundle = ctx.require(BundleKey);
    const effective = resolveEffectiveAgentRuntime(bundle, ctx);
    const baseNode = getResolvedRuntimeAgentNode(bundle.graph, input.run.nodeId);
    const node = { ...baseNode, turnAgent: effective.turnAgent };
    const session = hydrateDurableSession({
      compactionOverrides: { thresholdPercent: effective.thresholdPercent },
      durable,
      turnAgent: effective.turnAgent,
    });
    const harnessTools = createNodeHarnessTools({ node });

    const scoped = await withContextScope(ctx, session, async (enriched) => {
      const tools = buildToolSet({
        approvedTools: getApprovedTools(enriched),
        tools: harnessTools,
      });
      const output = await executeCodeModeProgram({
        continuationSecurity: getCodeModeContinuationSecurity(enriched),
        harnessTools,
        js: String(input.run.input.js ?? ""),
        mode: input.run.mode,
        toolCallId: input.run.callId,
        toolNames: input.run.toolNames,
        tools,
      });
      return { result: parseJsonValue(output ?? null), session: enriched };
    });
    return {
      outcome: { output: scoped.result, status: "completed" },
      sessionState: createDurableSessionState({ session: scoped.session }),
    };
  } catch (error) {
    return {
      outcome: {
        code: "CODE_MODE_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : String(error),
        partialEffectsPossible: true,
        retryable: false,
        status: "failed",
      },
      sessionState: input.sessionState,
    };
  }
}

(
  executeCodeModeProgramStep as typeof executeCodeModeProgramStep & { maxRetries: number }
).maxRetries = 0;
