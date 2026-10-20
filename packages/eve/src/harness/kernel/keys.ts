// EXPERIMENTAL (kernel-spike): context keys for the kernel prototype.

import { ContextKey } from "#context/key.js";
import type { KernelMode, KernelStepInput, KernelStepOutput } from "#harness/kernel/contract.js";

/** Set in a session's serialized context to run its turns through the kernel. */
export const KernelModeKey = new ContextKey<KernelMode>("eve.kernelMode");

/** `wasm` mode: what the workflow asked this turn step to run. */
export const KernelStepInputKey = new ContextKey<KernelStepInput>("eve.internal.kernelStepInput");

/** `wasm` mode: what this turn step ran, for the workflow's next kernel call. */
export const KernelStepOutputKey = new ContextKey<KernelStepOutput>(
  "eve.internal.kernelStepOutput",
);
