import { createHash } from "node:crypto";

import { FatalError } from "#compiled/@workflow/core/index.js";
import type { RunLimits } from "#compiled/run/index.js";
import {
  WORKFLOW_PROGRAM_BRIDGE_REQUEST_LIMIT,
  WORKFLOW_PROGRAM_CPU_TIMEOUT_MS,
  WORKFLOW_PROGRAM_TIMEOUT_MS,
  parseWorkflowProgramOutput,
  readWorkflowProgramAgentCall,
  type WorkflowProgramAgentCall,
  type WorkflowProgramCallResult,
  type WorkflowProgramInput,
  type WorkflowProgramPendingCall,
  type WorkflowProgramResolution,
} from "#execution/dynamic-workflow/schema.js";
import { toErrorMessage } from "#shared/errors.js";
import type { JsonValue } from "#shared/json.js";
import { loadWorkflowSandboxModule } from "#shared/workflow-sandbox.js";

export type WorkflowProgramStepOutcome =
  | { readonly output: JsonValue; readonly status: "completed" }
  | {
      readonly continuation: string;
      readonly pending: readonly WorkflowProgramPendingCall[];
      readonly status: "interrupted";
    };

interface WorkflowProgramStepInput {
  readonly callId: string;
  readonly program: WorkflowProgramInput;
  readonly resume?: {
    readonly continuation: string;
    readonly resolutions: readonly WorkflowProgramResolution[];
  };
}

const WORKFLOW_PROGRAM_CONTINUATION_AUDIENCE = "eve.workflow-program/v1";

const WORKFLOW_PROGRAM_LIMITS: RunLimits = {
  cpuTimeoutMs: WORKFLOW_PROGRAM_CPU_TIMEOUT_MS,
  maxBridgeRequests: WORKFLOW_PROGRAM_BRIDGE_REQUEST_LIMIT,
  maxConsoleOutputBytes: 64 * 1024,
  maxHostFunctionArgumentsBytes: 1024 * 1024,
  maxHostFunctionOutputBytes: 4 * 1024 * 1024,
  maxInFlightBridgeRequests: WORKFLOW_PROGRAM_BRIDGE_REQUEST_LIMIT,
  maxResultBytes: 1024 * 1024,
  maxSourceBytes: 256 * 1024,
  maxStackSizeBytes: 2 * 1024 * 1024,
  memoryLimitBytes: 64 * 1024 * 1024,
  timeoutMs: WORKFLOW_PROGRAM_TIMEOUT_MS,
};

/** Runs or resumes the side-effect-free JavaScript sandbox for one durable workflow. */
export async function runWorkflowProgramStep(
  input: WorkflowProgramStepInput,
): Promise<WorkflowProgramStepOutcome> {
  "use step";

  try {
    return await runWorkflowProgram(input);
  } catch (error) {
    // The sandbox is deterministic, so a failed program fails the same way on every retry.
    throw new FatalError(toErrorMessage(error));
  }
}

async function runWorkflowProgram(
  input: WorkflowProgramStepInput,
): Promise<WorkflowProgramStepOutcome> {
  const { createRunner, createSignedContinuationCodec, getHostFunctionContext, RunError } =
    await loadWorkflowSandboxModule();
  const { maxAgeMs, signingKey } = input.program.continuationSecurity;
  const runner = createRunner({
    continuationAudience: WORKFLOW_PROGRAM_CONTINUATION_AUDIENCE,
    continuationCodec: createSignedContinuationCodec({
      maxAgeMs,
      // Hashing gives run a 32-byte secret whatever the stored key's length.
      secret: createHash("sha256").update(signingKey).digest(),
    }),
  });

  const result = await runner.run({
    source: input.program.js,
    hostFunctions: {
      ctx: {
        // run shows the program only RunError messages; other host errors read "Host function failed."
        agent: async (target: unknown, agentInput: unknown) => {
          let call: WorkflowProgramAgentCall;
          try {
            call = readWorkflowProgramAgentCall({ input: agentInput, target });
          } catch (error) {
            throw new RunError(toErrorMessage(error), "WORKFLOW_PROGRAM_INVALID_AGENT_CALL");
          }
          const { interrupt, resume } = getHostFunctionContext();
          if (resume === undefined) return interrupt(call);
          const outcome = resume.resolution as WorkflowProgramCallResult;
          if (outcome.status === "failed") {
            throw new RunError(outcome.error, "WORKFLOW_PROGRAM_AGENT_FAILED");
          }
          return outcome.output;
        },
      },
    },
    limits: WORKFLOW_PROGRAM_LIMITS,
    continuationContext: { callId: input.callId },
    continuation: input.resume?.continuation,
    resolutions: input.resume?.resolutions.slice(),
  });

  if (result.status === "completed") {
    return { output: parseWorkflowProgramOutput(result.value), status: "completed" };
  }
  return {
    continuation: result.continuation,
    pending: result.interruptions.map((interruption) => ({
      call: readWorkflowProgramAgentCall(interruption.payload),
      id: interruption.id,
    })),
    status: "interrupted",
  };
}
