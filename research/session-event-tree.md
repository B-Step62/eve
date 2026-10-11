---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-11"
---

# Session events as one tree

v27 gave every concept a lifecycle: it's introduced, maybe updated, and closed. This doc is about the structure those lifecycles already share, and what changes when the code uses it. It follows [`session-event-lifecycle.md`](./session-event-lifecycle.md) and [`session-core-target.md`](./session-core-target.md). The prototype is `proto/event-tree`, on `proto/harness-core`.

## Summary

- **The v27 entities form one ownership tree, but nothing in the code says so.** Each family names its owner its own way (`owner`, `subject`, `interactionId`, `turnId`, `runId`), and the selectors, the closer, retention, the stream checker, and 86 hand-built scopes each re-derived "what's above this?" family by family. They disagreed: the checker's idea of what a turn holds differed from the closer's.
- **One rule replaces those walks.** `parentOf` states each family's owner once. Selectors, retention, closure, scopes, and the checker read it.
- **An owner's end closes what it holds, structurally.** The writer appends the closing facts in the same commit, leaves first. Transitions emit only the owner's own end.
- **The fold is table-driven.** Lifecycle facts fold by their catalog role; only what a fact changes beyond its own row is code.
- **The wire barely changes.** The rules below are mostly what v27 already meant. Prototyping them changed two outcomes, both toward the rules.
- **Measured:** about 280 production lines removed on top of `proto/harness-core`, with more available. Behavior is checked by the unit suite and the HITL, workflow, task, subagent, and cancellation fixtures ([Status](#status)).

## The rules

These are what 1.0 should promise. They describe the stream, so readers can rely on them, and the code follows them by construction.

1. **Every entity has at most one owner,** named by the fact that introduces it:

   | Entity         | Owner                                                                                                                                                                  |
   | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | turn, task     | the session                                                                                                                                                            |
   | model run      | its turn or context change (`owner`)                                                                                                                                   |
   | call           | the run that made it while the run streams; once the run completes, the run's owner; the task serving it once `call.started` names one; or the call it was made inside |
   | interaction    | what it's about (`subject`): a call, turn, task, or response                                                                                                           |
   | response       | its interaction                                                                                                                                                        |
   | context change | its turn, or the session                                                                                                                                               |
   | delivery       | the session, until a turn consumes it                                                                                                                                  |
   | child session  | the call or task that opened it                                                                                                                                        |

   Ownership changes only by a fact that says so (`call.started {taskId}`, `delivery.consumed {turnId}`), and when a run completes, which hands the calls it made on to its owner.

2. **An owner's end closes everything still open under it, in the same commit, leaves first.** Each family has one outcome for "its owner was cut" and one for "its owner was superseded by a retry":

   | Family      | Owner cut                                                 | Owner superseded |
   | ----------- | --------------------------------------------------------- | ---------------- |
   | call        | `interrupted`                                             | `abandoned`      |
   | model run   | `interrupted`                                             | `abandoned`      |
   | interaction | `interrupted`                                             | `abandoned`      |
   | response    | `withdrawn`                                               | `abandoned`      |
   | task        | `cancelled`                                               | `cancelled`      |
   | change      | `interrupted`                                             | `interrupted`    |
   | delivery    | `handled`, after its turn; `failed` when the session ends |                  |

   What the commit closes explicitly keeps its own outcome: `withdrawn` stays for a question its asker or steering took back.

3. **A fact's `scope` is its owners from the tree:** the turn, task, run, and change at or above the entity it's about. A call also names the run that made it, and that run's turn.

4. **The writer applies rules 2 and 3.** No producer builds closing facts or scopes itself.

### What the prototype changed on the wire

- **Work under a failed turn is `interrupted`, not `failed`.** Only what failed fails; v27 failed the turn's runs and context changes with it.
- **A question about a call closes when the call ends.** A cancelled `serve()` stretch's question used to stay open until the run withdrew it, which the waiting selector had to special-case. It now settles with the stretch, as `interrupted`. Before, the same cut read `withdrawn` when the model cancelled the task and `interrupted` when a person cancelled the turn; the tree can't tell those apart, and one outcome for "its owner was cut" is the simpler promise ([Open questions](#open-questions)).

Reasons on closing facts (`turn-ended`, `session-ended`, `model-call-retried`, `steered`, `task-ended`, `context-change-failed`) are unchanged.

## What the code looks like

| Piece         | Before                                                                                                      | After                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Ownership** | `callTurn`, `callRun`, `callTask`, `runTurn`, `interactionOwner`, `openWork`, each a walk                   | `tree.ts`: `parentOf`, `ancestors`, `ownerOf`, `openUnder`, `scopeOf`; the selectors are one-liners over it              |
| **Closure**   | `closure.ts`: an outcome matrix per way an owner ends, and a closer per family, called from each transition | `cascade.ts`: one pass where transitions are applied and again in the publisher; `closure.ts` deleted                    |
| **Retention** | Five hand-written pinners                                                                                   | Pin each open entity's owners, and a call's run                                                                          |
| **Checker**   | Its own entity map, seeding, and ownership rules: a second fold                                             | Folds into a copy of the shared view; one rule per lifecycle role, references checked generically, closure from the tree |
| **Fold**      | 30 hand-written cases                                                                                       | One table of lifecycle facts folded by role, and a short switch for what a fact changes beyond its row                   |

Provenance stays separate from ownership: which run made a call (and so which turn it's attributed to) doesn't change when a task serves it. `callTurn` and `callRun` keep reading that.

## Status

`proto/event-tree`, measured against `proto/harness-core`, production code: **+821 / −1,107 (−286)** across 11 files.

| File                                       | Change        |
| ------------------------------------------ | ------------- |
| `protocol/session-projection/tree.ts`      | +217, new     |
| `harness/session-machine/cascade.ts`       | +207, new     |
| `harness/session-machine/closure.ts`       | −249, deleted |
| `protocol/session-events/checker.ts`       | 521 → 318     |
| `protocol/session-projection/fold.ts`      | 712 → 559     |
| `protocol/session-projection/selectors.ts` | about −80     |
| `harness/session-machine/transitions.ts`   | about −70     |

- **Unit suite:** passes, with new tests for the cascade.
- **Fixtures (mock model):** `agent-tools-hitl` 69 of 69, `agent-subagents-hitl` 8 of 8, `agent-subagents` 16 of 16, `agent-cancellation` 9 of 9, `agent-workflow-tools` 33 of 34 (`webhook-deploy` fails on the base too). One eval changed: `sign-off-plan.cancel` reads `interrupted` for its question. The full mock matrix, 30 fixtures, matches #4616 fixture by fixture.
- **Not done:** removing the 86 hand-built scopes now that the writer stamps them (it overrides them, and the suite agrees with every one; about 100–150 lines), and the relay unification below.

## One taxonomy, inside and out

v27 changed the wire, not the model. Both sides kept the v26 one: the engine built
`InputRequest`s and converted them to facts, and readers folded the facts and converted rows back
into `InputRequest`s, so a question made the round trip `InputRequest` → `interaction.opened` →
row → `InputRequest`. That, not lifecycle closing, is where v27's added code went.

`proto/one-taxonomy` makes the interaction family the model everywhere, for interactions and
sign-ins:

- **The engine builds interaction requests** and keeps interaction ids; an approval stores its
  call (`callId`, `toolName`, `input`), and the budget prompt asks about its turn rather than a
  made-up tool call.
- **An answer is `{ interactionId, optionId?, text? }`**: a response's value and the interaction
  it answers, from client to channel to engine.
- **Readers read rows:** `askedInteraction` (the request's own fields, its id, and the call it asks
  about), `readerRequest` (where, how it stands, the deciding answer), and outcomes as
  `InteractionOutcome`, sign-ins included.
- **A child relays its own interaction facts** in one payload kind: the requests one commit
  opened, together, or one other fact. It decides all of them; the serving session mirrors them,
  and its route back is routing only.

Measured: production **+1,704 / −2,708 (−1,004)**, tests −1,324. Two things only evals found:

- **A child's commit must relay as one commit.** Relaying fact by fact asked a child's two
  approvals in two parent commits, so the person saw two pauses for one question set.
- **Open strings hide stale comparisons.** `InteractionRequest.kind` is open, so a leftover
  `=== "tool-approval"` compiles and never matches; every one had to be found by search.

Calls (`RuntimeActionRequest`/`Result` ↔ call facts) and user parts are the next families with
converters both ways. Instrumentation is a third public vocabulary over the same events.

## Still on the table

- **A shared owner field on the wire.** Every introducing fact could name its owner as `owner`. It would let a generic reader draw the tree without family knowledge, but rule 1's ownership changes still need code, so the gain is small. Not recommended unless external tooling needs it.
- **A shared outcome core.** Rule 2's table could become uniform if every family had `interrupted` and `abandoned`. It's one small table today, so not worth churning the vocabulary.

## Open questions

1. **`interrupted` or `withdrawn` for a question whose owner was cut?** The prototype uses `interrupted` everywhere. Keeping both would make a cascaded outcome depend on why the owner's owner ended.
