// Builds the kernel binding, the WASM module, and fx-mini, and copies the
// artifacts next to the TypeScript that loads them.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cargo = (...args) => execFileSync("cargo", args, { cwd: root, stdio: "inherit" });

cargo("build", "--release", "-p", "kernel-napi", "-p", "fx-mini");
cargo("build", "--release", "-p", "kernel-wasm", "--target", "wasm32-unknown-unknown");

const lib = process.platform === "darwin" ? "libkernel_napi.dylib" : "libkernel_napi.so";
mkdirSync(join(root, "dist"), { recursive: true });
copyFileSync(join(root, "target/release", lib), join(root, "dist/kernel.node"));
const wasm = readFileSync(join(root, "target/wasm32-unknown-unknown/release/kernel_wasm.wasm"));
writeFileSync(join(root, "dist/kernel.wasm"), wasm);
// Workflow code cannot read files, so the bytes ride in the workflow bundle.
writeFileSync(
  join(root, "dist/kernel-wasm-base64.ts"),
  `export const KERNEL_WASM_BASE64 = ${JSON.stringify(wasm.toString("base64"))};\n`,
);
