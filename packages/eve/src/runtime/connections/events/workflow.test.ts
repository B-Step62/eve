import { beforeEach, expect, it, vi } from "vitest";

import type { ConnectionEventHandlerState, EventBinding } from "./state.js";

/**
 * A deterministic stand-in for Workflow's hooks: one owner per token, and a
 * forced claim fails the previous owner once it has drained what it received.
 */
const world = vi.hoisted(() => {
  class FakeHook<T> {
    readonly queue: T[] = [];
    waiter: (() => void) | undefined;
    takenOver = false;
    readonly token: string;
    private readonly owners: Map<string, FakeHook<unknown>>;
    constructor(token: string, owners: Map<string, FakeHook<unknown>>) {
      this.token = token;
      this.owners = owners;
    }
    push(value: T) {
      this.queue.push(value);
      this.wake();
    }
    takeOver() {
      this.takenOver = true;
      this.wake();
    }
    private wake() {
      const waiter = this.waiter;
      this.waiter = undefined;
      waiter?.();
    }
    async next(): Promise<IteratorResult<T>> {
      for (;;) {
        if (this.queue.length > 0) return { done: false, value: this.queue.shift()! };
        if (this.takenOver) throw { name: "HookForceClaimedError", token: this.token };
        await new Promise<void>((resolve) => (this.waiter = resolve));
      }
    }
    [Symbol.asyncIterator]() {
      return { next: () => this.next() };
    }
    // oxlint-disable-next-line unicorn/no-thenable -- Workflow hooks are awaited for their first payload.
    then<R>(resolve: (value: T) => R, reject: (error: unknown) => R) {
      return this.next().then((result) => resolve(result.value), reject);
    }
    async getConflict() {
      return null;
    }
    async dispose() {
      if (this.owners.get(this.token) === this) this.owners.delete(this.token);
    }
  }
  const owners = new Map<string, FakeHook<unknown>>();
  return {
    owners,
    createHook(options: { token: string; experimental_force?: boolean }) {
      const previous = owners.get(options.token);
      if (previous !== undefined && !options.experimental_force)
        throw new Error(`test world: ${options.token} is already held`);
      const hook = new FakeHook<unknown>(options.token, owners);
      owners.set(options.token, hook);
      previous?.takeOver();
      return hook;
    },
    resume(token: string, value: unknown) {
      const hook = owners.get(token);
      if (hook === undefined) throw new Error(`test world: no hook for ${token}`);
      hook.push(value);
    },
    /** What each delivery saw when its run prepared it. */
    seen: [] as { id: string; count: number; receipts: number }[],
    successors: [] as (() => Promise<void>)[],
  };
});

vi.mock("#compiled/@workflow/core/index.js", () => ({ createHook: world.createHook }));
vi.mock("#runtime/connections/events/dispatch-step.js", () => ({
  // The callback state: how many deliveries this watch's handler has run.
  async prepareConnectionEventStep(input: {
    serializedContext: { count?: number };
    state: ConnectionEventHandlerState;
    payload: { delivery: { id: string } };
  }) {
    const id = input.payload.delivery.id;
    world.seen.push({
      id,
      count: input.serializedContext.count ?? 0,
      receipts: Object.keys(input.state.receipts).length,
    });
    return {
      accepted: true,
      serializedContext: input.serializedContext,
      state: { ...input.state, receipts: { ...input.state.receipts, [id]: "pending" } },
    };
  },
  async dispatchConnectionEventStep(input: {
    serializedContext: { count?: number };
    state: ConnectionEventHandlerState;
    payload: { delivery: { id: string } };
  }) {
    return {
      serializedContext: { count: (input.serializedContext.count ?? 0) + 1 },
      state: {
        ...input.state,
        receipts: { ...input.state.receipts, [input.payload.delivery.id]: "complete" },
      },
    };
  },
}));
vi.mock("#runtime/connections/events/lifecycle-step.js", async () => {
  const { connectionEventHandoverToken } = await import("./path.js");
  return {
    async openConnectionEventStep() {
      return { subscription: { id: "sub_1", name: "issue.created", status: "active" } };
    },
    // The test decides when the successor starts, to place deliveries before its takeover.
    async startConnectionEventSuccessorStep(input: { binding: EventBinding }) {
      world.successors.push(async () =>
        (await import("./workflow.js")).connectionEventWorkflow(
          input as Parameters<typeof import("./workflow.js").connectionEventWorkflow>[0],
        ),
      );
    },
    async passConnectionEventHandoverStep(input: {
      bindingId: string;
      generation: number;
      handover: unknown;
    }) {
      world.resume(connectionEventHandoverToken(input.bindingId, input.generation), input.handover);
    },
  };
});

const { CONNECTION_EVENT_HANDOVER_DELIVERIES, connectionEventWorkflow } =
  await import("./workflow.js");
const { connectionEventHookToken } = await import("./path.js");

const binding = { id: "binding-1" } as EventBinding;
const token = connectionEventHookToken(binding.id);
const deliver = (id: number) =>
  world.resume(token, { kind: "connection-event", delivery: { id: `delivery-${id}` } });
const seenThrough = (id: number) =>
  vi.waitFor(() => expect(world.seen.at(-1)?.id).toBe(`delivery-${id}`));

beforeEach(() => {
  world.owners.clear();
  world.seen.length = 0;
  world.successors.length = 0;
});

it("hands the successor the state and receipts of every delivery its predecessor processed", async () => {
  const first = connectionEventWorkflow({ binding, serializedContext: {} });
  await vi.waitFor(() => expect(world.owners.has(token)).toBe(true));
  for (let id = 1; id <= CONNECTION_EVENT_HANDOVER_DELIVERIES; id++) deliver(id);
  await vi.waitFor(() => expect(world.successors).toHaveLength(1));
  // Reaches the predecessor after it asked for a successor, before the takeover.
  const late = CONNECTION_EVENT_HANDOVER_DELIVERIES + 1;
  deliver(late);
  await seenThrough(late);
  const successor = world.successors[0]!();
  await first;
  deliver(late + 1);
  await seenThrough(late + 1);
  expect(world.seen.at(-1)).toEqual({ id: `delivery-${late + 1}`, count: late, receipts: late });
  // Each delivery ran once, in order, across both runs.
  expect(world.seen.map(({ id }) => id)).toEqual(
    Array.from({ length: late + 1 }, (_, index) => `delivery-${index + 1}`),
  );
  world.resume(token, { kind: "retire" });
  await successor;
  expect(world.owners.size).toBe(0);
});

it("ends the successor too when the watch stopped before the takeover", async () => {
  const first = connectionEventWorkflow({ binding, serializedContext: {} });
  await vi.waitFor(() => expect(world.owners.has(token)).toBe(true));
  for (let id = 1; id <= CONNECTION_EVENT_HANDOVER_DELIVERIES; id++) deliver(id);
  await vi.waitFor(() => expect(world.successors).toHaveLength(1));
  world.resume(token, { kind: "retire" });
  const successor = world.successors[0]!();
  await Promise.all([first, successor]);
  expect(world.owners.size).toBe(0);
});
