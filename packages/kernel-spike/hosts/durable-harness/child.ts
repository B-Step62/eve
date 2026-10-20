// One OS process of host C, on world-local in the workspace.
//
//   node hosts/durable-harness/child.ts <scenario> <workspace>
//   node hosts/durable-harness/child.ts <scenario> <workspace> --recover <sessionId>
//
// Prints `{ sessionId }` once the session starts, and exits when the drive
// writes its result file. The parent SIGKILLs it to crash a scenario.

import { existsSync } from "node:fs";
import { join } from "node:path";

import { createWorld } from "@workflow/world-local";
import { durableSessions, QUEUE_PREFIX } from "durable-harness";

import type { Input } from "../../src/contract.ts";
import { loadScenarios, ScenarioHost, seedWorkspace } from "../../src/scenario.ts";
import { kernelHarness, RESULT_FILE } from "./harness.ts";

const [name, ws, mode, recoverId] = process.argv.slice(2);
if (!name || !ws) throw new Error("usage: child.ts <scenario> <workspace> [--recover <sessionId>]");
const recovering = mode === "--recover";

const { config, scenarios } = loadScenarios();
const scenario = scenarios[name];
if (!scenario) throw new Error(`no scenario ${name}`);
if (!recovering) seedWorkspace(ws, scenario);

const world = createWorld({ dataDir: join(ws, ".wf"), recoverActiveRuns: recovering });
let sessionId = recoverId ?? "";
const send = async (input: Input) => {
  if (input.type === "steer") await sessions.send(sessionId, input.text, "steer");
  else if (input.type === "cancel") await sessions.send(sessionId, "cancel", "followUp");
};
const sessions = durableSessions({
  world,
  harness: kernelHarness({ config, host: new ScenarioHost(ws, scenario), send }),
});
world.registerHandler(QUEUE_PREFIX, sessions.handler);
await world.start?.();
if (!recovering) {
  ({ sessionId } = await sessions.start({ prompt: scenario.prompt }));
}
process.stdout.write(`${JSON.stringify({ sessionId, pid: process.pid })}\n`);

const started = Date.now();
while (!existsSync(join(ws, RESULT_FILE))) {
  const s = await sessions.inspect(sessionId);
  if (s.status === "failed") throw new Error(`session failed: ${s.failure?.message}`);
  if (Date.now() - started > 60_000) throw new Error("timed out");
  await new Promise((r) => setTimeout(r, 50));
}
await world.close?.();
process.exit(0);
