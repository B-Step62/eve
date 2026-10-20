import { fileURLToPath } from "node:url";

import { workflow } from "@workflow/vitest";
import { defineConfig } from "vitest/config";

// Workflow ids are relative to the root, so the bundle and the tests must
// share it: the package root.
const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root,
  plugins: [workflow({ cwd: root, rootDir: `${root}/.spike-tmp` })],
  test: {
    include: ["hosts/workflow/test/**/*.test.ts"],
    env: { KERNEL_SPIKE_ROOT: root },
    testTimeout: 60_000,
  },
});
