---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-16"
---

# Session reactions and dynamic values

This doc covers everything that changes during an eve session: the model, tools, skills, instructions, connections, subagents, and what hooks do in response. It proposes a common model underneath them: **durable reactions**. Dynamic values describe what the session should have; hooks describe what should happen. They share an execution model without needing identical authoring APIs.

The broader idea: **the session has a durable history, reactions make decisions from it, and work produces new observations that become part of that history.**

**Status.** [#4616](https://github.com/vercel/eve/pull/4616), on the v27 stack, prototypes recorded dynamic values and hooks in place of main's per-kind lifecycles and closure transforms, with a `select`, `record`, and `render` API. This revision moves the authoring API to one function with `ctx.oncePer`; the prototype's runner, occurrences, and recovery carry over. The API below is the target for the initial land. [Other models](#other-models-same-examples) shows the alternatives on the same examples.

## Summary

- **On `main`, dynamism is implemented as handlers on three lifecycle events.** Each kind has its own allowed events, replacement rules, and failure behavior. Tools survive cold starts through a compiler pass that snapshots what their callbacks capture.
- **A dynamic value is one function, evaluated before each model call.** It reads the session and returns the value: a model, tools, a skill, instructions, a connection, or a subagent.
- **`ctx.oncePer(key, fn)` is the durability boundary.** `fn` runs when `key` is new, and its JSON result is kept. A later evaluation with the same key, in any process, gets the kept result without running `fn`. Fetching, asking a router, and randomness go inside a memo; the code around it builds tools and models from the results, and must be deterministic.
- **Lifetimes are keys.** `ctx.session.id` evaluates once per session, `ctx.turn.id` once per turn, and a tenant ID once per tenant. Code outside a memo runs before every model call.
- **`auto()` stops being special.** On `main` it hand-writes a memo with framework internals. Here it is an ordinary definition, and an author can write their own router the same way ([How `auto()` works](#how-auto-works-on-main-and-now)).
- **Hooks are a function eve runs after each commit, or an `events` map.** They perform effects or return commands such as `cancel()` and `compact()`. A command acts once on what it targets, so a hook may return it on every commit while its condition holds. Hooks observe committed session state and event payloads, not the assembled conversation.
- **Unhandled errors fail the turn.** Nothing silently drops a required instruction or a failed credential check. Optional behavior is expressed in ordinary code.
- **No compiler pass over authored source.** Memos replace the closure transforms and the runtime that rebinds their callbacks, about 2,100 lines on `main` ([What this removes](#what-this-removes)).

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

This keeps the first caller's playbook for the whole session. Following the current caller means choosing another event and knowing whether that kind supports it. Tools and models can update per step; skills, instructions, connections, and subagents have narrower lifecycle choices. Steering and completed sign-ins introduce more timing rules. Some handlers receive stand-in events that were never published, and a fresh process runs handlers again to recover their callbacks.

Cold starts add another set of rules. A tool's callback may close over data fetched by its handler, but a closure cannot be stored as JSON. eve transforms the callback, snapshots its captures, and later rebinds its code. Authors have to know which JavaScript the transform understands, which captures are serializable, and when a package needs durable callback or schema wrappers.

Reactions replace these two sources of complexity:

| Today                                                  | Proposed                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| Choose an event and learn each kind's precedence rules | Write a function; eve evaluates it before each model call     |
| Persist captured variables through compiler transforms | Keep data with `ctx.oncePer`, and build ordinary code from it |
| Re-run handlers to recover executable code             | Re-run the function; its memos return committed answers       |
| Hooks observe, with a special cancellation callback    | Hooks act on state or facts and return session commands       |
| Different failure behavior for different kinds         | An unhandled error fails the owning execution                 |

The goal is both to simplify the internals of the system and to make one lifecycle that applies everywhere.

## The common model

A **reaction** is evaluated at a boundary, reads the session, and contributes something.

The session view comes from the facts eve has recorded: turns, model runs, calls, tasks, interactions, and context changes. Reactions also receive the identity and execution context they need. External answers, such as database results or router choices, become durable memos rather than hidden inputs that are fetched again on recovery.

```text
session history → session view → reaction ⇄ memos
       ↑                            │
       │               ┌────────────┴────────────┐
       │               ▼                         ▼
       │       capability to hold         command to apply
       │               │                         │
       └────── observations from subsequent work ┘
```

There are two kinds of contribution:

- **Something to hold:** these tools are available, this model is selected, these instructions apply. A new value replaces the previous one.
- **Something to do:** cancel this turn, compact the context. It acts once on its target, not as a standing configuration value.

We use the same language for both:

| Term                | Meaning                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Boundary**        | Where eve evaluates a reaction: before each model call for dynamic values, after each commit for hooks   |
| **Memo**            | A result `ctx.oncePer` kept under its key                                                                |
| **Occurrence**      | One run of a memo under a new key, or one matching fact for an event handler. A retry keeps its identity |
| **Contribution**    | The capability or command a reaction returns                                                             |
| **Materialization** | Building live objects, such as tools with callbacks, from memo results: the code around the memos        |

A memo's function and an event handler each evaluate an occurrence. The code around memos is materialization: it constructs live values, not new external actions.

This is a conceptual model of durable history, not a requirement to put every private record on the public event stream. Memos and other private data remain in checkpointed state. Nor does it mean arbitrary I/O is a pure function of the log: the point of keeping an external answer is to make it available on recovery without asking again.

### Callback context

| Callback      | Signature                | Context                                                                                                                               |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic value | `defineDynamic(fn)`      | `ctx.view`, `ctx.session`, `ctx.channel`, `ctx.turn`, `ctx.messages`, `ctx.model`, `ctx.now`, and `ctx.oncePer`                       |
| Hook          | `defineHook(fn)`         | `ctx.view`, `ctx.session`, `ctx.channel`, `ctx.turn` (or `null` before the first turn), `ctx.now`, and `ctx.oncePer`; no conversation |
| Event handler | `defineHook({ events })` | The hook context without `ctx.oncePer`, plus the event's position and `ctx.occurrence.id`; no conversation                            |
| Memo          | `ctx.oncePer(key, fn)`   | `fn(occurrence)` gets `occurrence.id` and `occurrence.abortSignal`, and reads the enclosing `ctx`                                     |

- **`ctx.view` is the fold a client builds from the public stream,** so selectors from `eve/events`, such as `idle(view)`, read the same on both sides.
- **What a client doesn't have lives on `ctx`.** `ctx.turn` is the turn this model call belongs to, as `{ id, input, status }`. `ctx.messages` is the conversation this model call will send. `ctx.model` is the model chosen for it, for everything except the `model` field itself.
- **`ctx.now` is the time of the latest commit,** so it reads the same in every process. Code that needs the time uses it rather than `Date.now()`.

Dynamic values read the conversation through `ctx.messages`. Hooks and event handlers have no conversation access path; their public types and runtime contexts enforce that boundary. An event payload can still contain message content, such as the value of a `content.completed` fact; that is not the assembled conversation.

## Dynamic values: what the session should have

### One function

The playbook can follow the caller directly:

```ts
// agent/skills/team_playbook.ts
import { defineDynamic, defineSkill } from "eve/skills";
import { PLAYBOOKS } from "../lib/playbooks";

export default defineDynamic((ctx) => {
  const team = ctx.session.auth.current?.attributes.team;
  return team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null;
});
```

eve evaluates it before every model call. A message from someone on another team changes the skill.

The same shape works for a model that depends on image content:

```ts
// agent/agent.ts
import { defineAgent, type DynamicContext } from "eve";
import { defineDynamic } from "eve/models";

export default defineAgent({
  model: defineDynamic((ctx) =>
    ctx.messages.some(hasImage) ? "google/gemini-3.5-flash" : "zai/glm-5.2",
  ),
});

function hasImage(message: DynamicContext["messages"][number]): boolean {
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

eve compares what a definition returns with what the last model call used, and rebuilds only what changed. The function itself still runs before every model call, so an expensive scan of the conversation costs that much each time; work that needn't repeat belongs in a memo.

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
| The sandbox                                                                  | Awkward                                 | A sandbox outlives a value; changing it means a new sandbox                |
| `build`, channels, schedules, workflow tools, `defaultTools`, `experimental` | Not candidates                          | Read at build time or before any session exists                            |

`reasoning`, `modelContextWindowTokens`, and `modelOptions` already vary with the model: the dynamic `model` field returns them together, because they are one coupled decision.

</details>

### Memos

When building a capability needs an external answer, put the question in a memo:

```ts
// agent/tools/crm.ts
import { defineDynamic } from "eve/tools";
import { crmTool, db } from "../lib/crm";

export default defineDynamic(async (ctx) => {
  const tenantId = ctx.session.auth.current?.attributes.tenantId;
  if (!tenantId) return null;
  const rows = await ctx.oncePer(tenantId, () => db.crmTools(tenantId));
  return Object.fromEntries(rows.map((row) => [row.slug, crmTool(row)]));
});
```

The database rows are kept; the tools are not. `crmTool` is an ordinary function that constructs a tool, including its schema and callbacks. A package can supply it without a special compiler transform or durable callback wrapper.

- **`ctx.oncePer(key, fn)` runs `fn` when `key` is new, and returns the kept result otherwise.** Keys and results are JSON, and keys compare as canonical JSON. A function that returns nothing keeps `null`.
- **A memo holds one key at a time.** A new key replaces the previous one, so a key that comes back later runs again ([Occurrences](#occurrences)). Storage is bounded by the number of memos, not by turns.
- **Most definitions need one memo, and it needs no name.** A definition that uses more names the others: `ctx.oncePer(key, fn, { name: "tables" })`. Two unnamed memos in one evaluation fail with an error naming the file. Memos in one evaluation can run concurrently, such as under `Promise.all`.
- **Memos belong to their definition.** Two files that memoize the same key each run their own. Memos don't nest, and `oncePer` only works while the definition is being evaluated.
- **`fn` gets its occurrence:** `occurrence.id`, for an external service's idempotency key, and `occurrence.abortSignal`.

eve rejects invalid results with the file and the memo's name; a non-JSON result also identifies the offending path and type, such as `oncePer returned Date at $.accounts[2].createdAt`. Public types reject statically known violations, with runtime validation for external data.

**Code outside a memo must be deterministic.** eve runs it before every model call and again in a fresh process, and expects the same capability from the same memo results and `ctx`. Time comes from `ctx.now`; I/O, randomness, and mutable process state belong in a memo. A `Math.random()` outside one can change a callback's behavior even if its tool description stays the same. Nothing stops an `await` outside a memo, and it works, but it runs before every model call and its answer isn't kept.

A skill's supporting files are built, not stored. eve keeps the skill's name, description, markdown, and a revision hash, and evaluates the definition again, with its memos, whenever a sandbox needs the files: when the skill first appears, when its revision changes, or when the session gets a new sandbox. Files that come from code, such as imported assets or a map of playbooks, are never stored. Files fetched in a memo are in the memo.

### Lifetimes are keys

| Key                                                    | Evaluates                                      |
| ------------------------------------------------------ | ---------------------------------------------- |
| No memo                                                | Before every model call                        |
| `ctx.turn.id`                                          | Once per turn                                  |
| `ctx.session.id`                                       | Once per session, under the current deployment |
| Any JSON, such as a tenant ID or `[team, ctx.turn.id]` | Whenever it changes                            |

This playbook follows the caller's team, and fetches it again every turn:

```ts
// agent/skills/team_playbook.ts
import { defineDynamic, defineSkill } from "eve/skills";
import { playbooks } from "../lib/playbooks";

export default defineDynamic(async (ctx) => {
  const team = ctx.session.auth.current?.attributes.team;
  if (!team) return null;
  const markdown = await ctx.oncePer([team, ctx.turn.id], () => playbooks.fetch(team));
  return markdown ? defineSkill({ markdown }) : null;
});
```

Only the key decides. `fn` can read anything in `ctx`, including the conversation, but those reads don't make it run again. For example, a router can choose once per turn using the conversation at that turn's first model call:

```ts
// agent/agent.ts
import { openai } from "@ai-sdk/openai";
import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";
import { chooseTier } from "./lib/router";

const models = { hard: openai("gpt-6-sol"), easy: openai("gpt-6-luna") };

export default defineAgent({
  model: defineDynamic(async (ctx) => {
    const tier = await ctx.oncePer(ctx.turn.id, (occurrence) =>
      chooseTier({ messages: ctx.messages, idempotencyKey: `${occurrence.id}:route` }),
    ); // "hard" | "easy"
    return models[tier];
  }),
});
```

The tier is kept, and the code after the memo picks the live model, provider instance included. `main` rejects provider instances from session and turn model handlers, because it stores the model itself. A retry gets the same occurrence; this router passes an operation-specific idempotency key to an evaluator that honors it. Data fetched from outside eve stays current only as far as its key asks; keying by `ctx.turn.id` refreshes it each turn, not whenever the database changes.

A memo keyed by `ctx.session.id` also latches a first value: `await ctx.oncePer(ctx.session.id, () => ctx.model.id)` keeps the model of the first call that evaluated it, until a deployment change.

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

That is a memo written by hand. The turn ID is the key. The `{ turnId, model }` entry in session state is the kept result, and it stores an option key rather than a model, because a model instance can't be stored. The `models` map in the closure turns the key back into the authored model. The fingerprint stands in for invalidation: a deployment with different options gets a different key, so it decides again.

None of that is available to authors. `loadContext` and `ContextKey` are internal, so a custom router on `main` either asks its router before every model call or reaches into internals.

With memos, the framework does that work, and `auto()` is an ordinary definition:

```ts
// packages/eve/src/models/auto.ts (proposed, condensed)
return defineDynamic(async (ctx) => {
  const key = await ctx.oncePer(ctx.turn.id, (occurrence) => choose(ctx, occurrence)); // an option key
  return optionOf(key); // the option key, as the authored model
});
```

The framework keeps the key, returns it in any process, gives a retry the same occurrence, and runs it again after a deployment change. The context key and its fingerprint are deleted. Because `choose` reads the turn's input inside the memo, it reads it once, at the turn's first model call. The authoring API is unchanged:

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

## Hooks

A hook is either a function eve runs after every commit, for where things stand, or an `events` map, for what happened. Both read committed session state and event payloads, without access to the assembled conversation. A hook performs effects or returns commands; there is no live capability to build.

```ts
// agent/hooks/compact-when-idle.ts
import { idle } from "eve/events";
import { compact, defineHook } from "eve/hooks";

export default defineHook((ctx) =>
  idle(ctx.view) && ctx.turn !== null ? compact({ reason: "The session went idle." }) : null,
);
```

The function runs after every commit, inside a turn or between turns, so "the session went idle" is noticed when it happens. It runs often, so it should be cheap: I/O belongs in a memo, which runs only when its key is new. Returning `compact()` on every commit while the session is idle asks for one compaction ([Commands](#commands)).

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

Both forms remain useful: "whenever the session becomes idle" and "for every settled turn" are different requests.

### Occurrences

A memo holds one key at a time, so a key and its occurrence are different things:

```text
key:         false → true → false → true
occurrence:    1       2       3       4
```

The two `true` keys are equal, but they are different occurrences. A retry of occurrence 2 keeps its identity; occurrence 4 gets a new one. Authors don't need to invent keys to express a repeated transition. Work that should happen only once keeps one key, such as `ctx.session.id`:

```ts
// agent/hooks/budget-alert.ts
import { defineHook } from "eve/hooks";
import { email } from "../lib/email";
import { spentUsd } from "../lib/usage";

export default defineHook(async (ctx) => {
  if (spentUsd(ctx.view) <= 50) return;
  await ctx.oncePer(ctx.session.id, (occurrence) =>
    email.send({ template: "budget", idempotencyKey: occurrence.id }),
  );
});
```

eve derives a memo occurrence's identity from the definition, the memo's name, a count of its key changes, and a digest of the key. A retry after a crash computes the same identity, because nothing new was committed, so eve doesn't have to write anything before `fn` runs. An event handler's occurrence is the fact's position in the stream:

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

Pass the occurrence's ID to an external service as an idempotency key; if an occurrence performs several operations, give each a stable suffix, such as `${occurrence.id}:route` in the router above.

An effect can succeed just before a process fails to save its result. A memo's result becomes durable with the step that ran it, and a crash before then runs `fn` again with the same occurrence. **Execution is at least once until checkpointed**, not exactly once; an external service must honor the idempotency key to avoid repeating its effect.

### Commands

A command is a request against a target, not against an occurrence:

- **`cancel()` targets the turn running when it is returned,** and is done once eve has asked that turn to stop. Between turns, it does nothing.
- **`compact()` targets the next model call,** and is done when a compaction starts.

A request equal to one that is pending or done for the same target is dropped. A hook may therefore return the same command on every commit while its condition holds: compact-when-idle compacts once per idle stretch, and a hook that cancels while credentials are missing cancels each turn that starts without them. A condition that stays true after its command acts asks again at the next target: a hook that compacts above a token count compacts before every model call if compaction can't get below it. Event handlers follow the same rule. Applying commands remains eve's responsibility, including deciding whether they are still valid.

## Instructions

An instruction's role decides which kind of contribution it is.

A **system instruction** is something to hold. It applies to every model call while the definition returns it, and disappears when it returns `null`:

```ts
// agent/instructions/long-conversation.ts
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic((ctx) =>
  ctx.view.session.turnCount > 6
    ? defineInstructions({ content: "Summarize what's settled before answering." })
    : null,
);
```

A **user instruction** joins the conversation, before the turn's input, when its content differs from the last one its file added. It stays there like any other message:

```ts
// agent/instructions/brief.ts
import { defineDynamic, defineInstructions } from "eve/instructions";
import { loadBrief } from "../lib/briefs";

export default defineDynamic(async (ctx) => {
  const brief = await ctx.oncePer(ctx.turn.id, () => loadBrief(ctx.session.auth.current));
  return brief ? defineInstructions({ content: brief, role: "user" }) : null;
});
```

The brief is fetched every turn, and joins the conversation when it changed. An unchanged brief isn't added again, where a `turn.started` handler on `main` appends the same text every turn. A later `null` adds nothing and doesn't remove what is already in the conversation; compaction and clear treat it like other history, as on `main`, and neither makes the same content join again. `main`'s replacement-session recipe, which hands a stranded session's transcript to its replacement, keeps working: a memo keyed by the predecessor's ID reads the transcript once, and it joins once.

A hook command for adding messages could follow if a case needs one, such as adding a message from an event handler. It is additive and not part of the initial change.

## When things run, and how they recover

### Clear execution boundaries

This is the author-facing contract, rather than an incidental order of internal callbacks:

- **Hooks run after each commit.** A hook function runs after every commit, inside a turn or between turns; an event handler runs for each matching fact. Streamed progress, such as content deltas, reaches only event handlers that handle it.
- **Dynamic values are evaluated before each model call.** eve evaluates each definition, runs the memos whose keys are new, and fixes the model, tools, and context that call uses. Changes during a tool batch affect the next model call.
- **A cancelling hook stops subsequent work at that boundary.** Hooks run before values, so a cancel takes effect before any value fetches data.
- **A requested tool runs only as it was offered.** A call that waits for approval keeps a digest of its tool's declaration and of the memo results its definition was evaluated with. If they differ when the call executes, because the caller's role or tenant changed during an approval wait, the call fails with a tool error saying the tool changed since it was offered, and the model can request it again. A memo that runs again and keeps the same data, such as one keyed by turn, is not a change. Authorization is still checked at execution time.
- **Only dynamic values read the conversation.** Hooks have no assembled-conversation access, so they can run after every commit, including background work between turns.

Which model calls are boundaries:

- **Every ordinary model call of a turn,** including the call after a tool batch and the call after an approval resumes. Compaction's summarizing call, the evaluator `auto()` asks, and `evaluate` inside a tool are not boundaries.
- **A steering message is visible at the next boundary.** It is not a new turn, so memos keyed by `ctx.turn.id` don't run again; code that reads `ctx.messages` sees it before the next model call.
- **A resumed approval runs its calls first.** Approved calls execute, with the check above, and then values are evaluated before the next model call. Nothing evaluates while a turn waits.
- **Compaction is not a boundary.** The next boundary sees the compacted conversation, so code over messages may change: the image model returns to text once a summary replaces the image.

Evaluating a definition and installing its value into a model request are not the same operation. This leaves room to keep provider-visible tool lists stable where prompt caching benefits from it.

### Cold starts reuse committed answers

```text
first evaluation:  function → oncePer runs fn → result kept → capability
                                                    │
                                                    ▼
                                               durable memo
                                                    │
fresh process:     function → oncePer returns ◄─────┘ → capability
```

A fresh process evaluates each definition again, and each memo returns its committed result. It does not query the database or router again merely to recover a capability. If a memo was interrupted before its result committed, the retry runs it again.

eve compares what the fresh evaluation offers with what the session was offered: tool declarations, and a connection's URL, instance key, and credential owner, since equal names or descriptions do not make two executable capabilities equivalent. A difference means code outside the memos isn't deterministic. The memos are still valid data, so eve keeps them, offers the new value at this boundary, and logs a diagnostic naming the file. Calls already requested from the old version fail as described above. In development, eve evaluates each definition twice the first time, with its memos fixed, and compares, so a `Math.random()` outside a memo shows up immediately rather than after a cold start in production.

The comparison is a useful check, not proof that arbitrary callbacks behave identically: deterministic code outside memos remains an author obligation.

### Failures are visible

An unhandled error in a definition, a memo, or a hook fails the owning execution. During a turn, it fails the turn: a value's before the model call it was evaluated for, and a hook's before the turn's next model call, or as the turn would otherwise settle. That includes event handlers that only observe: an audit or metrics hook that mustn't fail a turn catches its own errors. On `main`, a throwing hook is logged and the turn continues, so a hook can't enforce anything by throwing.

- **A failed memo keeps nothing.** The next evaluation runs it again, even under the same key, so a transient error can't break a once-per-session value for the rest of the session. That holds for hooks too: a hook's failed memo runs again at the next commit while its key stands.
- **An event handler runs once per fact.** A failure isn't retried later, though the workflow's own step retries still apply.
- **A hook running between turns has no turn to fail.** eve logs the failure with the hook, the occurrence, and the error. It does not retroactively fail an already completed turn. A public fact for it can come later: readers ignore fact types they don't recognize, so adding one doesn't break them.

There is no initial failure-policy option. If behavior is optional, the author catches an expected error and returns no contribution. Where the `try` sits matters: a memo that catches its own failure and returns `null` keeps that `null` until its key changes, while a `try` around `await ctx.oncePer(...)` keeps nothing, so the next evaluation tries again. Unexpected errors still propagate. In particular, eve must not respond to a failure by silently removing required instructions or exposing a static connection with different credentials as a fallback.

### Deployment changes invalidate memos

Only idle sessions move to a new deployment. At that transition, memos are discarded, whether they feed code or are only data, and run again at the next boundary. A once-per-session instruction should not keep an obsolete policy just because it is plain text. For the same reason, a memo keyed by `ctx.session.id` that captured the first caller captures whoever is current after a deployment change.

The new deployment must not blindly build from old data with incompatible new code. Start with running memos again as the uniform rule; explicit cross-deployment reuse can come later if needed. Completed event-handler occurrences are not replayed merely because a deployment changed.

### Values used outside the session

Some values are needed where the session's state isn't: a remote child is opened, messaged, reset, and cancelled by steps of its own, and its stream is followed by a route that has no session state at all. On `main`, a compiler pass found a dynamic remote agent's `auth` and `headers` and registered them by ID for those places.

With memos, eve evaluates the definition there too, from what the child was opened with:

- **A child is bound to the evaluation that opened it.** The step that opens a remote child stores, on the child's address, the session identity, the turn, `ctx.now`, and the memo results its remote agent was built from. The steps that message, reset, and cancel it, the route that follows its stream, and the relay that answers its questions all carry that binding. The binding stays private: it rides the parent's step state and private side stream, never a public fact or a request to the child.
- **Outside a model call, a definition sees that binding.** `ctx.session`, `ctx.turn`, and `ctx.now` are as they were when the child was opened, and each memo returns the result it had then, without running. `ctx.view`, `ctx.messages`, and `ctx.model` are unavailable; reading one fails the request with an error naming the file and the read. So does a memo the child wasn't opened with, or a key that differs from the bound one.
- **The destination is checked before credentials are used.** The name and URL the evaluation returns must match what the child was opened with, including after a deployment change, or the request fails rather than sending credentials elsewhere.
- **In development, eve checks this when a child opens,** by evaluating the definition from the new binding right away, so a read that can't be restored shows up the first time rather than on a later message or cancel.

```ts
// agent/subagents/finance.ts
import { defineDynamic, defineRemoteAgent } from "eve";
import { mintTenantToken, tenants } from "../lib/tenants";

export default defineDynamic(async (ctx) => {
  const tenantId = ctx.session.auth.current?.attributes.tenantId;
  if (!tenantId) return null;
  const tenant = await ctx.oncePer(tenantId, () => tenants.lookup(tenantId)); // { id, region }
  return defineRemoteAgent({
    description: "Analyze financial and accounting data.",
    url: `https://${tenant.region}.finance.example.com`,
    auth: async () => ({
      headers: { authorization: `Bearer ${await mintTenantToken(tenant.id)}` },
    }),
  });
});
```

`auth` still takes no arguments: it closes over `tenant`, and the definition can recreate it anywhere. If Bob, from another tenant, writes to the session after Alice's turn opened the child, the parent's later requests to that child still carry Alice's tenant, because `ctx.session` is the one the child was opened with.

Reads inside a memo are fine, because a restored memo doesn't run. Reading the conversation or the view outside one is what fails. A gate like this works before every model call, and fails when eve reaches the child:

```ts
if (!mentionsInvoices(ctx.messages)) return null; // fails when the child is messaged or cancelled
```

Moving the gate into a memo keyed by turn restores it, at the cost of deciding once per turn rather than per model call:

```ts
const offer = await ctx.oncePer(ctx.turn.id, () => mentionsInvoices(ctx.messages), {
  name: "offer",
});
if (!offer) return null;
```

This is where `select`, `record`, and `render` was stronger: the gate lived in `select`, and `render` needed only the record. A dynamic `defineWorkspaceAgent`, which `main`'s compiler pass never handled, goes through the same path, though the prototype doesn't test it yet.

### What eve stores

- **A memo's key is at most 64 KB, and its result at most 1 MB.** The error names the file and the memo, and suggests keeping an ID and fetching the rest when it is used.
- **Memos are private.** They live in the session's checkpointed state, never on the public stream. So do the bindings of remote children, and the digest of the last user instruction each file added.
- **Stored state rides along every step.** A turn step's input and result carry the session's state and history, so a memo is re-sent and re-persisted on each step. `main` has the same cost for its closure snapshots, which it stores separately for each callback, with no cap.
- **Diagnostics go to logs, and later traces.** Each memo run reports the file, the memo, the occurrence, what triggered it (a new key, a retry after failure, or a deployment change), how long it took, and whether the definition's value changed. A fresh evaluation that doesn't match what was offered is reported too. The prototype logs them at debug level. There is no public API for them.

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
import { hasImage } from "./lib/messages";

export default defineAgent({
  model: defineDynamic((ctx) =>
    ctx.messages.some(hasImage) ? "google/gemini-3.5-flash" : "zai/glm-5.2",
  ),
});
```

- **The event name goes.** The function runs before every model call, as a `step.started` handler does, and `ctx.messages` is the conversation that call will send.

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
  model: defineDynamic((ctx) =>
    ctx.session.auth.initiator?.attributes.plan === "enterprise"
      ? "anthropic/claude-opus-5.5"
      : "anthropic/claude-sonnet-5",
  ),
});
```

- **The same once-per-session behavior,** because the initiator doesn't change. Reading `session.auth.current` instead follows the current caller, which `main` can't express for models without `step.started`.

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

export default defineDynamic((ctx) =>
  ctx.session.auth.current?.attributes.plan === "enterprise"
    ? defineAgent({ description: "Analyze financial and accounting data.", model: ctx.model.id })
    : null,
);
```

- **The behavior differs.** `main` snapshots the parent's model when the session starts. Here the subagent follows the parent's model. Keeping the first one is a memo: `model: await ctx.oncePer(ctx.session.id, () => ctx.model.id)`.
- **A remote subagent** has the same shape, returning `defineRemoteAgent({ description, url })`. Its `auth` and `headers` are built from the child's binding wherever the child is reached ([Values used outside the session](#values-used-outside-the-session)).

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
import { listEnabledAccounts, mintAccountToken } from "../lib/accounts";

export default defineDynamic(async (ctx) => {
  const principal = ctx.session.auth.current;
  if (principal?.principalType !== "user") return null;

  const accounts = await ctx.oncePer(principal, () => listEnabledAccounts(principal));
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
});
```

- **One line changes:** the fetch is a memo. It follows the current caller where `main` keeps the first.
- **`main` warns that connection handlers "may run again when a parked turn resumes or a durable step retries".** Here `listEnabledAccounts` runs once per caller, and a fresh process builds the connections from the kept accounts.
- **The token is minted by `getToken` when it's needed,** and never kept.

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
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { listTables, runReadOnly } from "../lib/warehouse";

export default defineDynamic(async (ctx) => {
  const tables = await ctx.oncePer(ctx.session.id, async () =>
    (await listTables()).map(({ name, columns }) => ({ name, columns })),
  );
  return Object.fromEntries(
    tables.map((t) => [
      t.name,
      defineTool({
        description: `Query ${t.name}. Columns: ${t.columns.join(", ")}`,
        inputSchema: z.object({ sql: z.string() }),
        execute: ({ sql }) => runReadOnly(t.name, sql),
      }),
    ]),
  );
});
```

- **The fetch is a memo,** and keeps only the fields the tools use.
- **The rules about callbacks are gone.** `main` requires inline callbacks with JSON-serializable captures and inline schemas, and rejects `execute: makeExecutor()`. Code outside the memo is ordinary code: it can call helpers, create clients, or keep a schema in a variable.
- **The memo is what survives.** `main` snapshots what `execute` captures from its handler. Here only the memo's result is kept: a value `execute` captured from outside the memo, such as one fetched with an `await` outside it, is fetched again after a cold start.

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
export default defineDynamic((ctx) =>
  ctx.view.session.turnCount === 1 ? { query: queryTool } : { search: searchTool },
);
```

- **There's no precedence to learn.** On `main`, what a model call sees depends on how scopes combine: session, turn, and step tools are merged, a narrower scope wins a name collision, and steering skips `turn.started`. Here the tools are what the function returns: `query` for the first turn, and `search` after it.

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
export default defineDynamic((ctx) => {
  const region = ctx.session.auth.current?.attributes.region ?? "us";
  return { search: createSearchTool(`https://${region}.catalog.example.com`) };
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

export default defineDynamic((ctx) => {
  const team = ctx.session.auth.current?.attributes.team;
  const markdown = team ? PLAYBOOKS[team] : undefined;
  return markdown ? defineSkill({ markdown }) : null;
});
```

- **The same code without the event,** and it follows the caller: a message from someone on another team changes the skill, where `session.started` never runs again.

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

export default defineDynamic((ctx) => {
  const plan = ctx.session.auth.current?.attributes.plan ?? "free";
  return defineInstructions({
    content: `The caller is on the ${plan} plan. Match the depth of your answers to it.`,
  });
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
import { defineDynamic, defineInstructions } from "eve/instructions";
import { loadBrief } from "../lib/briefs";

export default defineDynamic(async (ctx) => {
  const brief = await ctx.oncePer(ctx.turn.id, () => loadBrief(ctx.session.auth.current));
  return brief ? defineInstructions({ content: brief, role: "user" }) : null;
});
```

- **The brief is fetched every turn, and joins the conversation when it changed.** `main` appends it every turn, even when it hasn't changed.
- **`main`'s augmented message snapshots go away.** An instruction resolver on `main` sees static user instructions at `session.started`, and session results at `turn.started`; other kinds see a different snapshot. `ctx.messages` is the same conversation for every dynamic value evaluated at that boundary; hooks do not receive it.

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

Audit, persistence, and sandbox-stopping hooks remain event handlers with side effects. They read event payloads and committed session state; any hook that previously read the assembled conversation must migrate to those inputs. A side effect that must happen once per occurrence keys on `ctx.occurrence.id` instead of coordinates copied from `event.data`.

</details>

## Other models, same examples

Four examples cover what differs between the models: tools built from fetched data, a decision per turn, a remote agent whose credentials are needed outside the session, and a hook that acts when state crosses a line. `main`'s versions of the first two are in [Before and after](#before-and-after) and [How `auto()` works](#how-auto-works-on-main-and-now).

- **`oncePer`**, proposed here.
- **`select`, `record`, and `render`**, as #4616 prototypes it. `select` is a synchronous function returning the JSON the value depends on, with `once`, `perTurn`, and `perStep` helpers. `record` runs when the selection changes, and its JSON result is kept. `render` is synchronous and pure, and builds the value from the record, or from the selection when there is no `record`. Hooks use `select` with `run`.
- **Moments**: named boundaries at which eve asks a definition for something, such as `beforeSession`, `beforeTurn`, and `beforeModelCall`, each with a typed input. A moment's result is kept for its lifetime, and `beforeModelCall` builds the value from it. Hooks use moments such as `afterCommit`.
- **Code by name**, only where it differs: the definition returns data, and code is found again through a factory registered under a stable name.

The moments and code-by-name APIs are sketches for comparison; neither exists.

<details>
<summary>The four examples in each model</summary>

### Tools from a warehouse

```ts
// oncePer
export default defineDynamic(async (ctx) => {
  const tables = await ctx.oncePer(ctx.session.id, async () =>
    (await listTables()).map(({ name, columns }) => ({ name, columns })),
  );
  return Object.fromEntries(tables.map((t) => [t.name, tableTool(t)]));
});
```

```ts
// select, record, and render
export default defineDynamic({
  select: once,
  record: async () => (await listTables()).map(({ name, columns }) => ({ name, columns })),
  render: (tables) => Object.fromEntries(tables.map((t) => [t.name, tableTool(t)])),
});
```

```ts
// moments
export default defineDynamic({
  beforeSession: async () => (await listTables()).map(({ name, columns }) => ({ name, columns })),
  beforeModelCall: (tables) => Object.fromEntries(tables.map((t) => [t.name, tableTool(t)])),
});
```

```ts
// code by name
const tableTool = defineToolFactory("warehouse.table", (t: Table) =>
  defineTool({
    description: `Query ${t.name}. Columns: ${t.columns.join(", ")}`,
    inputSchema: z.object({ sql: z.string() }),
    execute: ({ sql }) => runReadOnly(t.name, sql),
  }),
);

export default defineDynamic({
  per: "session",
  resolve: async () =>
    (await listTables()).map(({ name, columns }) => tableTool({ name, columns })),
});
```

- **`oncePer` and `select`/`record`/`render` keep the same data** and build the same tools. The three callbacks separate them structurally: `render` can't `await`, so it can't fetch by accident. With `oncePer`, that separation is a convention.
- **Moments name the lifetime** instead of keying it, and need a list of them.
- **Code by name stores `["warehouse.table", t]` for each tool,** and a fresh process calls the registered factory. Recovery is exact, but every factory needs a stable name and registration: a parallel API, like `defineDurableCallback`, for every package that ships tools.

### A router per turn

```ts
// oncePer
model: defineDynamic(async (ctx) => {
  const tier = await ctx.oncePer(ctx.turn.id, (occurrence) =>
    chooseTier({ messages: ctx.messages, idempotencyKey: occurrence.id }),
  );
  return models[tier];
}),
```

```ts
// select, record, and render
model: defineDynamic({
  select: perTurn,
  record: async (_turn, ctx) =>
    await chooseTier({ messages: await ctx.messages(), idempotencyKey: ctx.occurrence.id }),
  render: (tier) => models[tier],
}),
```

```ts
// moments
model: defineDynamic({
  beforeTurn: async (ctx) =>
    await chooseTier({ messages: ctx.messages, idempotencyKey: ctx.occurrence.id }),
  beforeModelCall: (tier) => models[tier],
}),
```

- **All three keep the tier and build the model from it.** They differ in how the lifetime is spelled: a key, a selector helper, or a moment's name.

### A remote agent per tenant

```ts
// oncePer
export default defineDynamic(async (ctx) => {
  const tenantId = ctx.session.auth.current?.attributes.tenantId;
  if (!tenantId) return null;
  const tenant = await ctx.oncePer(tenantId, () => tenants.lookup(tenantId));
  return financeAgent(tenant);
});
```

```ts
// select, record, and render
export default defineDynamic({
  select: ({ session }) => session.auth.current?.attributes.tenantId ?? null,
  record: async (tenantId) => (tenantId === null ? null : await tenants.lookup(tenantId)),
  render: (tenant) => (tenant === null ? null : financeAgent(tenant)),
});
```

```ts
// moments
export default defineDynamic({
  beforeTurn: async (ctx) => {
    const tenantId = ctx.session.auth.current?.attributes.tenantId;
    return tenantId ? await tenants.lookup(tenantId) : null; // every turn: no moment for "the tenant changed"
  },
  beforeModelCall: (tenant) => (tenant === null ? null : financeAgent(tenant)),
});
```

`financeAgent(tenant)` returns `defineRemoteAgent({ description, url, auth })`, with `auth` closing over `tenant`.

- **`select`/`record`/`render` is the strongest here.** Outside the session, eve calls `render(record)`, which needs no context at all, so a gate on the conversation in `select` costs nothing. With `oncePer`, eve evaluates the whole function from the child's binding, and a read of the conversation outside a memo fails there ([Values used outside the session](#values-used-outside-the-session)).
- **Moments can't say "when the tenant changes".** `beforeSession` misses a new caller, and `beforeTurn` looks the tenant up every turn.

### A budget alert

```ts
// oncePer
export default defineHook(async (ctx) => {
  if (spentUsd(ctx.view) <= 50) return;
  await ctx.oncePer(ctx.session.id, (occurrence) =>
    email.send({ template: "budget", idempotencyKey: occurrence.id }),
  );
});
```

```ts
// select, record, and render
export default defineHook({
  select: ({ view }) => spentUsd(view) > 50,
  run: async (over, ctx) => {
    if (over) await email.send({ template: "budget", idempotencyKey: ctx.occurrence.id });
  },
});
```

```ts
// moments
const alerted = defineState("budget-alert.sent", () => false);

export default defineHook({
  afterCommit: async (ctx) => {
    if (spentUsd(ctx.view) <= 50 || alerted.get()) return;
    await email.send({ template: "budget", idempotencyKey: `${ctx.session.id}:budget` });
    alerted.update(() => true);
  },
});
```

- **`select` and `run` act on each transition** of the selection; `oncePer` gets the same by keying on the condition, or acts once per session, as here, by keying on the session.
- **Moments have no memory of their own.** The hook keeps its own flag in state, and builds its own idempotency key.

</details>

### Other approaches

- **Events, as on `main`.** Handlers on lifecycle events, with a compiler that snapshots what callbacks capture. Each kind keeps its own precedence rules, and recovery runs handlers again.
- **`select`, `record`, and `render`.** Structurally separates data from code: `select` and `render` can't `await`. Stronger for values used outside the session, and it is what #4616 prototypes. Three callbacks for one idea read worse for the common cases, which need no data and fit in one function.
- **Moments.** Honest about when eve asks, unlike stand-in events, but a fixed list of lifetimes brings back precedence between them. Decision moments, such as before tool calls, before compaction, or before a turn settles, could come later where a concrete case needs a typed decision.
- **Code by name.** Data descriptors with factories found by registered name, the way `pi-durable` resolves code. Exact recovery, at the cost of naming and registering every factory.
- **Compiler closure conversion,** as on `main`. Automatic, and it snapshots every capture, but it restricts what callbacks may look like and costs a compiler ([What this removes](#what-this-removes)). A lint for `await` outside a memo would recover some of its safety without one.
- **A synchronous function with suspending memos,** in the style of React's `use`: a memo without a result suspends the function, and eve runs it again when the result arrives. `await` outside a memo becomes impossible, but evaluation is harder to follow and every memo miss re-runs the function.
- **Decisions as public facts.** Recording a router's choice or a tenant lookup on the public stream would make them visible to clients, but exposes private data and grows the public schema. Memos stay private; a specific decision can become a fact when a client needs it, as the chosen model already appears in `model.started`.

## What this removes

On `main`, recovering dynamic tools and remote credentials takes a compiler. About 1,060 lines of build transforms under `internal/workflow-bundle/dynamic-*` parse authored source, find what callbacks capture, and rewrite them into registered factories. About 1,020 more in `tools/durable-callbacks.ts` and `context/dynamic-tool-lifecycle.ts` register and rebind them at runtime, alongside `defineDurableCallback` and `defineDurableSchema` for code the compiler can't see. Memos need none of it, and builds stop parsing authored source.

The rest follows from one lifecycle:

- **Six lifecycles did one job six times.** Each decided when to run, where to keep its result, how a later result replaced an earlier one, and how to recover after a restart, with its own rules. That is what authors learned per kind, and it is what the code repeated. One runner does it once; a kind supplies how its value contributes to the session.
- **Precedence and replay rules disappear.** Turn results shadowing session results, steering skipping `turn.started`, and re-running handlers to rebind callbacks are cases that one function per value doesn't have, and neither do their tests.

## Pros and cons

### Pros

- **One function, in ordinary code.** Most definitions read like `main`'s handlers without the event, and a fetch becomes one `ctx.oncePer` line.
- **An explicit persistence boundary.** A memo is what survives a restart; packages return ordinary tools; callback code stays code. eve can retire the per-kind lifecycle and closure-rebinding machinery rather than teach authors its restrictions.
- **Lifetimes are keys.** Per session, per turn, per tenant, or any combination, without named lifetimes or precedence between them. A first value latches with a memo keyed by the session.
- **`auto()` is ordinary.** Its caching moves into the framework, and authors can write their own routers without internals.
- **Hooks act on state.** A hook can compact or cancel when a condition holds, with a plain `if`, and returning the same command again is safe.
- **Visible failures.** A required instruction or credential check can't silently disappear, and transient errors recover at the next boundary.
- **No compiler pass** over authored source in every build.

### Cons

- **Determinism outside memos is a convention.** Nothing stops an `await` outside a memo; the development check and the comparison on cold starts catch some mistakes, not all. `select`/`record`/`render` made an `await` in `render` impossible to write.
- **Only memo results are snapshotted.** A callback that captures something fetched outside a memo gets a fresh answer after a cold start, where `main`'s compiler kept what each callback captured from its handler.
- **Remote agents ask more of their code.** Outside a model call, a definition sees only the child's binding, so a gate on the conversation has to move into a memo.
- **The function runs before every model call.** Expensive work outside a memo repeats.
- **A caught failure inside a memo sticks** until its key changes.
- **Commands repeat while their condition holds.** A condition that stays true after its command acts asks again at the next target.
- **A memo holds one key.** Alternating between two keys runs the memo each time.

## Scope

The initial change is dynamic values and hooks on the v27 view, with `ctx.oncePer`, occurrences, commands, and recovery. Keep `defineDynamic`, retain event hooks, and add function hooks and returned commands. Moving #4616 to this API changes its definitions and hook kind: the runner keeps one result per memo rather than one record per definition, and remote credentials come from evaluating the definition from the child's binding rather than calling `render`.

Do not add `defineGuard`, a universal public `defineReaction`, an `onError` option, a lint for `await` outside memos, arbitrary dependency graphs, a command for adding messages, or a new task-authoring API. An `onError` option and the lint may come later.
