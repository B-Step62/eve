import { beforeEach, expect, it, vi } from "vitest";

import { HookNotFoundError } from "#compiled/@workflow/errors/index.js";
import type { CompiledBundle } from "#runtime/sessions/runtime-context-keys.js";
import type { ConnectionEventPayload } from "./delivery.js";
import type { ConnectionEventSubscribeOutcome, EventBinding } from "./state.js";

const { hooks, runs, started, resumed } = vi.hoisted(() => ({
  hooks: new Map<string, { runId: string; metadata: unknown }>(),
  runs: new Map<
    string,
    { status: string; outcome: Promise<unknown>; publish: (value: unknown) => void }
  >(),
  started: vi.fn(async (_reference: unknown, _args: unknown[]) => ({ runId: "watch-run" })),
  resumed: vi.fn(async (_token: string, _value: unknown) => ({})),
}));
vi.mock("#internal/workflow/runtime.js", () => ({
  async getHookByToken(token: string) {
    const hook = hooks.get(token);
    if (hook === undefined) throw new HookNotFoundError(token);
    return { runId: hook.runId, metadata: Promise.resolve(hook.metadata) };
  },
  resumeHook: resumed,
  getRun(runId: string) {
    const run = runs.get(runId)!;
    return {
      status: Promise.resolve(run.status),
      // The run's published subscribe outcome, as its stream delivers it.
      getReadable: () =>
        new ReadableStream({
          async pull(controller) {
            controller.enqueue(await run.outcome);
            controller.close();
          },
        }),
    };
  },
}));
vi.mock("#execution/workflow-runtime.js", () => ({
  connectionEventWorkflowReference: { workflowId: "watch" },
  connectionEventDeliveryWorkflowReference: { workflowId: "delivery" },
  startWorkflowOnCurrentDeployment: started,
}));

const {
  findConnectionEventOwner,
  retireConnectionEventOwner,
  startConnectionEventDelivery,
  startConnectionEventOwner,
} = await import("./owner.js");
const { connectionEventHookToken } = await import("./path.js");

const binding = {
  id: "binding-1",
  sessionId: "session-1",
  auth: null,
  connectionName: "issues",
} as EventBinding;
const token = connectionEventHookToken(binding.id);
const bundle = {
  compiledArtifactsSource: { kind: "disk", appRoot: "/virtual/events" },
} as CompiledBundle;
const payload = {
  kind: "connection-event",
  connectionName: "issues",
  bindingId: binding.id,
  delivery: { deliveryId: "delivery-1" },
} as ConnectionEventPayload;
const subscription = {
  id: "sub_1",
  name: "issue.created",
  arguments: {},
  status: "active" as const,
  expiresAt: null,
};
/** A watch run holding its hook; `status` is Workflow's run status. */
function holdWatch(status: string) {
  let publish!: (value: unknown) => void;
  const outcome = new Promise((resolve) => (publish = resolve));
  runs.set("watch-run", { status, outcome, publish });
  hooks.set(token, { runId: "watch-run", metadata: binding });
  return (value: ConnectionEventSubscribeOutcome) => publish(value);
}

beforeEach(() => {
  hooks.clear();
  runs.clear();
  started.mockClear();
  resumed.mockClear();
});

it("starts each delivery in its own run, under the binding its watch's hook carries", async () => {
  holdWatch("running");
  expect(await startConnectionEventDelivery(payload, bundle)).toBe(true);
  expect(started).toHaveBeenCalledExactlyOnceWith({ workflowId: "delivery" }, [
    { binding, payload, serializedContext: expect.any(Object) },
  ]);
  // The watch's own run takes nothing per delivery.
  expect(resumed).not.toHaveBeenCalled();
});

it.each([
  ["has ended", () => void holdWatch("completed")],
  ["is gone", () => {}],
])("refuses a delivery when its watch %s", async (_name, arrange) => {
  arrange();
  expect(await startConnectionEventDelivery(payload, bundle)).toBe(false);
  expect(started).not.toHaveBeenCalled();
});

it("retires only a live watch", async () => {
  holdWatch("completed");
  await retireConnectionEventOwner(binding.id);
  expect(resumed).not.toHaveBeenCalled();
  holdWatch("running");
  await retireConnectionEventOwner(binding.id);
  expect(resumed).toHaveBeenCalledExactlyOnceWith(token, { kind: "retire" });
});

it("keeps an ended watch's owner and subscription for get and stop", async () => {
  holdWatch("completed")({ subscription });
  expect(await findConnectionEventOwner(binding.id)).toEqual({ owner: binding, subscription });
});

it("reports a subscribe still in flight when the caller stops waiting, then its later result", async () => {
  const publish = holdWatch("running");
  const caller = new AbortController();
  const subscribing = startConnectionEventOwner(binding, bundle, caller.signal);
  caller.abort();
  expect(await subscribing).toBeUndefined();
  publish({ subscription });
  expect(await findConnectionEventOwner(binding.id)).toEqual({ owner: binding, subscription });
});
