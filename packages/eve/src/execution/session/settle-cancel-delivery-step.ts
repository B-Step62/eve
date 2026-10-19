import { publishSessionEvents, type SessionStepState } from "#execution/publish-session-events.js";
import { withSessionStateDelta } from "#execution/session/state-delta.js";
import { controlAdmitted } from "#harness/facts.js";
import type { ControlDelivery } from "#harness/types.js";
import type { SessionEvent } from "#protocol/session-event.js";

/** Records controls that finish without cancelling a turn, at an owner's committed boundary. */
export async function settleCancelDeliveryStep(
  input: SessionStepState & {
    readonly control: ControlDelivery;
    readonly outcome: "ignored" | "applied";
  },
) {
  "use step";
  return await withSessionStateDelta(input, (state) =>
    publishSessionEvents(state, cancelSettled(input.control, input.outcome)),
  );
}

/** A cancel that stopped no turn, admitted and settled in one commit. */
export function cancelSettled(
  control: ControlDelivery,
  outcome: "ignored" | "applied",
): SessionEvent[] {
  return [
    controlAdmitted(control, "cancel"),
    { data: { deliveryId: control.deliveryId, outcome }, type: "delivery.settled" },
  ];
}
