---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-11"
---

# Session reactions and dynamic values

This doc covers everything that changes during an eve session: the model, tools, skills, instructions, connections, subagents, and what hooks do in response. It proposes a common model underneath them: **durable reactions**. Dynamic values describe what the session should have; hooks describe what should happen. They share an execution model without needing identical authoring APIs.

The broader idea is simple: **the session has a durable history, reactions make decisions from it, and work produces new observations that become part of that history.**

**Status.** [#4616](https://github.com/vercel/eve/pull/4616), on the v27 stack, prototypes recorded dynamic values and hooks with `select`, `record`, and `render`, and removes main's per-kind lifecycles and closure transforms. This doc describes the proposed direction, which revises the prototype in a few places: hooks use `run` instead of `render`, an unhandled error fails the turn instead of withdrawing the value, dynamic values are evaluated before each model call rather than after every commit, occurrences get their own identity, a tool call checks that its tool hasn't changed since it was offered, a user-role instruction joins the conversation once per occurrence, skill files are rendered rather than stored, and a dynamic remote agent can carry credentials. Examples are proposed authoring shapes unless labelled `main`.

## Summary

- **On `main`, dynamism is implemented as handlers on three lifecycle events.** Each kind has its own allowed events, replacement rules, and failure behavior. Tools survive cold starts through a compiler pass that snapshots what their callbacks capture.
- **A reaction observes relevant state, evaluates when needed, and records an outcome.** Each evaluation is an occurrence with its own identity, so eve can distinguish retrying work from doing it again.
- **Dynamic values use `select`, `record`, and `render`.**
  - `select` says what the value depends on: the current turn, the caller's role, or whether the conversation contains an image. It is a cheap, synchronous function that returns JSON. Named lifetimes (`once`, `perTurn`, `perStep`) cover common cases.
  - `record` handles fetching or non-deterministic computation: query a database for this tenant's tools, ask a router which model to use, or choose a random value. It returns JSON that eve keeps. It runs when a new evaluation is needed, not just because a process restarted.
  - `render` turns that data into a live definition, such as a tool, skill, connection, or model. Without `record`, it receives the selection directly. It is synchronous and deterministic, so a fresh process can reconstruct the same capability without fetching its configuration again.
- **`auto()` stops being special.** On `main` it hand-writes this pattern with framework internals. Here it is an ordinary `select`, `record`, and `render`, and an author can write their own router the same way ([How `auto()` works](#how-auto-works-on-main-and-now)).
- **Hooks use `select` and `run`, or an event handler.** They perform effects or return commands such as `cancel()` and `compact()`. They share the reaction lifecycle, but do not need a rendering step.
- **A system instruction is held; a user instruction joins the conversation.** A system instruction applies while it is selected. A user instruction joins the conversation once per occurrence and stays, as on `main` ([Instructions](#instructions-held-or-joined)).
- **Unhandled errors fail the turn.** Nothing silently drops a required instruction or a failed credential check. Optional behavior is expressed in ordinary code, not a separate framework failure policy.
- **The prototype is about 4,000 lines of production code smaller than `main`,** mostly because one runner replaces six lifecycles and recording data replaces a compiler ([Why the prototype is smaller](#why-the-prototype-is-smaller)).
- **Unify the machinery, not every surface.** Selection, occurrences, recorded outcomes, and recovery belong underneath both APIs. A public universal reaction API and a separate guard API are not part of the initial change.

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
- **Something to do:** cancel this turn, compact the context. It belongs to an occurrence, not to a standing configuration value.

We use the same language for both:

| Term                | Meaning                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Selection**       | The relevant input that determines whether evaluation is needed                                                |
| **Occurrence**      | One evaluation of a reaction: a new selection, or a new matching fact. A retry keeps the occurrence's identity |
| **Record**          | The durable outcome eve keeps for an occurrence                                                                |
| **Contribution**    | The capability or command the outcome supplies to the session                                                  |
| **Materialization** | Reconstructing a live object, such as a tool with callbacks, from recorded data                                |

`record` and a hook's `run` both evaluate an occurrence. `render` is materialization: it constructs a live value, not a new external action.

This is a conceptual model of durable history, not a requirement to put every private record on the public event stream. Capability configuration and other private data can remain in checkpointed state. Nor does it mean arbitrary I/O is a pure function of the log: the point of recording an external answer is to make it available on recovery without asking again.

## Dynamic values: what the session should have

### Select what matters

The playbook can follow the caller directly:

```ts
// agent/skills/team_playbook.ts
import { defineDynamic, defineSkill } from "eve/skills";
import { PLAYBOOKS } from "../lib/playbooks";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.team ?? null,
  render: (team) => (team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null),
});
```

The same shape works for a model that depends on image content:

```ts
// agent/agent.ts
import { defineAgent, type ReactionView } from "eve";
import { defineDynamic } from "eve/models";

export default defineAgent({
  model: defineDynamic({
    select: (view) => view.messages.some(hasImage),
    render: (image) => (image ? "google/gemini-3.5-flash" : "zai/glm-5.2"),
  }),
});

function hasImage(message: ReactionView["messages"][number]): boolean {
  return (
    message.role === "user" &&
    Array.isArray(message.content) &&
    message.content.some(
      (part) =>
        part.type === "image" || (part.type === "file" && part.mediaType.startsWith("image/")),
    )
  );
}
```

The model changes when the answer changes, not merely because another message arrived. The selector still runs to check; expensive scans do not become free just because rendering is skipped.

The folder or field determines what the value may return. A tools file returns tools, a skills file returns skills, and the `model` field returns a model with its settings. `null` or `undefined` contributes nothing. The model stays a dynamic field inside an otherwise static `agent.ts`; build settings do not become session configuration.

<details>
<summary>Other places <code>defineDynamic</code> could fit</summary>

Each of these widens a field from `T` to `T | Dynamic<T>`, so a static definition still type-checks and adding one later is additive for authors. The cost falls on code that reads definitions, such as agent info and build-time name checks.

| Place                                                                        | Status                                  | What it would enable                                                       |
| ---------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| A whole file in `tools/`, `skills/`, `instructions/`, `connections/`         | In the prototype                        | Capabilities per caller, tenant, or conversation                           |
| A whole subagent at `subagents/<name>/` or `subagents/<name>.ts`             | In the prototype                        | Optional local and remote subagents                                        |
| `defineAgent({ model })`, at the root and in a subagent                      | In the prototype, including `auto()`    | Routing, per-plan models                                                   |
| `available` on a subagent, remote agent, tool, or connection                 | Candidate; the clearest payoff          | Showing a capability per caller without making its whole file dynamic      |
| A tool's or subagent's `description`                                         | Candidate                               | Wording per tenant or locale                                               |
| A tool's `inputSchema`                                                       | Candidate                               | An enum of the caller's projects or accounts                               |
| `limits`, such as `maxTokenCostUsdPerSession`                                | Candidate                               | Budgets per plan. Checked where the budget is checked, before a model call |
| `compaction.model` and `compaction.thresholdPercent`                         | Candidate                               | Compaction that follows the chosen model's context window                  |
| A connection's or remote agent's `url`                                       | Candidate                               | Endpoints per tenant. Needs target comparison on cold starts               |
| A remote agent's `auth` and `headers`                                        | Proposed, as part of a dynamic subagent | Credentials per tenant or caller, as on `main`                             |
| The sandbox                                                                  | Awkward                                 | A sandbox outlives a selection; changing it means a new sandbox            |
| `build`, channels, schedules, workflow tools, `defaultTools`, `experimental` | Not candidates                          | Read at build time or before any session exists                            |

`reasoning`, `modelContextWindowTokens`, and `modelOptions` already vary with the model: the dynamic `model` field returns them together, because they are one coupled decision.

</details>

### How `auto()` works, on main and now

`auto()` picks a model per turn by asking an evaluation model which option fits. On `main`, it is a `step.started` handler that implements its own caching with framework internals:

```ts
// packages/eve/src/models/auto.ts (main, condensed)
const selection = new ContextKey<{ turnId: string; model: string }>(
  `eve.experimental.evaluate.model.${fingerprint}`, // SHA-256 of the options, fallback, and evaluator
);

return defineDynamic({
  events: {
    "step.started": async (event, ctx) => {
      const state = loadContext();
      const previous = state.get(selection);
      if (previous?.turnId === turnId(event)) return models.get(previous.model)!; // this turn decided

      const result = await evaluate({ model, state: routingState(ctx), questions: { route } });
      state.set(selection, { turnId: turnId(event), model: result.answers.route.choice });
      return models.get(result.answers.route.choice)!;
    },
  },
});
```

That is `select`, `record`, and `render` written by hand. The turn ID is the selection. The `{ turnId, model }` entry in session state is the record, and it stores an option key rather than a model, because a model instance can't be stored. The `models` map in the closure is the render, turning the key back into the authored model. The fingerprint stands in for invalidation: a deployment with different options gets a different key, so it decides again. The handler still runs before every model call, only to discover that it already decided.

None of that is available to authors. `loadContext` and `ContextKey` are internal, so a custom router on `main` either asks its router before every model call or reaches into internals.

With reactions, the framework does that work, and `auto()` is an ordinary definition:

```ts
// packages/eve/src/models/auto.ts (proposed, condensed)
return defineDynamic({
  select: turnState, // the turn's ID and input
  record: (turn, ctx) => choose(turn, ctx), // ask the evaluator once per turn; returns an option key
  render: (key) => optionOf(key), // the option key, as the authored model
});
```

The framework keeps the key, renders the model in any process, gives a retry the same occurrence, and re-evaluates after a deployment change. The context key, its fingerprint, and the per-step cache check are deleted. The authoring API is unchanged:

```ts
// agent/agent.ts
import { defineAgent } from "eve";
import { auto } from "eve/models";

export default defineAgent({
  model: auto({
    fallback: "anthropic/claude-sonnet-5",
    options: {
      "openai/gpt-6-sol": "Difficult reasoning and engineering tasks",
      "openai/gpt-6-luna": "Routine tasks where fast completion matters",
    },
  }),
});
```

### Record data, render code

When constructing a capability needs an external answer, add `record`:

```ts
// agent/tools/crm.ts
import { defineDynamic } from "eve/tools";
import { crmTool, db } from "../lib/crm";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.tenantId ?? null,
  record: async (tenantId) => (tenantId === null ? [] : await db.crmTools(tenantId)),
  render: (rows) => Object.fromEntries(rows.map((row) => [row.slug, crmTool(row)])),
});
```

The database rows are kept. `crmTool` is an ordinary function that constructs a tool, including its schema and callbacks. A package can supply it without a special compiler transform or durable callback wrapper.

`record` is for data acquisition and computation, not for sending emails or charging cards; those effects belong in a hook's `run` or in execution callbacks. What `record` returns must be JSON. A secret returned here is stored too, so record configuration rather than tokens, and obtain credentials in callbacks such as `getToken` when they are used.

`render` must be pure, not merely synchronous. Time, randomness, and mutable process state can change a callback's behavior even if its tool description stays the same. Values that need to survive a restart belong in the record.

Without `record`, the selection is the data used to render. Without `render`, a JSON result can be used directly, such as a gateway model ID. Tools and connections always need rendering because they contain executable code.

A skill's supporting files are rendered too, not stored. eve keeps the skill's name, description, markdown, and a revision hash, and renders the files from the record whenever a sandbox needs them: when the skill first appears, when its revision changes, or when the session gets a new sandbox. Files that come from code, such as imported assets or a map of playbooks, are never stored. Files fetched in `record` are in the record, because `render` can't fetch them.

### Common lifetimes

| Selection         | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `once`            | Evaluate once for the session under the current definition revision |
| `perTurn`         | Evaluate for each new turn                                          |
| `perStep`         | Evaluate for each upcoming ordinary model call                      |
| A custom selector | Evaluate when the selected input changes                            |

These are ordinary selectors and can be combined with other dependencies. This playbook follows the caller's team, and fetches it again every turn:

```ts
// agent/skills/team_playbook.ts
import { defineDynamic, defineSkill, perTurn } from "eve/skills";
import { playbooks } from "../lib/playbooks";

export default defineDynamic({
  select: (view, { session }) => ({
    turn: perTurn(view),
    team: session.auth.current?.attributes.team ?? null,
  }),
  record: async ({ team }) => (team === null ? null : await playbooks.fetch(team)),
  render: (markdown) => (markdown ? defineSkill({ markdown }) : null),
});
```

Only the selection is watched. `record` can also read the caller and conversation, but those reads do not independently trigger another evaluation. For example, a router can choose once per turn using the conversation available at that point:

```ts
// agent/agent.ts
import { openai } from "@ai-sdk/openai";
import { defineAgent } from "eve";
import { defineDynamic, perTurn } from "eve/models";
import { chooseTier } from "./lib/router";

const models = { hard: openai("gpt-6-sol"), easy: openai("gpt-6-luna") };

export default defineAgent({
  model: defineDynamic({
    select: perTurn,
    record: async (_turn, ctx) => await chooseTier(await ctx.messages()), // "hard" | "easy"
    render: (tier) => models[tier],
  }),
});
```

The tier is recorded, and `render` picks the live model. Data fetched from outside eve stays current only as far as its selection asks; selecting `perTurn` refreshes it each turn, not whenever the database changes.

## Hooks: what should happen

Hooks share selection and durable evaluation with dynamic values, but their authoring shape is `select` plus `run`. `run(selection, ctx)` can do I/O and return a command. There is no live capability to reconstruct, so a hook does not need `render`.

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
import { hasWorkspaceCredentials } from "../lib/credentials";

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

The hook returns a decision; eve applies it before evaluating the turn's dynamic values or starting model work. If the credential check throws, the turn fails rather than continuing without the check. On `main`, a throwing hook is logged and the turn continues. No separate guard API is needed for the initial design. Resource-specific authorization still belongs at the point a tool accesses that resource.

### Occurrences, not just equal values

A reaction's selection and its occurrence are different things:

```text
selection:       false → true → false → true
occurrence:        1       2       3       4
```

The two `true` values are equal, but they represent different occurrences. A retry of occurrence 2 keeps its identity; occurrence 4 gets a new one. Authors should not need to invent keys just to express a repeated transition.

eve derives a state-selected occurrence's identity from the reaction, a count of its selection changes, and a digest of the selection. A retry after a crash computes the same identity, because nothing new was committed, so eve doesn't have to write anything before the effect runs. An event hook's occurrence is the fact's position in the stream.

For an external effect, the identity is available as an idempotency key:

```ts
// agent/hooks/budget-alert.ts
import { defineHook } from "eve/hooks";
import { email } from "../lib/email";
import { spentUsd } from "../lib/usage";

export default defineHook({
  select: (view) => spentUsd(view) > 50,
  run: async (over, ctx) => {
    if (over) await email.send({ template: "budget", idempotencyKey: ctx.occurrence.id });
  },
});
```

```ts
// agent/hooks/notify-settled.ts
import { defineHook } from "eve/hooks";
import { notifications } from "../lib/notifications";

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

## Instructions: held or joined

An instruction's role decides which kind of contribution it is.

A **system instruction** is something to hold. It applies to every model call while it is selected, and disappears when its value becomes `null`:

```ts
// agent/instructions/long-conversation.ts
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic({
  select: (view) => view.session.turnCount > 6,
  render: (long) =>
    long ? defineInstructions({ content: "Summarize what's settled before answering." }) : null,
});
```

A **user instruction** joins the conversation. Each occurrence that returns one adds it once, before the turn's input, and it stays there like any other message:

```ts
// agent/instructions/brief.ts
import { defineDynamic, defineInstructions, perTurn } from "eve/instructions";
import { loadBrief } from "../lib/briefs";

export default defineDynamic({
  select: perTurn,
  record: async (_turn, ctx) => await loadBrief(ctx.session.auth.current),
  render: (brief) => (brief ? defineInstructions({ content: brief, role: "user" }) : null),
});
```

Each turn is a new occurrence, so the brief joins every turn, even when its text matches last turn's: the same behavior as a `turn.started` handler on `main`. A retried occurrence doesn't add it twice. A later `null` adds nothing and doesn't remove what is already in the conversation; compaction and clear treat it like other history, as on `main`.

A hook command for adding messages could follow if a case needs one, such as adding a message from an event handler. It is additive and not part of the initial change.

## When things run, and how they recover

### Clear execution boundaries

This is the author-facing contract, rather than an incidental order of internal callbacks:

- **Hooks run after each commit.** A state-selected hook checks its selection after every commit, inside a turn or between turns, so "the session went idle" is noticed when it happens. An event hook runs for each matching fact.
- **Dynamic values are evaluated before each model call.** eve runs their selects, records what changed, and fixes the model, tools, and context that call uses. Changes during a tool batch affect the next model call.
- **A cancelling hook stops subsequent work at that boundary.** Hooks run before values, so a cancel takes effect before any value fetches data.
- **A requested tool runs only as it was offered.** Each call keeps a digest of the record its tool was rendered from. If the tool's current record differs when the call executes, because the caller's role or tenant changed during an approval wait, the call fails with a tool error saying the tool changed since it was offered, and the model can request it again. A re-evaluation that records the same data, such as a `perTurn` value, is not a change. Authorization is still checked at execution time.
- **`record` and `run` read the conversation explicitly.** `await ctx.messages()` loads it, in a turn or between turns. A hook's `select` that reads `view.messages` runs only where the conversation is loaded. `select` is pure, so skipping it repeats no work.

Which model calls are boundaries:

- **`perStep` covers the ordinary model calls of a turn,** including the call after a tool batch and the call after an approval resumes. Compaction's summarizing call, the evaluator `auto()` asks, and `evaluate` inside a tool are not boundaries.
- **A steering message is visible at the next boundary.** It is not a new turn, so `perTurn` values don't evaluate again; a selection that reads messages sees it before the next model call.
- **A resumed approval runs its calls first.** Approved calls execute, with the check above, and then values are evaluated before the next model call. Nothing evaluates while a turn waits.
- **Compaction is not a boundary.** The next boundary sees the compacted conversation, so a selection over messages may change: the image model returns to text once a summary replaces the image.

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

eve compares what the fresh render offers with what the session was offered: tool declarations, and a connection's URL, instance key, and credential owner, since equal names or descriptions do not make two executable capabilities equivalent. A difference means `render` isn't deterministic. eve then discards the record and evaluates again at the next boundary, rather than failing every turn for as long as the selection stands. Calls already requested from the old version fail as described above. In development, eve renders twice on the first evaluation and compares, so a `Math.random()` in `render` shows up immediately rather than after a cold start in production.

The comparison is a useful check, not proof that arbitrary callbacks behave identically: deterministic rendering remains an author obligation.

### Failures are visible

An unhandled error in `select`, `record`, `render`, or a hook fails the owning execution. During a turn, it fails the turn. That includes event handlers that only observe: an audit or metrics hook that mustn't fail a turn catches its own errors. On `main`, a throwing hook is logged and the turn continues, so a hook can't enforce anything by throwing.

- **A failed evaluation of a value is never recorded.** The last good record stays in place, and the next boundary evaluates again even if the selection hasn't changed. A transient error therefore can't break a `once` value for the rest of the session.
- **A failed hook occurrence is not run again later.** A compaction meant for an idle moment shouldn't happen an hour later. Within the occurrence, the workflow's own step retries still apply.
- **A hook running between turns has no turn to fail.** eve logs the failure with the hook, the occurrence, and the error. It does not retroactively fail an already completed turn. A public fact for it can come later: readers ignore fact types they don't recognize, so adding one doesn't break them.

There is no initial failure-policy option. If behavior is optional, the author can catch an expected error and explicitly return no contribution. That `null` is recorded like any other value: a `once` value that catches a failure has nothing for the rest of the session, so a value that should recover selects `perTurn`. Unexpected errors still propagate. In particular, eve must not respond to a failure by silently removing required instructions or exposing a static connection with different credentials as a fallback.

### Deployment changes invalidate values

Only idle sessions move to a new deployment. At that transition, dynamic values are invalidated whether they contain code or only data, and reevaluated before the next model call. A `once` instruction should not keep an obsolete policy just because it is plain text. For the same reason, a `once` value that captured the first caller in `record` captures whoever is current after a deployment change.

The new deployment must not blindly render old data with an incompatible new renderer. Start with reevaluation as the uniform rule; explicit cross-deployment record reuse can come later if needed. Completed hook occurrences are not replayed merely because a deployment changed.

### Values used outside the session

Some values are needed where the session's state isn't: a remote child is opened, messaged, reset, and cancelled by steps of their own, and its stream is followed by a route. On `main`, a compiler pass found a dynamic remote agent's `auth` and `headers` and registered them by ID for those places.

With reactions, those places render the value instead:

- **A rendered reference travels with the child.** It names the reaction and carries the record the remote agent was rendered from, in the selection a call carries and in the child's address. Records hold no secrets, so copying one there is safe.
- **eve renders by reaction from the deployed definitions.** Given the reference, it finds the definition's `render`, calls it with the record, and takes the `auth` and `headers` it returns. Nothing about this is specific to remote agents.
- **The destination is checked before credentials are used.** The rendered URL, name, and path must match what the child was opened with. A child opened before a deployment change keeps its URL; if the current selection names another, the request fails rather than sending new credentials to the old destination.

```ts
// agent/subagents/finance.ts
import { defineDynamic, defineRemoteAgent } from "eve";
import { mintTenantToken, tenants } from "../lib/tenants";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.tenantId ?? null,
  record: async (tenantId) => (tenantId === null ? null : await tenants.lookup(tenantId)), // { id, region }
  render: (tenant) =>
    tenant === null
      ? null
      : defineRemoteAgent({
          description: "Analyze financial and accounting data.",
          url: `https://${tenant.region}.finance.example.com`,
          auth: async () => ({
            headers: { authorization: `Bearer ${await mintTenantToken(tenant.id)}` },
          }),
        }),
});
```

`auth` still takes no arguments: it closes over `tenant`, and `render` can recreate it anywhere. A dynamic `defineWorkspaceAgent`, which `main`'s compiler pass never handled, works the same way.

### What eve stores

- **A selection is at most 64 KB, and a record at most 1 MB.** The error names the reaction and suggests recording an ID and fetching the rest when it is used.
- **Records are private.** They live in the session's checkpointed state, never on the public stream.
- **Stored state rides along every step.** A turn step's input and result carry the session's state and history, so a record is re-sent and re-persisted on each step. `main` has the same cost for its closure snapshots, which it stores separately for each callback, with no cap.
- **Diagnostics go to logs and traces.** Each evaluation reports the reaction, the occurrence, what triggered it (a new selection, a retry after failure, a deployment change, or a render that didn't match), how long it took, and its outcome. There is no public API for them.

## Before and after

<details>
<summary>Examples from main's docs, and how they change</summary>

### Route image inputs to a vision model

```ts
// agent/agent.ts (main)
import { defineAgent, defineDynamic } from "eve";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const hasImage = ctx.messages.some(
          (message) =>
            message.role === "user" &&
            Array.isArray(message.content) &&
            message.content.some(
              (part) =>
                part.type === "image" ||
                (part.type === "file" &&
                  (part.mediaType === "image" || part.mediaType.startsWith("image/"))),
            ),
        );

        return hasImage ? "google/gemini-3.5-flash" : "zai/glm-5.2";
      },
    },
  }),
});
```

```ts
// agent/agent.ts (proposed)
import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";

export default defineAgent({
  model: defineDynamic({
    select: (view) => view.messages.some(hasImage),
    render: (image) => (image ? "google/gemini-3.5-flash" : "zai/glm-5.2"),
  }),
});
```

- **The test moves into `select`,** and the model is rendered when its answer flips rather than chosen before every model call.

### Choose a model by plan

```ts
// agent/agent.ts (main)
import { defineAgent, defineDynamic } from "eve";

export default defineAgent({
  model: defineDynamic({
    events: {
      "session.started": (_event, ctx) => {
        if (ctx.session.auth.initiator?.attributes.plan === "enterprise") {
          return "anthropic/claude-opus-5.5";
        }

        return "anthropic/claude-sonnet-5";
      },
    },
  }),
});
```

```ts
// agent/agent.ts (proposed)
import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";

export default defineAgent({
  model: defineDynamic({
    select: (_view, { session }) => session.auth.initiator?.attributes.plan === "enterprise",
    render: (enterprise) =>
      enterprise ? "anthropic/claude-opus-5.5" : "anthropic/claude-sonnet-5",
  }),
});
```

- **The same once-per-session behavior,** because the initiator doesn't change. Selecting `session.auth.current` instead would follow the current caller, which `main` can't express for models without `step.started`.

### Expose a subagent to enterprise callers

```ts
// agent/subagents/finance/agent.ts (main)
import { defineAgent, defineDynamic } from "eve";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      if (ctx.session.auth.current?.attributes.plan !== "enterprise") {
        return null;
      }

      return defineAgent({
        description: "Analyze financial and accounting data.",
        model: ctx.model ? ctx.model.id : "openai/gpt-5.5-mini",
      });
    },
  },
});
```

```ts
// agent/subagents/finance/agent.ts (proposed)
import { defineAgent, defineDynamic } from "eve";

export default defineDynamic({
  select: (view, { session }) =>
    session.auth.current?.attributes.plan === "enterprise"
      ? (view.model?.id ?? "openai/gpt-5.5-mini")
      : null,
  render: (model) =>
    model === null
      ? null
      : defineAgent({ description: "Analyze financial and accounting data.", model }),
});
```

- **The behavior differs.** `main` snapshots the parent's model when the session starts. Here the parent's model is part of the selection, so the subagent follows it. Keeping the first model takes a hook that latches it into session state.
- **A remote subagent** has the same shape, returning `defineRemoteAgent({ description, url })`. Its `auth` and `headers` are rendered from the record wherever the child is reached ([Values used outside the session](#values-used-outside-the-session)).

### One connection per account

```ts
// agent/connections/accounts.ts (main)
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import { listEnabledAccounts, mintAccountToken } from "../lib/accounts";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const principal = ctx.session.auth.current;
      if (principal?.principalType !== "user") return null;

      const accounts = await listEnabledAccounts(principal);
      return Object.fromEntries(
        accounts.map((account) => [
          account.slug,
          defineMcpClientConnection({
            url: "https://mcp.cloud.example.com",
            description: `${account.label} (${account.accountId})`,
            instanceKey: account.accountId,
            auth: {
              credentialOwner: "user",
              getToken: ({ principal }) => mintAccountToken(principal, account),
            },
          }),
        ]),
      );
    },
  },
});
```

```ts
// agent/connections/accounts.ts (proposed)
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import { type Account, listEnabledAccounts, mintAccountToken } from "../lib/accounts";

export default defineDynamic({
  select: (_view, { session }) =>
    session.auth.current?.principalType === "user" ? session.auth.current : null,
  record: async (principal) => (principal === null ? [] : await listEnabledAccounts(principal)),
  render: (accounts) =>
    Object.fromEntries(accounts.map((account) => [account.slug, accountConnection(account)])),
});

function accountConnection(account: Account) {
  return defineMcpClientConnection({
    url: "https://mcp.cloud.example.com",
    description: `${account.label} (${account.accountId})`,
    instanceKey: account.accountId,
    auth: {
      credentialOwner: "user",
      getToken: ({ principal }) => mintAccountToken(principal, account),
    },
  });
}
```

- **`main` warns that connection handlers "may run again when a parked turn resumes or a durable step retries".** Here `listEnabledAccounts` runs once per caller, and a fresh process renders the connections from the recorded accounts.
- **The token is minted by `getToken` when it's needed,** and never recorded.

### One tool per warehouse table

```ts
// agent/tools/query.ts (main)
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { listTables, runReadOnly } from "../lib/warehouse";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) =>
      Object.fromEntries(
        (await listTables()).map((t) => [
          t.name,
          defineTool({
            description: `Query ${t.name}. Columns: ${t.columns.join(", ")}`,
            inputSchema: z.object({ sql: z.string() }),
            execute: ({ sql }) => runReadOnly(t.name, sql),
          }),
        ]),
      ),
  },
});
```

```ts
// agent/tools/query.ts (proposed)
import { defineDynamic, defineTool, once } from "eve/tools";
import { z } from "zod";
import { listTables, runReadOnly } from "../lib/warehouse";

export default defineDynamic({
  select: once,
  record: async () => (await listTables()).map(({ name, columns }) => ({ name, columns })),
  render: (tables) =>
    Object.fromEntries(
      tables.map((t) => [
        t.name,
        defineTool({
          description: `Query ${t.name}. Columns: ${t.columns.join(", ")}`,
          inputSchema: z.object({ sql: z.string() }),
          execute: ({ sql }) => runReadOnly(t.name, sql),
        }),
      ]),
    ),
});
```

- **A few more lines:** the fetch and the tools are separate.
- **The rules about callbacks are gone.** `main` requires inline callbacks with JSON-serializable captures and inline schemas, and rejects `execute: makeExecutor()`. `render` is ordinary code: it can call helpers, create clients, or keep a schema in a variable.

### Replace session tools each turn

```ts
// agent/tools/catalog.ts (main)
export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => ({ query: queryTool }),
    // On each turn, re-resolve. Replaces this file's session.started tools for later calls.
    "turn.started": async (_event, ctx) => ({ search: searchTool }),
  },
});
```

```ts
// agent/tools/catalog.ts (proposed)
export default defineDynamic({
  select: (view) => view.turn !== null, // before the first turn, or after it
  render: (started) => (started ? { search: searchTool } : { query: queryTool }),
});
```

- **There's no precedence to learn.** On `main`, the most recently fired event owns the file's tools, a turn result shadows the session's, and steering skips `turn.started`. Here the tools are whatever the selection says.

### A package's tool

```ts
// provider-package/search.ts (main)
import { defineDurableCallback, defineTool } from "eve/tools";
import { z } from "zod";

export function createSearchTool(baseUrl: string) {
  return defineTool({
    description: "Search the provider catalog.",
    inputSchema: z.object({ query: z.string() }),
    execute: defineDurableCallback({
      closure: { baseUrl },
      callback: async ({ baseUrl }, { query }: { query: string }) => {
        const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`);
        return response.json();
      },
    }),
  });
}
```

```ts
// provider-package/search.ts (proposed)
import { defineTool } from "eve/tools";
import { z } from "zod";

export function createSearchTool(baseUrl: string) {
  return defineTool({
    description: "Search the provider catalog.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`);
      return response.json();
    },
  });
}

// agent/tools/search.ts
export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.region ?? "us",
  render: (region) => ({ search: createSearchTool(`https://${region}.catalog.example.com`) }),
});
```

- **`defineDurableCallback` and `defineDurableSchema` are deleted,** along with the rule that every callback property, including labels, approval policies, `approvalKey`, and `toModelOutput`, be wrapped.
- **An extension doesn't need `eve extension build`** for its tools to survive a cold start.

### A playbook for the caller's team

```ts
// agent/skills/team_playbook.ts (main)
import { defineDynamic, defineSkill } from "eve/skills";
import { PLAYBOOKS } from "../lib/playbooks";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const team = ctx.session.auth.current?.attributes.team;
      const markdown = team ? PLAYBOOKS[team] : undefined;
      return markdown ? defineSkill({ markdown }) : null;
    },
  },
});
```

```ts
// agent/skills/team_playbook.ts (proposed)
import { defineDynamic, defineSkill } from "eve/skills";
import { PLAYBOOKS } from "../lib/playbooks";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.team ?? null,
  render: (team) => (team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null),
});
```

- **The same length,** and it follows the caller: a message from someone on another team changes the skill, where `session.started` never runs again.

### Instructions for the caller's plan

```ts
// agent/instructions/persona.ts (main)
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const plan = ctx.session.auth.current?.attributes.plan ?? "free";
      return defineInstructions({
        content: `The caller is on the ${plan} plan. Match the depth of your answers to it.`,
      });
    },
  },
});
```

```ts
// agent/instructions/persona.ts (proposed)
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.plan ?? "free",
  render: (plan) =>
    defineInstructions({
      content: `The caller is on the ${plan} plan. Match the depth of your answers to it.`,
    }),
});
```

- **A system instruction is held,** and follows the plan if a later caller's differs.

### A brief for every turn

```ts
// agent/instructions/brief.ts (main)
import { defineDynamic, defineInstructions } from "eve/instructions";
import { loadBrief } from "../lib/briefs";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const brief = await loadBrief(ctx.session.auth.current);
      return brief ? defineInstructions({ content: brief, role: "user" }) : null;
    },
  },
});
```

```ts
// agent/instructions/brief.ts (proposed)
import { defineDynamic, defineInstructions, perTurn } from "eve/instructions";
import { loadBrief } from "../lib/briefs";

export default defineDynamic({
  select: perTurn,
  record: async (_turn, ctx) => await loadBrief(ctx.session.auth.current),
  render: (brief) => (brief ? defineInstructions({ content: brief, role: "user" }) : null),
});
```

- **The same behavior:** the brief joins the conversation every turn, even when it hasn't changed.
- **`main`'s augmented message snapshots go away.** An instruction resolver on `main` sees static user instructions at `session.started`, and session results at `turn.started`; other kinds see a different snapshot. `ctx.messages()` is the same conversation for every reaction.

### Cancel a turn when credentials are missing

```ts
// agent/hooks/require-credentials.ts (main)
import { defineHook } from "eve/hooks";
import { loadWorkspaceCredentials } from "../lib/credentials";

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      try {
        await loadWorkspaceCredentials(ctx.session.auth.current);
      } catch (error) {
        console.warn("cancelling turn: workspace credentials unavailable", {
          error,
          sessionId: ctx.session.id,
        });
        ctx.cancel();
      }
    },
  },
});
```

```ts
// agent/hooks/require-credentials.ts (proposed)
import { cancel, defineHook } from "eve/hooks";
import { loadWorkspaceCredentials } from "../lib/credentials";

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      try {
        await loadWorkspaceCredentials(ctx.session.auth.current);
      } catch {
        return cancel("Workspace credentials are unavailable.");
      }
    },
  },
});
```

- **Cancelling is a return value** with a reason. `main` requires `ctx.cancel()` to be called before the handler's promise settles, and ignores it from work the handler doesn't await.
- **Without the `try`, the turn fails.** On `main`, a throwing hook is logged and the turn continues, so a hook can't enforce a check by throwing.

### Hooks that observe

`main`'s audit, persistence, and sandbox-stopping hooks are unchanged: they are event handlers with side effects, and remain so. A side effect that must happen once per occurrence keys on `ctx.occurrence.id` instead of coordinates copied from `event.data`.

</details>

## Why the prototype is smaller

Against its base, `trial/v27-on-hitl`, #4616 adds 6,107 lines and removes 16,523 across 386 files:

| Area                                    | Added | Removed | Net    |
| --------------------------------------- | ----- | ------- | ------ |
| eve production code                     | 3,675 | 7,662   | −3,987 |
| Tests                                   | 1,384 | 6,089   | −4,705 |
| Extension compatibility snapshots       | 1     | 1,597   | −1,596 |
| Fixtures, templates, and extension code | 1,033 | 1,175   | −142   |

In production code, the runner, the kind adapters, and the definitions add about 2,400 lines. The largest deletions are:

| Deleted                                                                                        | Lines |
| ---------------------------------------------------------------------------------------------- | ----- |
| Lifecycles per kind: tools, memory, skills, subagents, connections, instructions, model, hooks | 2,260 |
| Closure transforms: dynamic tools, their AST references, dynamic remote agents                 | 1,083 |
| Durable callbacks, tool rebuilding, tool metadata, and tool resolution                         | 890   |
| Participants and change points, which decided which lifecycle ran when                         | 459   |
| Memory state                                                                                   | 304   |

Four reasons account for it:

- **Six lifecycles did one job six times.** Each decided when to run, where to keep its result, how a later result replaced an earlier one, and how to recover after a restart, with its own rules. That is what authors learned per kind, and it is what the code repeated. One runner does it once; a kind supplies how its value contributes to the session, in a few dozen lines.
- **Recovering closures needs a compiler.** Persisting what a callback captured means parsing authored source, finding the captures, rewriting callbacks into factories, registering them, and rebinding them on recovery, plus a parallel API for code the compiler can't see. Recording data and rendering again needs none of it, and builds stop parsing authored source.
- **Precedence and replay rules disappear.** Turn results shadowing session results, steering skipping `turn.started`, and re-running handlers to rebind callbacks are cases that one selection per value doesn't have, and neither do their tests.
- **Tests and snapshots follow the code.** Most of the deleted test lines covered the deleted lifecycles and transforms. The snapshot deletions are the old dynamic-tool extension contract at each of its versions.

Two caveats. The runner reads the v27 public view, which exists for clients anyway; on v26's events, that view would have to be built too. And the revisions in this doc, such as failing turns, occurrence identity, and checking calls against their record, add some code back, likely a few hundred lines.

## Pros and cons

### Pros

- **An explicit persistence boundary.** Packages return ordinary tools; recorded configuration survives a restart; callback code stays code. eve can retire the per-kind lifecycle and closure-rebinding machinery rather than teach authors its restrictions.
- **Selections express intent directly.** A capability can follow a caller or a conversation property instead of relying on an event that happens to notice it.
- **One lifecycle for every kind.** The same three functions, the same named lifetimes, and the same failure rule cover models, tools, skills, instructions, connections, and subagents.
- **`auto()` is ordinary.** Its caching moves into the framework, and authors can write their own routers without internals.
- **Hooks can act on state.** They can compact or cancel when a condition becomes true, not only observe individual facts.
- **Visible failures.** A required instruction or credential check can't silently disappear, and transient errors recover at the next boundary.
- **Less code.** About 4,000 fewer lines of production code, and no compiler pass over authored source in every build.

### Cons

- **The complexity does not disappear.** Authors must choose dependencies deliberately, keep rendering pure, and make external effects safe to retry.
- **A simple async resolver becomes two functions:** a data-fetching `record` and a `render` that constructs from it.
- **First-value snapshots are indirect.** "The parent's model when the session started" isn't a function of the current view; it takes a hook that latches it into session state. A `once` value that captured the first caller captures whoever is current after a deployment change.
- **A caught failure sticks.** A value that catches an error and returns `null` keeps that `null` until its selection changes.
- **Behavior changes from `main`.** Hooks that throw fail the turn rather than being logged. Values that read `session.auth.current` follow the current caller rather than the first, and a subagent that selects `view.model` follows the parent's model.
- **Records are carried by every step.** A large record costs on every step of the session, not once. The 1 MB cap bounds it, but authors still have to choose what to record.
- **Performance needs end-to-end evidence.** The prototype's unchanged selectors are cheap, but that does not measure database latency, growing conversation scans, checkpoint size, or provider prompt-cache misses. Removing compiler machinery is valuable even without claiming that every session gets faster.
- **Recovery needs to be explainable.** Diagnostics should show which input triggered an evaluation, which revision produced the value, and whether work failed or is waiting to retry. Otherwise an explicit lifecycle in code can still be opaque in production.

## Scope

The initial change is dynamic values and hooks on the v27 view, with shared selection, occurrences, records, and recovery. Keep `defineDynamic`, retain event hooks, and add state-selected hooks and returned commands. Do not add `defineGuard`, a universal public `defineReaction`, arbitrary dependency graphs, a command for adding messages, or a new task-authoring API.
