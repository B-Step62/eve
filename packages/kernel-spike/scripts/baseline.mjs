// Runs both baselines and prints the report.
//
//   pnpm spike:baseline
//
// The eve half runs inside eve's integration tier (eve's aliases, Workflow
// transform, and world-local), so it needs eve's JS build first.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const spike = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(spike, "../..");
const run = (cmd, args, cwd, env = {}) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

// The eve-wasm mode runs the kernel in workflow code, which cannot read files,
// so the WASM bytes go into eve's workflow bundle for this run only.
const wasmBytes = join(repo, "packages/eve/src/harness/kernel/wasm-bytes.ts");
const original = readFileSync(wasmBytes, "utf8");
const b64 = readFileSync(join(spike, "dist/kernel.wasm")).toString("base64");
writeFileSync(wasmBytes, `export const KERNEL_WASM_BASE64: string = ${JSON.stringify(b64)};\n`);
try {
  run("pnpm", ["--filter", "eve", "run", "build:js"], repo);
  run(
    "pnpm",
    [
      "--filter",
      "eve",
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.integration.config.ts",
      "--dir",
      "../kernel-spike/baseline",
      "--globals",
    ],
    repo,
    { KERNEL_SPIKE_ROOT: spike, EVE_KERNEL_NATIVE_PATH: join(spike, "dist/kernel.node") },
  );
} finally {
  writeFileSync(wasmBytes, original);
}
run(
  "npx",
  [
    "vitest",
    "run",
    "--config",
    "hosts/workflow/vitest.config.ts",
    "hosts/workflow/test/baseline.test.ts",
  ],
  spike,
);
run("node", ["bench/kernel-turn.ts"], spike);
run("node", ["baseline/report.ts"], spike);
