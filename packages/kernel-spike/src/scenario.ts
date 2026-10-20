// The scenario host in TypeScript: the scripted model and the two file tools.
// It matches crates/fx-mini/src/main.rs line for line, so every host runs the
// same effects. Only three things are host specific, and the caller passes
// them in: how a crash happens, how user input reaches the session, and how
// a cancel reaches a running effect.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EffectRequest, EffectResult, Input, Message, SessionConfig } from "./contract.ts";
import { spikeRoot } from "./native.ts";

export interface ScriptStep {
  text?: string;
  chunks?: number;
  chunk_ms?: number;
  tool_calls?: { id: string; name: string; input: Record<string, unknown> }[];
}

export interface Scenario {
  prompt: string;
  files: Record<string, string>;
  script: ScriptStep[];
  crash?: { at: "tool"; name: string } | { at: "model"; index: number };
  steer?: { after_chunks: number; text: string };
  cancel?: { after_tool_start: string };
}

export interface ScenarioFile {
  config: SessionConfig;
  scenarios: Record<string, Scenario>;
}

export function loadScenarios(): ScenarioFile {
  return JSON.parse(
    readFileSync(join(spikeRoot(), "scenarios/scenarios.json"), "utf8"),
  ) as ScenarioFile;
}

export const SCENARIOS = ["plain", "crash_in_write", "crash_in_model", "steer", "cancel"] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

export function seedWorkspace(ws: string, scenario: Scenario): void {
  mkdirSync(ws, { recursive: true });
  for (const [path, content] of Object.entries(scenario.files))
    writeFileSync(join(ws, path), content);
}

export interface HostHooks {
  /** The process stops here. Rust aborts; Workflow throws; durable-harness hangs until killed. */
  crash(): Promise<never>;
  /** Sends user input to the session, the way this host's inbox receives it. */
  send(input: Input): Promise<void>;
  /** Whether the kernel cancelled this effect. */
  cancelled(): boolean;
}

export class ScenarioHost {
  readonly ws: string;
  readonly scenario: Scenario;

  constructor(ws: string, scenario: Scenario) {
    this.ws = ws;
    this.scenario = scenario;
  }

  trace(line: Record<string, unknown>): void {
    appendFileSync(join(this.ws, ".trace.jsonl"), `${JSON.stringify(line)}\n`);
  }

  traceLines(): Record<string, unknown>[] {
    const file = join(this.ws, ".trace.jsonl");
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  }

  /** A trace marker, so injected input is sent once even across processes. */
  once(marker: string): boolean {
    if (this.traceLines().some((l) => l.kind === marker)) return false;
    this.trace({ kind: marker });
    return true;
  }

  async run(request: EffectRequest, hooks: HostHooks): Promise<EffectResult> {
    const e = request.effect;
    if (e.kind === "model_call") return this.model(e.request.messages, hooks);
    if (e.kind === "tool_call") return this.tool(e.call_id, e.name, e.input, hooks);
    return (await sleepOrCancel(e.ms, hooks))
      ? { status: "interrupted", reason: "cancelled" }
      : { status: "completed", output: null };
  }

  async model(messages: Message[], hooks: HostHooks): Promise<EffectResult> {
    const index = messages.filter((m) => m.role === "assistant").length;
    this.trace({ kind: "model_call", index });
    const crash = this.scenario.crash;
    if (crash?.at === "model" && crash.index === index) {
      const calls = this.traceLines().filter(
        (l) => l.kind === "model_call" && l.index === index,
      ).length;
      if (calls === 1) await hooks.crash();
    }
    const step = this.scenario.script[index] ?? { text: "" };
    const text = step.text ?? "";
    const chunks = Math.max(1, step.chunks ?? 1);
    const chars = [...text];
    const size = Math.max(1, Math.ceil(chars.length / chunks));
    let emitted = "";
    for (let n = 0; n * size < chars.length || (n === 0 && chars.length === 0); n++) {
      if (await sleepOrCancel(step.chunk_ms ?? 0, hooks)) {
        return { status: "interrupted", reason: "cancelled", partial: { text: emitted } };
      }
      emitted += chars.slice(n * size, (n + 1) * size).join("");
      const steer = this.scenario.steer;
      if (steer && steer.after_chunks === n + 1 && this.once("steer_sent")) {
        await hooks.send({ type: "steer", id: "steer-1", text: steer.text });
      }
      if (chars.length === 0) break;
    }
    return { status: "completed", output: { text, tool_calls: step.tool_calls ?? [] } };
  }

  async tool(
    callId: string,
    name: string,
    input: Record<string, unknown>,
    hooks: HostHooks,
  ): Promise<EffectResult> {
    this.trace({ kind: "tool_start", id: callId, name });
    if (this.scenario.cancel?.after_tool_start === name && this.once("cancel_sent")) {
      await hooks.send({ type: "cancel", id: "cancel-1" });
    }
    const path = join(this.ws, String(input.path ?? ""));
    let result: EffectResult;
    if (name === "read_file") {
      if (await sleepOrCancel(Number(input.delay_ms ?? 0), hooks)) {
        return { status: "interrupted", reason: "cancelled" };
      }
      try {
        result = { status: "completed", output: readFileSync(path, "utf8") };
      } catch (err) {
        result = { status: "failed", error: String(err) };
      }
    } else if (name === "write_file") {
      appendFileSync(path, String(input.content ?? ""));
      this.trace({ kind: "side_effect", id: callId });
      const crash = this.scenario.crash;
      if (crash?.at === "tool" && crash.name === name) await hooks.crash();
      result = { status: "completed", output: "ok" };
    } else {
      result = { status: "failed", error: `no tool ${name}` };
    }
    this.trace({ kind: "tool_end", id: callId, name });
    return result;
  }
}

async function sleepOrCancel(ms: number, hooks: HostHooks): Promise<boolean> {
  let left = ms;
  while (left > 0) {
    if (hooks.cancelled()) return true;
    const step = Math.min(10, left);
    await new Promise((r) => setTimeout(r, step));
    left -= step;
  }
  return hooks.cancelled();
}
