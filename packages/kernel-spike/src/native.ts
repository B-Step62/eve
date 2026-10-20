// Loads the Node-API build of the kernel (dist/kernel.node).
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Advanced, Input, KernelState, Output, SessionConfig } from "./contract.ts";

interface Binding {
  open(config: string): string;
  advance(state: string, inputs: string): string;
  Kernel: {
    new (config: string): NativeKernel;
    fromState(state: string): NativeKernel;
  };
}

interface NativeKernel {
  advance(inputs: string): string;
  snapshot(): string;
  isIdle(): boolean;
}

/** The package root. Workflow bundles move this file, so tests pass it in. */
export function spikeRoot(): string {
  return process.env.KERNEL_SPIKE_ROOT ?? join(fileURLToPath(new URL(".", import.meta.url)), "..");
}

let binding: Binding | undefined;

export function native(): Binding {
  binding ??= createRequire(import.meta.url)(join(spikeRoot(), "dist/kernel.node")) as Binding;
  return binding;
}

export function open(config: SessionConfig): KernelState {
  return JSON.parse(native().open(JSON.stringify(config))) as KernelState;
}

export function advance(state: KernelState, inputs: Input[]): Advanced {
  return JSON.parse(native().advance(JSON.stringify(state), JSON.stringify(inputs))) as Advanced;
}

/** The kernel with its state kept in Rust between calls. */
export class Kernel {
  #inner: NativeKernel;

  constructor(config: SessionConfig) {
    this.#inner = new (native().Kernel)(JSON.stringify(config));
  }

  advance(inputs: Input[]): Output {
    return JSON.parse(this.#inner.advance(JSON.stringify(inputs))) as Output;
  }

  snapshot(): KernelState {
    return JSON.parse(this.#inner.snapshot()) as KernelState;
  }

  isIdle(): boolean {
    return this.#inner.isIdle();
  }
}
