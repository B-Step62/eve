import {
  accumulateSessionUsage,
  addUsageBeforeWindow,
  getTurnUsageState,
  setTurnUsageState,
  toUsage,
  type TokenUsageDelta,
  type TurnUsageState,
} from "#harness/turn-tag-state.js";
import type { SessionStateMap } from "#harness/types.js";
import type { TokenUsage } from "#shared/token-usage.js";

// A delegated agent's spend counts against the session that delegated to it.
// A run tallies what its `ctx.agent` sessions spend, and its replies and
// outcome carry the running total to its calling session, which counts it in
// the step that applies them. A `serve` run sends the total on its own only for
// a turn no reply will carry. A run's messages reach the session in the order
// it sent them, so each total is at least the last one counted. A child's
// usage already includes what its own children spent, so a chain of agents
// adds up at every level. A turn's usage can carry the part spent before the
// child's current usage window; the run tallies it apart, and the calling
// session keeps it out of its own window.

/** What a run's `ctx.agent` sessions have spent, turn by turn. */
export interface RunUsageTally {
  /** Adds one ended turn's usage, and the part of it spent before the child's window. */
  record(turnUsage: TokenUsage, beforeWindow?: TokenUsage): void;
  /** The running total, or `undefined` before any turn ended. */
  total(): TokenUsage | undefined;
  /** The running total spent before the children's windows, or `undefined` while there is none. */
  beforeWindow(): TokenUsage | undefined;
}

/** `onRecord` runs after each recorded turn, so the run can send a total no reply will carry. */
export function createRunUsageTally(onRecord?: () => void): RunUsageTally {
  let spent: TurnUsageState | undefined;
  let spentBeforeWindow: TurnUsageState | undefined;
  return {
    record(turnUsage, beforeWindow) {
      spent = accumulateSessionUsage({ previous: spent, usage: turnUsage });
      if (beforeWindow !== undefined) {
        spentBeforeWindow = accumulateSessionUsage({
          previous: spentBeforeWindow,
          usage: beforeWindow,
        });
      }
      onRecord?.();
    },
    total() {
      return spent === undefined ? undefined : toUsage(spent.session);
    },
    beforeWindow() {
      return spentBeforeWindow === undefined ? undefined : toUsage(spentBeforeWindow.session);
    },
  };
}

/** A run's running totals: all it spent, and the part spent before its children's windows. */
export interface RunUsage {
  readonly beforeWindow?: TokenUsage;
  readonly usage: TokenUsage;
}

/**
 * Adds a run's delegated spend to the session's totals: its running totals,
 * less the part `counted` earlier. Spend from before the children's windows
 * moves this session's window start too, so it stays out of the window.
 */
export function countRunUsage<T extends { readonly state?: SessionStateMap }>(
  session: T,
  run: RunUsage,
  counted?: RunUsage,
): T {
  const totals = setTurnUsageState(
    session,
    accumulateSessionUsage({
      previous: getTurnUsageState(session.state),
      usage: usageSince(run.usage, counted?.usage),
    }),
  );
  if (run.beforeWindow === undefined) return totals;
  return addUsageBeforeWindow(totals, usageSince(run.beforeWindow, counted?.beforeWindow));
}

function usageSince(total: TokenUsage, counted: TokenUsage | undefined): TokenUsageDelta {
  if (counted === undefined) return total;
  return {
    cacheReadTokens: total.cacheReadTokens - counted.cacheReadTokens,
    cacheWriteTokens: total.cacheWriteTokens - counted.cacheWriteTokens,
    costUsd: total.costUsd === undefined ? undefined : total.costUsd - (counted.costUsd ?? 0),
    inputTokens: total.inputTokens - counted.inputTokens,
    outputTokens: total.outputTokens - counted.outputTokens,
  };
}
