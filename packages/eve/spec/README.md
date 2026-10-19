# The session scheduler, checked

An eve session's scheduler decides what each step takes and when the session waits. It's pure
(`src/execution/session/scheduler/`): `on(state, event)` takes in what happened, and
`next(state, session)` decides what the session does next, until it asks for something only the
world can finish, such as a step or a read of the inbox. The session loop (`session-loop.ts`)
performs what it asks and hands back what came of it.

Two checks hold it to its promises, and they lean on each other:

| Check                                                           | What it runs                                      | What it shows                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The scheduler checker (`scheduler/checked.integration.test.ts`) | production's `next` and `on`, and a small world   | every promise holds in every state the scheduler reaches within its bounds, across its features     |
| The explorer (`explored-sessions.integration.test.ts`)          | production's scheduler with the real harness step | the session's promises hold on every path, and the real step keeps the contract the checker assumes |

```
  scheduler checker                                  explorer
  production next/on + a world that keeps            production next/on + the real harness step
  the step's contract (microseconds a move)          (milliseconds a move)
            |                                                  |
            | every promise, in every state                    | every real step keeps the contract
            | within its bounds                                | the checker's world assumes
            v                                                  v
  scheduler-mutants.mjs: each bug put back into     scheduler-compare.mjs: what two versions of
  production, one at a time, is found               the scheduler observe, compared case by case
```

## What it describes

A session holds what the world sends, in arrival order. Between turns it starts the next one from
what it holds. While a turn runs, the turn's own person steers it; anyone may answer what it asks,
but someone else's message waits for the turn to end; and a cancel stops it. The scheduler decides
all of that: which delivery a step takes, when the session waits, and what a cancel stops. Each
delivery it holds goes first, once, to the children whose questions it answers.

A step is one model call and everything the session's machine decides around it. The checker
doesn't describe how a step decides; it states the step's contract: a step puts every delivery it
takes on the stream; an answer leaves what it answers awaiting nothing more, unless a response
policy weighs it in the next step or its responder may not give it; the turn's own message steers
past everything the turn asked; and a clear ends the open turn. The explorer checks the real step
keeps that contract.

## The scheduler checker

`src/internal/testing/scheduler-checker.ts` explores the scheduler breadth first, with nothing but
itself: no harness, no model call, so a transition takes microseconds. The world keeps what the
session's durable state would say, and answers each request the way the step and the durable steps
do: it picks a step's result, what arrives beside it, what arrives while the session waits, how a
route, a response policy, or a hand-off comes out. What resolves something open (an answer, a
sign-in's callback, a run's result, a task's end) is always possible; anything new costs one of a
bounded number of sends, so every path ends.

Its nine cases each add one part of the world to a core of Alice and Bob writing and answering
while turns ask, call, and wait: controls, sign-ins, tasks and their waits, children, delegated
callers and queued messages, budgets, hand-offs and the session ending, and answers a response
policy weighs or refuses. Together they reach about 780,000 states in under a minute.
`EVE_CHECK_SCHEDULER_WIDEN=1` raises every bound.

In every state it reaches, it checks:

| Promise                                       | What it says                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| holds each delivery once, and never one ended | the session never ends a delivery it still holds, so whatever takes it later can                                                                  |
| takes only what it lets go                    | a step never takes a delivery the session still holds                                                                                             |
| routes before it takes                        | a step takes a child's answer only once the session offered it to the child                                                                       |
| shows what it holds                           | while the session waits, its stream shows every delivery and control it holds                                                                     |
| only its person steers                        | once a turn runs, anyone else brings it only answers                                                                                              |
| sleeps on nothing                             | a waiting turn never sleeps on an answer, its own person's message, sign-ins that all called back, calls that all reported, or tasks that settled |
| waits on what's open                          | a turn waits on people only for what they can still answer                                                                                        |
| resumes on every sign-in                      | a turn that waits on sign-ins resumes once every one called back, and takes each callback once                                                    |
| times only its task waits                     | the session races the inbox only against timers of `eve__task_wait` calls still waiting                                                           |
| leaves nothing open                           | between turns, everything the world sent has settled, unless a budget prompt holds the turn                                                       |
| tells its caller once                         | a delegated caller hears once how each turn ended                                                                                                 |
| signals as it decides                         | a cancel the inbox's pump signals at once stops the turn at its boundary, and nothing else does                                                   |
| never throws, always asks                     | the scheduler never throws, and never decides without end                                                                                         |
| gets quiet                                    | from every state it reaches, the session can still get to waiting between turns, or end                                                           |

**`pnpm spec:scheduler-mutants`** puts twelve bugs into production's scheduler, one at a time, and
checks the checker finds each; a check no mutant breaks would prove nothing.

**`pnpm spec:scheduler-compare`** compares what two versions of the scheduler observe. With
`EVE_CHECK_SCHEDULER_OBSERVE=<prefix>`, the checker writes, for each case, every state of the world
wherever it moves (a step, a wait, the end, a failure) with what the scheduler asks of it, and the
shortest trail to each. A refactor that keeps the scheduler's behavior observes the same, whatever
state each version keeps; one that doesn't prints the shortest trails to where they first differ.

## The explorer

`src/internal/testing/session-explorer.ts` runs the real harness step under the production
scheduler, in process, with Alice and Bob, mock `reply`, `lookup`, `deploy`, `build`, and `release`
tools, typed and batched answers, and optionally controls and arrivals during steps. At each step it
checks the step contract the checker assumes, the step's decision against what the tables say, and
the stream's properties; its closed graph checks every state can still get quiet. It covers
approvals, batches, typed answers, response policies, refusals, and controls, but no sign-ins,
tasks, children, delegated callers, budgets, or hand-offs: the checker covers those, on the
contract.

## What it proves, and what it doesn't

The checker proves its promises about production's scheduler for every state within its bounds,
not for any number of people, deliveries, or steps, and only for the world it models. Its contracts
for the step and the durable steps are assumptions; the explorer checks the step's contract for the
real step, within the explorer's bounds and world. Where the explorer can't reach, the contract is
read from the code: a message sent while a budget prompt is open is one such case.

Neither check covers the session loop's effects (signals, timers, and the durable steps it calls),
nor replay, retries, or crashes, nor bursts of arrivals beyond what arrives during one step; the
loop's unit and integration tests cover the effects.

The checker leaves two things out on purpose, each an open decision rather than a bug this change
fixes: a prewarmed session drops a clear or compact that comes before its first message, and a
cancel that stops a clear's or a compact's step leaves that control unsettled.

## What writing it found

Each of these was a real behavior, found while building the checks, and is now fixed, recorded as
a mutant, or recorded as an open decision:

- Someone else's delivery that both answered the turn and carried a message was split, but both
  halves kept one delivery id. Found when the explorer sent an answer with a message.
- A cancel or clear left input the turn had queued but not read open, and handed it to the next
  turn. Found by the explorer's closed graph.
- A message from the turn's own person, sent with an answer a response policy weighed, lost its
  steering while the policy decided. Found by writing the steering promise down as a property.
- A cancel that arrived while a turn waited on its calls stopped the turn without becoming its
  cause. The pure scheduler reads the inbox in order, so the turn stops on the cancel itself.
- A delivery was routed to the session's children twice: once while the turn waited, and again
  when steering took it. The scheduler now routes each held delivery once, in arrival order.
  Found by comparing what the old and new scheduler observe.
- The checker's world let a child take any delivery, let anyone's answer close what it answered,
  and had no response policies. The explorer's contract check found the last two against the real
  step; routing every delivery once exposed the first as a path that never ended.
- A cancel during a clear's or a compact's step leaves the control unsettled. Found once the
  checker's controls case allowed three sends; recorded as an open decision.
- The explorer merged states that differed in what the session had written but no longer
  retained. Found by comparing every observable state the old and new scheduler reach.

## Changing the scheduler

Change the scheduler, then run the checker; a finding prints the path that reaches it. A bug the
change fixes belongs in `scheduler-mutants.mjs`, with the case that reaches it. For a refactor,
record what the checker observes before and after, and compare them with
`pnpm spec:scheduler-compare`: any difference should be one the change means to make. A change to
what the checker's world assumes of a step belongs in the explorer's contract check too.
