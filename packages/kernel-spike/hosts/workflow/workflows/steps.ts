// Step code for host B. Steps run in Node, so they may load the native
// kernel and touch the workspace. Workflow code never imports these modules
// directly; it calls the steps.

import { getStepMetadata } from "workflow";
import { resumeHook } from "workflow/api";

import type {
  Advanced,
  EffectRequest,
  EffectResult,
  Input,
  KernelState,
  SessionConfig,
} from "../../../src/contract.ts";
import type { Scenario } from "../../../src/scenario.ts";

export const inboxToken = (ws: string) => `kernel-spike:${ws}`;

export async function loadScenarioStep(
  name: string,
  ws: string,
): Promise<{ config: SessionConfig; scenario: Scenario }> {
  "use step";
  const { loadScenarios, seedWorkspace } = await import("../../../src/scenario.ts");
  const { config, scenarios } = loadScenarios();
  const scenario = scenarios[name]!;
  seedWorkspace(ws, scenario);
  return { config, scenario };
}

export async function kernelOpenStep(config: SessionConfig): Promise<KernelState> {
  "use step";
  const { open } = await import("../../../src/native.ts");
  return open(config);
}

export async function kernelAdvanceStep(state: KernelState, inputs: Input[]): Promise<Advanced> {
  "use step";
  const { advance } = await import("../../../src/native.ts");
  return advance(state, inputs);
}

/** Workflow cannot interrupt a running step, so a cancel is a marker the effect polls. */
export async function cancelStep(ws: string, key: string): Promise<void> {
  "use step";
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  mkdirSync(join(ws, ".cancel"), { recursive: true });
  writeFileSync(join(ws, ".cancel", key), "");
}

/**
 * One kernel effect. Workflow reruns a step that did not finish, so a
 * `never` effect on a later attempt reports `interrupted { crashed }`
 * instead of running again (R2). A thrown error stands in for a crash: in
 * this in-process test the Workflow runtime retries the step the same way it
 * redelivers one after a process dies.
 */
export async function runEffectStep(
  name: string,
  ws: string,
  request: EffectRequest,
): Promise<EffectResult> {
  "use step";
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { loadScenarios, ScenarioHost } = await import("../../../src/scenario.ts");
  const { attempt } = getStepMetadata();
  if (request.replay === "never" && attempt > 1) {
    return { status: "interrupted", reason: "crashed", partial: null };
  }
  const host = new ScenarioHost(ws, loadScenarios().scenarios[name]!);
  return host.run(request, {
    crash: async () => {
      throw new Error("simulated crash");
    },
    send: async (input) => {
      await resumeHook(inboxToken(ws), input);
    },
    cancelled: () => existsSync(join(ws, ".cancel", request.key)),
  });
}
