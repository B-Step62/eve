// EXPERIMENTAL (kernel-spike): the kernel's Node-API build, for step code.

import { createRequire } from "node:module";

import type { KernelBinding } from "#harness/kernel/contract.js";

interface NativeAddon {
  open(config: string): string;
  advance(state: string, inputs: string): string;
  resume(state: string): string;
}

let addon: NativeAddon | undefined;

/** Loads `kernel.node` from `EVE_KERNEL_NATIVE_PATH` (built by packages/kernel-spike). */
export function nativeKernel(): KernelBinding {
  if (addon === undefined) {
    const path = process.env.EVE_KERNEL_NATIVE_PATH;
    if (path === undefined || path === "") {
      throw new Error("eve.kernelMode is native, but EVE_KERNEL_NATIVE_PATH is not set.");
    }
    addon = createRequire(import.meta.url)(path) as NativeAddon;
  }
  const a = addon;
  return {
    open: (config) => JSON.parse(a.open(JSON.stringify(config))),
    advance: (state, inputs) =>
      JSON.parse(a.advance(JSON.stringify(state), JSON.stringify(inputs))),
    resume: (state) => JSON.parse(a.resume(JSON.stringify(state))),
  };
}
