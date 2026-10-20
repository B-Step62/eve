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
/** A review answers with `decision`; the agent writes `path`, then reports what it saw. */
function reviewed(decision) {
  return (i, kind) =>
    kind === "review"
      ? { tool_calls: [{ id: "review", name: "permission_decision", input: { decision } }] }
      : i === 0
        ? {
            tool_calls: [
              { id: "w1", name: "write_file", input: { path: ".zshrc", content: "export A=1\n" } },
            ],
          }
        : { text: "Done." };
}
const written = (ws) => {
  try {
    return readFileSync(join(ws, ".zshrc"), "utf8") === "export A=1\n";
  } catch {
    return false;
  }
};
// `auto` mode: fx's admission sends a write to a shell startup file to the review.
scenarios["review-clear"] = {
  mode: "auto",
  prompt: "Add export A=1 to .zshrc.",
  files: {},
  script: reviewed("clear"),
  check: (ws, out) => written(ws) && out.final_output === "Done.",
};
scenarios["review-caution"] = {
  mode: "auto",
  prompt: "Add export A=1 to .zshrc.",
  files: {},
  script: reviewed("caution"),
  check: (ws, out) => !written(ws) && out.final_output === "Done.",
};
// `ask` mode: the write needs a person, and `fx ask` has none, so the run fails.
scenarios["ask-no-person"] = {
  mode: "ask",
  fails: true,
  prompt: "Write out.txt.",
  files: {},
  script: (i) =>
    i === 0
      ? {
          tool_calls: [
            { id: "w1", name: "write_file", input: { path: "out.txt", content: "x\n" } },
          ],
        }
      : { text: "Done." },
  check: (ws, out) => {
    try {
      readFileSync(join(ws, "out.txt"));
      return false;
    } catch {
      return out.final_output === "";
    }
  },
};
// 20 reads of 5 KB in a 16k-token window: both compact before the turn ends.
scenarios.compaction = {
  prompt: "Read big.txt 20 times.",
  files: { "big.txt": "x".repeat(5000) },
  contextWindow: 16_000,
  script: (_index, _kind, n) =>
    n < 20
      ? { tool_calls: [{ id: `r${n}`, name: "read_file", input: { path: "big.txt" } }] }
      : { text: "Read big.txt 20 times." },
  check: (_ws, out) => out.final_output === "Read big.txt 20 times.",
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
  return startFakeGateway(scenario.script, MODEL, scenario.contextWindow).then(
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
            FX_PERMISSION_MODE: scenario.mode ?? "full-access",
            FX_GATEWAY_BASE_URL: gw.baseUrl,
            FX_GATEWAY_CHAT_URL: gw.chatUrl,
            FX_E2E_GATEWAY_CHAT_URL: gw.chatUrl,
            FX_E2E_GATEWAY_MODELS_URL: `${gw.baseUrl}/coding-agent/v1/models`,
            ...(process.env.FX_KERNEL ? { FX_KERNEL: process.env.FX_KERNEL } : {}),
            ...(process.env.FX_KERNEL_TRACE ? { FX_KERNEL_TRACE: "1" } : {}),
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
          if (process.env.FX_BENCH_DUMP) {
            writeFileSync(process.env.FX_BENCH_DUMP, JSON.stringify(gw.requests));
            writeFileSync(`${process.env.FX_BENCH_DUMP}.stderr`, stderr);
          }
          let out = {};
          try {
            out = JSON.parse(stdout.trim().split("\n").at(-1));
          } catch {}
          resolve({
            ms,
            code,
            out,
            ok: (scenario.fails ? code !== 0 : code === 0) && scenario.check(ws, out),
            calls: gw.requests.length,
            kinds: gw.requests.map((r) => r.kind),
            requestBytes: gw.requests.reduce((n, r) => n + r.bytes, 0),
            stderr,
          });
        });
      }),
  );
}

const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
const only = arg("--only");
for (const [name, scenario] of Object.entries(scenarios)) {
  if (only !== undefined && !only.split(",").includes(name)) continue;
  await runOnce(scenario);
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await runOnce(scenario));
  const bad = runs.find((r) => !r.ok);
  if (bad) {
    console.error(
      `${LABEL} ${name} failed: exit ${bad.code}\n${JSON.stringify(bad.out).slice(0, 500)}\n${process.env.FX_BENCH_STDERR ? bad.stderr : bad.stderr.slice(-1500)}`,
    );
    process.exitCode = 1;
  }
  rows.push({
    label: LABEL,
    scenario: name,
    ms: median(runs.map((r) => r.ms)).toFixed(1),
    modelCalls: runs[0].calls,
    reviews: runs[0].kinds.filter((k) => k === "review").length,
    compactions: runs[0].kinds.filter((k) => k.endsWith("compaction")).length,
    requestKB: (runs[0].requestBytes / 1024).toFixed(1),
    ok: !bad,
  });
}
console.table(rows);
const out = arg("--out");
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
