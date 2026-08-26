import type { ToolSet } from "ai";
import type * as CodeModeModule from "#compiled/experimental-ai-sdk-code-mode/index.js";

const MODULE_KEY = Symbol.for("eve.codeModeRuntime.module");
const MODULE_SPECIFIER = ["#compiled", "experimental-ai-sdk-code-mode", "index.js"].join("/");

type RuntimeModule = Pick<typeof CodeModeModule, "createCodeModeTool">;
type RuntimeGlobal = typeof globalThis & { [MODULE_KEY]?: RuntimeModule };

let modulePromise: Promise<RuntimeModule> | undefined;

export function installCodeModeRuntimeModule(module: RuntimeModule): void {
  (globalThis as RuntimeGlobal)[MODULE_KEY] = module;
}

export async function createCodeModeRuntimeTool(input: {
  readonly bridgeRequestLimit: number;
  readonly hostTools: ToolSet;
}): Promise<ToolSet[string]> {
  const { createCodeModeTool } = await loadModule();
  return createCodeModeTool(input.hostTools, {
    executionPolicy: {
      maxBridgeRequests: input.bridgeRequestLimit,
      maxInFlightBridgeRequests: input.bridgeRequestLimit,
    },
  }) as ToolSet[string];
}

async function loadModule(): Promise<RuntimeModule> {
  const installed = (globalThis as RuntimeGlobal)[MODULE_KEY];
  if (installed !== undefined) return installed;
  modulePromise ??= import(MODULE_SPECIFIER) as Promise<RuntimeModule>;
  return await modulePromise;
}
