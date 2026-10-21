import { createHash } from "node:crypto";

import { FatalError } from "#compiled/@workflow/core/index.js";
import type { RunLimits } from "#compiled/run/index.js";
import {
  WORKFLOW_PROGRAM_BRIDGE_REQUEST_LIMIT,
  WORKFLOW_PROGRAM_CPU_TIMEOUT_MS,
  WORKFLOW_PROGRAM_TIMEOUT_MS,
  readWorkflowProgramAgentCall,
  type WorkflowProgramAgentCall,
  type WorkflowProgramCallResult,
  type WorkflowProgramInput,
  type WorkflowProgramPendingCall,
  type WorkflowProgramResolution,
} from "#execution/dynamic-workflow/schema.js";
import { toErrorMessage } from "#shared/errors.js";
import { parseJsonValue, type JsonValue } from "#shared/json.js";
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
/** Host function group behind the prelude's `ctx`; programs call `ctx.agent`, not this. */
const WORKFLOW_PROGRAM_HOST_NAMESPACE = "__eveWorkflowProgram";
/** Size limit for the JSON text of a program's result and of each `ctx.agent()` call. */
const WORKFLOW_PROGRAM_MAX_JSON_BYTES = 1024 * 1024;
const WORKFLOW_PROGRAM_MAX_SOURCE_BYTES = 256 * 1024;

const WORKFLOW_PROGRAM_GUEST_ERROR_NAMES = {
  WORKFLOW_PROGRAM_AGENT_FAILED: "WorkflowProgramAgentError",
  WORKFLOW_PROGRAM_INVALID_AGENT_CALL: "WorkflowProgramAgentCallError",
} as const;

/**
 * Converts the program's values to JSON inside the sandbox, where run's limits
 * bound the work. run transfers values with shared references intact, so a
 * small value can expand without limit if the host converts it. The prelude
 * shares the program's first line, so stack line numbers match its source.
 */
function wrapWorkflowProgram(js: string): string {
  return `const ctx = Object.freeze({ agent: (target, input) => ${WORKFLOW_PROGRAM_HOST_NAMESPACE}.agent(JSON.stringify({ target, input })) }); return JSON.stringify(await (async () => {${js}\n})());`;
}

/**
 * run measures JSON text in its own encoding, which escapes every quote, so
 * run gets twice the budget and eve checks the JSON size itself.
 */
const runEncodingLimit = (jsonBytes: number) => jsonBytes * 2 + 1024;

const WORKFLOW_PROGRAM_LIMITS: RunLimits = {
  cpuTimeoutMs: WORKFLOW_PROGRAM_CPU_TIMEOUT_MS,
  maxBridgeRequests: WORKFLOW_PROGRAM_BRIDGE_REQUEST_LIMIT,
  maxConsoleOutputBytes: 64 * 1024,
  maxHostFunctionArgumentsBytes: runEncodingLimit(WORKFLOW_PROGRAM_MAX_JSON_BYTES),
  maxHostFunctionOutputBytes: 4 * 1024 * 1024,
  maxInFlightBridgeRequests: WORKFLOW_PROGRAM_BRIDGE_REQUEST_LIMIT,
  maxResultBytes: runEncodingLimit(WORKFLOW_PROGRAM_MAX_JSON_BYTES),
  // eve checks the program's own size; the ASCII wrapper's length is its byte count.
  maxSourceBytes: WORKFLOW_PROGRAM_MAX_SOURCE_BYTES + wrapWorkflowProgram("").length,
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
  const sourceBytes = Buffer.byteLength(input.program.js);
  if (sourceBytes > WORKFLOW_PROGRAM_MAX_SOURCE_BYTES) {
    throw new RangeError(
      `Workflow program source is ${String(sourceBytes)} bytes, over the ${String(WORKFLOW_PROGRAM_MAX_SOURCE_BYTES)} byte limit.`,
    );
  }
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

  // run shows the program only RunError messages; other host errors read "Host function failed."
  const guestError = (message: string, code: keyof typeof WORKFLOW_PROGRAM_GUEST_ERROR_NAMES) => {
    const error = new RunError(message, code);
    // RunError takes its name from its class, which the minified vendored bundle renames.
    error.name = WORKFLOW_PROGRAM_GUEST_ERROR_NAMES[code];
    return error;
  };

  const result = await runner.run({
    source: wrapWorkflowProgram(input.program.js),
    hostFunctions: {
      [WORKFLOW_PROGRAM_HOST_NAMESPACE]: {
        agent: async (callJson: unknown) => {
          let call: WorkflowProgramAgentCall;
          try {
            call = readWorkflowProgramAgentCall(
              parseWorkflowProgramJson(callJson, "ctx.agent() input"),
            );
          } catch (error) {
            throw guestError(toErrorMessage(error), "WORKFLOW_PROGRAM_INVALID_AGENT_CALL");
          }
          const { interrupt, resume } = getHostFunctionContext();
          if (resume === undefined) return interrupt(call);
          const outcome = resume.resolution as WorkflowProgramCallResult;
          if (outcome.status === "failed") {
            throw guestError(outcome.error, "WORKFLOW_PROGRAM_AGENT_FAILED");
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
    // `JSON.stringify` returns undefined for values it drops, such as `undefined` itself.
    const output =
      result.value === undefined
        ? null
        : parseJsonValue(parseWorkflowProgramJson(result.value, "result"));
    return { output, status: "completed" };
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

/** Parses JSON text from the prelude; code that bypasses the prelude can send any value. */
function parseWorkflowProgramJson(value: unknown, label: string): unknown {
  if (typeof value !== "string") {
    throw new TypeError(`Workflow program ${label} must be JSON text.`);
  }
  const bytes = Buffer.byteLength(value);
  if (bytes > WORKFLOW_PROGRAM_MAX_JSON_BYTES) {
    throw new RangeError(
      `Workflow program ${label} is ${String(bytes)} bytes of JSON, over the ${String(WORKFLOW_PROGRAM_MAX_JSON_BYTES)} byte limit.`,
    );
  }
  return JSON.parse(value);
}
