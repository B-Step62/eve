import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.env.EVE_ARMS_OUTPUT ?? `${cwd}/results/measurements.jsonl`);
mkdirSync(dirname(output), { recursive: true });
const repetitions = Number(process.env.EVE_ARMS_REPETITIONS ?? 3);
const models = (
  process.env.EVE_ARMS_MODELS ?? "openai/gpt-6.1-sol,anthropic/claude-opus-5.5"
).split(",");
// Program arms (`js`, `py`) are opt-in: add them to EVE_ARMS_MODES once
// `agent/lib/program-arms.ts` configures their runtime.
const arms = (process.env.EVE_ARMS_MODES ?? "direct,deferred,subagents").split(",");
const TASKS = 10;
const sizes = (process.env.EVE_ARMS_SIZES ?? "moderate,large").split(",");
// `--summary` rebuilds summary.md from the existing rows without running evals.
const summaryOnly = process.argv.includes("--summary");
for (let repetition = 1; !summaryOnly && repetition <= repetitions; repetition++) {
  for (const model of models)
    for (const size of sizes)
      for (const arm of arms) {
        const key = `${model.replaceAll("/", "-")}-${size}-${arm}-${repetition}`;
        console.log(`Running ${key}`);
        const run = spawnSync("pnpm", ["exec", "eve", "eval", "--strict", "--verbose"], {
          cwd,
          encoding: "utf8",
          timeout: 900_000,
          maxBuffer: 32 * 1024 * 1024,
          env: {
            ...process.env,
            EVE_E2E_MODEL: model,
            EVE_ARMS_MODE: arm,
            EVE_ARMS_SIZE: size,
            EVE_ARMS_REPETITION: String(repetition),
            EVE_ARMS_OUTPUT: output,
          },
        });
        writeFileSync(`${dirname(output)}/${key}.log`, (run.stdout ?? "") + (run.stderr ?? ""));
        console.log(
          `Exit ${run.status}; ${(run.stdout ?? "").match(/Results: .*/)?.[0] ?? run.error ?? "No result summary"}`,
        );
      }
}
const rows = existsSync(output)
  ? readFileSync(output, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  : [];
// Every run writes a row, failed ones included, so means cover every attempt.
// A run whose eval process died before writing shows up as a shortfall in Runs.
const lines = [
  "| Model | Size | Arm | Success | Runs | Mean input tokens | Cache read ratio | Mean model calls | Mean actions | Mean program attempts | Mean latency (s) | Error classes |",
  "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
];
for (const model of models)
  for (const size of sizes)
    for (const arm of arms) {
      const r = rows.filter((r) => r.model === model && r.size === size && r.arm === arm);
      const sum = (key) => r.reduce((n, row) => n + (row[key] ?? 0), 0);
      const mean = (key, digits = 1) => (r.length ? (sum(key) / r.length).toFixed(digits) : "-");
      const errors = {};
      for (const row of r) {
        for (const c of [row.errorClass, ...(row.programErrorClasses ?? [])])
          if (c) errors[c] = (errors[c] ?? 0) + 1;
      }
      const errorText =
        Object.entries(errors)
          .map(([c, n]) => `${c} ×${n}`)
          .join(", ") || "-";
      lines.push(
        `| ${model} | ${size} | ${arm} | ${r.filter((r) => r.success).length}/${r.length} | ${r.length}/${TASKS * repetitions} | ${mean("inputTokens")} | ${sum("inputTokens") ? ((100 * sum("cacheReadTokens")) / sum("inputTokens")).toFixed(1) : "-"}% | ${mean("modelCalls")} | ${mean("actions")} | ${mean("programAttempts")} | ${r.length ? (sum("latencyMs") / r.length / 1000).toFixed(2) : "-"} | ${errorText} |`,
      );
    }
writeFileSync(`${dirname(output)}/summary.md`, lines.join("\n") + "\n");
console.log(lines.join("\n"));
