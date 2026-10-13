import { readFileSync } from "node:fs";

export const TASKS = 10;

/** Rows of one dataset (a JSONL file written by `measure.ts`). */
export function readRows(path) {
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map(JSON.parse);
}

/**
 * Markdown table with one line per model, size and arm present in `rows`, in
 * first-seen order. `Runs` compares the rows recorded with `TASKS` per
 * repetition, so a run whose eval process died before writing shows up as a
 * shortfall.
 */
export function summarize(rows, repetitions) {
  const lines = [
    "| Model | Size | Arm | Success | Runs | Mean input tokens | Cache read ratio | Mean model calls | Mean actions | Mean program attempts | Mean latency (s) | Error classes |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
  ];
  const keys = [...new Set(rows.map((r) => JSON.stringify([r.model, r.size, r.arm])))];
  for (const key of keys) {
    const [model, size, arm] = JSON.parse(key);
    const r = rows.filter((r) => r.model === model && r.size === size && r.arm === arm);
    const sum = (k) => r.reduce((n, row) => n + (row[k] ?? 0), 0);
    const mean = (k) => (sum(k) / r.length).toFixed(1);
    const errors = {};
    for (const row of r)
      for (const c of [row.errorClass, ...(row.programErrorClasses ?? [])])
        if (c) errors[c] = (errors[c] ?? 0) + 1;
    const errorText =
      Object.entries(errors)
        .map(([c, n]) => `${c} ×${n}`)
        .join(", ") || "-";
    const cache = sum("inputTokens")
      ? `${((100 * sum("cacheReadTokens")) / sum("inputTokens")).toFixed(1)}%`
      : "-";
    lines.push(
      `| ${model} | ${size} | ${arm} | ${r.filter((r) => r.success).length}/${r.length} | ${r.length}/${TASKS * repetitions} | ${mean("inputTokens")} | ${cache} | ${mean("modelCalls")} | ${mean("actions")} | ${mean("programAttempts")} | ${(sum("latencyMs") / r.length / 1000).toFixed(2)} | ${errorText} |`,
    );
  }
  return lines.join("\n") + "\n";
}
