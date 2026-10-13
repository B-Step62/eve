import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createWorld } from "@workflow/world-local";
import { afterAll } from "vitest";

import { resolvePackageRoot } from "#internal/application/package.js";
import { resolveWorkflowTestOutputDirectory } from "#internal/testing/workflow-vitest-plugin.js";
import {
  deriveEveWorkflowQueuePrefix,
  installEveWorkflowQueueNamespace,
} from "#internal/workflow/queue-namespace.js";
import { resolveLocalWorkflowWorldDataDirectory } from "#internal/workflow/local-world-data-directory.js";
import { setWorld } from "#internal/workflow/runtime.js";

import { WORKFLOW_TEST_AGENT_NAME } from "./workflow-global-setup.js";

const packageRoot = resolvePackageRoot();
const outDir = resolveWorkflowTestOutputDirectory(packageRoot);
const poolId = process.env.VITEST_POOL_ID ?? "0";
const activeHandlers = new Set<Promise<Response>>();
let closing = false;
installEveWorkflowQueueNamespace(WORKFLOW_TEST_AGENT_NAME);
const world = createWorld({
  dataDir: join(resolveLocalWorkflowWorldDataDirectory(packageRoot), `vitest-${poolId}`),
  // Every test file in this worker shares the data directory, and the file's
  // state is cleared below. Recovering the previous file's unfinished runs on
  // start would only re-enqueue deliveries that fail before a handler exists.
  recoverActiveRuns: false,
  tag: `vitest-${poolId}`,
});

await world.start?.();
await world.clear();
world.registerHandler(
  deriveEveWorkflowQueuePrefix(WORKFLOW_TEST_AGENT_NAME),
  createLazyHandler(join(outDir, "workflows.mjs")),
);
setWorld(world);

afterAll(async () => {
  closing = true;
  try {
    await world.close?.();
    // Direct queue handlers can still be hydrating streams when close returns.
    await Promise.allSettled(activeHandlers);
  } finally {
    setWorld(undefined);
  }
});

function createLazyHandler(bundlePath: string): (request: Request) => Promise<Response> {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  let loading: Promise<(request: Request) => Promise<Response>> | undefined;

  async function handle(request: Request): Promise<Response> {
    loading ??= import(/* @vite-ignore */ pathToFileURL(bundlePath).href).then(
      (mod: { POST: (request: Request) => Promise<Response> }) => mod.POST,
    );
    handler ??= await loading;
    return await handler(request);
  }

  return async (request: Request) => {
    if (closing) return new Response(null, { status: 503 });
    const pending = handle(request);
    activeHandlers.add(pending);
    try {
      return await pending;
    } finally {
      activeHandlers.delete(pending);
    }
  };
}
