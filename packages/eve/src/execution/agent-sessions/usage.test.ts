import { describe, expect, it } from "vitest";

import { countRunUsage, createRunUsageTally } from "#execution/agent-sessions/usage.js";
import { getSessionUsageWindow, resetSessionUsageWindow } from "#harness/turn-tag-state.js";
import type { TokenUsage } from "#shared/token-usage.js";

function input(inputTokens: number): TokenUsage {
  return { cacheReadTokens: 0, cacheWriteTokens: 0, inputTokens, outputTokens: 0 };
}

describe("run usage tally", () => {
  it("counts what a run hadn't carried when a renewal reached it as before the new window", () => {
    const tally = createRunUsageTally();
    // A child's first turn, not yet carried to the parent when the approval renews the tree.
    tally.record(input(30_000_000));
    tally.renew();
    // The child's next turn: 16M, 15M of it spent before the child's own window.
    tally.record(input(16_000_000), input(15_000_000));
    const carried = tally.carry();

    expect(carried).toEqual({ beforeWindow: input(45_000_000), usage: input(46_000_000) });
    const parent = countRunUsage(resetSessionUsageWindow({ state: {} }), carried!);
    expect(getSessionUsageWindow(parent).inputTokens).toBe(1_000_000);
  });

  it("keeps what the run carried before the renewal in the window the caller counted it in", () => {
    const tally = createRunUsageTally();
    tally.record(input(10));
    const first = tally.carry();
    tally.record(input(5));
    tally.renew();
    tally.record(input(2));

    expect(tally.hasUncarried()).toBe(true);
    expect(tally.carry()).toEqual({ beforeWindow: input(5), usage: input(17) });
    expect(first).toEqual({ usage: input(10) });
    expect(tally.hasUncarried()).toBe(false);
  });
});
