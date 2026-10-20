// Runs `fx ask --json --no-save` on the spike scenarios against the scripted
// gateway, and reports time, model calls, and checks.
//
//   node fx/run.mjs --bin <fx> --label <name> [--runs 10]

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startFakeGateway } from "./fake-gateway.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BIN = arg("--bin");
const LABEL = arg("--label", "fx");
const RUNS = Number(arg("--runs", "10"));
const MODEL = "openai/gpt-5.5";

/** The scenarios, in fx's tool names. `steps-N` makes N model calls that each read 5 KB. */
const scenarios = {
  plain: {
    prompt: "Combine a.txt and b.txt into out.txt.",
    files: { "a.txt": "alpha", "b.txt": "beta" },
    script: (i) =>
      i === 0
        ? {
            tool_calls: [
              { id: "r1", name: "read_file", input: { path: "a.txt" } },
              { id: "r2", name: "read_file", input: { path: "b.txt" } },
              { id: "w1", name: "write_file", input: { path: "out.txt", content: "alpha+beta\n" } },
            ],
          }
        : { text: "Done." },
    check: (ws, out) => {
      try {
        return (
          readFileSync(join(ws, "out.txt"), "utf8") === "alpha+beta\n" &&
          out.final_output === "Done."
        );
      } catch {
        return false;
      }
    },
  },
};
for (const n of [1, 5, 10, 20]) {
  scenarios[`steps-${n}`] = {
    prompt: `Read big.txt ${n} times.`,
    files: { "big.txt": "x".repeat(5000) },
    script: (i) =>
      i < n
        ? { tool_calls: [{ id: `r${i}`, name: "read_file", input: { path: "big.txt" } }] }
        : { text: `Read big.txt ${n} times.` },
    check: (_ws, out) => out.final_output === `Read big.txt ${n} times.`,
  };
}

function runOnce(scenario) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "fx-bench-")));
  const home = join(root, "home");
  const ws = join(root, "ws");
  mkdirSync(join(home, ".fx"), { recursive: true });
  mkdirSync(ws);
  writeFileSync(join(home, ".fx", "settings.json"), "{}");
  for (const [p, c] of Object.entries(scenario.files)) writeFileSync(join(ws, p), c);
  return startFakeGateway(scenario.script, MODEL).then(
    (gw) =>
      new Promise((resolve, reject) => {
        const start = performance.now();
        const child = spawn(BIN, ["ask", "--json", "--no-save", scenario.prompt], {
          cwd: ws,
          env: {
            PATH: "/usr/bin:/bin",
            HOME: home,
            AI_GATEWAY_API_KEY: "synthetic",
            FX_DISABLE_KEYCHAIN: "1",
            FX_E2E_DISABLE_DOTENV: "1",
            FX_AUTO_UPGRADE: "0",
            FX_SOUND: "0",
            FX_SKIP_ONBOARDING: "1",
            FX_MODEL: MODEL,
            FX_PERMISSION_MODE: "full-access",
            FX_GATEWAY_BASE_URL: gw.baseUrl,
            FX_GATEWAY_CHAT_URL: gw.chatUrl,
            FX_E2E_GATEWAY_CHAT_URL: gw.chatUrl,
            FX_E2E_GATEWAY_MODELS_URL: `${gw.baseUrl}/coding-agent/v1/models`,
            ...(process.env.FX_KERNEL ? { FX_KERNEL: process.env.FX_KERNEL } : {}),
          },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d));
        child.stderr.on("data", (d) => (stderr += d));
        child.on("error", reject);
        child.on("exit", async (code) => {
          const ms = performance.now() - start;
          await gw.stop();
          let out = {};
          try {
            out = JSON.parse(stdout.trim().split("\n").at(-1));
          } catch {}
          resolve({
            ms,
            code,
            out,
            ok: code === 0 && scenario.check(ws, out),
            calls: gw.requests.length,
            requestBytes: gw.requests.reduce((n, r) => n + r.bytes, 0),
            stderr,
          });
        });
      }),
  );
}

const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
for (const [name, scenario] of Object.entries(scenarios)) {
  await runOnce(scenario);
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await runOnce(scenario));
  const bad = runs.find((r) => !r.ok);
  if (bad) {
    console.error(
      `${LABEL} ${name} failed: exit ${bad.code}\n${JSON.stringify(bad.out).slice(0, 500)}\n${bad.stderr.slice(-1500)}`,
    );
    process.exitCode = 1;
  }
  rows.push({
    label: LABEL,
    scenario: name,
    ms: median(runs.map((r) => r.ms)).toFixed(1),
    modelCalls: runs[0].calls,
    requestKB: (runs[0].requestBytes / 1024).toFixed(1),
    ok: !bad,
  });
}
console.table(rows);
const out = arg("--out");
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
