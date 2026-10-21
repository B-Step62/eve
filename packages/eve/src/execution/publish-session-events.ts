import { getStepMetadata } from "#compiled/@workflow/core/index.js";
import { StepInterruptedError } from "#execution/step-interrupted-error.js";
import { readSessionStreamTailIndex, streamSessionLines } from "#execution/session-event-stream.js";
import { isHookCancellableEvent } from "#execution/session/turn-event-handler.js";
import type { ControlDelivery } from "#harness/types.js";
import { buildAdapterContext } from "#channel/adapter-context.js";
import { callAdapterEventHandler, type ChannelAdapterContext } from "#channel/adapter.js";
import { type ContextContainer, contextStorage } from "#context/container.js";
import { dispatchStreamEventHooks } from "#context/hook-lifecycle.js";
import { AuthKey, InitiatorAuthKey, ParentSessionKey, SessionKey } from "#context/keys.js";
import { withContextScope } from "#context/run-step.js";
import { deserializeContext, serializeContext } from "#context/serialize.js";
import { setChannelContext } from "#execution/channel-context.js";
import { forwardSessionInput } from "#execution/forward-session-input.js";
import {
  createDurableSessionState,
  readDurableSession,
  type DurableSession,
  type DurableSessionState,
} from "#execution/durable-session-store.js";
import { resolveEffectiveAgentRuntime } from "#execution/effective-agent-config.js";
import { rehydrateSessionConnections } from "#execution/participants.js";
import { dynamicEventKey } from "#dynamic/definition.js";
import { reconcileSessionContinuationToken } from "#execution/reconcile-session-continuation-token.js";
import { hydrateDurableSession } from "#execution/session.js";
import {
  saveTransition,
  sessionView,
  type Transition,
  dropClosedRecords,
} from "#harness/session-machine/commit.js";
import { announceWaiting } from "#harness/session-machine/waiting.js";
import { cascade } from "#harness/session-machine/cascade.js";
import { copyView } from "#protocol/session-projection/fold.js";
import {
  currentProjection,
  currentView,
  enterSessionProjection,
  enterSessionProjectionAt,
  nextLinePosition,
  recordPublishedLine,
  saveSessionProjection,
} from "#harness/session-machine/current.js";
import {
  storedProjection,
  type SessionView as MachineView,
} from "#harness/session-machine/view.js";
import { validateHarnessModelMessages, type HarnessModelMessage } from "#harness/messages.js";
import { eventsOf } from "#harness/publication.js";
import type {
  HandleEventFn,
  HarnessSession,
  HarnessSessionBase,
  SessionPublication,
} from "#harness/types.js";
import { bindSessionInstrumentation } from "#instrumentation/runtime.js";
import { createLogger } from "#internal/logging.js";
import { createEventReader, eventsOfLine, linesOf } from "#protocol/session-lines.js";
import type { SessionEvent, SessionStreamEvent } from "#protocol/session-event.js";
import { encodeLineBytes, type FactPosition } from "#protocol/session-events/envelope.js";
import { type SessionProjection } from "#protocol/session-projection.js";
import type { Cause, ErrorInfo } from "#protocol/session-events/envelope.js";
import { sessionEndedFacts } from "#harness/facts.js";
import { createStreamChecker, type StreamChecker } from "#protocol/session-events/checker.js";
import type { SessionView } from "#protocol/session-projection/tables.js";
import { BundleKey, ChannelKey } from "#runtime/sessions/runtime-context-keys.js";

const log = createLogger("execution.publish-session-events");

/**
 * Whose event a session publishes. Every event reaches the channel adapter, the
 * session stream, and stream-event hooks. The session's own events also reach
 * its instrumentation and carry its turn's delivery ids.
 *
 * A relayed event belongs to an exchange this session carries for a child
 * session or a workflow run: the question or sign-in it raised, the turn
 * boundary that question causes here, and the `interaction.settled` for the answer
 * this session routes back. This session's instrumentation never tracks that
 * pending input, so no event of the exchange reaches it; the child records its
 * side as its own.
 */
export type SessionEventOrigin = "own" | "relayed";

/** The session a step publishes to: its stream and the state it starts from. */
export interface SessionStepState {
  readonly serializedContext: Record<string, unknown>;
  readonly sessionState: DurableSessionState;
  readonly sessionWritable: WritableStream<Uint8Array>;
}

/** A {@link SessionStepState} with the conversation history, for a step that reads or changes it. */
export interface SessionHistoryStepState extends SessionStepState {
  readonly history: HarnessModelMessage[];
}

/** The context and session state a publication leaves behind. */
export interface PublishedSessionEvents {
  readonly serializedContext: Record<string, unknown>;
  readonly sessionState: DurableSessionState;
}

/**
 * Publishes a session step's own events, such as a workflow tool's
 * `call.progress`, exactly as a turn publishes its events. Call from a step
 * and adopt the result: hooks run in the session's context and may change it.
 */
export async function publishSessionEvents(
  target: SessionStepState,
  events: readonly SessionEvent[],
  options?: { readonly canCancelTurn?: boolean },
): Promise<PublishedSessionEvents & { readonly cancelled: boolean }> {
  let cancelled = false;
  const published = await publishEventsFromStep(
    target,
    "own",
    events,
    options?.canCancelTurn
      ? () => {
          cancelled = true;
        }
      : undefined,
  );
  return { ...published, cancelled };
}

async function publishEventsFromStep(
  target: SessionStepState,
  origin: SessionEventOrigin,
  events: readonly SessionEvent[],
  cancelTurn?: () => void,
): Promise<PublishedSessionEvents> {
  if (events.length === 0) {
    return { serializedContext: target.serializedContext, sessionState: target.sessionState };
  }
  const restored = await restoreSessionStep(target);
  const { published } = await publishFromSessionStep(restored, {
    recoveryLines: linesOf(events, "").length,
    recoverResult: () => undefined,
    cancelTurn,
    origin,
    async publish(emit) {
      await emit(events);
    },
  });
  return published;
}

/** A session step's context and session, restored so the step can publish. */
export interface RestoredSessionStep {
  readonly ctx: ContextContainer;
  readonly durableSession: DurableSession;
  readonly sessionWritable: WritableStream<Uint8Array>;
}

/** A {@link RestoredSessionStep} with the history, so its publication sees a whole session. */
export interface RestoredSessionHistoryStep extends RestoredSessionStep {
  readonly history: HarnessModelMessage[];
}

export async function restoreSessionStep(step: SessionStepState): Promise<RestoredSessionStep> {
  return {
    ctx: await deserializeContext(step.serializedContext),
    durableSession: readDurableSession(step.sessionState),
    sessionWritable: step.sessionWritable,
  };
}

/**
 * What a session step publishes, and how it changes the session the
 * publication leaves. `S` is a {@link HarnessSession} only for a step
 * restored with its history.
 */
export type SessionStepPublication<T, R, S extends HarnessSessionBase = HarnessSessionBase> = {
  /** A fixed publication can be adopted from the stream without re-running its writer. */
  /** A hook stops this publication's running turn; its owner adopts the cancellation after commit. */
  readonly cancelTurn?: () => void;
  readonly origin: SessionEventOrigin;
  /** Where a relayed input batch came from; the channel adapter and its forwarding see it. */
  readonly inputSource?: string;
  /** Emits the step's events in the session's context scope. */
  publish(emit: HandleEventFn, session: S): Promise<T>;
  /**
   * Changes the step makes to the session once the scope has committed it,
   * before its continuation token is reconciled.
   */
  updateSession?(session: S, published: T): SessionUpdate<R, S>;
} & (
  | { readonly recoveryLines?: never; readonly recoverResult?: never }
  | { readonly recoveryLines: number; readonly recoverResult: () => T }
);

/** The session a step keeps, and anything it derived while changing it. */
export interface SessionUpdate<R, S extends HarnessSessionBase = HarnessSessionBase> {
  readonly session: S;
  readonly result?: R;
}

/**
 * Publishes from a step that owns the session. Returns the context and session
 * state to adopt, and the result of `updateSession`. `step.ctx` is updated in place.
 * The history is published and returned only when the step was restored with it.
 */
export async function publishFromSessionStep<T, R = undefined>(
  step: RestoredSessionHistoryStep,
  publication: SessionStepPublication<T, R, HarnessSession>,
): Promise<{
  readonly published: PublishedSessionEvents & { readonly history: HarnessModelMessage[] };
  readonly result: R | undefined;
}>;
export async function publishFromSessionStep<T, R = undefined>(
  step: RestoredSessionStep,
  publication: SessionStepPublication<T, R>,
): Promise<{ readonly published: PublishedSessionEvents; readonly result: R | undefined }>;
export async function publishFromSessionStep<T, R>(
  step: RestoredSessionStep & { readonly history?: HarnessModelMessage[] },
  publication: SessionStepPublication<T, R>,
): Promise<{
  readonly published: PublishedSessionEvents & { readonly history?: HarnessModelMessage[] };
  readonly result: R | undefined;
}> {
  const { ctx } = step;
  const scoped = await publishInSessionScope(step, publication);
  const update: SessionUpdate<R> = publication.updateSession?.(scoped.session, scoped.result) ?? {
    session: scoped.session,
  };
  // The session saves the lifecycle it published, without the records whose owners it closed.
  const projection = readSessionProjection(ctx);
  const session = reconcileSessionContinuationToken(
    ctx,
    saveSessionProjection(dropClosedRecords(update.session, projection), ctx),
  );
  return {
    published: {
      serializedContext: serializeContext(ctx),
      sessionState: createDurableSessionState({ session }),
      ...("history" in session && { history: session.history as HarnessModelMessage[] }),
    },
    result: update.result,
  };
}

/**
 * Runs `publication.publish` in the session's context scope with an emit that
 * publishes each event in order. Returns its result and the session the scope
 * commits.
 */
async function publishInSessionScope<T>(
  step: RestoredSessionStep & { readonly history?: HarnessModelMessage[] },
  publication: SessionStepPublication<T, unknown>,
): Promise<{ readonly result: T; readonly session: HarnessSessionBase }> {
  const { ctx } = step;
  enterSessionProjection(ctx, step.durableSession.state);
  const effectiveAgent = resolveEffectiveAgentRuntime(ctx.require(BundleKey), ctx);
  const hydrated = hydrateDurableSession({
    compactionOverrides: { thresholdPercent: effectiveAgent.thresholdPercent },
    durable: step.durableSession,
    turnAgent: effectiveAgent.turnAgent,
  });
  const session =
    step.history === undefined
      ? hydrated
      : { ...hydrated, history: validateHarnessModelMessages(step.history) };
  const instrumentation =
    publication.origin === "own"
      ? bindSessionInstrumentation({
          agentName: effectiveAgent.turnAgent.id,
          ctx,
          rootSessionId: session.rootSessionId ?? session.sessionId,
          sessionId: session.sessionId,
        })
      : undefined;

  const publisher = openSessionEventPublisher({
    cancelTurn: publication.cancelTurn,
    ctx,
    inputSource: publication.inputSource,
    origin: publication.origin,
    sessionWritable: step.sessionWritable,
  });
  try {
    return await withContextScope(ctx, session, async (enrichedSession) => {
      if (publication.recoveryLines !== undefined) {
        await rehydrateSessionConnections({ ctx, bundle: ctx.require(BundleKey), effectiveAgent });
        const recovered = await reconcilePublishedSessionLines({
          ctx,
          sessionId: session.sessionId,
          cancelTurn: publication.cancelTurn,
        });
        if (recovered > 0) {
          if (recovered !== publication.recoveryLines)
            throw new StepInterruptedError(
              "A non-turn step published work that cannot be reconstructed from its checkpoint. Start a new session.",
            );
          return { result: publication.recoverResult!(), session: enrichedSession };
        }
      }
      const emit =
        instrumentation?.createHandleEvent({ handleEvent: publisher.publish }) ?? publisher.publish;
      const result = await publication.publish(emit, enrichedSession);
      await publisher.finish();
      return { result, session: enrichedSession };
    });
  } finally {
    await instrumentation?.flush();
    publisher.writer.release();
  }
}

/**
 * Holds a session's stream for one step, which keeps its writer lock until it
 * releases it. Events reach the stream through `SessionEventPublisher.emit`.
 */
export interface SessionEventWriter {
  /** Closes the session stream; only a terminal event (`done`, completion, or failure) does this. */
  close(): Promise<void>;
  /** Releases the writer lock so the next step can acquire it. Safe after `close()`. */
  release(): void;
}

/** One event as written: as readers read it back, with where it sits on the stream. */
export interface WrittenEvent {
  readonly event: SessionStreamEvent;
  readonly position: FactPosition;
  /** It rode as a progress record, which only hooks keyed on its type hear. */
  readonly progress: boolean;
  /** Immutable table snapshot after this record's whole line, not a later concurrent write. */
  readonly view: SessionView;
}

interface StreamWriter extends SessionEventWriter {
  /** Writes one line: one chunk, so a crash leaves all of it or none. */
  write(bytes: Uint8Array): Promise<void>;
}

/** Dispatches a session's written events to its channel and stream-event hooks. */
export interface SessionEventDispatcher {
  /** The context delivery hands the channel adapter; a turn step also hands it to `adapter.deliver`. */
  readonly adapterCtx: ChannelAdapterContext;
  /**
   * Runs the stream-event hooks for written events, in order. Only a turn step passes
   * `cancelTurnFor`, which says how a hook on each event may stop the turn; see
   * `turn-event-handler.ts`.
   */
  runHooks(
    written: readonly WrittenEvent[],
    cancelTurnFor?: (event: SessionStreamEvent) => (() => void) | undefined,
  ): Promise<void>;
}

interface EventDispatcher extends SessionEventDispatcher {
  /**
   * After the write: relays each input request this session carries for its caller
   * (`forwardSessionInput`), or runs the channel adapter's handler, then saves the channel
   * context.
   */
  deliver(written: readonly WrittenEvent[]): Promise<void>;
}

/** A session's stream held by one step, with the dispatch of the events that step publishes. */
export interface SessionEventPublisher {
  readonly dispatcher: SessionEventDispatcher;
  readonly writer: SessionEventWriter;
  /**
   * Writes one publication (a commit's facts on one line, each progress record on its own),
   * folds each line into the step's projection, then runs the channel's handlers. Returns the
   * events as written, for their hooks.
   */
  emit(publication: SessionPublication): Promise<readonly WrittenEvent[]>;
  /** `emit`, then the events' stream-event hooks. */
  publish(publication: SessionPublication): Promise<void>;
  /**
   * Ends a unit of the step's progress: publishes what the tables now say about the open
   * turn waiting on people (`announceWaiting`). Steps call it as they end. A turn step passes
   * whether it stopped for a person; a step that runs while the turn waits leaves it to the
   * tables.
   */
  finish(options?: { readonly announce?: boolean }): Promise<void>;
}

/**
 * Whether publication checks each line against the event contract before writing it: on under
 * `eve dev` and with `EVE_CHECK_SESSION_EVENTS=1`, off with `EVE_CHECK_SESSION_EVENTS=0`. A
 * violation fails the publication instead of writing a line readers can't fold.
 */
export function checksSessionEvents(): boolean {
  const configured = process.env.EVE_CHECK_SESSION_EVENTS;
  if (configured === "1") return true;
  if (configured === "0") return false;
  return process.env.EVE_DEV === "1";
}

/**
 * Reconcile a retried step with lines that its checkpoint did not include. The stream is the
 * authority for positions: a released writer's chunks survive a failed step. Dispatch is
 * at-least-once, including when a previous attempt delivered a line but did not checkpoint it.
 */
export async function hasUncheckpointedSessionLines(
  ctx: ContextContainer,
  sessionId: string,
): Promise<boolean> {
  try {
    if (getStepMetadata().attempt <= 1) return false;
  } catch (error) {
    if (error instanceof Error && error.name === "NotInStepContextError") return false;
    throw error;
  }
  const tail = await readSessionStreamTailIndex(sessionId);
  const first = nextLinePosition(ctx);
  if (tail + 1 < first) throw new Error("Session checkpoint is ahead of its stream.");
  return tail >= first;
}

export async function reconcilePublishedSessionLines(input: {
  readonly ctx: ContextContainer;
  readonly sessionId: string;
  readonly onEvent?: (event: SessionStreamEvent) => void;
  readonly cancelTurn?: () => void;
  /** Terminal closure must inspect the stream even on its first attempt. */
  readonly terminal?: boolean;
  readonly dispatch?: boolean;
}): Promise<number> {
  if (!input.terminal) {
    let metadata: ReturnType<typeof getStepMetadata>;
    try {
      metadata = getStepMetadata();
    } catch (error) {
      if (error instanceof Error && error.name === "NotInStepContextError") return 0;
      throw error;
    }
    if (metadata.attempt <= 1) return 0;
  }
  const { ctx, sessionId } = input;
  const first = nextLinePosition(ctx);
  const tail = await readSessionStreamTailIndex(sessionId);
  if (tail < first) {
    if (tail + 1 !== first) throw new Error("Session checkpoint is ahead of its stream.");
    return 0;
  }
  log.warn("recovering published lines from interrupted session step", {
    sessionId,
    orphanedLines: tail - first + 1,
  });
  const dispatcher = input.dispatch === false ? undefined : createSessionEventDispatcher({ ctx });
  // Only a progress line needs a prior timestamp. One bounded forward read avoids a
  // durable open per preceding record and refuses to invent an unknown event time.
  let progressAt: string | undefined;
  const firstLines = streamSessionLines(sessionId, { follow: false, startIndex: first });
  let firstRecord;
  try {
    firstRecord = (await firstLines.next()).value;
  } finally {
    await firstLines.return(undefined);
  }
  if (firstRecord?.line === undefined)
    throw new Error("Cannot reconcile an unreadable session line.");
  if ("progress" in firstRecord.line) {
    const start = Math.max(0, first - 256);
    for await (const record of streamSessionLines(sessionId, {
      follow: false,
      startIndex: start,
    })) {
      if (record.position >= first) break;
      if (record.line === undefined)
        throw new Error("Cannot reconcile an unreadable session line.");
      if ("facts" in record.line) progressAt = record.line.at;
    }
    if (progressAt === undefined)
      throw new StepInterruptedError(
        "Cannot reconcile progress: no preceding commit in the bounded history window. Start a new session.",
      );
  }
  const reader = createEventReader(progressAt);
  let position = first;
  for await (const record of streamSessionLines(sessionId, { follow: false, startIndex: first })) {
    if (record.position > tail) break;
    if (record.line === undefined) throw new Error("Cannot reconcile an unreadable session line.");
    const events = reader.read(record.line, record.position);
    if (record.position !== position) throw new Error("Cannot reconcile a missing session line.");
    if (dispatcher !== undefined) {
      const resolvers = ctx.get(BundleKey)?.resolvedAgent.dynamicConnectionResolvers ?? [];
      if (
        events.some(
          (event) =>
            (event.type === "session.started" || event.type === "turn.started") &&
            resolvers.some((resolver) => resolver.eventNames.includes(dynamicEventKey(event.type))),
        )
      )
        throw new StepInterruptedError(
          "A dynamic connection selected at an uncheckpointed start cannot be restored for event hooks. Start a new session.",
        );
    }
    recordPublishedLine(ctx, record.line, position, events);
    const view = currentView(ctx);
    const progress = "progress" in record.line;
    const written = events.map((event) => ({
      event,
      position: event.meta.position,
      progress,
      view,
    }));
    for (const event of events) input.onEvent?.(event);
    if (dispatcher !== undefined) {
      await contextStorage.run(ctx, async () => {
        await dispatcher.deliver(written);
        const hooks = input.terminal
          ? written.filter(({ event }) => event.type !== "session.ended")
          : written;
        const endsTurn = written.some(
          ({ event }) => event.type === "turn.settled" || event.type === "session.ended",
        );
        await dispatcher.runHooks(hooks, (event) =>
          !endsTurn && isHookCancellableEvent(event.type) ? input.cancelTurn : undefined,
        );
      });
    }
    position++;
  }
  if (position !== tail + 1) throw new Error("Session stream ended before its reported tail.");
  return position - first;
}

export function openSessionEventPublisher(input: {
  readonly cancelTurn?: () => void;
  readonly ctx: ContextContainer;
  readonly origin: SessionEventOrigin;
  readonly sessionWritable: WritableStream<Uint8Array>;
  readonly inputSource?: string;
}): SessionEventPublisher {
  const { ctx } = input;
  const dispatcher = createSessionEventDispatcher(input);
  // Opened after the dispatcher, so a context that cannot build one leaves the
  // stream unlocked for the terminal event's fallback write.
  const writer = openSessionEventWriter(input.sessionWritable);
  let checker: StreamChecker | undefined;
  // The tables as the step's first publication found them, for what its end announces.
  let before: SessionView | undefined;
  const emitOne = async (publication: SessionPublication): Promise<readonly WrittenEvent[]> => {
    if (checker === undefined && checksSessionEvents()) {
      const { schemaViolation } = await import("#protocol/session-events/schemas.js");
      checker = createStreamChecker({
        seed: currentProjection(ctx).view,
        validate: schemaViolation,
      });
    }
    if (before === undefined) before = copyView(currentView(ctx));
    const events = cascade(currentView(ctx), eventsOf(publication));
    const at = new Date().toISOString();
    const written: WrittenEvent[] = [];
    // Preflight every line before the first write: an oversize progress record must not leave
    // an earlier part of the publication durably written.
    const lines = linesOf(events, at).map((line) => ({ line, bytes: encodeLineBytes(line) }));
    lines.forEach(({ line }, index) => {
      const violations = checker?.check(line, nextLinePosition(ctx) + index);
      if (violations !== undefined && violations.length > 0) {
        checker = undefined;
        throw new Error(
          `Session event contract: ${violations
            .map(
              (violation) =>
                `${violation.rule} at ${violation.position}:${violation.index ?? "progress"}: ${violation.message}`,
            )
            .join("; ")}`,
        );
      }
    });
    for (const { line, bytes } of lines) {
      const position = nextLinePosition(ctx);
      await writer.write(bytes).catch((error: unknown) => {
        // Validation ran ahead of the write. A failed write must not leave the checker ahead
        // of the checkpoint; a later publication reseeds it from what actually committed.
        checker = undefined;
        throw error;
      });
      const lineEvents = eventsOfLine(line, position, at);
      recordPublishedLine(ctx, line, position, lineEvents);
      const progress = "progress" in line;
      const view = currentView(ctx);
      lineEvents.forEach((event) =>
        written.push({ event, position: event.meta.position, progress, view }),
      );
    }
    await dispatcher.deliver(written);
    return written;
  };
  // Local calls execute concurrently. Serialize publication through write, fold and channel
  // delivery so two calls cannot reserve the same position or overwrite channel state. A
  // failure rejects its caller but releases this lane for terminal cleanup.
  let publicationTail: Promise<unknown> = Promise.resolve();
  const emit = (publication: SessionPublication): Promise<readonly WrittenEvent[]> => {
    const next = publicationTail.then(() => emitOne(publication));
    publicationTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
  const publish = async (publication: SessionPublication): Promise<void> => {
    await dispatcher.runHooks(await emit(publication), (event) =>
      isHookCancellableEvent(event.type) ? input.cancelTurn : undefined,
    );
  };
  return {
    dispatcher,
    writer,
    emit,
    publish,
    async finish(options) {
      if (before === undefined) return;
      const announced =
        options?.announce === false ? [] : announceWaiting(before, currentView(ctx));
      before = undefined;
      if (announced.length > 0) await publish(announced);
    },
  };
}

function createSessionEventDispatcher(input: {
  readonly ctx: ContextContainer;
  readonly inputSource?: string;
}): EventDispatcher {
  const { ctx, inputSource } = input;
  const adapter = ctx.require(ChannelKey);
  const adapterCtx = buildAdapterContext(adapter, ctx);
  const deliveryCtx = inputSource === undefined ? adapterCtx : { ...adapterCtx, inputSource };

  return {
    adapterCtx,
    async deliver(written) {
      if (written.length === 0) return;
      // Each committed line's facts, for its `committed` handler once the line's events ran.
      let line: { facts: SessionEvent[]; position: FactPosition; view: SessionView } | undefined;
      const committed = async () => {
        if (line === undefined) return;
        const { facts, position, view } = line;
        line = undefined;
        await callAdapterEventHandler(
          adapter,
          { facts, position: position.line },
          { ...deliveryCtx, position, scope: undefined, view },
        );
      };
      for (const { event, position, progress, view } of written) {
        if (line !== undefined && line.position.line !== position.line) await committed();
        if (await forwardSessionInput(ctx, event, inputSource)) continue;
        if (!progress) (line ??= { facts: [], position, view }).facts.push(event);
        const scope = "scope" in event ? event.scope : undefined;
        await callAdapterEventHandler(adapter, event, { ...deliveryCtx, position, scope, view });
      }
      await committed();
      setChannelContext(ctx, { ...adapter, state: { ...adapterCtx.state } });
    },
    async runHooks(written, cancelTurnFor) {
      if (written.length === 0) return;
      // Read here rather than when the dispatcher is built: terminal delivery
      // runs no hooks and must not require the bundle.
      const registry = ctx.require(BundleKey).hookRegistry;
      for (const { event, position, progress, view } of written) {
        await dispatchStreamEventHooks({
          cancelTurn: cancelTurnFor?.(event),
          ctx,
          event,
          position,
          progress,
          registry,
          view,
        });
      }
    },
  };
}

function openSessionEventWriter(sessionWritable: WritableStream<Uint8Array>): StreamWriter {
  const streamWriter = sessionWritable.getWriter();

  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    streamWriter.releaseLock();
  };
  return {
    async write(bytes) {
      await streamWriter.write(bytes);
    },
    close: async () => {
      try {
        await streamWriter.close();
      } finally {
        release();
      }
    },
    release,
  };
}

/** The session's projection as of the last event it published. */
export function readSessionProjection(ctx: ContextContainer): SessionProjection {
  return currentProjection(ctx);
}

/** How a session ends from outside a turn. */
export interface SessionEnding {
  readonly outcome: "completed" | "failed";
  readonly cause?: Cause;
  /** The reset control that ends the session, when it named its delivery. */
  readonly control?: ControlDelivery;
  readonly error?: ErrorInfo;
}

/**
 * Ends the session from outside a turn: one commit settles what it left open and ends it
 * (`session.ended`), through its channel adapter and instrumentation, then closes the session
 * stream so readers following it reach its end. Stream-event hooks do not run: the ending session
 * may not restore, and no turn scope remains for authored code. Never throws.
 *
 * When the context cannot be restored, the commit is only written and the stream closed: the one
 * degraded write of a session event.
 */
export async function publishTerminalSessionEvent(input: {
  readonly errorId?: string;
  readonly ending: SessionEnding;
  readonly serializedContext: Record<string, unknown>;
  readonly sessionState?: DurableSessionState;
  readonly sessionWritable: WritableStream<Uint8Array>;
  /** The session's last turn, for channel handlers' `ctx.session.turn`. */
  readonly turn?: { readonly id: string; readonly sequence: number };
  /** The turn the event ends, for instrumentation. */
  readonly turnId?: string;
  /** The session's last checkpointed projection: what's open, and the next line's position. */
  readonly projection?: SessionProjection;
}): Promise<void> {
  const sessionId = (input.serializedContext["eve.sessionId"] as string | undefined) ?? "";
  const fields = { errorId: input.errorId, sessionId };
  const type = "session.ended";
  let projection =
    input.projection ??
    (input.sessionState === undefined
      ? undefined
      : storedProjection(readDurableSession(input.sessionState).state));
  let ctx: ContextContainer;
  let publisher: SessionEventPublisher;
  try {
    ctx = await deserializeContext(input.serializedContext);
    enterSessionProjectionAt(ctx, projection);
    if (input.sessionState === undefined) {
      await reconcilePublishedSessionLines({ ctx, sessionId, terminal: true, dispatch: false });
    } else {
      const durable = readDurableSession(input.sessionState);
      const agent = resolveEffectiveAgentRuntime(ctx.require(BundleKey), ctx);
      const session = hydrateDurableSession({
        compactionOverrides: { thresholdPercent: agent.thresholdPercent },
        durable,
        turnAgent: agent.turnAgent,
      });
      await withContextScope(ctx, session, async (enriched) => {
        if ((await readSessionStreamTailIndex(sessionId)) >= nextLinePosition(ctx)) {
          await rehydrateSessionConnections({
            ctx,
            bundle: ctx.require(BundleKey),
            effectiveAgent: agent,
          });
        }
        return {
          result: await reconcilePublishedSessionLines({ ctx, sessionId, terminal: true }),
          session: enriched,
        };
      });
    }
    projection = currentProjection(ctx);
    publisher = openSessionEventPublisher({
      ctx,
      origin: "own",
      sessionWritable: input.sessionWritable,
    });
  } catch (error) {
    log.error(`failed to restore context for terminal ${type} event`, { ...fields, error });
    // Even when providers or handlers cannot run, fold the physical tail if the context
    // can deserialize. The fallback still appends to the stream's actual tail.
    try {
      const fallbackCtx = await deserializeContext(input.serializedContext);
      enterSessionProjectionAt(fallbackCtx, projection);
      await reconcilePublishedSessionLines({
        ctx: fallbackCtx,
        sessionId,
        terminal: true,
        dispatch: false,
      });
      projection = currentProjection(fallbackCtx);
    } catch (foldError) {
      log.error(`failed to fold tail for terminal ${type} event`, { ...fields, error: foldError });
    }
    if (projection?.view.session.status === "ended") {
      try {
        await openSessionEventWriter(input.sessionWritable).close();
      } catch {
        // Another attempt may have closed the stream already.
      }
      return;
    }
    const facts = sessionEndedFacts(projection, input.ending);
    const closed = projection === undefined ? facts : cascade(projection.view, facts);
    await writeUnroutedSessionEvent(input.sessionWritable, closed).catch((writeError) =>
      log.error(`failed to write terminal ${type} event`, { ...fields, error: writeError }),
    );
    return;
  }

  if (projection?.view.session.status === "ended") {
    try {
      await publisher.writer.close();
    } catch {
      // The terminal fact survived an earlier attempt that already closed the stream.
    } finally {
      publisher.writer.release();
    }
    return;
  }

  // Terminal events publish outside any turn step, and only a turn step
  // installs the session callback context that channel `session.ended`
  // handlers read, so install it here. A prewarmed session that expires,
  // resets, or closes before its first message has no turn yet: `turn_0`.
  const auth = ctx.get(AuthKey) ?? null;
  ctx.setVirtualContext(SessionKey, {
    auth: { current: auth, initiator: ctx.get(InitiatorAuthKey) ?? auth },
    parent: ctx.get(ParentSessionKey),
    sessionId,
    turn: input.turn ?? { id: "turn_0", sequence: 0 },
  });

  // Emitted without its hooks; see above.
  const publish: HandleEventFn = async (event) => {
    await publisher.emit(event);
    await publisher.writer.close();
  };
  let instrumentation: ReturnType<typeof bindSessionInstrumentation>;
  try {
    instrumentation = bindSessionInstrumentation({
      agentName: ctx.require(BundleKey).turnAgent.id,
      ctx,
      rootSessionId: ctx.get(ParentSessionKey)?.rootSessionId ?? sessionId,
      sessionId,
    });
  } catch (error) {
    log.error(`failed to bind instrumentation for terminal ${type} event`, { ...fields, error });
  }
  const emit = instrumentation?.createHandleEvent({ handleEvent: publish }) ?? publish;
  try {
    await contextStorage.run(ctx, () => emit(sessionEndedFacts(projection, input.ending)));
  } catch (error) {
    log.error(`failed to publish terminal ${type} event`, { ...fields, error });
  } finally {
    publisher.writer.release();
    try {
      await instrumentation?.flush();
    } catch (error) {
      log.error(`failed to flush instrumentation after terminal ${type} event`, {
        ...fields,
        error,
      });
    }
  }
}

async function writeUnroutedSessionEvent(
  sessionWritable: WritableStream<Uint8Array>,
  facts: readonly SessionEvent[],
): Promise<void> {
  const writer = openSessionEventWriter(sessionWritable);
  try {
    const lines = linesOf(facts, new Date().toISOString()).map(encodeLineBytes);
    for (const bytes of lines) await writer.write(bytes);
    await writer.close();
  } finally {
    writer.release();
  }
}

/**
 * The commit of a step that owns the session outside a turn: restore it, decide its transitions
 * against what it restored, publish their events in order, and save what they change.
 * Used by relay-changing steps outside a turn; other steps still publish or apply transitions
 * directly. Batches keep the turn unchanged and contain at most one sign-in snapshot.
 */
export async function commitSessionStep(
  target: SessionStepState | RestoredSessionStep,
  decide: (view: MachineView) => readonly Transition[],
  options: {
    readonly origin: SessionEventOrigin;
    readonly cancelTurn?: () => void;
    /** Where a relayed input batch came from; see `SessionStepPublication.inputSource`. */
    readonly inputSource?: string;
  },
): Promise<PublishedSessionEvents> {
  const { state } =
    "ctx" in target ? target.durableSession : readDurableSession(target.sessionState);
  const view = sessionView(storedProjection(state), state);
  const transitions = decide(view);
  if (
    (transitions.length > 1 && transitions.some((transition) => transition.turn !== view.turn)) ||
    transitions.filter((transition) => transition.signIns !== undefined).length > 1
  ) {
    throw new Error("A transition batch must not overlap turn or sign-in snapshots.");
  }
  // The batch is one commit: the publisher closes what its owners' ends leave open, seeing it whole.
  if ("ctx" in target) return await commit(target, transitions, options);
  if (transitions.every((transition) => changesNothing(view, transition))) {
    return { serializedContext: target.serializedContext, sessionState: target.sessionState };
  }
  return await commit(await restoreSessionStep(target), transitions, options);
}

async function commit(
  restored: RestoredSessionStep,
  transitions: readonly Transition[],
  options: {
    readonly origin: SessionEventOrigin;
    readonly inputSource?: string;
    readonly cancelTurn?: () => void;
  },
): Promise<PublishedSessionEvents> {
  const { published } = await publishFromSessionStep(restored, {
    recoveryLines: transitions.flatMap((transition) => transition.events).length > 0 ? 1 : 0,
    recoverResult: () => undefined,
    inputSource: options.inputSource,
    cancelTurn: options.cancelTurn,
    origin: options.origin,
    async publish(emit) {
      // One commit: the batch's events are one atomic line.
      const events = transitions.flatMap((transition) => transition.events);
      if (events.length > 0) await emit(events);
    },
    // Save onto the session the scope committed, which carries what its providers captured.
    updateSession: (session) => ({
      session: transitions.reduce((next, transition) => saveTransition(next, transition), session),
    }),
  });
  return published;
}

/** A transition that reports nothing and changes no record, as the machine decides with no work. */
function changesNothing(view: MachineView, transition: Transition): boolean {
  return (
    transition.turn === view.turn &&
    transition.events.length === 0 &&
    transition.signIns === undefined &&
    transition.relays === undefined &&
    transition.commit === undefined &&
    transition.clearsHistory === undefined
  );
}
