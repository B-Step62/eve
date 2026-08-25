import { describe, expect, it } from "vitest";

import {
  clearCodeModeRun,
  getCodeModeRun,
  isCodeModeRunResult,
  setCodeModeRun,
} from "#execution/code-mode-run/state.js";
import type { HarnessSession } from "#harness/types.js";

const session = { sessionId: "parent", state: {} } as HarnessSession;
const record = { callId: "call-1", hookToken: "hook-1", runId: "run-1" };

describe("code mode run state", () => {
  it("records, validates, and clears the owned run", () => {
    const stored = setCodeModeRun(session, record);
    expect(getCodeModeRun(stored.state)).toEqual(record);
    expect(
      isCodeModeRunResult(stored.state, {
        callId: "call-1",
        kind: "tool-result",
        output: { ok: true },
        toolName: "code_mode",
      }),
    ).toBe(true);
    expect(
      isCodeModeRunResult(stored.state, {
        callId: "call-2",
        kind: "tool-result",
        output: { ok: true },
        toolName: "code_mode",
      }),
    ).toBe(false);
    expect(getCodeModeRun(clearCodeModeRun(stored).state)).toBeUndefined();
  });
});
