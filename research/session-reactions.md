---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-11"
---

# Session reactions and dynamic values

This doc covers everything that changes during an eve session: the model, tools, skills, instructions, connections, subagents, and what hooks do in response. It describes how `main` handles them, what that costs authors and eve, and the model that replaces it: **reactions**, and the **dynamic values** authors write with them. It replaces the earlier `session-reactions.md` and `dynamic-values.md`.

The prototype is [#4616](https://github.com/vercel/eve/pull/4616), on the v27 stack. Code examples labelled "main" come from main's docs unless they say otherwise.

## Summary

- **On `main`, dynamism is implemented as handlers on three lifecycle events.** Each kind allows a different subset of `session.started`, `turn.started`, and `step.started`, fails in its own way, and survives a cold start through a compiler pass that snapshots what its callbacks capture ([How dynamism works on main](#how-dynamism-works-on-main)).
- **That costs authors a list of exceptions per kind, and eve about 4,300 lines** of lifecycles, transforms, and durable callbacks. Some things can't be said at all: a hook can't compact, and nothing can depend on state other than those three events ([What that costs](#what-that-costs)).
- **Proposal: all dynamism is a reaction** An internal `defineReaction` interface supports all dynamic use case. It consists of three functions, `select`, `record`, and `render`. `record` is optional and omitted for many common cases. ([The model](#the-model))
  - `select` is what the reaction depends on. it's a function of the state of the session, and returns a small JSON-encodable object. this is intended to be fast and cheap, as it runs on every commit that mutates the state of the session. examples include 'the current turn id', 'is the session idle', 'does message history contain any image attachments'. Eve exports named lifetimes for common cases (`once`, `perTurn`, `perStep`)
  - `record` is an optional step that handles any async or non-deterministic work. It takes `select`'s output as input, and returns a separate JSON-encodable object. This function only runs when the value of `select` changes, meaning it is safe to do more expensive work here. Examples would be "query the database for rows describing tools that should be available to this tenant" or "query Jev for what model should be used for this session and store its id". This is broken out from `build` because its values must survive cold process restarts. If we did not have this escape hatch, each cold process restart would run the expensive or non-deterministic code independently. ([Cold starts](#cold-starts))
  - `build` takes in the output of `record` (or `select`, if `record` is not specified) and returns a definition (skill, tool, agent, etc.), data, or intent (compact, clear, etc.).
- **Hooks are reactions.** Reactions can return intents from `render`, and side effects ("send an email when budget limits are exceeded" go in `record`) ([Hooks](#hooks))
- **Most things get simpler to express, a few things get harder.** The lifecycle of when things run and change becomes much more explicit and consistent across our API surface area, and you're able to depend on things that were previously impossible to express. On the flip side, some things get more difficult to express, and there is one small gap vis-a-vis today that becomes impossible to express (addressable, with a bit of extra complexity if we care)([What gets harder](#what-gets-harder-and-what-we-give-up)).

**Status.** #4616 implements this model for every kind, including hooks and `auto()`, and deletes main's lifecycles, transforms, and durable callbacks. Not yet: a dynamic remote agent with `auth` or `headers`.

## How dynamism works on `main`

### Handlers on lifecycle events

A dynamic value on `main` is an event handler that returns a capability:

```ts
// agent/skills/team_playbook.ts (main)
import { defineDynamic, defineSkill } from "eve/skills";

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

Each kind accepts different events, with its own rule for how they combine:

| Kind                             | Events              | How results combine                                                     |
| -------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| Model (`defineAgent({ model })`) | session, turn, step | Step over turn over session. Every matching handler must return a model |
| Tools                            | session, turn, step | "The most recently fired one owns that file's tool set"                 |
| Connections                      | session, turn       | A turn result replaces the session result, including `null`             |
| Subagents                        | session, turn       | A turn selection shadows the session selection, including `null`        |
| Skills                           | session, turn       | `step.started` is "reserved for dynamic tools"                          |
| Instructions                     | session, turn       | A user-role result is appended to history at each boundary              |

The handler receives `ctx.messages`, whose contents depend on the kind: instruction resolvers get a snapshot augmented with earlier instruction results, and the others don't.

### How code survives a cold start

A `session.started` handler runs once, but its tools are used for the rest of the session, by whichever process runs the next step. A closure can't be persisted, so `main` compiles one into something that can be:

```ts
// agent/tools/query.ts, as authored (main)
"session.started": async () => {
  const table = await pickTable();
  return {
    query: defineTool({
      description: `Query ${table}`,
      execute: async (input) => run(table, input), // `run` is a module import
    }),
  };
},
```

```ts
// after the bundler transform (simplified)
function __eve_execute_0(__closure, input) { // hoisted, with a stable identity
  const { table } = __closure;
  return run(table, input);
}
// …
execute: __eveStamp(__eve_execute_0, { table }), // the snapshot { table } persists as JSON
```

```text
first resolve
  ├─ declarations ─────────────────────────▶ persisted: what the model saw
  ├─ closure snapshot { table: "orders" } ─▶ persisted, per callback phase
  └─ __eve_execute_0 ──────────────────────▶ in-process registry
later step, fresh process: registry miss ─▶ re-run the handler only to register the bodies
                                         ─▶ __eve_execute_0(persisted { table: "orders" }, input)
```

- **Every callback phase is hoisted:** `execute`, `approval`, `approvalKey`, three label phases, `toModelOutput`, and the input and output schemas.
- **Captures must be JSON.** "Functions, class instances, `Date`, `Map`, symbols, non-finite numbers, and cyclic values fail resolution."
- **Code the transform can't see needs wrappers.** A package that returns tools wraps every callback in `defineDurableCallback({ closure, callback })` and every live schema in `defineDurableSchema`, or is built with `eve extension build`.
- **Connections and remote agents work differently.** A connection's live `getToken` and headers are rebuilt by running its handler again, and a remote agent's `auth` and `headers` are hoisted into registered factories by a second transform.

### Hooks

Hooks observe. "Handlers are observe-only. They cannot inject model context." The one thing a hook can do to a session is `ctx.cancel()`, which "returns `void` rather than a promise", must be called "before the handler's promise settles", and is ignored on more than a dozen event types. Hooks run at least once: a retried step re-emits its events with new IDs.

### Inside eve

| What                                                           | Lines on `main` |
| -------------------------------------------------------------- | --------------- |
| Six per-kind lifecycles (`context/dynamic-*-lifecycle.ts`)     | 1,683           |
| Dynamic tool building, metadata, and resolve contexts          | 517             |
| The tool and remote-agent transforms, and their bundler plugin | 1,045           |
| Durable callbacks, durable schemas, and rebind                 | 404             |
| Dynamic connection registry and recovery                       | 83              |
| The memory lifecycle                                           | 598             |
| **Total**                                                      | **4,330**       |

## What that costs

### Exceptions authors learn

Each of these is a rule an author has to know to predict what their code does:

- **Which events a kind allows,** and how results combine when a file has several ([the table above](#handlers-on-lifecycle-events)).
- **Steering skips `turn.started`.** "A message that steers a held turn joins it without another `turn.started`, as does a completed sign-in, so `turn.started` resolvers do not see it; `step.started` resolvers do."
- **Callbacks are compiled, with rules.** "Call expressions such as `execute: makeExecutor()` are not transformed." "A schema stored in a resolver-local variable is a non-serializable capture." A client captured from the handler is rejected. Extensions need `eve extension build`, and packages need durable wrappers.
- **Handlers run again on recovery.** "Keep `session.started` and `turn.started` resolvers idempotent and return the same tool identities for the same persisted scope." For connections: "keep external side effects outside the handler."
- **Four failure rules.** A connection that throws "fails the current turn and parks the session". A model that throws fails the turn. A subagent is logged and omitted. Instructions keep "any wider valid system selection".
- **User-role instructions append every time.** "There is no automatic deduplication: returning the same user content on a later turn intentionally appends another message."
- **Snapshots, not values.** A dynamic subagent that reads `ctx.model` "snapshots the model ID; a later parent model change does not retarget the child."
- **`ctx.cancel()`'s timing rules,** and hooks being unable to do anything else.
- **Captured secrets are persisted.** A token minted in a handler and used in `execute` is JSON, so it's stored in the session's durable state as part of the closure snapshot.

### What authors can't say

- **Depend on anything but three events:** a tool that appears once a sign-in tool succeeds, instructions after a long conversation, a compaction when the session goes idle. `step.started` with `ctx.messages` approximates some of these, by running before every model call and re-deriving the answer.
- **Change skills, instructions, connections, or subagents mid-turn.** Only tools and the model accept `step.started`.
- **Act from a hook,** beyond cancelling.
- **Use ordinary code in a dynamic tool:** a client built in the handler, a helper that builds `execute`, a schema in a local variable.

### What eve carries

- **Six lifecycles that each implement** scope, shadowing, failure, and recovery for one kind.
- **A compiler pass over authored source** in every build, with its own rules about what JavaScript it understands.
- **Rebind paths per scope**, which re-run authored handlers to register code, best effort.
- **A closure snapshot per callback phase** in durable state, for every dynamic tool.

## The model

### Select, render, record

The usual reaction is two functions:

```ts
// agent/tools/users.ts
import { defineDynamic } from "eve/tools";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.role ?? null,
  render: (role) =>
    role === "admin"
      ? { list_users: listUsers, delete_user: deleteUser }
      : { list_users: listUsers },
});
```

When `render` needs something to await, `record` goes between them:

```ts
// agent/tools/crm.ts
export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.tenantId ?? null,
  record: async (tenantId) => (tenantId === null ? [] : await db.crmTools(tenantId)),
  render: (rows) => Object.fromEntries(rows.map((row) => [row.slug, crmTool(row)])),
});
```

| Function                 | Runs                                                                 | Sync? | Returns                                          |
| ------------------------ | -------------------------------------------------------------------- | ----- | ------------------------------------------------ |
| `select(view, ctx)`      | After every commit                                                   | Yes   | JSON: what the reaction depends on               |
| `record(selection, ctx)` | Once per new selection, when there's one                             | No    | JSON that eve keeps                              |
| `render(input)`          | Wherever the value is needed: after a change, and in a fresh process | Yes   | The value: tools, instructions, a model, intents |

- **`select` decides when.** It reads the session's view and identity, and eve compares a digest of what it returns with the last one. Nothing else triggers a reaction.
- **`render` makes the value** from the selection, or from what `record` kept. It's synchronous, so it can't do I/O, and it may run again in a process that has never seen the session.
- **`record` is for awaiting.** It runs once per new selection, may read the session's identity, channel, and conversation, and eve keeps what it returns, so that must be JSON. A secret returned from `record` is kept too, so `record` returns what the value is made of, and `render` fetches tokens at the moment they're used.
- **Either can stand alone beside `select`.** Without `record`, `render` gets the selection. Without `render`, what `record` returned is the value, which works when it's already JSON, such as a gateway model ID from an API.
- **Tools and connections are always rendered,** since they carry code, which can't be kept. A `record` that returns a tool fails with "The record of `tools/x.ts` must return JSON".
- **The folder decides what the value is.** `defineDynamic` from `eve/tools` returns tools, from `eve/skills` skills, from `eve/models` a model, and from `eve` a whole subagent. `undefined` or `null` contributes nothing.

The rule an author needs: **`render` makes the value; add `record` when there's something to await.**

### Why these names

- **`select`** is the familiar word for reading what a computation depends on, from selectors and Signals.
- **`render`** describes what the function is: a synchronous description of what the session should have, given its inputs, rendered again wherever it's needed. Rendering a model, a set of tools, or a hook's intents all read naturally.
- **`record`** says what happens to its result. It runs when there's something new to record, its result is kept, and `render` plays it back in any process. That explains both rules authors trip on: what's recorded must be JSON, and a recorded secret is stored. Names such as `load` suggest the opposite, a step that runs every time a process starts.
- **One set of names for every reaction,** hooks included. The previous drafts used `resolve` and `build`. `resolve` collided with Promise resolution and with main's "resolvers", and `build` collided with the static `build` field a dynamic subagent accepts.

### Named lifetimes

Most of main's dynamic values run once per session, turn, or step. Those are named, and exported next to every `defineDynamic` and `defineHook`:

| On `main`         | With reactions     | Runs                             |
| ----------------- | ------------------ | -------------------------------- |
| `session.started` | `select: once`     | Once per session                 |
| `turn.started`    | `select: perTurn`  | Once per turn                    |
| `step.started`    | `select: perStep`  | Once per model call              |
| Not possible      | Any other `select` | Whenever what it returns changes |

They're ordinary selects, so they compose:

```ts
select: (view, { session }) => ({ turn: perTurn(view), team: session.auth.current?.attributes.team }),
```

### What `select` and `record` read

`view` is the session's public tables, as `eve/events` folds them, with selectors such as `idle(view)`, plus:

| Field           | What it is                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `view.latest`   | The position of the latest fact of each type, and `"*"` for the latest fact. Selecting a position runs once per new fact |
| `view.turn`     | The latest turn, running or not, with its `id`, `status`, and `input`                                                    |
| `view.messages` | The conversation as the model sees it. Read lazily, and only available in commits inside a turn step                     |
| `view.model`    | The model the session uses, for kinds that run after the model                                                           |

The second argument of `select` holds the session's ID, auth, schedule, and predecessor, and the channel's kind, continuation token, and metadata. `record` gets the same, an `abortSignal`, and `ctx.messages`. In a commit without the conversation, reading `ctx.messages` postpones `record` to the next commit that has it.

**Only `select` is watched.** Whatever `record` reads besides its selection, such as the caller or the conversation, is captured when it runs and not read again. That's how `auto()` decides once per turn from the conversation before it, and how a value can keep whoever started the session ([Examples](#examples)).

### Where dynamic values go

A dynamic value fills one place in a definition. Each place is its own reaction, with its own selection and record.

| Where                                                                  | Status                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A whole file in `tools/`, `skills/`, `instructions/`, `connections/`   | Supported                                                           |
| A whole subagent at `subagents/<name>/`                                | Supported. `null` omits it. A remote one carries no credentials yet |
| `defineAgent({ model })`, in `agent.ts` and in a subagent's `agent.ts` | Supported, including `auto()`                                       |
| A dynamic `agent.ts`                                                   | A build error that points at the `model` field                      |
| `compaction.model`, `build`, `defaultTools`, `experimental`            | Static: read at build, or before any session                        |
| A single field: a description, a schema, a URL, `available`            | Not yet. Each widens a field type later                             |

Three different things vary over a session, and a field's type says which it takes:

| Kind              | Evaluated                                        | For                                                                                  |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Static**        | At build or deploy                               | `build`, channels, schedules, workflow tools                                         |
| **Dynamic value** | After a commit, when its selection changes       | What the model sees, and which capabilities exist                                    |
| **Callback**      | When it's used, in context, free to have effects | What's needed only when something runs: `execute`, `approval`, `getToken`, `headers` |

If it changes what the model sees, it's a dynamic value. If it's needed only when something executes, it's a callback, created in `render`.

**The model is a field, not a dynamic `agent.ts`.** One place holds one coupled decision: the model and its settings, `{ model, reasoning?, modelContextWindowTokens?, modelOptions? }`, which travel together. Everything that can't vary stays a static field beside it, `model: auto(...)` reads as it does on `main`, and a subagent can keep a static description while choosing its own model.

**Widening a field later is additive** for authors: `T` becomes `T | Dynamic<T>`, and every static definition still type-checks. The cost falls on code that reads definitions, such as agent info and build-time name checks. `available` for subagents and remote agents is the likely first.

### Cold starts

Each reaction keeps a record in the session's durable state: the selection's digest, what the model is offered, the position it changed at, and the deployment that recorded it. When the value carries code, the record also keeps what `render` rendered from. Code lives in a process-local cache.

```text
a step needs a value's code
  ├─ this process rendered it from this record ─▶ use it
  └─ it didn't ─▶ render(what was recorded)
                    └─ what the model sees differs from what it was offered ─▶ fail closed
```

- **`record` never runs again for a selection it already recorded.** A fresh process renders from the record, so a cold start reads no database, asks no router, and mints no token.
- **What the model was offered is recorded too,** such as tool declarations and the model's reference. A render that offers something different withdraws the value, with `"tools/query.ts" rendered something other than what this session was offered.` The tool isn't offered, or the model call fails. That's one rule for every kind, and it fires only when `render` isn't deterministic.
- **A new deployment records again.** Only idle sessions move to a new deployment. A fresh process under it renders the step's code from the record, without the check, and values with code record again at the step's first commit. Values that are only data keep theirs until their selection changes.

**`auto()` is an ordinary definition** of this shape, with nothing an author couldn't write:

```ts
defineDynamic({
  select: turnState, // the turn, and its input up to 16,000 characters
  record: (turn, ctx) => choose(turn, ctx.messages), // asks the router once per turn
  render: (key) => (key === null ? null : optionOf(key)), // the option it chose, as a model
});
```

Before, `auto()` had four privileges: the conversation in its `resolve`, a flag that skipped commits without it, returning `null` before the first turn, and an internal `rebuild`. Each is now a general rule: `ctx.messages` in any `record`, postponing a `record` that reads it where it's missing, `null` meaning no model yet, and rendering from the record.

### Freshness

A value is what its selection says until the selection changes. That's the whole rule:

- **Instructions append when their content changes.** A per-turn brief that comes back the same isn't appended again.
- **What `record` reads beyond its selection isn't watched.** A value that reads `session.auth.current` in `record` keeps the first caller's answer. Select the caller if the value should follow it.
- **Data fetched in `record` stays** until the selection asks again. A value that should refresh every turn selects `perTurn`.

### Failures

A `select`, `record`, or `render` that throws withdraws its value: the capability isn't offered, and the error is logged. eve tries again when the selection or the deployment changes, not on every commit. A model has nothing to fall back to, so the model call that needs it fails, as it does when a dynamic model returns `null`. That replaces main's four rules.

### Hooks

A hook is a reaction like any other, and its `render` returns intents:

```ts
// agent/hooks/compact-when-idle.ts
import { idle } from "eve/events";
import { compact, defineHook } from "eve/hooks";

export default defineHook({
  select: (view) => (idle(view) ? (view.turn?.id ?? null) : null),
  render: (turnId) => (turnId === null ? null : compact({ reason: "The session went idle." })),
});

// agent/hooks/require-credentials.ts: something to await, so record
export default defineHook({
  select: perTurn,
  record: async (_turn, ctx) => await hasWorkspaceCredentials(ctx.session.auth.current),
  render: (ok) => (ok ? null : cancel("Workspace credentials are unavailable.")),
});
```

What differs is what `render` returns, not the kind of definition:

- **Capabilities** (tools, instructions, a model, a subagent) are held while the selection stands, and replaced when it changes.
- **Intents** (`cancel()`, `compact()`) are applied once per selection: each new selection is an occurrence. `cancel(reason?)` stops the turn running when the hook rendered, and `compact({ reason? })` compacts before the next model call. A second idle stretch is a new occurrence, so it compacts again. Rendering the same occurrence again, in any process, applies nothing new.
- **Side effects go in `record`,** which runs once per new selection, and at least once if a step is retried. `ctx.occurrence` is a stable key for the occurrence, to pass as an idempotency key: an email, a charge, a ticket. `render` stays pure.

The runner treats rendered entries by type: it holds capabilities and applies intents once. The folder decides which types are allowed: `tools/` takes tools, `hooks/` takes intents. A reaction that returns tools and an intent together needs no new machinery, only a folder that allows both.

**`defineHook({ events })` remains, as the observer form:** a handler per fact for audit, persistence, and metrics, which may return intents too. That's a callback per fact rather than a function of state, and it stays visibly separate.

Before this, #4616 kept a hook's intents in its slot like a value, with a set of keys already acted on. A plain `compact()` was keyed `default`, so it compacted once per session unless the author invented a name per occurrence. Occurrences removed the set and the naming. A map of intents is still accepted, and its names don't matter.

### Order, and the comparison with Signals

After each commit, eve runs reactions in a fixed order: hooks, memory, the model, connections, subagents, tools, skills, instructions.

- **Hooks first,** so a cancel takes effect before anything else records.
- **The model before the rest,** so later kinds can read `view.model`. Hooks, memory, and the model itself get an error if they read it.
- **Tools after connections and subagents,** so tool names can be checked against theirs.

That's the whole dependency structure: one value and two orderings. A reviewer noted that this is close to TC39 Signals, and that if selects could read shared derivations and earlier values as tracked dependencies, the graph could decide the order. The comparison fits: `select` is a computed's dependency read, the digest its equality check, `render` the computation, and an intent the effect. Three things keep it from carrying over directly:

- **Dependencies have to be durable.** A cold process must know what a value depended on. An explicit `select` returns something serializable to digest and record. Tracking reads automatically would mean recording every read value, which ends up as a less inspectable selection.
- **`record` is async.** Async computeds are the unsettled part of the Signals proposal.
- **Cycles.** If selects read each other, cycles become possible. A fixed order rules them out.

The order isn't API, and shouldn't be documented as such. Shared derivations, a memoized function of the view computed once per commit, can be added later without changing it, and so can reading another value from a `select`.

### What it costs to run

Each `select` runs after every commit. In the standalone prototype, 20 unchanged reactions cost about 7 µs per commit, and commits that only carry streamed deltas skip everything but hooks. A selection is capped at 64 KB. `record` and `render` run only on a change: a vision router decides when the answer flips, rather than before every model call, and connections no longer resolve again before every model call.

### Built on the v27 view

Reactions read the public view that `eve/events` folds from the v27 lifecycle facts. Every concept a `select` needs, such as turns, model runs, calls, interactions, and context changes, is announced, updated, and closed as facts, so it's a row in a table. On v26's events, "has a call to X settled?" would mean replaying events. Memory providers and channel handlers run on the same runner in #4616, and keep their current authoring shapes for now.

## Examples

Each example pairs `main` with reactions, followed by what changed.

### A model for images

```ts
// main
model: defineDynamic({
  events: {
    "step.started": (_event, ctx) =>
      ctx.messages.some(hasImage) ? "google/gemini-3.5-flash" : "zai/glm-5.2",
  },
}),

// reactions
model: defineDynamic({
  select: (view) => view.messages.some(hasImage),
  render: (image) => (image ? "google/gemini-3.5-flash" : "zai/glm-5.2"),
}),
```

The value depends on whether there's an image, and says so. It renders when that flips, rather than running before every model call.

### `auto()`, and a router of your own

```ts
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

Unchanged from `main`. It decides once per turn, from the turn's input and up to seven messages before it, capped at 16,000 characters, as on `main`. The choice is recorded, so tool calls, steering, compaction, and cold starts never ask the router again.

An author can write their own the same way, reading as much of the conversation as they like:

```ts
model: defineDynamic({
  select: perTurn,
  // Once per turn. The conversation isn't watched, so a later message doesn't decide again.
  record: async (_turn, ctx) => {
    const { answers } = await decide({ state: { messages: ctx.messages }, questions: { tier: TIER } });
    return answers.tier.choice; // "hard" | "easy", recorded
  },
  render: (tier) => (tier === "hard" ? openai("gpt-6-sol") : openai("gpt-6-luna")),
}),
```

On `main`, this is a `step.started` handler that runs before every model call. In earlier drafts of #4616 it couldn't be written for long conversations: only `select` saw the conversation, and selections are capped.

### An enterprise-only subagent

```ts
// main
export default defineDynamic({
  events: {
    "session.started": (_event, ctx) =>
      ctx.session.auth.current?.attributes.plan !== "enterprise"
        ? null
        : defineAgent({
            description: "Analyze financial and accounting data.",
            model: ctx.model ? ctx.model.id : "openai/gpt-5.5-mini",
          }),
  },
});

// reactions
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

The behavior differs. `main` snapshots the parent's model when the session starts. This version follows it: the parent's model is part of the selection, so a change renders the subagent again. Keeping the first model takes a hook that latches it into session state ([What gets harder](#what-gets-harder-and-what-we-give-up)).

### One connection per account

```ts
// main
export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const principal = ctx.session.auth.current;
      if (principal?.principalType !== "user") return null;
      const accounts = await listEnabledAccounts(principal);
      return Object.fromEntries(
        accounts.map((account) => [account.slug, accountConnection(account)]),
      );
    },
  },
});

// reactions
export default defineDynamic({
  select: (_view, { session }) =>
    session.auth.current?.principalType === "user" ? session.auth.current : null,
  record: async (principal) => (principal === null ? [] : await listEnabledAccounts(principal)),
  render: (accounts) =>
    Object.fromEntries(accounts.map((account) => [account.slug, accountConnection(account)])),
});

// shared
const accountConnection = (account: Account) =>
  defineMcpClientConnection({
    url: "https://mcp.cloud.example.com",
    description: `${account.label} (${account.accountId})`,
    instanceKey: account.accountId,
    auth: {
      credentialOwner: "user",
      getToken: ({ principal }) => mintAccountToken(principal, account),
    },
  });
```

`main` warns that connection handlers "may run again when a parked turn resumes or a durable step retries", so they must be idempotent, without side effects. Here `listEnabledAccounts` runs once per caller, and a cold start only renders the connections from the recorded accounts. The token is minted by `getToken` when it's needed, never recorded.

### One tool per warehouse table

```ts
// main
export default defineDynamic({
  events: {
    "session.started": async () =>
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

// reactions
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

A few more lines: the fetch and the tools are separate. In exchange, the rules about what `execute` and `inputSchema` may capture are gone. `render` could create a client, call a helper, or keep a schema in a local variable.

### A package's tool

```ts
// main: every callback wrapped, every value in `closure`
export function createSearchTool(baseUrl: string) {
  return defineTool({
    description: "Search the provider catalog.",
    inputSchema: z.object({ query: z.string() }),
    execute: defineDurableCallback({
      closure: { baseUrl },
      callback: async ({ baseUrl }, { query }: { query: string }) =>
        (await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`)).json(),
    }),
  });
}

// reactions: an ordinary function
export function createSearchTool(baseUrl: string) {
  return defineTool({
    description: "Search the provider catalog.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) =>
      (await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`)).json(),
  });
}

// used from render
render: ({ baseUrl }) => ({ search: createSearchTool(baseUrl) }),
```

`defineDurableCallback` and `defineDurableSchema` are deleted, and an extension doesn't need a special build for its tools to survive a cold start.

### Tools chosen by role

```ts
// main
export default defineDynamic({
  events: {
    "session.started": (_event, ctx) =>
      ctx.session.auth.current?.attributes.role === "admin"
        ? { list_users: listUsers, delete_user: deleteUser }
        : { list_users: listUsers },
  },
});

// reactions
export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.role ?? null,
  render: (role) =>
    role === "admin"
      ? { list_users: listUsers, delete_user: deleteUser }
      : { list_users: listUsers },
});
```

A role that changes mid-session changes the tools at the next model call. To keep the role of whoever started the session, as `main` does, read it in `record` instead, which captures it once:

```ts
select: once,
record: (_selected, ctx) => ctx.session.auth.current?.attributes.role ?? null,
render: (role) => (role === "admin" ? { list_users: listUsers, delete_user: deleteUser } : { list_users: listUsers }),
```

### A tool that returns a random number

This one shows what happens to a value that isn't a function of its inputs:

```ts
// main
"session.started": () => {
  const x = Math.random();
  return { lucky: defineTool({ description: "Returns the lucky number.", execute: () => ({ x }) }) };
},

// an earlier draft of #4616
select: () => null,
resolve: () => {
  const x = Math.random();
  return { lucky: defineTool({ description: "Returns the lucky number.", execute: () => ({ x }) }) };
},

// reactions
select: once,
record: () => Math.random(),
render: (x) => ({ lucky: defineTool({ description: "Returns the lucky number.", execute: () => ({ x }) }) }),
```

|                   | What a cold start does                                                                            | What the author sees                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`            | Calls the hoisted `execute` with the snapshot `{ x }`                                             | The same number for the whole session                                                                                                                                                                                                                                          |
| The earlier draft | Runs `resolve` again, which picks a new `x`. The declaration matches, so the new tool is accepted | A different number whenever a step lands in a process without the session's code: another instance, an evicted cache, a restart. Never locally. If `x` were in the description, the tool would fail closed, and with a constant selection it would stay failed for the session |
| Reactions         | Renders again with the recorded `x`                                                               | The same number for the whole session. A `record` that returned the tool itself would fail immediately, because a tool isn't JSON                                                                                                                                              |

Only randomness inside `render` could still drift, and `render` is the one function documented as pure.

### A playbook for the caller's team

```ts
// reactions (main is at the top of this doc)
export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.team ?? null,
  render: (team) => (team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null),
});
```

The same length as on `main`. It also follows the caller: a delivery from someone on another team changes the skill, where `session.started` never runs again.

### A brief for every turn

```ts
// main
export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const brief = await loadBrief(ctx.session.auth.current);
      return brief ? defineInstructions({ content: brief, role: "user" }) : null;
    },
  },
});

// reactions
export default defineDynamic({
  select: (view, { session }) => ({ turn: perTurn(view), principal: session.auth.current }),
  record: async ({ principal }) => await loadBrief(principal),
  render: (brief) => (brief ? defineInstructions({ content: brief, role: "user" }) : null),
});
```

The behavior differs. `main` appends the brief every turn, even when it hasn't changed. Reactions append it when its content changes, which is usually what's wanted. A brief that must repeat every turn has to differ, for example by naming the turn.

### Instructions for a long conversation

```ts
export default defineDynamic({
  select: (view) => view.session.turnCount > 6,
  render: (long) =>
    long ? defineInstructions({ content: "Summarize what's settled before answering." }) : null,
});
```

On `main`, this is a `turn.started` handler that recounts on every turn. Here it renders twice per session: at the start, and when the conversation crosses the line.

### Hooks

```ts
// main: cancel when credentials fail
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      try {
        await loadWorkspaceCredentials(ctx.session.auth.current);
      } catch {
        ctx.cancel();
      }
    },
  },
});

// reactions, as a reaction
export default defineHook({
  select: perTurn,
  record: async (_turn, ctx) => await hasWorkspaceCredentials(ctx.session.auth.current),
  render: (ok) => (ok ? null : cancel("Workspace credentials are unavailable.")),
});

// reactions, as an observer
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

- **Cancelling is a return value.** It targets the turn that was running, and there's no rule about calling it before a promise settles.
- **Compacting when idle** isn't possible on `main`, where hooks are observe-only ([Hooks](#hooks)).
- **Persisting every fact to a database** reads the same in both, keyed on `meta.id`. A side effect that must happen once per occurrence, such as an email, keys on `ctx.occurrence` instead of on coordinates copied from the event.

## What gets simpler

### For authors

| On `main`                                                              | With reactions                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Pick an event from the kind's allowlist                                | Select what the value depends on, or use a named lifetime |
| The latest handler owns the file; a turn result shadows the session's  | One `select` per value                                    |
| Steering skips `turn.started`                                          | A value that depends on messages selects them             |
| Inline callbacks, JSON captures, inline schemas, `eve extension build` | `render` is ordinary code                                 |
| `defineDurableCallback`, `defineDurableSchema`                         | Deleted                                                   |
| Handlers may run again on recovery, so keep them idempotent            | `record` runs once per selection; a cold start renders    |
| Four failure rules                                                     | One                                                       |
| A different message snapshot for instructions                          | One view, and `ctx.messages` in any `record`              |
| Hooks observe, with `ctx.cancel()` and its timing rules                | Hooks are reactions whose `render` returns intents        |
| Every captured value persisted, secrets included                       | What's kept is exactly what `record` returns              |

Most of main's dynamic-capabilities guide explains these: the events table for every kind, "Events and recovery" for connections, and "Author replayable callbacks", "Create dynamic tools in a package", and "Identity and redeploys" for tools. With reactions, the guide is `select` and `render`, `record` for awaiting, and the named lifetimes, and it covers hooks too.

### For eve

- **Deleted:** the six lifecycles, dynamic tool building and metadata, the two transforms and their bundler plugin, durable callbacks and schemas, rebind, and the memory lifecycle: the 4,330 lines [above](#inside-eve).
- **In their place:** one runner and an adapter per kind, about 2,200 lines in #4616. Across the repo, #4616 adds about 5,400 lines and removes about 16,400, tests and fixtures included.
- **Recording and rendering** removed each kind's `reconcile`, the internal `rebuild`, re-running `resolve` in a fresh process, the hooks' set of satisfied keys, and every privilege `auto()` had. Together they left production code about the same size, 6 fewer lines of code and 45 more of comments: the engine (the runner, the kinds, `auto()`, memory tools) is about 105 lines smaller, and the definition types, validation, and exports for the three forms are about 100 larger. Folding hooks into the same shape and putting `auto()` on the standard path were the part that shrank code outright, about 40 lines net.
- **Builds stop parsing authored source.**

## What gets harder, and what we give up

- **Dynamic remote agents can't carry credentials yet.** On `main`, a dynamic remote agent could return `auth` or `headers` written in the dynamic file: a per-tenant URL with a per-tenant token, an authenticated agent offered to some callers only, or credentials derived from the caller. The steps that open and message a remote child, and the routes that follow it, read only the recorded selection, so they have no `render` to call. A static remote agent's `auth` takes no arguments and can't see the session. For eve-to-eve remotes, static service credentials with `forwardPrincipal` often fit better anyway. The fix is to render the remote agent from its record in those places, as turn steps already do, at an estimated 100 to 150 lines. It would also make a dynamic `defineWorkspaceAgent` possible, which never worked on `main`.
- **A value can't latch a view value directly.** "The parent's model when the session started" isn't a function of the current view, so `select` can't express it, and `record` doesn't read the view. A hook can latch it into session state for `select` to read. Values that change with their inputs are easier to predict, so this stays the exception.
- **Simple cases gain a line.** `"session.started": () => x` becomes `select: once` and `render: () => x`.
- **Repeating requires a change.** User-role instructions append when their content changes, so a message that must repeat every turn has to differ.
- **Selects that read messages run only inside turn steps.** Commits outside one, such as a task settling between turns, skip them and keep their value. A `record` that reads `ctx.messages` waits for the next commit that has them.
- **What `record` reads besides its selection isn't watched.** That's the point of capturing a caller or a conversation once, and the mistake when a value should follow it.
- **Two rules.** What `record` returns must be JSON, and `render` is synchronous. Both fail immediately, with messages that say where the code goes.
- **A new error.** "Rendered something other than what this session was offered" appears when a `render` isn't deterministic. `main` never showed it, because `main` replayed captured values instead.

## Open questions

1. **A failed dynamic connection.** `main` keeps a failed dynamic connection's static namesake hidden, so it can't reappear as a fallback with different auth. Does withdrawing the value preserve that?
2. **Caps.** A selection is capped at 64 KB. Should what `record` keeps be capped too, and at what size?
3. **`perStep`.** Which commit does it run after, relative to the model call it's for?
4. **Messages outside turn steps.** Should `view.messages` and `ctx.messages` be available in every commit, at the cost of loading the conversation?
5. **Occurrence keys and retries.** A hook's key has to be the same when a step is retried. Does a retried commit keep its positions, so a key derived from them holds?
6. **Tools that change mid-turn.** Anthropic invalidates the prompt cache when tool definitions change, and OpenAI recommends a stable tool list with `allowed_tools`. Should tools change only at turn start, and be masked or appended mid-turn where a provider supports it?
7. **`available` first.** It's the widening with the clearest payoff: optional subagents and remote agents per caller, without a whole dynamic file.
