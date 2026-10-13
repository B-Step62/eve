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
- **v27 (the stack)** gives providers the stream's names for what the stream records, with each
  ending carrying its outcome. It builds the events from committed facts and the tables after
  them.
- **Reactions (#4616).** Hooks observe the session through one context:
  `(fact, { view, position, occurrence })`, plus `select` with `run` for derived state.

This doc relates the three. Its recommendation: keep provider events shaped as operations that
stand alone, and use v27's rows to fill each ending with what its start knew. Authors then need
no `ctx.state` for common cases, and most of the machinery behind it can go. Reactions shares
infrastructure with instrumentation, not its authoring shape. None of this beyond PR 10 is
implemented.

## Three vocabularies

| Layer                                     | Names                                                                 | Job                                    |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| Session facts                             | `turn.settled`, `call.requested`, `interaction.opened`, …             | What eve records; locked by the stream |
| Provider events (`defineInstrumentation`) | `turn.settled`, `model.call.started`, `channel.delivery.completed`, … | What eve tells authored providers      |
| `@eve/tracing` operations                 | turn, attempt, model call, tool, approval, memory                     | Span layout for any agent framework    |

Facts are built for folding: small, normalized records that refer to each other and rebuild state.
Telemetry wants operations: a start and an end, one key, and the name, kind and timing in the
payload. OTel spans and log pipelines work this way. So turning facts into provider events isn't
duplication. It's a projection for a different reader, and it's where `tracePolicy` decides which
content each provider receives. PR 10 makes the projection use the stream's names; this doc keeps
the projection and makes its endings complete.

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
`idempotencyKey` and a payload type per event stay. OpenTelemetry trace schema 4 and its span
names don't change.

### Proposed: endings that stand alone

Today an ending carries only what changed: `call.settled` has the outcome, output, error and
usage, but not the tool's name, kind or start time. A provider that needs them stores them in
`ctx.state` at the start. The event builder already reads the rows when it builds each ending, so
it can copy the start's fields across:

| Ending                | Adds, from the row                                 |
| --------------------- | -------------------------------------------------- |
| `call.settled`        | `toolName`, `kind`, `startedAtMs`                  |
| `interaction.settled` | `call` (as on `interaction.opened`), `startedAtMs` |
| `turn.settled`        | `sequence`, `startedAtMs`                          |
| `session.ended`       | `startedAtMs`                                      |

Where a start already has a field, the ending uses the same name: `call.requested` has `toolName`,
`kind` and `startedAtMs`, and `turn.started` has `sequence`. Content stays on the event
that produced it: inputs on the start, outputs on the ending. That keeps `tracePolicy` as it is.

Nothing else changes for authors. `idempotencyKey` stays the operation's one key, `kind` keeps
instrumentation's own values (`tool-call`, `load-skill`, `subagent-call`, `remote-agent-call`),
which tell local and remote subagents apart, and model calls stay a matched pair of live events.

## Examples from the guide

Each "before" is the example as `docs/guides/instrumentation/instrumentation.mdx` publishes it on
the stack, where it already uses PR 10's names.

### Time a tool call

Before: the start stores the name and time in `ctx.state`, and the ending reads them back.

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

After: the ending has what the start had.

```ts title="agent/instrumentation/audit.ts"
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  events: {
    "call.settled": (event) => {
      console.log({
        tool: event.toolName,
        durationMs: Date.now() - event.startedAtMs,
        outcome: event.outcome,
      });
    },
  },
});
```

In the previous code, the provider tracks state when the call starts and reaches back into it
when the call ends. In the new code, the ending already carries what the start knew, read from
the session's rows, so the provider tracks nothing itself. `startedAtMs` is when the call was
requested, so the duration still includes time spent waiting for an approval.

### Time an approval

The guide has no example for this one. It's the same pattern, and a common thing to measure.

Before:

```ts title="agent/instrumentation/approvals.ts"
export default defineInstrumentation({
  events: {
    "interaction.opened": (event, ctx) => {
      if (event.kind !== "approval") return;
      ctx.state.set({ tool: event.call?.name, openedAt: Date.now() });
    },
    "interaction.settled": (event, ctx) => {
      const opened = ctx.state.get() as { tool?: string; openedAt: number } | undefined;
      if (opened === undefined) return;
      metrics.histogram("eve.approval_ms", Date.now() - opened.openedAt, {
        tool: opened.tool,
        outcome: event.outcome,
      });
    },
  },
});
```

After:

```ts title="agent/instrumentation/approvals.ts"
export default defineInstrumentation({
  events: {
    "interaction.settled": (event) => {
      if (event.kind !== "approval") return;
      metrics.histogram("eve.approval_ms", Date.now() - event.startedAtMs, {
        tool: event.call?.name,
        outcome: event.outcome,
      });
    },
  },
});
```

`metrics` stands for any metrics client.

### Unchanged examples

- **Send a redacted audit record.** It reads `call.requested` alone, which already has the name,
  kind, input and `idempotencyKey`.
- **Capture model input and output.** `model.call.started` and `model.call.completed` already
  form a matched pair with content on each side, under the provider's `tracePolicy`.

## Considered: the hook context

An earlier draft proposed giving providers the hook context after reactions: fact handlers
receive the literal fact and `{ view, position, occurrence }`, and `select` with `run` covers
derived state. Rewriting the guide's examples that way made most of them harder to write:

| Example                | With the hook context                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time a tool call       | One handler, but it reads `event.data`, joins to `view.calls[callId]` and parses ISO times. About even                                                |
| Audit record           | Worse: two keys (`occurrence.id` and `callId`) instead of one, deeper paths, and the capability `kind` doesn't tell local and remote subagents apart  |
| Model input and output | Worse: a live start plus a `content.completed` fact filtered by `phase`, output per content part instead of per model call, and nothing links the two |
| Waiting gauge          | More code, and a per-session gauge isn't the same metric as the global count it replaced                                                              |

```ts
// The hook-context version of "time a tool call", for comparison
"call.settled": (event, { view }) => {
  const call = view.calls[event.data.callId];
  console.log({
    tool: call.capability.name,
    durationMs: Date.parse(call.endedAt!) - Date.parse(call.startedAt),
    outcome: event.data.outcome,
  });
},
```

It would also have made `tracePolicy` redact fact data and the whole view per provider, instead
of fields on events it builds. The view helps hooks because they act on where the session stands.
Instrumentation records operations, and joining facts against tables moves that work onto every
provider.

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

### With endings that stand alone (proposed)

These follow from the design and haven't been measured:

- **The builder grows a little.** `call.settled` and `interaction.settled` already read their row
  in `instrumentationEventsOf`; copying the start's fields is a few lines per ending.
- **`ctx.state` and its machinery can go,** if no provider needs it once endings are complete.
  That's `instrumentation/state.ts` (235 lines): durable slots per provider and operation, kept in
  serialized workflow context. It also covers the abandon and release paths in `dispatch.ts` and
  the slot preservation that `cancelled-model-call-batch.ts` calls. See open question 1.
- **The OTel adapter stops recording what events now carry.** On main, the adapter stores the
  turn's ending (`terminal`, via `recordTerminal` in `tracing/eve/session.ts`) until the session
  transition. `turn.settled` carries the outcome, so that state goes. The adapter keeps what only
  tracing knows: span contexts, sampling decisions, channel audience and principals.
- **The adapter can use the view where it needs derived state.** Main ends a turn's span at the
  next session transition, usually `session.waiting`, and channel-delivery spans read the turn's
  trace state until then. The adapter is framework code, so it can watch the view, for example
  for "this turn's deliveries are done", without exposing the view to authors.

### Shared with reactions

The reactions runner and instrumentation both run after each commit, over the commit's facts and
the view after it. They can share that dispatch, and instrumentation's keys can be derived the
way occurrences are, from the session and the entity's ID, instead of each family building its
own (`actionIdempotencyKey`, `inputIdempotencyKey`, …). The authored shapes stay separate: an
instrumentation handler is failure-isolated, its return value is ignored, it never cancels a turn,
and `tracePolicy` decides what content it gets.

### What doesn't get simpler

- **The live layer stays.** The AI SDK hook bridge, `runInContext` for parenting third-party spans,
  MCP spans, and memory and delivery events.
- **Direct `invokeTool` calls have no session stream,** so the publisher still builds their call
  events itself.
- **Span identity and durable recovery stay in `@eve/tracing`** and its checkpointer.

## Open questions

1. Whether any provider needs `ctx.state` once endings are complete. A provider that creates a
   value at the start, such as an ID returned by its backend, still has to carry it to the
   ending. Rows can't supply that. If such providers can derive the value from `idempotencyKey`
   instead, `ctx.state` can go; otherwise it stays, used less.
2. Where the turn span ends. The options are the adapter watching the view, or the library
   recording an outcome without ending the turn. The library's
   [design doc](https://github.com/vercel/eve/blob/main/research/agent-tracing-library.md#open-questions)
   lists the second as an open question.
3. Whether the live families should share one convention: `started`, then `settled` with an
   `outcome`. A channel delivery's ending already carries `outcome`, so its three ending names
   repeat that field.
4. Whether trace backends should implement the library's `AgentTelemetry` instead of consuming
   provider events. That depends on publishing `@eve/tracing`, which is private.

## Plan

1. **Restack onto main.** Port PR 10's names into `tracing/eve/*`: about 24 references in six
   files. Delete the adapter's stored `terminal`. Decide the turn span's end with a scenario test
   that covers a delivery after `turn.settled`.
2. **Restore the tracing tests from main.** PR 2 deleted three suites (5,289 lines): the provider
   tests, the telemetry contract test and the invoke-tool parity test. Main keeps them under
   `tracing/eve/`, so port main's versions to the new names.
3. **Complete the endings** in a small follow-up: copy the start's fields onto each ending, update
   the guide's timing example, and answer open question 1 before removing `ctx.state`. This
   doesn't depend on reactions, and it should land before 1.0 locks provider events.

Related: [`session-changes-overview.md`](./session-changes-overview.md) (the stack),
[`session-reactions.md`](./session-reactions.md) (`select`, `record`, `render` and occurrences),
and [`agent-tracing-library.md`](https://github.com/vercel/eve/blob/main/research/agent-tracing-library.md)
(on main).
