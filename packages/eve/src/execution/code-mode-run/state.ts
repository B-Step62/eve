import type { HarnessSession, SessionStateMap } from "#harness/types.js";
import type { RuntimeToolResultActionResult } from "#shared/action-types.js";

const CODE_MODE_RUN_STATE_KEY = "eve.runtime.codeModeRun";

export interface CodeModeRunRecord {
  readonly callId: string;
  readonly hookToken: string;
  readonly runId: string;
}

export function getCodeModeRun(state: SessionStateMap | undefined): CodeModeRunRecord | undefined {
  const value = state?.[CODE_MODE_RUN_STATE_KEY];
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Partial<CodeModeRunRecord>;
  if (
    typeof record.callId !== "string" ||
    typeof record.hookToken !== "string" ||
    typeof record.runId !== "string"
  ) {
    return undefined;
  }
  return record as CodeModeRunRecord;
}

export function setCodeModeRun(session: HarnessSession, record: CodeModeRunRecord): HarnessSession {
  return { ...session, state: { ...session.state, [CODE_MODE_RUN_STATE_KEY]: record } };
}

export function clearCodeModeRun(session: HarnessSession): HarnessSession {
  if (getCodeModeRun(session.state) === undefined) return session;
  const state = { ...session.state };
  delete state[CODE_MODE_RUN_STATE_KEY];
  return { ...session, state: Object.keys(state).length > 0 ? state : undefined };
}

export function isCodeModeRunResult(
  state: SessionStateMap | undefined,
  result: RuntimeToolResultActionResult,
): boolean {
  const run = getCodeModeRun(state);
  return run?.callId === result.callId && result.toolName === "code_mode";
}
