// Loads the Node-API build of the kernel (dist/kernel.node).
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Advanced, Entry, Input, KernelState, Output, SessionConfig } from "./contract.ts";

interface Binding {
  open(config: string): string;
  advance(state: string, inputs: string): string;
  replay(state: string, entries: string): string;
  resume(state: string): string;
  Kernel: {
    new (config: string): NativeKernel;
    fromState(state: string): NativeKernel;
  };
}

interface NativeKernel {
  advance(inputs: string): string;
  replay(entries: string): string;
  resume(): string;
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

export function replay(state: KernelState, entries: Entry[]): Advanced {
  return JSON.parse(native().replay(JSON.stringify(state), JSON.stringify(entries))) as Advanced;
}

export function resume(state: KernelState): Output {
  return JSON.parse(native().resume(JSON.stringify(state))) as Output;
}

/** The kernel with its state kept in Rust between calls. */
export class Kernel {
  #inner: NativeKernel;

  constructor(config: SessionConfig, snapshot?: KernelState) {
    this.#inner =
      snapshot === undefined
        ? new (native().Kernel)(JSON.stringify(config))
        : native().Kernel.fromState(JSON.stringify(snapshot));
  }

  replay(entries: Entry[]): Output {
    return JSON.parse(this.#inner.replay(JSON.stringify(entries))) as Output;
  }

  resume(): Output {
    return JSON.parse(this.#inner.resume()) as Output;
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
