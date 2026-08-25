import type { ToolSet } from "ai";
import type * as CodeModeModule from "#compiled/experimental-ai-sdk-code-mode/index.js";

const MODULE_KEY = Symbol.for("eve.codeModeRuntime.module");
const MODULE_SPECIFIER = ["#compiled", "experimental-ai-sdk-code-mode", "index.js"].join("/");

type RuntimeModule = Pick<typeof CodeModeModule, "createCodeModeTool" | "unwrapCodeModeResult">;
type RuntimeGlobal = typeof globalThis & { [MODULE_KEY]?: RuntimeModule };

export type CodeModeContinuationSecurity = CodeModeModule.CodeModeContinuationSecurityOptions;

let modulePromise: Promise<RuntimeModule> | undefined;

export function installCodeModeRuntimeModule(module: RuntimeModule): void {
  (globalThis as RuntimeGlobal)[MODULE_KEY] = module;
}

export async function createCodeModeRuntimeTool(input: {
  readonly bridgeRequestLimit: number;
  readonly continuationSecurity: CodeModeContinuationSecurity;
  readonly hostTools: ToolSet;
}): Promise<ToolSet[string]> {
  const { createCodeModeTool } = await loadModule();
  return createCodeModeTool(input.hostTools, {
    continuationSecurity: input.continuationSecurity,
    executionPolicy: {
      maxBridgeRequests: input.bridgeRequestLimit,
      maxInFlightBridgeRequests: input.bridgeRequestLimit,
    },
  }) as ToolSet[string];
}

export async function unwrapCodeModeRuntimeResult(
  value: unknown,
  continuationSecurity: CodeModeContinuationSecurity,
): Promise<{ readonly output: unknown; readonly status: "completed" }> {
  const { unwrapCodeModeResult } = await loadModule();
  const result = await unwrapCodeModeResult(value, continuationSecurity);
  if (result.status !== "completed") {
    throw new Error("code_mode does not support interrupt continuations in workflow-run mode");
  }
  return result;
}

async function loadModule(): Promise<RuntimeModule> {
  const installed = (globalThis as RuntimeGlobal)[MODULE_KEY];
  if (installed !== undefined) return installed;
  modulePromise ??= import(MODULE_SPECIFIER) as Promise<RuntimeModule>;
  return await modulePromise;
}
