import type { DeliverHookPayload, TurnCaller } from "#channel/types.js";
import { decideBetweenTurns, handOff } from "#execution/session/scheduler/between-turns.js";
import {
  unrouted,
  type SessionControl,
  type TurnSelection,
} from "#execution/session/scheduler/held.js";
import {
  inTurn,
  turnOf,
  type Scheduler,
  type SessionEnd,
  type Due,
  type Turn,
} from "#execution/session/scheduler/state.js";
import { decideInTurn, startTurn } from "#execution/session/scheduler/turn.js";
import type { TurnStepPayload } from "#execution/session/turn-step-types.js";
import type { TaskToolCall, TaskWaitResult } from "#execution/tasks/calls.js";
import type { AppliedRunMessage } from "#execution/tools/workflow/apply-run-messages-step.js";
import type { WorkflowToolRunMessage } from "#execution/tools/workflow/messages.js";
import type { ControlDelivery } from "#harness/types.js";
import type { RuntimeActionResult } from "#shared/action-types.js";

// The session's scheduler, which decides what a session does next. Everything in it is pure.
//
//              ┌──────────────── on(state, event) ◀────────────────┐
//              ▼                                                   │
//   Scheduler ── next(state, session) ──▶ { state, asks } ── the loop performs `asks`
//
// `on` (`events.ts`) takes what happened: something arrived, or something the scheduler asked
// for came back. `next` decides what the session does, until it asks for something only the
// world can finish: run a step, route a delivery to a child, wait on the inbox. Its decisions move
// the state themselves, so the session loop (`session-loop.ts`) only performs them.
//
// A session runs turns, one at a time. Between turns (`between-turns.ts`), it takes the next
// thing it holds (`held.ts`): a control, or deliveries, which start a turn. A turn (`turn.ts`)
// runs steps; after each, it goes on, waits (`waits.ts`) on a person, on calls, or on tasks, or
// ends. What arrives meanwhile may answer the turn (`answers.ts`), steer it, or wait for the turn
// to end. A cancel stops the turn. `internal/testing/scheduler-checker.ts` checks what holds of
// it.

/** What the scheduler reads of the session's durable state, which only steps change. */
export interface SessionReading {
  /** Whether the stream shows the delivery. */
  onStream(deliveryId: string): boolean;
  /** The turn the stream has open, or the id the next turn takes. */
  turnId(): string;
  /** The turn the stream has open, if one is. */
  openTurnId(): string | undefined;
  /** The principal the session acts as between deliveries. */
  contextPrincipal(): string;
  /** A budget prompt holds the turn open. */
  budgetOpen(): boolean;
  workingTasks(): boolean;
  /** What an `eve__task_wait` call returns now, if it returns. */
  taskWait(wake: {
    readonly interrupted: boolean;
    readonly timedOut: boolean;
  }): TaskWaitResult | undefined;
  /** Whether a result that came through the inbox comes from a run the turn recorded. */
  recordedRun(result: RuntimeActionResult): boolean;
  /** The protocol of a remote caller this session can't relay a person's input to, if it has one. */
  earlierRemoteCaller(): number | undefined;
  /** Someone can answer the session: its channel asks people, or a delegating parent relays. */
  canAskPeople(): boolean;
  /** Something waits in the inbox, unread. */
  inboxPending(): boolean;
  now(): number;
}

/** What the scheduler asks of the world: everything here only the world can finish. */
export type Next =
  | Due
  /** A turn begins, and its signals start. `control`: the turn runs a control. */
  | {
      readonly kind: "turn-started";
      readonly turn: Pick<Turn, "steerer" | "turnId">;
      readonly control: boolean;
    }
  /** Runs a step of the turn (`stepped`). Only the turn's first step binds its `caller`. */
  | { readonly kind: "step"; readonly input?: TurnStepPayload; readonly caller?: TurnCaller }
  /** Routes a delivery's answers to the children that asked (`routed`). */
  | { readonly kind: "route"; readonly delivery: DeliverHookPayload }
  /** Maps a delivery's channel-specific answers onto `requestIds` (`mapped`). */
  | {
      readonly kind: "map-answers";
      readonly delivery: DeliverHookPayload;
      readonly requestIds: readonly string[];
    }
  /** Handles a question, a withdrawal, or an outcome from a run (`handled`). */
  | {
      readonly kind: "handle-run-message";
      readonly message: Exclude<WorkflowToolRunMessage, AppliedRunMessage>;
    }
  /** Starts the runs of the calls the turn waits on (`dispatched`). */
  | { readonly kind: "dispatch" }
  /** Answers task tool calls, and starts the timers of the waits among them (`task-calls-started`). */
  | { readonly kind: "start-task-calls"; readonly calls: readonly TaskToolCall[] }
  /** Stops the runs of calls that haven't reported: someone steered the turn. */
  | { readonly kind: "interrupt-runs"; readonly callIds: readonly string[] }
  /** Puts what the session holds on the stream, before it waits. */
  | {
      readonly kind: "admit-held";
      readonly deliveries: readonly DeliverHookPayload[];
      readonly controls: readonly {
        readonly control: SessionControl;
        readonly delivery: ControlDelivery;
      }[];
    }
  /**
   * Waits for what arrives (`arrived`), for the inbox to close (`closed`), or for one of the turn's
   * task waits' `timers` (`timed-out`).
   */
  | { readonly kind: "wait"; readonly timers: readonly string[] }
  /**
   * Starts the turn `selection` takes, unless the session moves to the deployment that accepted
   * it (`transfer`).
   */
  | {
      readonly kind: "take-turn";
      readonly selection: TurnSelection;
      readonly compactionDue: boolean;
    }
  /** Moves the session, which compacted, to a fresh run (`transfer`). */
  | { readonly kind: "hand-off" }
  | { readonly kind: "end"; readonly end: SessionEnd };

/**
 * Each delivery the session holds goes to the children whose questions it answers first, once,
 * in arrival order, whenever the session decides in a turn or idly between turns; the session
 * holds what's left. Whatever then takes it takes only what's the session's own.
 */
function route(state: Scheduler): Made | undefined {
  const { phase } = state;
  const deciding =
    phase.kind === "turn" || (phase.kind === "between-turns" && phase.pending === undefined);
  if (!deciding) return undefined;
  const delivery = unrouted(state.held);
  if (delivery === undefined) return undefined;
  return {
    state: {
      ...state,
      held: { ...state.held, routed: delivery.sequence + 1 },
      routing: delivery.sequence,
    },
    asks: { delivery: delivery.delivery, kind: "route" },
  };
}

export interface Decision {
  readonly state: Scheduler;
  readonly asks: Next;
  /** The turn looked for what steers it: its steering signal starts fresh, for what's unread. */
  readonly rearm: boolean;
}

/** A decision, which may or may not ask the world for something yet. */
export interface Made {
  readonly state: Scheduler;
  readonly asks?: Next;
}

/** What the scheduler does next: it decides until it asks for something only the world can finish. */
export function next(state: Scheduler, session: SessionReading): Decision {
  let current = state;
  for (let decided = 0; decided < 100; decided += 1) {
    const made = decide(current, session);
    current = made.state;
    if (made.asks === undefined) continue;
    const turn = turnOf(current);
    if (turn === undefined || !turn.rearm) return { rearm: false, state: current, asks: made.asks };
    return { rearm: true, state: inTurn(current, { ...turn, rearm: false }), asks: made.asks };
  }
  throw new Error("The scheduler decides without end.");
}

function decide(state: Scheduler, session: SessionReading): Made {
  const [due, ...rest] = state.due;
  if (due !== undefined) return { state: { ...state, due: rest }, asks: due };
  const routes = route(state);
  if (routes !== undefined) return routes;
  const { phase } = state;
  switch (phase.kind) {
    case "starting":
      return startTurn(state, phase.input, session);
    case "turn":
      return decideInTurn(state, phase.turn, session);
    case "handing-off":
      return handOff(state, phase, session);
    case "between-turns":
      return decideBetweenTurns(state, phase, session);
    case "ended":
      return { state, asks: { end: phase.end, kind: "end" } };
  }
}
