import { publishSessionEvents, type SessionStepState } from "#execution/publish-session-events.js";
import { withSessionStateDelta } from "#execution/session/state-delta.js";
import { controlSettled, type ControlSettlement } from "#harness/facts.js";

/** Records a control that finishes without a step of its own. */
export async function settleControlDeliveryStep(
  input: SessionStepState & { readonly settlement: ControlSettlement },
) {
  "use step";
  return await withSessionStateDelta(input, (state) =>
    publishSessionEvents(state, controlSettled(input.settlement)),
  );
}
