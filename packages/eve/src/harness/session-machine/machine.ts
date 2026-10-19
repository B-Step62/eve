import type { SessionProjection } from "#protocol/session-projection.js";
import type { HarnessSession } from "#harness/types.js";
import { dropClosedRecords, saveTransition, sessionView, type Transition } from "./commit.js";
import { projectionAfter } from "./current.js";
import type { SessionView } from "./view.js";

// The session as the machine's rules read and change it. A rule is a pure function: it reads a
// machine and returns the changes it makes. `applyChange` is how a change applies, the same way
// whether a rule plans ahead (`Plan`) or a step publishes it (`Step.apply`), so what a rule
// decided after one change is what the step's session holds after publishing it.

/** What a step's rules change: the session's history and private state, and its projection. */
export interface Machine {
  readonly session: HarnessSession;
  readonly projection: SessionProjection;
}

/** One change a rule makes: a transition, which commits, or an edit to private state alone. */
export type Change = Transition | SessionEdit;

/** A change to state only the session reads, such as the runs it no longer waits on. */
export interface SessionEdit {
  readonly edit: (session: HarnessSession) => HarnessSession;
}

export function viewOf(machine: Machine): SessionView {
  return sessionView(machine.projection, machine.session.state);
}

/** The machine once `change` applies: its facts commit, and the records they close retire. */
export function applyChange(machine: Machine, change: Change): Machine {
  if ("edit" in change) return { ...machine, session: change.edit(machine.session) };
  const projection = projectionAfter(machine.projection, change.events);
  const session = dropClosedRecords(saveTransition(machine.session, change), projection);
  return { projection, session };
}

/**
 * Rules applied one after another, each reading what the last left: the machine they leave, and
 * the changes, in order, for a step to publish.
 */
export class Plan {
  #machine: Machine;
  readonly #changes: Change[] = [];

  constructor(machine: Machine) {
    this.#machine = machine;
  }

  get machine(): Machine {
    return this.#machine;
  }

  get changes(): readonly Change[] {
    return this.#changes;
  }

  view(): SessionView {
    return viewOf(this.#machine);
  }

  apply(change: Change): void {
    this.#machine = applyChange(this.#machine, change);
    this.#changes.push(change);
  }
}
