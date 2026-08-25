import { asSchema, type ToolSet } from "ai";
import { z } from "#compiled/zod/index.js";

import type { HarnessToolMap } from "#harness/types.js";
import { isNeverApproval } from "#tools/approval/policies.js";
import { FINAL_OUTPUT_TOOL_NAME } from "#runtime/framework-tools/final-output.js";
import { LOAD_SKILL_TOOL_NAME } from "#runtime/skills/fragment-context.js";
import {
  createCodeModeRuntimeTool,
  type CodeModeContinuationSecurity,
} from "#shared/code-mode-runtime.js";

/** Model-facing tool name for the experimental code-mode sandbox. */
export const CODE_MODE_TOOL_NAME = "code_mode";

/** Catalog discovery tools available to generated code in `"lazy"` mode. */
export const SEARCH_TOOLS_NAME = "search_tools";
export const DESCRIBE_TOOLS_NAME = "describe_tools";

/**
 * Sandboxed nested tool calls one `code_mode` invocation may make. Mirrors the
 * Workflow sandbox default bridge limit.
 */
const CODE_MODE_BRIDGE_REQUEST_LIMIT = 256;
const CODE_MODE_ORCHESTRATION_INSTRUCTION =
  "Call code_mode at most once per response. Never wrap a single host call; put the complete tool workflow—dependent calls, loops, retries, and parallel work—in that one program.";

/**
 * Framework tools that never enter the sandbox: control-plane actions
 * (`load_skill` injects instructions, `final_output` ends the run) are model
 * decisions, not data work to script.
 */
const NEVER_SANDBOXED_TOOL_NAMES: ReadonlySet<string> = new Set([
  LOAD_SKILL_TOOL_NAME,
  FINAL_OUTPUT_TOOL_NAME,
]);

export type CodeModeMode = "eager" | "lazy";

interface CodeModeToolSet {
  readonly claimedToolNames: readonly string[];
  readonly modelTools: ToolSet;
}

/**
 * Replaces the agent's ordinary executable tools with one model-facing
 * `code_mode` sandbox tool. Claimed tools are demoted: they leave the direct
 * model surface and become callable only as `tools.name(input)` from generated
 * code, matching how code mode runs everywhere else (one `execute` surface,
 * not a parallel one).
 *
 * Simplest-possible claiming rule — a tool enters the sandbox only when its
 * bridged call can complete inline, with no interrupt machinery:
 *
 * - it has a server-side `execute`;
 * - it is not a subagent/remote-agent delegation (`runtimeAction`), which
 *   remains a direct model tool with its own durable child-session lifecycle;
 * - it has no approval policy or explicit `never()`; dynamically gated tools
 *   stay direct because native approval runs outside `execute`;
 * - it is not a background-execution tool (its execute needs batch wiring).
 *
 * Everything unclaimed stays a direct model tool.
 */
export async function applyCodeModeTool(input: {
  readonly continuationSecurity: CodeModeContinuationSecurity;
  readonly harnessTools: HarnessToolMap;
  readonly mode: CodeModeMode;
  readonly tools: ToolSet;
}): Promise<CodeModeToolSet> {
  const hostTools: Record<string, ToolSet[string]> = {};
  const modelTools: Record<string, ToolSet[string]> = {};

  for (const [name, tool] of Object.entries(input.tools)) {
    if (claimsForCodeMode(name, tool, input.harnessTools)) {
      hostTools[name] = wrapHostToolForCodeMode(tool);
    } else {
      modelTools[name] = tool;
    }
  }

  if (Object.keys(hostTools).length === 0) {
    return { claimedToolNames: [], modelTools: input.tools };
  }

  const claimedToolNames = Object.keys(hostTools);

  if (input.mode === "lazy") {
    Object.assign(hostTools, createDiscoveryTools(hostTools));
  }

  const codeModeTool = await createCodeModeRuntimeTool({
    bridgeRequestLimit: CODE_MODE_BRIDGE_REQUEST_LIMIT,
    continuationSecurity: input.continuationSecurity,
    hostTools: hostTools as ToolSet,
  });

  const advertisedCodeModeTool =
    input.mode === "lazy"
      ? ({
          ...codeModeTool,
          description: lazyCodeModeDescription(codeModeTool, hostTools as ToolSet),
        } as ToolSet[string])
      : ({
          ...codeModeTool,
          description: `${CODE_MODE_ORCHESTRATION_INSTRUCTION}\n\n${codeModeTool.description ?? ""}`,
        } as ToolSet[string]);
  modelTools[CODE_MODE_TOOL_NAME] = {
    ...advertisedCodeModeTool,
    execute: undefined,
  } as ToolSet[string];

  return { claimedToolNames, modelTools: modelTools as ToolSet };
}

/** Executes one generated program against a reconstructed static host surface. */
export async function executeCodeModeProgram(input: {
  readonly continuationSecurity: CodeModeContinuationSecurity;
  readonly harnessTools: HarnessToolMap;
  readonly js: string;
  readonly mode: CodeModeMode;
  readonly toolCallId: string;
  readonly toolNames: readonly string[];
  readonly tools: ToolSet;
}): Promise<unknown> {
  const hostTools: Record<string, ToolSet[string]> = {};
  for (const name of input.toolNames) {
    const tool = input.tools[name];
    if (tool !== undefined && claimsForCodeMode(name, tool, input.harnessTools)) {
      hostTools[name] = wrapHostToolForCodeMode(tool);
    }
  }
  if (input.mode === "lazy") Object.assign(hostTools, createDiscoveryTools(hostTools));
  const codeModeTool = await createCodeModeRuntimeTool({
    bridgeRequestLimit: CODE_MODE_BRIDGE_REQUEST_LIMIT,
    continuationSecurity: input.continuationSecurity,
    hostTools: hostTools as ToolSet,
  });
  if (codeModeTool.execute === undefined) throw new Error("code_mode has no executor");
  return await codeModeTool.execute(
    { js: input.js } as never,
    {
      toolCallId: input.toolCallId,
    } as never,
  );
}

function claimsForCodeMode(
  name: string,
  tool: ToolSet[string],
  harnessTools: HarnessToolMap,
): boolean {
  if (NEVER_SANDBOXED_TOOL_NAMES.has(name)) return false;
  if (tool.execute === undefined) return false;

  const harnessTool = harnessTools.get(name);
  if (harnessTool === undefined) return false;
  if (harnessTool.runtimeAction !== undefined) return false;
  if (harnessTool.approval !== undefined && !isNeverApproval(harnessTool.approval)) return false;
  if (harnessTool.execution === "background") return false;
  return true;
}

/**
 * Bridged host-tool calls resolve tool output for generated code, so the
 * model-output projection never applies; async-iterable outputs collapse to
 * their final value the same way the harness does for the model.
 */
function wrapHostToolForCodeMode(tool: ToolSet[string]): ToolSet[string] {
  const execute = tool.execute;
  if (execute === undefined) return tool;

  return {
    ...tool,
    execute: async (toolInput: never, options: never) =>
      resolveExecuteOutput(execute(toolInput, options)),
  } as ToolSet[string];
}

async function resolveExecuteOutput(output: unknown): Promise<unknown> {
  if (isAsyncIterable(output)) {
    let finalOutput: unknown;
    for await (const part of output) {
      finalOutput = part;
    }
    return finalOutput;
  }
  return await output;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as { readonly [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] ===
      "function"
  );
}

/**
 * In-sandbox catalog discovery for `"lazy"` mode. Generated code searches the
 * catalog and reads full signatures at runtime instead of every signature
 * being inlined into the tool description.
 */
function createDiscoveryTools(
  catalog: Record<string, ToolSet[string]>,
): Record<string, ToolSet[string]> {
  const entries = Object.entries(catalog).map(([name, tool]) => ({
    description: typeof tool.description === "string" ? tool.description : "",
    inputSchema: tool.inputSchema,
    name,
  }));

  const search: ToolSet[string] = {
    description: "Search the sandboxed tool catalog. Returns matching tool names and descriptions.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Case-insensitive substring matched against tool names and descriptions. Omit to list every tool.",
        ),
    }),
    execute: async ({ query }: { readonly query?: string }) => {
      const needle = query?.toLowerCase().trim() ?? "";
      return entries
        .filter(
          (entry) =>
            needle === "" ||
            entry.name.toLowerCase().includes(needle) ||
            entry.description.toLowerCase().includes(needle),
        )
        .map((entry) => ({ description: entry.description, name: entry.name }));
    },
  } as ToolSet[string];

  const describe: ToolSet[string] = {
    description: "Describe sandboxed tools: full description and JSON Schema of the input.",
    inputSchema: z.object({
      names: z.array(z.string()).describe("Tool names to describe."),
    }),
    execute: async ({ names }: { readonly names: readonly string[] }) => {
      return names.map((name) => {
        const entry = entries.find((candidate) => candidate.name === name);
        if (entry === undefined) return { error: "unknown tool", name };
        return {
          description: entry.description,
          inputSchema: asSchema(entry.inputSchema).jsonSchema,
          name,
        };
      });
    },
  } as ToolSet[string];

  return { [DESCRIBE_TOOLS_NAME]: describe, [SEARCH_TOOLS_NAME]: search };
}

/**
 * Lazy-mode description: keep the generated sandbox rules, replace the inlined
 * signature listing with a names-only catalog plus the discovery API.
 */
function lazyCodeModeDescription(codeModeTool: ToolSet[string], hostTools: ToolSet): string {
  const generated = typeof codeModeTool.description === "string" ? codeModeTool.description : "";
  const marker = "Tools:\n";
  const start = generated.indexOf(marker);
  const header = start >= 0 ? generated.slice(0, start).trimEnd() : generated.trimEnd();

  const names = Object.keys(hostTools)
    .filter((name) => name !== SEARCH_TOOLS_NAME && name !== DESCRIBE_TOOLS_NAME)
    .sort();

  return [
    header,
    "",
    CODE_MODE_ORCHESTRATION_INSTRUCTION,
    "",
    "Discovery API (call these first to learn signatures):",
    "```ts",
    "declare const tools: {",
    `  /** Search the tool catalog. Omit query to list everything. */`,
    `  ${SEARCH_TOOLS_NAME}: (input: { query?: string; }) => Promise<{ name: string; description: string; }[]>;`,
    `  /** Full description and input JSON Schema per tool. */`,
    `  ${DESCRIBE_TOOLS_NAME}: (input: { names: string[]; }) => Promise<unknown[]>;`,
    "  // ...plus every tool listed below, callable as tools.name(input).",
    "};",
    "```",
    "",
    `Available tools (names only): ${names.join(", ")}.`,
    `Signatures are not listed here; call tools.${DESCRIBE_TOOLS_NAME} before using a tool you have not seen.`,
  ].join("\n");
}
