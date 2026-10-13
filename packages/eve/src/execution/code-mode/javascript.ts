import { randomBytes } from "node:crypto";
import { jsonSchema, type ToolSet } from "ai";
import { toErrorMessage } from "#shared/errors.js";
import type { JsonValue } from "#shared/json.js";
import {
  continueWorkflowSandboxInterrupt,
  createParkingHostTool,
  createWorkflowSandboxTool,
  getWorkflowSandboxPendingInterrupts,
  unwrapWorkflowSandboxResult,
  type WorkflowSandboxContinuationSecurity,
  type WorkflowSandboxInterrupt,
} from "#shared/workflow-sandbox.js";
import type {
  ProgramCall,
  ProgramErrorClass,
  ProgramResume,
  ProgramRuntime,
  ProgramStart,
  ProgramStep,
} from "./runtime.js";

const LOG_BYTES = 16 * 1024;
const INTERRUPT_KIND = "eve/code-mode/tool-call";
interface BridgeCall extends ProgramCall {
  readonly logs: readonly string[];
  readonly limitExceeded?: boolean;
}
interface State {
  readonly interrupt: WorkflowSandboxInterrupt;
  readonly security: WorkflowSandboxContinuationSecurity;
  readonly logs: readonly string[];
}

/** QuickJS interpreter. Host tools only park; they never perform side effects. */
export class JavaScriptProgramRuntime implements ProgramRuntime {
  readonly language = "js" as const;

  start(input: ProgramStart): Promise<ProgramStep> {
    return this.run(input);
  }

  resume(input: ProgramResume): Promise<ProgramStep> {
    return this.run(input, input);
  }

  private async run(input: ProgramStart, resume?: ProgramResume): Promise<ProgramStep> {
    const state = resume?.state as unknown as State | undefined;
    let logs = state?.logs ?? [];
    if (Date.now() >= input.limits.deadlineAt)
      return failure("Program deadline exceeded.", "deadline", logs);
    const security = state?.security ?? {
      signingKey: randomBytes(32).toString("base64url"),
      maxAgeMs: 365 * 24 * 60 * 60 * 1000,
    };
    const options = {
      bridgeRequestLimit: input.limits.maxTotalCalls + 1,
      continuationSecurity: security,
      executionPolicy: {
        timeoutMs: Math.max(1, input.limits.deadlineAt - Date.now()),
        memoryLimitBytes: input.limits.memoryBytes,
        maxBridgeRequests: input.limits.maxTotalCalls + 1,
        maxInFlightBridgeRequests: input.limits.maxInFlightCalls + 1,
        maxConsoleOutputBytes: LOG_BYTES,
      },
    };
    const tools = buildTools(input);
    try {
      let raw: unknown;
      if (state === undefined) {
        const tool = await createWorkflowSandboxTool({ ...options, hostTools: tools });
        if (tool.execute === undefined) throw new Error("JavaScript sandbox has no executor.");
        raw = await tool.execute(
          { js: wrapSource(input) } as never,
          { toolCallId: "eve__execute" } as never,
        );
      } else {
        let current = state.interrupt;
        raw = current;
        // Feed only the calls outstanding in this continuation, in issue order.
        const pending = getWorkflowSandboxPendingInterrupts(current);
        for (const original of pending) {
          const call = readCall(original);
          const result = resume!.results.find((result) => result.index === call.index);
          if (result === undefined)
            throw new Error(`Missing result for program call ${call.index}.`);
          const resolution =
            result.status === "completed"
              ? { status: "completed", output: result.output }
              : {
                  status: "failed",
                  error:
                    result.status === "unknown"
                      ? `Outcome unknown: the side effect may or may not have happened. ${result.error}`
                      : result.error,
                };
          raw = await continueWorkflowSandboxInterrupt({
            ...options,
            interrupt: current,
            resolution,
            tools,
          });
          const next = await unwrapWorkflowSandboxResult(raw, security);
          if (next.status === "completed") break;
          const candidates = getWorkflowSandboxPendingInterrupts(next.interrupt);
          if (candidates.length === 0)
            throw new Error("Program continuation contains no pending calls.");
          current = candidates[0]!;
        }
      }
      const outcome = await unwrapWorkflowSandboxResult(raw, security);
      if (Date.now() >= input.limits.deadlineAt)
        return failure("Program deadline exceeded.", "deadline", logs);
      if (outcome.status === "completed") {
        const result = outcome.output as Exclude<ProgramStep, { status: "parked" }>;
        return { ...result, logs: capLogs(result.logs) };
      }
      const pending = getWorkflowSandboxPendingInterrupts(outcome.interrupt);
      const calls = pending.map(readCall).sort((a, b) => a.index - b.index);
      logs = capLogs(calls.at(-1)?.logs ?? logs);
      if (
        calls.length > input.limits.maxInFlightCalls ||
        calls.some(
          (call) => call.limitExceeded === true || call.index >= input.limits.maxTotalCalls,
        )
      ) {
        return failure("Program call limit exceeded.", "call-limit", logs);
      }
      return {
        calls: calls.map(({ index, input, tool }) => ({ index, input, tool })),
        state: { interrupt: pending[0]!, security, logs } as unknown as JsonValue,
        status: "parked",
      };
    } catch (error) {
      const message = toErrorMessage(error);
      return failure(
        message,
        Date.now() >= input.limits.deadlineAt ? "deadline" : classify(message),
        logs,
      );
    }
  }
}

function readCall(interrupt: WorkflowSandboxInterrupt): BridgeCall {
  if (interrupt.payload.kind !== INTERRUPT_KIND) throw new Error("Invalid program call interrupt.");
  return interrupt.input as BridgeCall;
}

function buildTools(input: ProgramStart): ToolSet {
  const allowed = new Set(input.toolNames);
  return {
    call: createParkingHostTool({
      description: "Park one allowlisted program tool call.",
      inputSchema: jsonSchema({ type: "object" }),
      interrupt: (raw) => {
        const call = raw as BridgeCall;
        if (!allowed.has(call.tool)) throw new Error(`Unknown program tool: ${call.tool}`);
        if (
          !Number.isInteger(call.index) ||
          call.index < 0 ||
          call.index > input.limits.maxTotalCalls
        ) {
          throw new Error("Program call limit exceeded.");
        }
        return { kind: INTERRUPT_KIND };
      },
    }),
  };
}

function wrapSource(input: ProgramStart): string {
  // All mutable bookkeeping is lexical, outside the model-written function.
  // The bridge receives issue indices from the sandbox, not host completion order.
  return `return await (async (__host) => {
    let __issued = 0, __inFlight = 0, __logSize = 0;
    const __logs = [];
    const __console = Object.freeze(Object.fromEntries(["log", "info", "warn", "error", "debug"].map(name => [name, (...args) => {
      const text = args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ");
      const remaining = ${LOG_BYTES} - __logSize;
      if (remaining > 0 && __logs.length < 256) { const line = text.slice(0, Math.floor(remaining / 4)); __logs.push(line); __logSize += line.length * 4; }
    }])));
    const __allowed = Object.create(null);
    for (const name of ${JSON.stringify(input.toolNames)}) {
      __allowed[name] = async (input = null) => {
        const index = __issued++;
        if (index >= ${input.limits.maxTotalCalls} || __inFlight >= ${input.limits.maxInFlightCalls}) {
          await __host.call({ index, tool: name, input: null, logs: __logs, limitExceeded: true });
          throw new Error("Program call limit exceeded.");
        }
        __inFlight++;
        try { return await __host.call({ index, tool: name, input, logs: __logs }); }
        finally { __inFlight--; }
      };
    }
    Object.freeze(__allowed);
    const __tools = new Proxy(__allowed, { get(target, name) {
      if (typeof name === "string" && !Object.hasOwn(target, name)) throw new Error("Unknown program tool: " + name);
      return target[name];
    } });
    try {
      const output = await (async (tools, console) => {\n${input.source}\n})(__tools, __console);
      return { status: "completed", output: output ?? null, logs: __logs };
    } catch (error) {
      const message = String(error && error.message || error);
      const errorClass = message.includes("call limit") ? "call-limit" : message.includes("Unknown program tool") ? "unknown-tool" : "runtime";
      return { status: "failed", error: message, errorClass, logs: __logs };
    }
  })(tools);`;
}

function classify(message: string): ProgramErrorClass {
  if (/timeout|timed out|deadline|interrupted/i.test(message)) return "deadline";
  if (/memory|allocation/i.test(message)) return "memory";
  if (/limit|bridge requests/i.test(message)) return "call-limit";
  if (/syntax/i.test(message)) return "syntax";
  if (/unknown.*tool/i.test(message)) return "unknown-tool";
  return "runtime";
}

function failure(
  error: string,
  errorClass: ProgramErrorClass,
  logs: readonly string[],
): ProgramStep {
  return { status: "failed", error, errorClass, logs: capLogs(logs) };
}

/** Enforce the output cap outside generated code as well as inside it. */
function capLogs(logs: readonly string[]): string[] {
  const bounded: string[] = [];
  let remaining = LOG_BYTES;
  for (const log of logs.slice(0, 256)) {
    const bytes = Buffer.from(String(log));
    const line = bytes.subarray(0, remaining).toString("utf8");
    // Truncating a multibyte sequence can add a replacement character.
    const safe = Buffer.byteLength(line) <= remaining ? line : line.slice(0, -1);
    bounded.push(safe);
    remaining -= Buffer.byteLength(safe);
    if (remaining <= 0) break;
  }
  return bounded;
}
