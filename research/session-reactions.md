---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-11"
---

# Session reactions and dynamic values

This doc covers everything that changes during an eve session: the model, tools, skills, instructions, connections, subagents, and what hooks do in response. It proposes a common model underneath them: **durable reactions**. Dynamic values describe what the session should have; hooks describe what should happen. They share an execution model without needing identical authoring APIs.

The broader idea is simple: **the session has a durable history, reactions make decisions from it, and work produces new observations that become part of that history.** Model calls and tasks could eventually fit this model too, but adopting it for dynamic values and hooks does not require rebuilding the whole runtime.

**Status.** [#4616](https://github.com/vercel/eve/pull/4616), on the v27 stack, prototypes recorded dynamic values and removes the closure transforms. This doc describes the proposed direction, not everything the prototype already does. In particular, the hook `run` API, message-insertion command, failure behavior, and execution boundaries below revise the prototype's design. Examples are proposed authoring shapes unless labelled `main`.

## Summary

- **On `main`, dynamism is implemented as handlers on three lifecycle events.** Each kind has its own allowed events, replacement rules, and failure behavior. Tools survive cold starts through a compiler pass that snapshots what their callbacks capture.
- **A reaction observes relevant state, evaluates when needed, and records an outcome.** A new evaluation has its own identity, so eve can distinguish retrying work from doing it again for a new occurrence.
- **Dynamic values use `select`, `record`, and `render`.**
  - `select` says what the value depends on: the current turn, the caller's role, or whether the conversation contains an image. It is a cheap, synchronous function that returns JSON. Named lifetimes (`once`, `perTurn`, `perStep`) cover common cases.
  - `record` handles fetching or non-deterministic computation: query a database for this tenant's tools, ask a router which model to use, or choose a random value. It returns JSON that eve keeps. It runs when a new evaluation is needed, not just because a process restarted.
  - `render` turns that data into a live definition, such as a tool, skill, connection, or model. Without `record`, it receives the selection directly. It is synchronous and deterministic, so a fresh process can reconstruct the same capability without fetching its configuration again.
- **Hooks use `select` and `run`, or an event handler.** They perform effects or return commands such as `cancel()` and `compact()`. They share the reaction lifecycle, but do not need a rendering step.
- **Unhandled errors fail the turn.** Nothing silently drops a required instruction or a failed credential check. Optional behavior is expressed in ordinary code, not a separate framework failure policy.
- **Unify the machinery, not every surface.** Selection, evaluation identity, recorded outcomes, and recovery belong underneath both APIs. A public universal reaction API, a separate guard API, and rewriting model calls or tasks are not part of the initial change.

## Why change

On `main`, an author chooses when a dynamic value runs by naming a lifecycle event:

```ts
// agent/skills/team_playbook.ts (main)
export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const team = ctx.session.auth.current?.attributes.team;
      return team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null;
    },
  },
});
```

This keeps the first caller's playbook for the whole session. Following the current caller means choosing another event and knowing whether that kind supports it. Tools and models can update per step; skills, instructions, connections, and subagents have narrower lifecycle choices. Steering and completed sign-ins introduce more timing rules.

Cold starts add another set of rules. A tool's callback may close over data fetched by its handler, but a closure cannot be stored as JSON. eve transforms the callback, snapshots its captures, and later rebinds its code. Authors have to know which JavaScript the transform understands, which captures are serializable, and when a package needs durable callback or schema wrappers.

Reactions replace these two sources of complexity:

| Today                                                  | Proposed                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Choose an event and learn each kind's precedence rules | Select the state the value depends on                        |
| Persist captured variables through compiler transforms | Explicitly record data, then reconstruct ordinary JavaScript |
| Re-run handlers to recover executable code             | Render from an already committed record                      |
| Hooks observe, with a special cancellation callback    | Hooks handle occurrences and return session commands         |
| Different failure behavior for different kinds         | An unhandled error fails the owning execution                |

The goal is not just less framework code. It is a persistence boundary authors can see and a lifecycle they can explain.

## The common model

A **reaction** observes session state, performs an evaluation when relevant input changes, and commits an outcome.

The session view comes from the facts eve has recorded: turns, model runs, calls, tasks, interactions, and context changes. Reactions also receive the identity and execution context they need. External answers, such as database results or router choices, become durable records rather than hidden inputs that are fetched again on recovery.

```text
session history → session view → reaction → recorded outcome
       ↑                                      │
       │                         ┌────────────┴────────────┐
       │                         ▼                         ▼
       │                 capability to hold         command to apply
       │                         │                         │
       └──────── observations from subsequent work ───────┘
```

There are two kinds of contribution:

- **Something to hold:** these tools are available, this model is selected, these instructions apply. A new value replaces the previous one.
- **Something to do:** cancel this turn, compact the context, append this message. It belongs to an occurrence, not to a standing configuration value.

We use the same language for both:

| Term                | Meaning                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| **Selection**       | The relevant input that determines whether evaluation is needed                 |
| **Evaluation**      | One logical execution of a reaction, possibly with several retry attempts       |
| **Record**          | The durable outcome eve keeps                                                   |
| **Contribution**    | The capability or command the outcome supplies to the session                   |
| **Materialization** | Reconstructing a live object, such as a tool with callbacks, from recorded data |

`record` and a hook's `run` both participate in evaluation. `render` is materialization: it constructs a live value, not a new external action.

This is a conceptual model of durable history, not a requirement to put every private record on the public event stream. Capability configuration and other private data can remain in checkpointed state. Nor does it mean arbitrary I/O is a pure function of the log: the point of recording an external answer is to make it available on recovery without asking again.

## Dynamic values: what the session should have

### Select what matters

The playbook can follow the caller directly:

```ts
// agent/skills/team_playbook.ts
import { defineDynamic, defineSkill } from "eve/skills";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.team ?? null,
  render: (team) => (team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null),
});
```

The same shape works for a model that depends on image content:

```ts
model: defineDynamic({
  select: (view) => view.messages.some(hasImage),
  render: (image) => (image ? "google/gemini-3.5-flash" : "zai/glm-5.2"),
}),
```

The model changes when the answer changes, not merely because another message arrived. The selector still runs to check; expensive scans do not become free just because rendering is skipped.

The folder or field determines what the value may return. A tools file returns tools, a skills file returns skills, and the `model` field returns a model with its settings. `null` or `undefined` contributes nothing. The model stays a dynamic field inside an otherwise static `agent.ts`; build settings do not become session configuration.

### Record data, render code

When constructing a capability needs an external answer, add `record`:

```ts
// agent/tools/crm.ts
import { defineDynamic } from "eve/tools";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.tenantId ?? null,
  record: async (tenantId) => (tenantId === null ? [] : await db.crmTools(tenantId)),
  render: (rows) => Object.fromEntries(rows.map((row) => [row.slug, crmTool(row)])),
});
```

The database rows are kept. `crmTool` is an ordinary function that constructs a tool, including its schema and callbacks. A package can supply it without a special compiler transform or durable callback wrapper.

`record` is for data acquisition and computation, not for sending emails or charging cards; those effects belong in hooks or execution callbacks. What `record` returns must be JSON. A secret returned here is stored too, so record configuration rather than tokens, and obtain credentials in callbacks such as `getToken` when they are used.

`render` must be pure, not merely synchronous. Time, randomness, and mutable process state can change a callback's behavior even if its tool description stays the same. Values that need to survive a restart belong in the record.

Without `record`, the selection is the data used to render. Without `render`, a JSON result can be used directly, such as a gateway model ID. Tools and connections always need rendering because they contain executable code.

### Common lifetimes

| Selection         | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `once`            | Evaluate once for the session under the current definition revision |
| `perTurn`         | Evaluate for each new turn                                          |
| `perStep`         | Evaluate for each upcoming ordinary model call                      |
| A custom selector | Evaluate when the selected input changes                            |

These are ordinary selectors and can be combined with other dependencies:

```ts
select: (view, { session }) => ({
  turn: perTurn(view),
  team: session.auth.current?.attributes.team ?? null,
}),
```

Only the selection is watched. `record` can also read the caller and conversation, but those reads do not independently trigger another evaluation. For example, a router can choose once per turn using the conversation available at that point:

```ts
model: defineDynamic({
  select: perTurn,
  record: async (_turn, ctx) => await chooseModel(ctx.messages),
  render: (choice) => models[choice],
}),
```

That is also how `auto()` fits: choose a model, record the choice, and reuse it through tool calls and cold starts. Data fetched from outside eve stays current only as far as its selection asks; selecting `perTurn` refreshes it each turn, not whenever the database changes.

## Hooks: what should happen

Hooks share selection and durable evaluation with dynamic values, but their authoring shape is `select` plus `run`. A hook can do I/O and return a command. There is no live capability to reconstruct, so it does not need `render`.

```ts
// agent/hooks/compact-when-idle.ts
import { idle } from "eve/events";
import { compact, defineHook } from "eve/hooks";

export default defineHook({
  select: (view) => ({ idle: idle(view), turnId: view.turn?.id ?? null }),
  run: ({ idle, turnId }) =>
    idle && turnId !== null ? compact({ reason: "The session went idle." }) : null,
});
```

A state-selected hook runs on its initial evaluation and when its selection changes. An event hook handles each matching fact instead. Both remain useful: "whenever the session becomes idle" and "for every settled turn" are different requests.

The event form stays:

```ts
// agent/hooks/require-credentials.ts
import { cancel, defineHook } from "eve/hooks";

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      if (!(await hasWorkspaceCredentials(ctx.session.auth.current))) {
        return cancel("Workspace credentials are unavailable.");
      }
    },
  },
});
```

The hook returns a decision; eve applies it before proceeding with the turn's capability recording or model work. If the credential check throws, the turn fails rather than continuing without the check. No separate guard API is needed for the initial design. Resource-specific authorization still belongs at the point a tool accesses that resource.

### Occurrences, not just equal values

A reaction's selection and its evaluation identity are different things:

```text
selection:       false → true → false → true
occurrence:        1       2       3       4
```

The two `true` values are equal, but they represent different occurrences. A retry of occurrence 2 keeps its identity; occurrence 4 gets a new one. Authors should not need to invent keys just to express a repeated transition.

For an external effect, the identity is available as an idempotency key:

```ts
export default defineHook({
  events: {
    async "turn.settled"(event, ctx) {
      await notifications.send({
        sessionId: ctx.session.id,
        turnId: event.data.turnId,
        idempotencyKey: ctx.occurrence.id,
      });
    },
  },
});
```

An effect can succeed just before a process fails to save its result. The handler may then run again. **Execution is at least once until checkpointed**, not exactly once; an external service must honor the idempotency key to avoid repeating its effect.

Returned commands also belong to the occurrence. Restoring a committed command does not request it again. `cancel()` targets the turn the occurrence belongs to, never a later one; `compact()` requests compaction before the next model call. Applying session commands remains eve's responsibility, including deciding whether they are still valid.

## Instructions are values; adding a message is an action

An instruction says what should apply while its value is active:

```ts
// agent/instructions/long-conversation.ts
export default defineDynamic({
  select: (view) => view.session.turnCount > 6,
  render: (long) =>
    long ? defineInstructions({ content: "Summarize what's settled before answering." }) : null,
});
```

Putting a brief into history at the start of every turn is different. It is an insertion at a particular place, even when its text matches last turn's brief:

```ts
// agent/hooks/turn-brief.ts
import { appendMessage, defineHook } from "eve/hooks";

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const brief = await loadBrief(ctx.session.auth.current);
      if (!brief) return;
      return appendMessage({
        role: "user",
        content: brief,
        placement: "before-turn-input",
      });
    },
  },
});
```

This proposed command replaces the append behavior of dynamic user-role instructions. A retried occurrence does not append twice. A new turn can append the same text again. Authors do not have to change the content to manufacture a new occurrence.

## When things run, and how they recover

### Clear execution boundaries

Hooks observe committed changes and can react between model calls or between turns. Before a model call, eve reconciles dynamic values against the current session and conversation, then fixes the capability snapshot that call uses.

This is the author-facing contract, rather than an incidental order of internal callbacks:

- **A cancelling hook stops subsequent work at that boundary.** It is not deferred until after other reactions have fetched data.
- **A model call gets one coherent configuration.** Its model, tools, and context are prepared before it starts. Changes during a tool batch affect the next model call.
- **A requested tool stays bound to the capability version the model saw.** Approval waits or a fresh process must not silently replace its implementation. Authorization is still checked at execution time.
- **Dynamic values have the conversation when evaluated.** Reading it must not secretly suspend a half-executed `record` and cause earlier work to repeat.

eve may check selections earlier as an optimization. Checking whether a value changed and installing it into a model request are not the same operation. This also leaves room to keep provider-visible tool lists stable where prompt caching benefits from it.

### Cold starts reuse committed answers

```text
first evaluation: select → record data → render capability
                                │
                                ▼
                           durable record
                                │
fresh process:                  └────────→ render capability
```

A fresh process reconstructs code from the committed record. It does not query the database or router again merely to recover that capability. If evaluation was interrupted before its outcome committed, a retry may repeat the work.

eve can compare reconstructed declarations with what the model was offered and fail if they differ. That is a useful check, not proof that arbitrary callbacks behave identically: deterministic rendering remains an author obligation. A connection whose target changes under the same name must still be replaced; equal names or descriptions do not make two executable capabilities equivalent.

### Failures are visible

An unhandled error in `select`, `record`, `render`, or a hook fails the owning execution. During a turn, it fails the turn. A hook running between turns has its own execution to report as failed; it does not retroactively fail an already completed turn.

There is no initial failure-policy option. If behavior is optional, the author can catch an expected error and explicitly return no contribution. Unexpected errors still propagate. In particular, eve must not respond to a failure by silently removing required instructions or exposing a static connection with different credentials as a fallback.

### Deployment changes invalidate values

Only idle sessions move to a new deployment. At that transition, dynamic values are invalidated whether they contain code or only data, and reevaluated before the next model call. A `once` instruction should not keep an obsolete policy just because it is plain text.

The new deployment must not blindly render old data with an incompatible new renderer. Start with reevaluation as the uniform rule; explicit cross-deployment record reuse can come later if needed. Completed hook occurrences are not replayed merely because a deployment changed.

## The same idea underneath model calls and tasks

The broader loop is **observe, decide, execute, record**:

| Work               | Decision                                            | New observation                      |
| ------------------ | --------------------------------------------------- | ------------------------------------ |
| Model call         | A response is needed; request a model run           | Response, usage, or failure          |
| Tool or task       | Requested work is ready to execute                  | Progress and completion or failure   |
| Dynamic capability | Its selected inputs changed; evaluate configuration | Recorded configuration for later use |
| Compaction hook    | The session became idle; request compaction         | The resulting context change         |

This is more precise than saying every reaction is a function that mutates the log. Decisions can be reconstructed from durable inputs; external work produces answers that need to be recorded. A network request and a session commit are not one atomic action.

A model run streams, a task may last hours, and a dynamic value may take a synchronous calculation. They can share execution identity, recorded outcomes, cancellation, and recovery without becoming the same callback or public API. Task and model failures also remain outcomes their callers can handle, not a rule that every failed background task must fail an unrelated turn.

Memory and channels fit the same distinction: recall contributes context, capture performs an effect, and a channel handler delivers an update. Their authoring APIs can stay specialized. The common machinery should grow from these concrete uses, not from designing a universal workflow language first.

## What we gain, and what we still pay for

**The main gain is an explicit persistence boundary.** Packages return ordinary tools; recorded configuration survives a restart; callback code stays code. eve can retire the per-kind lifecycle and closure-rebinding machinery rather than teach authors its restrictions.

**Selections express intent more directly.** A capability can follow a caller or conversation property instead of relying on an event that happens to notice it. Hooks can act on state transitions as well as individual facts.

**The complexity does not disappear.** Authors must choose dependencies deliberately, keep rendering pure, and make external effects safe to retry. A simple async resolver becomes a data-fetching step and a constructor. Shared selection logic, first-value snapshots, and external freshness still need deliberate design.

**Performance needs end-to-end evidence.** The prototype's unchanged selectors are cheap, but that does not measure database latency, growing conversation scans, checkpoint size, or provider prompt-cache misses. Removing compiler machinery is valuable even without claiming that every session gets faster.

**Recovery needs to be explainable.** Diagnostics should show which input triggered an evaluation, which revision produced the value, and whether work failed or is waiting to retry. Otherwise an explicit lifecycle in code can still be opaque in production.

## Scope and remaining questions

The initial change is dynamic values and hooks on the v27 view, with shared selection, evaluation identity, records, and recovery. Keep `defineDynamic`, retain event hooks, and add state-selected hooks and returned commands. Do not add `defineGuard`, a universal public `defineReaction`, arbitrary dependency graphs, or a new task-authoring API.

The prototype is useful groundwork, not the finished contract. In particular:

- **Retries and failure ownership:** define bounded retry behavior and how a between-turn hook's failure is surfaced. Evaluation identity must survive retries and distinguish later equal-valued occurrences.
- **Scheduling:** pin the model-call boundary, cancellation ordering, and `perStep` behavior, including steering, approval waits, and compaction. Hooks outside turn steps need an explicit conversation-access story rather than lazy postponement.
- **Capability revisions:** preserve the definitions an outstanding call was offered, and replace live connections even when their names are unchanged. Decide how provider-specific tool masking fits without changing these semantics.
- **Storage and privacy:** bound recorded data and expose useful diagnostics without publishing secrets or private configuration.
- **Remote agents:** the prototype does not yet reconstruct dynamic remote-agent credentials in all execution paths. Close that gap before claiming parity with `main`.

The direction is one durable execution model with a few clear authoring surfaces: **dynamic values describe what the session should have; hooks describe what should happen; both are reactions whose outcomes eve can remember.**
