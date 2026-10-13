---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-13"
---

# Instrumentation on the session stack

This doc covers how the stack's instrumentation changes meet main's new tracing library, and
whether reactions should change the provider API. The short answers: porting the stack onto the
library is a small, mostly mechanical job with one real decision, and the provider API should stay
as the stack leaves it.

## What the stack changes

PR 10 gives providers the stream's names for the four families the stream records, and each
operation ends with one event that carries the fact's outcome:

| Main                                              | Stack                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `session.completed`, `session.failed`             | `session.ended` with `outcome` `completed` or `failed`             |
| `session.waiting`                                 | Removed. v27 has no waiting event                                  |
| `turn.completed`, `turn.cancelled`, `turn.failed` | `turn.settled` with `outcome` `completed`, `cancelled` or `failed` |
| `tool.call.started`, `completed`, `failed`        | `call.requested`, `call.settled` with a `CallOutcome`              |
| `input.requested`, `input.resolved`               | `interaction.opened`, `interaction.settled` with its outcome       |

Step attempt, model call, memory and channel delivery events, `ctx.state` and `idempotencyKey`
don't change, and neither do OpenTelemetry trace schema 4 and its span names.

Internally, instrumentation is −380 production lines across the stack:

- `native-events.ts` builds provider events from each committed fact and the tables after it.
  PR 2 deletes the private per-call and per-request scope maps (157 lines of
  `instrumentation/state.ts`), `setAttemptScope`/`getAttemptScope` and HITL's
  `publishInputResolutions`. Model attempts are facts, so instrumentation keeps no record of them.
- A consumer no longer maps three event names back to an outcome. PR 10's OTel provider ends a
  turn's span from `turn.settled`'s outcome, which deletes the stored terminal, its codec and its
  error serializer (about 50 lines).

## Meeting main's tracing library

Main moved span layout, capture and durable recovery into `@eve/tracing` (#4160, #4164). eve's
adapter, `tracing/eve/*`, turns provider events into library operations. Main left the provider
API alone, so the overlap with the stack is the adapter:

1. **Port the names.** About 24 references to the old names in six `tracing/eve/*` files. The
   adapter's stored turn `terminal` (`recordTerminal` in `tracing/eve/session.ts`) goes, because
   `turn.settled` carries the outcome.
2. **Decide when a turn's span ends.** Main ends it at the next session transition, usually
   `session.waiting`, and channel-delivery spans read the turn's trace state until then. The stack
   ends it at `turn.settled`, which may orphan a delivery traced after the turn settles. The
   adapter is framework code, so it can read the view to find the right moment, such as "this
   turn's deliveries are done". The alternative is for the library to record an outcome without
   ending the turn, which its
   [design doc](https://github.com/vercel/eve/blob/main/research/agent-tracing-library.md#open-questions)
   lists as an open question. A scenario test with a delivery after `turn.settled` should decide.
3. **Restore the tracing tests from main.** PR 2 deleted three suites (5,289 lines): the provider
   tests, the telemetry contract test and the invoke-tool parity test. Main keeps them under
   `tracing/eve/`, so port main's versions to the new names.

## Providers keep operation-shaped events

An earlier draft proposed giving providers the hook context after reactions: the literal fact,
`{ view, position, occurrence }`, and `select` with `run`. Rewriting the guide's examples that way
made most of them harder. The audit record needed two keys instead of one, model input and output
no longer lined up, and a tool's timing meant joining `event.data` to `view.calls`. It would also
have made `tracePolicy` redact the whole view per provider.

Facts are built for folding: small records that refer to each other. Telemetry wants operations
that stand alone, with a start, an end, one key and the name and timing in the payload. Building
provider events from facts is a projection for that reader, not duplication. Reactions and
instrumentation can share infrastructure, since both run after each commit, but not an authoring
shape.

One small addition follows from the rows: an ending can carry what its start knew. With
`toolName`, `kind` and `startedAtMs` on `call.settled`, the guide's timing example drops its
`ctx.state` and becomes one handler:

```ts title="agent/instrumentation/audit.ts"
"call.settled": (event) => {
  console.log({
    tool: event.toolName,
    durationMs: Date.now() - event.startedAtMs,
    outcome: event.outcome,
  });
},
```

The event builder already reads the call row when it builds the ending, so this is a few lines.
The fields are optional additions, so they can land any time. `ctx.state` stays for providers
that carry values of their own, such as an ID their backend returned at the start.

Related: [`session-changes-overview.md`](./session-changes-overview.md) (the stack) and
[`session-reactions.md`](./session-reactions.md) (reactions).
