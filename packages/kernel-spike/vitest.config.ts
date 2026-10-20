import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: { KERNEL_SPIKE_ROOT: fileURLToPath(new URL(".", import.meta.url)) },
    testTimeout: 60_000,
  },
});
