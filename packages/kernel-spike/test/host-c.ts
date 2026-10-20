// Host C driver: runs a scenario in a child process on durable-harness. A
// crash scenario is SIGKILLed at its crash point (after the side effect,
// before the result is recorded) and recovered by a second process.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { spikeRoot } from "../src/native.ts";
import { loadScenarios, type ScenarioName } from "../src/scenario.ts";
import { RESULT_FILE } from "../hosts/durable-harness/harness.ts";
import type { RunResult } from "./assertions.ts";

function child(args: string[]) {
  const p = spawn(
    process.execPath,
    [join(spikeRoot(), "hosts/durable-harness/child.ts"), ...args],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, KERNEL_SPIKE_ROOT: spikeRoot() },
    },
  );
  let out = "";
  let err = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (err += d));
  const exited = new Promise<number | null>((r) => p.on("exit", (code) => r(code)));
  return { p, exited, out: () => out, err: () => err };
}

async function until<T>(fn: () => T | undefined, what: string, ms = 30_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

function traceHas(ws: string, pred: (l: Record<string, unknown>) => boolean): boolean {
  const file = join(ws, ".trace.jsonl");
  if (!existsSync(file)) return false;
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .some((l) => pred(JSON.parse(l) as Record<string, unknown>));
}

export async function runHostC(name: ScenarioName, ws: string): Promise<RunResult> {
  const scenario = loadScenarios().scenarios[name]!;
  const first = child([name, ws]);
  const crash = scenario.crash;
  if (crash) {
    const sessionId = await until(() => {
      const line = first
        .out()
        .split("\n")
        .find((l) => l.startsWith("{"));
      return line ? (JSON.parse(line) as { sessionId: string }).sessionId : undefined;
    }, "the session to start");
    await until(
      () =>
        traceHas(ws, (l) =>
          crash.at === "tool"
            ? l.kind === "side_effect"
            : l.kind === "model_call" && l.index === crash.index,
        ) || undefined,
      "the crash point",
    );
    first.p.kill("SIGKILL");
    await first.exited;
    const second = child([name, ws, "--recover", sessionId]);
    await finish(second);
  } else {
    await finish(first);
  }
  const result = JSON.parse(readFileSync(join(ws, RESULT_FILE), "utf8")) as Omit<RunResult, "ws">;
  return { ws, ...result };
}

async function finish(c: { p: ChildProcess; exited: Promise<number | null>; err(): string }) {
  const timer = setTimeout(() => c.p.kill("SIGKILL"), 60_000);
  const code = await c.exited;
  clearTimeout(timer);
  if (code !== 0) throw new Error(`host C child exited ${code}: ${c.err().slice(-3000)}`);
}
