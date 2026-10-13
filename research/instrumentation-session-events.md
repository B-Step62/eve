---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-13"
---

# Reviewing the instrumentation changes

This guide is for reviewing the instrumentation changes in stack #4696. Two PRs carry nearly all
of them: PR 2 rebuilds provider events from committed facts, and PR 10 gives providers the
stream's names. Together they are −380 production lines in `instrumentation/` and `tracing/`. The
guide lists where the changes are, what to check in each, the issues found in review and how they
were resolved, and how to verify.

## Where the changes are

| PR                                                    | Instrumentation changes                                                        | Production lines |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------: |
| #4549                                                 | `invoke-tool-parity.integration.test.ts` follows the one executor (tests only) |                0 |
| 2 · [#4567](https://github.com/vercel/eve/pull/4567)  | Provider events built from committed facts; private scope maps deleted         |             −245 |
| 3 · [#4574](https://github.com/vercel/eve/pull/4574)  | The instrumentation guide follows v27 (`docs/guides/instrumentation/`)         |        docs only |
| 9 · [#4694](https://github.com/vercel/eve/pull/4694)  | One retention test follows the running-work record (tests only)                |                0 |
| 10 · [#4695](https://github.com/vercel/eve/pull/4695) | The stream's names, one ending per operation, the OTel provider's turn endings |             −135 |

Production lines exclude tests. PR 2 also changes the call sites that feed instrumentation,
mainly `execution/publish-session-events.ts` and `harness/tool-loop.ts`.

## PR 2: events from committed facts

On main, instrumentation rebuilt each operation from v26 events and kept private maps to know
which attempt a call or request belonged to. On the stack, `createInstrumentationHandleEvent`
(`instrumentation/native-events.ts`) wraps the publisher. After each line is written, it maps
every committed fact, with the session's tables after that line, to provider events.

What's deleted:

- The per-call and per-request scope maps: 157 lines of `instrumentation/state.ts`. The file
  keeps only the durable `ctx.state` slots.
- `setAttemptScope`/`getAttemptScope`, which `tool-loop.ts`, `model-call/run.ts`,
  `model-call/call.ts` and `hitl/intake.ts` called to tell instrumentation which attempt was
  running.
- HITL's `publishInputResolutions`. Interaction endings now come from `interaction.settled`.
- 49 lines of `dispatch.ts` and 66 of `runtime.ts` that served the maps.

What to check:

- **One event per fact, after the line is written.** Events derive from the fact and the tables;
  nothing is published from inside a step.
- **What an ending closes is heard too.** When a line holds an ending, the transform recomputes
  the writer's cascade (`cascade(before, published)`) so a turn's end also produces `call.settled`
  with `interrupted` for its open calls. Check that this matches the line the writer commits. One
  test covers it ("hears what a turn's end closes with it, as the writer commits it").
- **Attempt scope comes from the run row.** A call's or request's attempt is its run's current
  attempt (`runAttempt`, `callRun`). A replacement run continues the attempt count of the run a
  retry gave up.
- **Sign-ins produce no interaction events.** `interactionAttempt` skips `kind: "sign-in"`;
  main's input events had no sign-in kind either.
- **Request kinds are the interaction's.** `kind` on interaction events is `question`, `approval`
  or `budget`, where main's input events had `question`, `tool-approval` and `session-limit`.
  The instrumentation guide's upgrade table lists the rename.
- **Agent calls are deferred.** `call.requested` for an agent call sets `isWorkflowTool`, because
  the child session reports its own start.
- **Remote agents.** PR 2 reports a remote agent's call as a subagent call. PR 10 fixes it; see
  [Issues found in review](#issues-found-in-review).

## PR 10: the stream's names

The four families the stream records take the stream's names, and each operation ends with one
event that carries the fact's outcome:

| Main                                              | Stack                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `session.completed`, `session.failed`             | `session.ended` with `outcome` `completed` or `failed`             |
| `session.waiting`                                 | Removed. v27 has no waiting event                                  |
| `turn.completed`, `turn.cancelled`, `turn.failed` | `turn.settled` with `outcome` `completed`, `cancelled` or `failed` |
| `tool.call.started`, `completed`, `failed`        | `call.requested`, `call.settled` with a `CallOutcome`              |
| `input.requested`, `input.resolved`               | `interaction.opened`, `interaction.settled` with its outcome       |

Step attempt, model call, memory and channel delivery events keep their names, as do `ctx.state`
and `idempotencyKey`. OpenTelemetry trace schema 4 and its span names don't change. A direct
`invokeTool` emits the same `call.requested`/`call.settled` pair (`tracing/invoke-tool-span.ts`).

Where the change lands:

- **Types.** `lifecycle.ts` replaces the per-ending event types with one ending type per family;
  `InstrumentationSessionOutcome` and `InstrumentationTurnOutcome` are the stream's own
  `SessionOutcome` and `TurnOutcome`. `provider.ts` re-exports the new names.
- **Dispatch.** `dispatch.ts` releases a provider's `ctx.state` on the new endings, and on
  `session.ended` and `turn.settled` for state a missing ending would leave behind.
- **Content.** `content.ts` projects `answer`, `request`, `input` and `output` on the new names
  under each provider's `tracePolicy`. Without outputs, `call.settled` now drops `output` and
  `error` entirely, where main's `tool.call.completed` kept the output's `type`.
- **OTel provider.** `tracing/agent-otel-provider.ts` ends a turn's span at `turn.settled`, with
  its outcome, or at `session.ended` for a turn the session's end left open. The stored terminal,
  its codec and its error serializer go (about 50 lines); an older stored terminal is ignored when
  read. Tool and approval spans read `call.*` and `interaction.*`
  (`agent-tool-instrumentation.ts`, `agent-approval-instrumentation.ts`).
- **Remote agents.** A call's capability has `remote: true` when another deployment serves the
  agent (`harness/call-facts.ts`, `protocol/session-events/families/call.ts`), and
  `native-events.ts` reports such a call as `remote-agent-call`. The hook, channel, schedule and
  tool contract reports are regenerated for the field.
- **Docs and changeset.** The guide's event table, upgrade table and examples use the new names;
  `.changeset/instrumentation-vocabulary.md` is a `minor` note.

What to check:

- **When a turn's span ends.** Main ends it at the next session transition, usually
  `session.waiting`, and deletes the turn's trace state then. The stack ends it, and deletes that
  state, at `turn.settled`. The turn's channel delivery still reaches the span: its ending comes
  from the same `turn.settled` fact and is published first, which a test pins.
- **Old names fail quietly.** A provider keyed on a removed name gets a type error, but at runtime
  its handler never fires. A hook keyed on a removed v26 event fails at load and names the
  replacement; instrumentation has no such check.

## Issues found in review

Writing this guide turned up four issues. PR 10's last commit addresses them.

1. **Remote agent calls were reported as local subagent calls (PR 2). Fixed.** A call's
   capability kind is `agent` for both, so `native-events.ts` reported every agent call as
   `subagent-call`, and remote agent spans lost their `CLIENT` kind and `agent.action.kind`. The v26
   stream had carried the distinction. The capability now has `remote: true` for a remote agent,
   and instrumentation maps it back. Tests in `harness/call-facts.test.ts` and
   `instrumentation/native-events.test.ts` fail without the fix.
2. **A delivery after `turn.settled` (PR 10). Not a bug.** Channel-delivery tracing copies the
   delivery's metadata onto the turn's trace state, which the turn span reads when it ends. The
   delivery's ending comes from the same `turn.settled` fact and is published before it, so the
   state still exists. A test in `native-events.test.ts` now pins that order.
3. **Gaps in the upgrade docs (PR 3, PR 10). Fixed.** `docs/concepts/upgrade-to-v27-events.md`
   no longer says instrumentation's event types stay, the instrumentation guide's upgrade table
   lists the request kind rename (`tool-approval` → `approval`, `session-limit` → `budget`), and
   the comment in `instrumentation/state.ts` names `call.requested` and `call.settled`.
4. **Deleted coverage (PR 2). Partly addressed.** Three tracing suites are gone, 5,289 lines: the
   provider tests (`agent-otel-provider.test.ts`), the telemetry contract test and the invoke-tool
   parity test. PR 2 adds `agent-approval-instrumentation.test.ts`, and PR 10 adds tests for remote
   agent calls and delivery order. The three suites test the adapter main has since moved, so the
   restack restores them from main's copies.

## How to verify

From `packages/eve`, after `pnpm run build:compiled`:

```sh
npx vitest run --config vitest.unit.config.ts src/instrumentation src/tracing
npx vitest run --config vitest.integration.config.ts src/tracing src/instrumentation
npx vitest run --config vitest.scenario.config.ts src/tracing
```

At PR 10's head, after the fixes, the full unit suite, 17 tracing and instrumentation integration
tests and 16 tracing scenarios pass, as do the typecheck and the contract, guard and docs checks.
Earlier in review, span trees were compared with the previous build for five mock evals.

## Main's tracing library

After the stack's base, main moved span layout, capture and durable recovery into `@eve/tracing`
(#4160, #4164) and moved eve's adapter to `tracing/eve/*`. Main didn't change the provider API, so
the stack conflicts only in the adapter. The restack ports about 24 references to the old names
in six `tracing/eve/*` files, drops the adapter's stored turn ending, and can restore the three
deleted suites from main's copies.
