// Host A: fx-mini, the in-process Rust runner, as a real OS process. A crash
// scenario aborts the first process; a second process resumes from the log.

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import type { Command, KernelEvent, KernelState } from "../src/contract.ts";
import { spikeRoot } from "../src/native.ts";
import type { ScenarioName } from "../src/scenario.ts";
import type { RunResult } from "./assertions.ts";

const bin = () => join(spikeRoot(), "target/release/fx-mini");

function run(name: ScenarioName, ws: string, extra: string[]) {
  return spawnSync(
    bin(),
    [
      "--scenarios",
      join(spikeRoot(), "scenarios/scenarios.json"),
      "--scenario",
      name,
      "--workspace",
      ws,
      ...extra,
    ],
    { encoding: "utf8" },
  );
}

export function runHostA(
  name: ScenarioName,
  ws: string,
  store: "log" | "none" = "log",
): RunResult & { crashed: boolean } {
  const commands: Command[] = [];
  const events: KernelEvent[] = [];
  let state: KernelState | undefined;
  const collect = (stdout: string) => {
    for (const line of stdout.split("\n").filter(Boolean)) {
      const v = JSON.parse(line) as {
        event?: KernelEvent;
        command?: Command;
        final_state?: KernelState;
      };
      if (v.event) events.push(v.event);
      if (v.command) commands.push(v.command);
      if (v.final_state) state = v.final_state;
    }
  };
  const first = run(name, ws, store === "none" ? ["--no-save"] : []);
  collect(first.stdout);
  const crashed = first.signal === "SIGABRT" || first.status === 134;
  if (crashed && store === "log") collect(run(name, ws, ["--resume"]).stdout);
  if (!state) throw new Error(`fx-mini produced no final state: ${first.stderr}`);
  return { ws, state, commands, events, crashed };
}
