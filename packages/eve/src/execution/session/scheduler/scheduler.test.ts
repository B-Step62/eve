import { describe, expect, it } from "vitest";

import { on, type SchedulerEvent } from "#execution/session/scheduler/events.js";
import { next, type Next, type SessionReading } from "#execution/session/scheduler/next.js";
import { initialScheduler, type Scheduler } from "#execution/session/scheduler/state.js";

describe("a session between turns", () => {
  it("stops working tasks for a cancel, and settles that cancel as applied once they stop", () => {
    const parked = settle(initialScheduler({ kind: "parked" }), reading());

    const asked = performAll(
      on(parked.state, {
        arrivals: [{ kind: "cancel", origin: { deliveryId: "cancel-tasks" } }],
        kind: "arrived",
      }),
      reading({ workingTasks: true }),
    );

    expect(asked).toEqual([
      { kind: "cancel-tasks", reason: "turn-cancelled" },
      { control: { deliveryId: "cancel-tasks" }, kind: "settle-cancel", outcome: "applied" },
      { kind: "wait", timers: [] },
    ]);
  });

  it("hands off a lone message that arrived while nothing waited, but not one of a burst", () => {
    const parked = settle(initialScheduler({ kind: "parked" }), reading());
    const message: SchedulerEvent = {
      arrivals: [
        { delivery: { kind: "deliver", payloads: [{ message: "next turn" }] }, kind: "delivery" },
      ],
      kind: "arrived",
    };
    const taken = (session: SessionReading) => {
      const routing = next(on(parked.state, message), session);
      expect(routing.asks.kind).toBe("route");
      const routed = on(routing.state, {
        kind: "routed",
        routed: {
          delivery: { kind: "deliver", payloads: [{ message: "next turn" }] },
          kind: "remainder",
        },
      });
      return next(routed, session).asks;
    };

    expect(taken(reading())).toMatchObject({
      kind: "take-turn",
      selection: { handoffEligible: true },
    });
    expect(taken(reading({ inboxPending: true }))).toMatchObject({
      kind: "take-turn",
      selection: { handoffEligible: false },
    });
  });

  it("expires once the inbox closes", () => {
    const parked = settle(initialScheduler({ kind: "parked" }), reading());

    expect(next(on(parked.state, { kind: "closed" }), reading()).asks).toEqual({
      end: { kind: "expired" },
      kind: "end",
    });
  });
});

/** What the session reads of a durable session with nothing open, unless `changes` says otherwise. */
function reading(
  changes: Partial<Record<"inboxPending" | "workingTasks", boolean>> = {},
): SessionReading {
  return {
    budgetOpen: () => false,
    canAskPeople: () => true,
    contextPrincipal: () => "anonymous",
    earlierRemoteCaller: () => undefined,
    inboxPending: () => changes.inboxPending === true,
    now: () => 0,
    onStream: () => true,
    openTurnId: () => undefined,
    recordedRun: () => true,
    taskWait: () => undefined,
    turnId: () => "turn_1",
    workingTasks: () => changes.workingTasks === true,
  };
}

/** Runs the scheduler until it waits on the inbox. */
function settle(
  state: Scheduler,
  session: SessionReading,
): { readonly state: Scheduler; readonly asked: Next[] } {
  const asked: Next[] = [];
  let current = state;
  for (;;) {
    const decision = next(current, session);
    asked.push(decision.asks);
    current = decision.state;
    if (decision.asks.kind === "wait") return { asked, state: current };
  }
}

function performAll(state: Scheduler, session: SessionReading): Next[] {
  return settle(state, session).asked;
}
