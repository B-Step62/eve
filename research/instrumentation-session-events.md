---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-13"
---

# Instrumentation on session events and reactions

Three pieces of in-flight work change eve's instrumentation:

- **The tracing library (main).** `@eve/tracing` owns span layout, capture and durable
  recovery. eve's adapter, `tracing/eve/*`, turns instrumentation events into library operations.
  The provider API, `defineInstrumentation` and the events in `instrumentation/lifecycle.ts`, is
  unchanged on main.
- **v27 (the stack).** gives providers the stream's names for what the stream
  records, with each ending carrying its outcome. It rebuilds the events from committed
  facts and the tables after them.
- **Reactions (#4616).** Hooks observe the session through one context:
  `(fact, { view, position, occurrence })`, plus `select` with `run` for derived state.

This doc relates the three. Its proposal: once reactions lands, instrumentation providers observe
the session the same way hooks do. The proposal isn't implemented.

## Three vocabularies

| Layer                                     | Names                                                                 | Job                                    |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| Session facts                             | `turn.settled`, `call.requested`, `interaction.opened`, …             | What eve records; locked by the stream |
| Provider events (`defineInstrumentation`) | `turn.settled`, `model.call.started`, `channel.delivery.completed`, … | What eve tells authored providers      |
| `@eve/tracing` operations                 | turn, attempt, model call, tool, approval, memory                     | Span layout for any agent framework    |

Main's provider events are a second name for most facts (`tool.call.completed` for
`call.settled`), and they aren't neutral: they carry eve scopes, channel audience and principals.
With the library as the neutral layer, the middle layer only needs to be eve's own vocabulary.
PR 10 moves it most of the way there, and the proposal below finishes the move.

## User-facing changes

### In the stack (PR 10)

The four families the stream records take the stream's names. Each operation ends with one event
that carries the fact's outcome:

| Main                                              | Stack                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `session.completed`, `session.failed`             | `session.ended` with `outcome` `completed` or `failed`             |
| `session.waiting`                                 | Removed. v27 has no waiting event                                  |
| `turn.completed`, `turn.cancelled`, `turn.failed` | `turn.settled` with `outcome` `completed`, `cancelled` or `failed` |
| `tool.call.started`, `completed`, `failed`        | `call.requested`, `call.settled` with a `CallOutcome`              |
| `input.requested`, `input.resolved`               | `interaction.opened`, `interaction.settled` with its outcome       |

Step attempt, model call, memory and channel delivery events keep their names. `ctx.state`,
`idempotencyKey` and a payload type per event stay. OpenTelemetry trace schema 4 and
its span names don't change.

### Proposed: providers observe like hooks (after #4616)

Hooks, channel `events` and instrumentation all key handlers by event type. The proposal gives
instrumentation the hook context as well: fact handlers receive the literal fact, and `select` with
`run` covers derived state. [Examples from the guide](#examples-from-the-guide) shows four of
the published examples rewritten.

What changes for authors:

| Stack today                                                               | Proposed                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A payload type per event (`event.toolName`, `event.outcome`)              | The fact itself (`event.data.capability.name`, `event.data.outcome`), as hooks receive it   |
| `ctx.state` to carry data from a start to its end                         | `ctx.view`: the row holds the start time, input, kind and outcome                           |
| `idempotencyKey`, a retry key that a start and its end share              | `occurrence.id` for one fact; `callId` or `interactionId` for the operation                 |
| `kind` of `tool-call`, `load-skill`, `subagent-call`, `remote-agent-call` | The capability's `kind`: `tool`, `agent`, `skill` or `control`                              |
| `session.waiting` gone, with no replacement                               | `select` over the view, for example open interactions, and `run` when the selection changes |
| Model output in `model.call.completed`                                    | The `content.completed` fact                                                                |

These stay live events, using one convention, `started` and then `settled` with an `outcome`:

- **Model calls and step attempts.** The `model.started` and `model.settled` facts cover timing
  and outcome. The prompt and instructions aren't recorded, so a live event still carries model
  input.
- **Memory operations and channel deliveries.** Neither has facts. A delivery's ending already
  carries an `outcome`, so folding its three ending names into one loses nothing.

What stays different from hooks: an instrumentation handler is failure-isolated, its return value
is ignored, it never cancels a turn, it runs after the commit without blocking it, and
`tracePolicy` decides which content each provider receives. `setup`, `flush` and `shutdown`
stay.

## Examples from the guide

Each "before" is the example as `docs/guides/instrumentation/instrumentation.mdx` publishes it on
the stack, where it already uses PR 10's names. Each "after" is the proposed shape. The proposed
API isn't implemented, so these are sketches.

### Time a tool call

The guide stores the tool name and start time in `ctx.state` when the call is requested and reads
them back when it settles.

Before:

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  events: {
    "call.requested": (event, ctx) => {
      ctx.state.set({ name: event.toolName, startedAt: Date.now() });
    },
    "call.settled": (event, ctx) => {
      const started = ctx.state.get() as { name: string; startedAt: number } | undefined;
      if (started === undefined) return;

      console.log({
        tool: started.name,
        durationMs: Date.now() - started.startedAt,
        outcome: event.outcome,
      });
    },
  },
});
```

After:

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  events: {
    "call.settled": (event, { view }) => {
      const call = view.calls[event.data.callId];
      console.log({
        tool: call.capability.name,
        durationMs: Date.parse(call.endedAt!) - Date.parse(call.startedAt),
        outcome: event.data.outcome,
      });
    },
  },
});
```

In the previous code, the instrumentation provider needed to manually track state on event
open, and then reach into that state on close to log the final event.

In the new code, the instrumentation provider has access to the session view, which already
has rich information from the unified session fold, meaning it does not need to track state
itself.

### Send a redacted audit record

The guide's `id` is `idempotencyKey`. The guide says a start and its end share it, and to use it
as a stable key when upserting records across replays.

Before:

```ts title="agent/instrumentation/audit.ts"
export default defineInstrumentation({
  tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: false }),
  events: {
    "call.requested": async (event) => {
      await sendAuditRecord({
        id: event.idempotencyKey,
        input: redactApiKey(event.input),
        kind: event.kind, // "tool-call" | "load-skill" | "subagent-call" | "remote-agent-call"
        name: event.toolName,
      });
    },
  },
});
```

After:

```ts title="agent/instrumentation/audit.ts"
export default defineInstrumentation({
  tracePolicy: () => ({ emit: true, recordInputs: true, recordOutputs: false }),
  events: {
    "call.requested": async (event, { occurrence }) => {
      await sendAuditRecord({
        id: occurrence.id, // this fact; a retried step computes the same one
        callId: event.data.callId, // the call, shared with its call.settled
        input: redactApiKey(event.data.input),
        kind: event.data.capability.kind, // "tool" | "agent" | "skill" | "control"
        name: event.data.capability.name,
      });
    },
  },
});
```

`idempotencyKey` did two jobs, deduplicating replays and naming the operation, and each now has
its own key. `kind` becomes the session's capability
kind, where `agent` covers local and remote subagents alike; telling them apart would mean
reading the call's child row.

### Capture model input and output

The guide logs the prompt and the response under a policy that records content only for public
conversations and in development.

Before:

```ts title="agent/instrumentation/audit.ts"
export default defineInstrumentation({
  tracePolicy: ({ audience, environment }) => ({
    emit: true,
    recordInputs: audience === "public" || environment === "development",
    recordOutputs: audience === "public" || environment === "development",
  }),
  events: {
    "model.call.started": (event) => {
      console.log("input", event.input);
    },
    "model.call.completed": (event) => {
      console.log("output", event.content);
    },
  },
});
```

After:

```ts title="agent/instrumentation/audit.ts"
export default defineInstrumentation({
  tracePolicy: ({ audience, environment }) => ({
    emit: true,
    recordInputs: audience === "public" || environment === "development",
    recordOutputs: audience === "public" || environment === "development",
  }),
  events: {
    "model.call.started": (event) => {
      console.log("input", event.input); // still a live event
    },
    "content.completed": (event) => {
      if (event.data.phase === "reply") console.log("output", event.data.value);
    },
  },
});
```

Output comes from the `content.completed` fact, as it does for hooks. No fact records the prompt
and instructions, so `model.call.started` stays. `tracePolicy` now has to strip `event.data.value`
when outputs aren't recorded, which is the content-policy work under
[What doesn't get simpler](#what-doesnt-get-simpler).

### Report who the session is waiting on

The guide has no example for this. On the stack, a provider would count open requests from
`interaction.opened` and `interaction.settled`, sending a change for each event. Those events
skip sign-ins, so the "after" filters them out too. `metrics` stands for any metrics client.

Before:

```ts title="agent/instrumentation/waiting.ts"
export default defineInstrumentation({
  events: {
    "interaction.opened": (event) => {
      metrics.increment("eve.waiting_on_person", { kind: event.kind });
    },
    "interaction.settled": (event) => {
      metrics.decrement("eve.waiting_on_person", { kind: event.kind });
    },
  },
});
```

After:

```ts title="agent/instrumentation/waiting.ts"
export default defineInstrumentation({
  select: (view) =>
    Object.values(view.interactions)
      .filter((row) => row.status === "open" && row.request.kind !== "sign-in")
      .map((row) => row.request.kind),
  run: (open, ctx) => {
    metrics.gauge("eve.waiting_on_person", open.length, { session: ctx.session.id });
  },
});
```

A counter built from deltas drifts when a provider misses an event, such as a handler that timed
out. The selection is the whole state, so each `run` sets the gauge to what the view says. Main's
`session.waiting` doesn't fill this gap: it fires whenever the session suspends, including when it
goes idle after a turn.

## What gets simpler internally

### With v27 (in the stack)

- **Events are a transform over facts.** `native-events.ts` maps each committed fact, and the
  tables after it, to provider events. PR 2 deletes the private per-call and per-request scope
  maps (157 lines of `instrumentation/state.ts`), `setAttemptScope`/`getAttemptScope` and HITL's
  `publishInputResolutions`. Model attempts are facts, so instrumentation keeps no record of them.
- **One ending per operation.** A consumer doesn't map three event names back to an outcome.
  PR 10's OTel provider ends a turn's span from `turn.settled`'s outcome, which deletes the
  stored terminal, its codec and its error serializer (about 50 lines).
- Instrumentation is −380 production lines across the stack.

### With reactions-shaped providers (proposed)

These follow from the design and haven't been measured:

- **The fact mapping mostly goes.** `instrumentationEventsOf` in `native-events.ts` (about 210
  lines, 10 fact cases) builds a payload per fact. Fact handlers would receive the fact, so only
  the live events need building.
- **`ctx.state` and its machinery go.** That's `instrumentation/state.ts` (235 lines): durable
  slots per provider and operation, kept in serialized workflow context. Also the abandon and
  release paths in `dispatch.ts`, and the slot preservation that `cancelled-model-call-batch.ts`
  calls.
- **Idempotency keys reduce to IDs eve already has.** Builders such as `actionIdempotencyKey`
  give way to `occurrence.id` and the entity's own ID.
- **Payload types for four families go.** `lifecycle.ts` defines a type for each session, turn,
  call and interaction event, each with its own scope shape. Handlers would take the fact types
  and the hook context type instead.
- **The tracing adapter stops copying lifecycle data.** Main's trace state stores each turn's
  `terminal` (`recordTerminal` in `tracing/eve/session.ts`), start time, sequence and parent
  lineage, and each call's end time. The session, turn and call rows hold all of these. The
  adapter keeps what only tracing knows: span contexts, sampling decisions, channel audience and
  principals.
- **The turn span gets a real end.** Main ends a turn's span at the next session transition,
  usually `session.waiting`. Main's channel-delivery spans read the turn's trace state until
  then. A `select` over the view, such as "this turn's deliveries are done", gives the adapter
  that moment without a waiting event.

### What doesn't get simpler

- **The live layer stays.** The AI SDK hook bridge, `runInContext` for parenting third-party spans,
  MCP spans, and memory and delivery events.
- **Content policy gets new work.** `tracePolicy` redacts fields of today's payloads. Handing
  providers facts and a view means projecting fact data and the view per provider. This is the
  proposal's main cost.
- **Direct `invokeTool` calls have no session stream.** They need a synthetic fact or their own
  event.
- **Span identity and durable recovery stay in `@eve/tracing`** and its checkpointer.

## Open questions

1. How to project the view under `tracePolicy`: a redacted copy per provider, or content-free
   rows with content only on facts.
2. Whether to record model input as facts, or keep `model.call.started` as a live event.
3. Where the turn span ends. The options are an adapter `select`, or the library recording an
   outcome without ending the turn. The library's
   [design doc](https://github.com/vercel/eve/blob/main/research/agent-tracing-library.md#open-questions)
   lists the second as an open question.
4. Whether trace backends should implement the library's `AgentTelemetry` instead of consuming
   provider events. That depends on publishing `@eve/tracing`, which is private.

## Plan

1. **Restack onto main.** Port PR 10's names into `tracing/eve/*`: about 24 references in six
   files. Delete the adapter's stored `terminal`. Decide the turn span's end with a scenario test
   that covers a delivery after `turn.settled`.
2. **Restore the tracing tests from main.** PR 2 deleted three suites (5,289 lines): the provider
   tests, the telemetry contract test and the invoke-tool parity test. Main keeps them under
   `tracing/eve/`, so port main's versions to the new names.
3. **After #4616**, a follow-up gives providers the hook context, removes `ctx.state` and moves the
   remaining live events to `started` and `settled` with an `outcome`.

Related: [`session-changes-overview.md`](./session-changes-overview.md) (the stack),
[`session-reactions.md`](./session-reactions.md) (`select`, `record`, `render` and occurrences),
and [`agent-tracing-library.md`](https://github.com/vercel/eve/blob/main/research/agent-tracing-library.md)
(on main).
