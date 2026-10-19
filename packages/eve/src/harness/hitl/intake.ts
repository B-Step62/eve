import { callRun, runTurn } from "#protocol/session-projection/selectors.js";
import { buildStepCatalog } from "#execution/catalog/step-catalog.js";
import { SEARCH_TOOL_NAME } from "#protocol/catalog-tools.js";
import { collectWorkflowCalls } from "#harness/coordination.js";
import { resolveInlineAuthorizationInterrupt } from "#harness/inline-tool-authorization.js";
import { completeSignIn, settle } from "#harness/session-machine/transitions.js";
import type { SuspendedStep } from "#harness/session-machine/view.js";
import type { Step } from "#harness/step/context.js";
import { SessionLimitDeclinedError, throwIfTurnAborted } from "#harness/turn-cancellation.js";
import { bumpSessionRuntimeUsageLimits } from "#harness/session-usage.js";
import type { HarnessToolLookup, HarnessStepInput, StepResult } from "#harness/types.js";
import type { RuntimeWorkflowTaskRequest } from "#shared/action-types.js";
import {
  admitAnswers,
  type ApprovedCall,
  dispatch,
  grantedApprovals,
  openLimit,
  queueInput,
  refusedDeliveries,
  requireSignIn,
  settleApprovals,
  settleLimit,
  stepForRequest,
  withdrawSignIns,
  withdrawUnavailable,
} from "./approvals.js";
import { rejectApprovedCall, runApprovedCalls, type ApprovedCallResult } from "./approved-calls.js";
import {
  checkResponders,
  currentAnswering,
  weighResponders,
  type Answering,
  type WeighedResponders,
} from "./responders.js";
import type { Plan } from "#harness/session-machine/machine.js";
import { blocked } from "#harness/step/park.js";
import {
  compactInput,
  deliver,
  resolveTextInput,
  resolveTypedApproval,
  type ResolvedStepInput,
  turnInputOnly,
  withoutResponses,
  withoutTurnInput,
} from "./delivery.js";
import { recheckApprovedCall } from "#harness/tools.js";

/** What the world says about a delivery's answers before the step takes them. */
export interface AnswersGiven {
  readonly input: HarnessStepInput | undefined;
  /** The step takes the input its turn queued, which waits while runtime results arrive. */
  readonly takeQueued: boolean;
  /** What the response policies concluded about the answers they weighed (`weighAnswers`). */
  readonly weighed: WeighedResponders;
  /** The approvals whose tool went away and whose step can search for another. */
  readonly searchable: ReadonlySet<string>;
  readonly answering: Answering;
}

/**
 * What the step takes once the delivery's answers are in: `stop` ends the step, as when the
 * answers wait for a response policy, a responder must sign in, or the turn holds the input
 * behind what it waits on. `take` carries the turn's input, without the answers, and what the
 * answers decided.
 */
export type TakenAnswers =
  | { readonly kind: "stop" }
  | {
      readonly kind: "take";
      readonly input: HarnessStepInput | undefined;
      /** The message the turn receives, as the stream shows it. */
      readonly message?: HarnessStepInput["message"];
      /** A plain-text answer consumed the message, so the model never reads it. */
      readonly consumedMessage: boolean;
      /** The delivery carries input for a turn. */
      readonly opensTurn: boolean;
      readonly decided: HumanDecisions;
    };

/**
 * Takes a delivery's answers and messages into the session, a pure rule of the machine. A
 * policy's verdict stands or settles the answer it weighed; a stale answer becomes text, a typed
 * one the answer it stands for, and each answer stands once its responder may give it. Standing
 * answers then decide what they answer: the budget prompt, and each step's approvals once all
 * have one, or when the turn's own person steers past them with a message.
 *
 * Input the turn can't take yet waits in its queue, unreceived: input that follows the approved
 * calls, whose results the model reads first, and input that arrived while the turn waits on
 * what it asked.
 */
export function takeAnswers(plan: Plan, given: AnswersGiven): TakenAnswers {
  const { weighed } = given;
  plan.apply(weighed);
  if (weighed.unavailable.length > 0) {
    plan.apply(
      withdrawUnavailable(plan.view(), {
        interactionIds: weighed.unavailable,
        searchable: (request) => given.searchable.has(request.interactionId),
      }),
    );
  }
  if (weighed.challenges.length > 0) {
    // A message waits behind the sign-in; mid-turn, only the turn's own person's messages reach
    // the step, so it steers once the turn takes it.
    plan.apply(
      requireSignIn(plan.view(), {
        challenges: weighed.challenges,
        queued: given.input,
        steers: given.input?.message !== undefined && openLimit(plan.view()) === undefined,
      }),
    );
    return { kind: "stop" };
  }
  const delivered = deliver(plan.view(), given.input, { takeQueued: given.takeQueued });
  // A message queued before it could steer steers now.
  const queuedSteers = delivered.takeQueued && plan.view().turn.steers === true;
  if (delivered.takeQueued && plan.view().turn.queued !== undefined) {
    const { queued: _queued, steers: _steers, ...turn } = plan.view().turn;
    plan.apply({ events: [], turn });
  }
  // A typed approval answers like a press, so the approval's response policy decides it.
  const typed = resolveTypedApproval(plan.view(), delivered.input);
  const limit = openLimit(plan.view());
  // A new message steers the held turn, unless it waits behind the budget prompt. A typed answer
  // is not a new message.
  const messaged =
    queuedSteers ||
    (given.input?.message !== undefined && typed?.message !== undefined) ||
    delivered.displayMessage !== undefined;
  const steer = messaged && limit === undefined;
  const steered = steer ? withdrawSteeredSignIns(plan, typed) : typed;

  // A typed answer to the budget prompt is an answer like a press.
  const answered: ResolvedStepInput | undefined =
    limit === undefined ? steered : resolveTextInput(plan.view().projection.view, steered);
  // Who gave each answer decides whether it stands now, waits for a response policy, or is
  // refused.
  const check = checkResponders(plan.view(), answered, given.answering);
  plan.apply(admitAnswers(plan.view(), { check, delivery: answered }));
  // A refused delivery is settled, so the turn doesn't carry it on, or settle it again.
  let input = withoutDeliveries(answered, refusedDeliveries(check, answered));
  if (Object.keys(check.weigh).length > 0) {
    // The answers are recorded before any policy runs: the next step weighs them, with the rest
    // of the delivery, whose message steers then.
    plan.apply(
      queueInput(plan.view(), compactInput(input), {
        steers: steer && answered?.messageConsumed !== true,
      }),
    );
    return { kind: "stop" };
  }
  const consumedMessage = answered?.messageConsumed === true;
  let message = consumedMessage
    ? undefined
    : (delivered.displayMessage ?? delivered.input?.message);
  const decided = decide(plan, steer && !consumedMessage);
  if (decided.approved.length > 0 || decided.settledApprovals) {
    // The model reads what the answers decided before the delivery's own input, as the AI SDK
    // ran it, so that input waits a step.
    plan.apply(queueInput(plan.view(), turnInputOnly(input)));
    input = withoutTurnInput(input);
    message = undefined;
  }
  if (decided.approved.length === 0 && blocked(plan.view(), plan.machine.session.state)) {
    // Nothing the answers decided can run, so the input waits, unreceived, behind them.
    plan.apply(queueInput(plan.view(), compactInput(input)));
    return { kind: "stop" };
  }
  return {
    consumedMessage,
    decided,
    input,
    kind: "take",
    message,
    opensTurn: hasTurnInput(delivered.input) || hasTurnInput(steered),
  };
}

/** What the person decided: the budget answer, and the calls they approved. */
export interface HumanDecisions {
  readonly limit?: { readonly granted: boolean };
  readonly approved: readonly ApprovedCall[];
  /** Approvals settled on their answers: the model reads their results before the turn input. */
  readonly settledApprovals: boolean;
}

/**
 * The standing answers decide what they answer: the budget prompt settles, and each step's
 * approvals settle together once each has an answer, or when a message steers past them.
 */
function decide(plan: Plan, steer: boolean): HumanDecisions {
  const limit = settleLimit(plan.view());
  if (limit.events.length > 0) plan.apply(limit);
  const settled = settleApprovals(plan.view(), { steer });
  plan.apply(settled);
  return { approved: settled.approved, limit: limit.limit, settledApprovals: settled.answered };
}

/**
 * Before the step takes a delivery's answers, the world has its say: each sign-in callback
 * completes its sign-in, and the response policies weigh the answers they gate, with the tools
 * of the step that asked. Their verdicts, with who the step answers as, are what `takeAnswers`
 * decides from.
 */
export async function weighAnswers(
  step: Step,
  input: HarnessStepInput | undefined,
  options: { readonly takeQueued: boolean },
): Promise<AnswersGiven> {
  const completions = step.config.signInCompletions ?? [];
  if (completions.length > 0) await step.apply(completeSignIn(step.view(), { completions }));
  const weighed = await weighResponders(step.view(), {
    now: Date.now(),
    toolsOf: (parked) => restoreTools(step, parked),
  });
  const searchable = new Set(
    weighed.unavailable.filter(
      (interactionId) =>
        toolsOf(step, stepForRequest(step.view(), interactionId)).get(SEARCH_TOOL_NAME) !==
        undefined,
    ),
  );
  return {
    answering: currentAnswering(),
    input,
    searchable,
    takeQueued: options.takeQueued,
    weighed,
  };
}

/**
 * Approved calls run with the tools of the step that asked, built from the history as it stood
 * when the answers came, before the turn's input joins it.
 */
export async function restoreAskingTools(step: Step): Promise<void> {
  for (const parked of step.view().turn.suspended) await restoreTools(step, parked);
}

/**
 * What the decisions do once the turn has the delivery: a budget answer grants a fresh budget or
 * ends the turn tree, the steps denials completed commit, and approved calls run.
 */
export async function applyHumanDecisions(
  step: Step,
  decided: HumanDecisions,
): Promise<StepResult | undefined> {
  if (decided.limit !== undefined) {
    if (!decided.limit.granted) throw new SessionLimitDeclinedError();
    step.session = bumpSessionRuntimeUsageLimits(
      step.session,
      step.view().projection.view.usage.total,
    );
  }
  await step.apply(settle(step.view(), { results: [] }));
  return runApproved(step, decided.approved);
}

/**
 * Runs the calls a person approved, each with the tools of the step that asked and as the turn's
 * requester: workflow and agent calls join the runs their steps wait on, and local calls run
 * here, in the step's first attempt. A call that needs a sign-in stops the turn for it.
 */
async function runApproved(
  step: Step,
  approved: readonly ApprovedCall[],
): Promise<StepResult | undefined> {
  if (approved.length === 0) return undefined;
  const responders = new Map(approved.map((call) => [call.request.interactionId, call.responder]));
  const byStep = new Map<SuspendedStep, ApprovedCall["request"][]>();
  for (const { request, step: parked } of approved) {
    byStep.set(parked, [...(byStep.get(parked) ?? []), request]);
  }
  const tasks: RuntimeWorkflowTaskRequest[] = [];
  const denied: ApprovedCallResult[] = [];
  const local: { requests: ApprovedCall["request"][]; tools: HarnessToolLookup }[] = [];
  for (const [parked, requests] of byStep) {
    const tools = toolsOf(step, parked);
    const workflows: ApprovedCall["request"][] = [];
    for (const request of requests) {
      const tool = tools.get(request.call.toolName);
      if (tool?.workflowId === undefined) continue;
      const recheck = await recheckApprovedCall(tool, {
        abortSignal: step.config.abortSignal,
        approvalGrants: grantedApprovals(step.view()),
        callId: request.call.callId,
        input: request.call.input,
      });
      if (recheck.denied) {
        denied.push(
          await rejectApprovedCall({
            position: step.position(),
            publish: step.publish,
            approval: request,
            reason: recheck.reason,
          }),
        );
      } else {
        workflows.push(request);
      }
    }
    local.push({
      requests: requests.filter(
        (request) => tools.get(request.call.toolName)?.workflowId === undefined,
      ),
      tools,
    });
    if (workflows.length === 0) continue;
    const dispatched = collectWorkflowCalls({
      session: step.session,
      toolCalls: workflows.map(({ call }) => ({
        input: call.input,
        toolCallId: call.callId,
        toolName: call.toolName,
      })),
      tools,
      turnId: parked.event.turnId,
    });
    step.session = dispatched.session;
    tasks.push(
      ...dispatched.workflowRequests.map((task) => ({
        ...task,
        clearedBy: {
          interactionId: workflows.find((request) => request.call.callId === task.callId)!
            .interactionId,
        },
      })),
    );
  }
  if (denied.length > 0) await step.apply(settle(step.view(), { results: denied }));
  if (tasks.length > 0) await step.apply(dispatch(step.view(), { tasks }));

  const calls = local.flatMap(({ requests }) => requests);
  step.frameworkToolNames = new Set(
    local.flatMap(({ requests, tools }) =>
      requests
        .map((request) => request.call.toolName)
        .filter((name) => tools.get(name)?.frameworkTool === true),
    ),
  );
  if (calls.length === 0) return undefined;
  const executed = await Promise.all(
    local.map(async ({ requests, tools }) => {
      if (requests.length === 0) return { settled: [], signIns: [] };
      const view = step.view().projection.view;
      const call = view.calls[requests[0]!.call.callId];
      const runId = call === undefined ? undefined : callRun(view, call);
      const run = runId === undefined ? undefined : view.runs[runId];
      const attempt =
        run?.attempt === undefined
          ? undefined
          : step.instrumentation?.prepareAttempt({
              runId: run.runId,
              attempt: run.attempt,
              stepIndex: run.step,
              turnId: runTurn(view, run.runId),
              isFrameworkTool: (name) => step.frameworkToolNames.has(name),
            });
      return await runApprovedCalls({
        abortSignal: step.config.abortSignal,
        approvalGrants: grantedApprovals(step.view()),
        approvals: requests,
        messages: step.projectHistory(step.session.history),
        position: step.position(),
        publish: step.publish,
        responderOf: (approval) => responders.get(approval.interactionId),
        telemetry: attempt?.telemetry,
        tools,
      });
    }),
  );
  await step.apply(settle(step.view(), { results: executed.flatMap((run) => run.settled) }));
  // A cancellation ends the turn once the calls it cut short have their results.
  throwIfTurnAborted(step.config.abortSignal);
  const signIn = resolveInlineAuthorizationInterrupt({
    messages: [],
    signIns: executed.flatMap((run) => run.signIns),
  });
  if (signIn === undefined) return undefined;
  await step.apply(
    requireSignIn(step.view(), {
      callIdsByName: signIn.callIdsByName,
      challenges: signIn.challenges,
    }),
    step.session.history,
  );
  return { session: step.session };
}

// A step's catalog is built once per suspended step. Restoring a step's tools runs its
// resolvers, so a step's tools restore again only after another step's.
const restoredTools = new WeakMap<
  Step,
  { readonly tools: Map<string, HarnessToolLookup>; last?: string }
>();

function stepKey(at: { readonly turnId: string; readonly stepIndex: number }): string {
  return `${at.turnId}:${at.stepIndex}`;
}

/** The entries of the step that asked, restored by building its catalog; the running step's without one. */
async function restoreTools(
  step: Step,
  parked: SuspendedStep | undefined,
): Promise<HarnessToolLookup> {
  const { config } = step;
  const at = parked?.event ?? step.position();
  const key = stepKey(at);
  const cache = restoredTools.get(step) ?? { tools: new Map<string, HarnessToolLookup>() };
  restoredTools.set(step, cache);
  const restored = cache.tools.get(key);
  if (restored !== undefined && cache.last === key) return restored;
  await config.participants?.restoreStep({
    at: { sequence: at.sequence, stepIndex: at.stepIndex, turnId: at.turnId },
    messages: step.projectHistory(step.session.history),
    modelId: step.session.agent.modelReference?.id ?? "dynamic",
    parked: parked !== undefined,
  });
  const tools = buildStepCatalog({
    agentTools: config.tools,
    ctx: step.ctx,
    endsTurn: false,
    session: step.session,
  });
  cache.tools.set(key, tools);
  cache.last = key;
  return tools;
}

/** The entries a parked step's calls run with: those of the step that asked. */
function toolsOf(step: Step, parked: SuspendedStep | undefined): HarnessToolLookup {
  return (parked && restoredTools.get(step)?.tools.get(stepKey(parked.event))) ?? step.config.tools;
}

const STEERED_SIGN_IN_REASON = "Cancelled because a new message arrived.";

/**
 * A message steers the held turn: the sign-ins it waits on end, declined, and the model learns
 * why. The answers responders still wait on close with the approvals they answer.
 */
function withdrawSteeredSignIns(
  plan: Plan,
  input: HarnessStepInput | undefined,
): HarnessStepInput | undefined {
  const names = [...new Set(plan.view().signIns.map((challenge) => challenge.name))];
  if (names.length === 0) return input;
  plan.apply(withdrawSignIns(plan.view(), STEERED_SIGN_IN_REASON));
  return {
    ...input,
    context: [
      ...(input?.context ?? []),
      `Sign-in to ${names.join(", ")} was cancelled because the user sent a new message instead. Ask to sign in again only if the new message still needs it.`,
    ],
  };
}

function withoutDeliveries(
  input: ResolvedStepInput | undefined,
  settled: ReadonlySet<string>,
): HarnessStepInput | undefined {
  const rest = withoutResponses(input);
  if (rest === undefined || settled.size === 0) return rest;
  const deliveries = rest.deliveries?.filter(({ deliveryId }) => !settled.has(deliveryId));
  const { deliveries: _all, ...other } = rest;
  return deliveries === undefined || deliveries.length === 0 ? other : { ...other, deliveries };
}

/** Whether the input carries user-facing turn input. */
function hasTurnInput(input: HarnessStepInput | undefined): boolean {
  if (input === undefined) return false;
  return input.message !== undefined || (input.answers?.length ?? 0) > 0;
}
