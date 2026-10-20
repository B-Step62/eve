import {
  readDurableSession,
  replaceDurableSessionSnapshot,
} from "#execution/durable-session-store.js";
import type { SessionStepState } from "#execution/publish-session-events.js";
import { renewDescendantWindows } from "#execution/renew-descendant-windows.js";
import {
  withSessionStateDelta,
  type SessionStateTransition,
} from "#execution/session/state-delta.js";
import { renewSessionUsageWindow } from "#harness/turn-tag-state.js";

/** Applies a renewal a parent sent down: a new window here, then in this session's own runs. */
export async function renewSessionUsageWindowStep(
  input: SessionStepState & { readonly renewalId: string },
): Promise<SessionStateTransition> {
  "use step";
  return await withSessionStateDelta(input, async () => {
    const renewed = renewSessionUsageWindow(
      readDurableSession(input.sessionState),
      input.renewalId,
    );
    if (!renewed.renewed) return {};
    await renewDescendantWindows(renewed.session, input.renewalId);
    return {
      sessionState: replaceDurableSessionSnapshot({
        session: renewed.session,
        state: input.sessionState,
      }),
    };
  });
}
