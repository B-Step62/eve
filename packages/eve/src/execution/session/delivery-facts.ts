import type {
  DeliverHookPayload,
  DeliverPayload,
  SessionAuthContext,
  SessionParent,
} from "#channel/types.js";
import type { ConsumedDelivery } from "#harness/session-machine/transitions.js";
import type {
  ControlDelivery,
  HarnessStepInput,
  SessionStateMap,
  StepInput,
} from "#harness/types.js";
import type { SessionView } from "#protocol/session-projection/tables.js";
import { coalesceTurnInputs } from "#harness/messages.js";
import { attributeAnswers } from "#execution/session/answer-caller.js";
import { controlAdmitted, defined, fact } from "#harness/facts.js";
import { userPartsOf } from "#harness/user-parts.js";
import { readClientContext } from "#internal/client-context.js";
import type { SessionEvent } from "#protocol/session-event.js";
import type { Principal } from "#protocol/session-events/envelope.js";
import type { DeliverySource } from "#protocol/session-events/families/delivery.js";

// A delivery's facts at the step that admits it: every payload is admitted, a payload the
// channel's `deliver` hook ignored settles `ignored` at once, and the rest go on to the turn,
// which consumes them. Deliveries are admitted at step boundaries, since only steps write: by the
// step that takes them, or, for one the session holds while it waits, before it waits
// (`admitHeldDeliveriesStep`).

/**
 * What one step admits: the facts it writes first, and each consumed payload's input, carrying
 * its delivery and each answer bound to the response it submits.
 */
export interface DeliveryAdmission {
  readonly facts: readonly SessionEvent[];
  readonly inputs: readonly HarnessStepInput[];
}

export function admitDeliveries(
  input: DeliverySourceInput & {
    /** The payloads left once sign-in callbacks were matched out, with what `deliver` made of each. */
    readonly payloads: readonly {
      readonly payload: DeliverPayload;
      readonly input: StepInput | undefined;
    }[];
    /** Whether the session already admitted a delivery: before it waited, or as it forwarded part. */
    readonly admitted?: (deliveryId: string) => boolean;
  },
): DeliveryAdmission {
  const facts: SessionEvent[] = [];
  const inputs: HarnessStepInput[] = [];
  for (const { input: stepInput, payload } of input.payloads) {
    const { deliveryId, fact: admitted } = admissionOf({ ...input, payload });
    if (input.admitted?.(deliveryId) !== true) facts.push(admitted);
    if (stepInput === undefined) {
      facts.push(fact("delivery.settled", { deliveryId, outcome: "ignored" }));
      continue;
    }
    const consumed: ConsumedDelivery = {
      deliveryId,
      parts: stepInput.message === undefined ? [] : userPartsOf(stepInput.message),
    };
    const { answers, ...rest } = stepInput;
    inputs.push(
      answers === undefined || answers.length === 0
        ? { ...rest, deliveries: [consumed] }
        : {
            ...rest,
            answers: answers.map((answer, index) => ({
              ...answer,
              deliveryId,
              responseId: `response_${deliveryId}_${String(index)}`,
            })),
            deliveries: [consumed],
          },
    );
  }
  return { facts, inputs };
}

/** What a step takes of the delivery it runs with. */
export interface TakenDelivery {
  readonly admission: DeliveryAdmission;
  /** The step's input: what the channel made of each payload, with each answer attributed. */
  readonly input: HarnessStepInput | undefined;
  /**
   * Who the step acts as: the delivery's sender, or whoever it acted as before, when the
   * delivery only answers the session's own requests (`attributed`), or its channel ignored it
   * while a turn runs (`ignored`), which mustn't change who the turn acts for.
   */
  readonly acts: "as-sender" | "as-before";
  readonly attributed: boolean;
  readonly ignored: boolean;
}

/**
 * A step takes its delivery: every payload is admitted (`admitDeliveries`), and a delivery that
 * only answers the session's own requests has each answer attributed to its sender
 * (`attributeAnswers`), so the step goes on acting for the turn. A delivery without auth acts as
 * the session's current identity, so only one that names its sender can answer as someone else.
 */
export function takeDelivery(
  input: DeliverySourceInput & {
    readonly payloads: readonly {
      readonly payload: DeliverPayload;
      readonly input: StepInput | undefined;
    }[];
    readonly admitted?: (deliveryId: string) => boolean;
    /** Who sent the delivery the step runs with, as its own auth names them. */
    readonly sender: SessionAuthContext | null | undefined;
    readonly state: SessionStateMap | undefined;
    /** No turn is open: a delivery opens one, and none runs to protect. */
    readonly betweenTurns: boolean;
  },
): TakenDelivery {
  const admission = admitDeliveries(input);
  const coalesced =
    admission.inputs.length === 0 ? undefined : admission.inputs.reduce(coalesceTurnInputs);
  const answers =
    input.sender === undefined
      ? undefined
      : attributeAnswers({ responder: input.sender, state: input.state, stepInput: coalesced });
  const stepInput = answers ?? coalesced;
  const ignored = stepInput === undefined && !input.betweenTurns;
  return {
    acts: answers !== undefined || ignored ? "as-before" : "as-sender",
    admission,
    attributed: answers !== undefined,
    ignored,
    input: stepInput,
  };
}

/**
 * What the session holds that its stream doesn't show yet: the admission of each delivery and
 * control it holds and hasn't admitted. What later takes one admits it again, which the writer
 * drops (`cascade`).
 */
export function heldAdmissions(
  view: SessionView,
  held: {
    readonly deliveries: readonly DeliverHookPayload[];
    readonly controls: readonly { readonly control: string; readonly delivery: ControlDelivery }[];
  },
  source: Omit<DeliverySourceInput, "delivery">,
): SessionEvent[] {
  return [
    ...held.deliveries.flatMap((delivery) =>
      delivery.payloads.map((payload) => admissionOf({ ...source, delivery, payload }).fact),
    ),
    ...held.controls.map(({ control, delivery }) => controlAdmitted(delivery, control)),
  ].filter(
    (fact) =>
      fact.type !== "delivery.admitted" || view.deliveries[fact.data.deliveryId] === undefined,
  );
}

/** Where a delivery came from, and the payload's `delivery.admitted`. */
export interface DeliverySourceInput {
  readonly delivery: DeliverHookPayload;
  readonly channelKind: string;
  readonly parent?: SessionParent;
  readonly sessionStarted: boolean;
}

/** One payload's delivery id, and the fact that admits it. */
export function admissionOf(input: DeliverySourceInput & { readonly payload: DeliverPayload }): {
  readonly deliveryId: string;
  readonly fact: SessionEvent;
} {
  const { delivery, payload } = input;
  const index = delivery.payloads.indexOf(payload);
  const metadata = delivery.deliveryMetadata?.find((entry) => entry.payloadIndex === index);
  if (metadata === undefined)
    throw new Error(
      "Session delivery has no identity. Assign delivery metadata at dispatch before admission.",
    );
  const servedCall =
    delivery.payloadCallers === undefined
      ? (delivery.caller?.servedCallId ?? delivery.caller?.callId)
      : (delivery.payloadCallers[index] ?? undefined);
  const callId = servedCall ?? (input.sessionStarted ? undefined : input.parent?.callId);
  const source: DeliverySource = defined({
    channel: metadata.channelKind ?? input.channelKind,
    scheduleId: delivery.schedule?.definition,
    caller:
      input.parent === undefined || callId === undefined
        ? undefined
        : { sessionId: input.parent.sessionId, callId },
  });
  const clientContext = readClientContext(payload);
  return {
    deliveryId: metadata.deliveryId,
    fact: fact("delivery.admitted", {
      clientContext:
        clientContext !== undefined && clientContext.length > 0 ? [...clientContext] : undefined,
      deliveryId: metadata.deliveryId,
      principal: principalOf(delivery.auth),
      source,
    }),
  };
}

/** Who sent a delivery, as the wire names them. */
export function principalOf(auth: SessionAuthContext | null | undefined): Principal | undefined {
  if (auth === undefined || auth === null) return undefined;
  return defined({ id: auth.principalId, issuer: auth.issuer, type: auth.principalType });
}
