---
issue: "None (maintainer-requested research)"
status: draft
last_updated: "2026-10-11"
---

# Session reactions and dynamic values

This doc is about everything that changes during an eve session: the model, tools, skills, instructions, connections, subagents, and what hooks do in response. It describes how `main` handles them, what that costs authors and eve, and the model that replaces it: **reactions**, and the **dynamic values** authors write with them. It replaces the earlier `session-reactions.md` and `dynamic-values.md`.

`main` was read at `caf61ffb9`. The prototype is [#4616](https://github.com/vercel/eve/pull/4616) at `182eaa41e`, on the v27 stack. Code examples labelled "main" come from main's docs unless they say otherwise.

## Summary

- **On `main`, dynamism is handlers on three lifecycle events.** Each kind allows a different subset of `session.started`, `turn.started`, and `step.started`, fails in its own way, and survives a cold start through a compiler pass that snapshots what its callbacks capture ([How dynamism works on main](#how-dynamism-works-on-main)).
- **That costs authors a list of exceptions per kind, and eve about 4,300 lines** of lifecycles, transforms, and durable callbacks. Some things can't be said at all: a hook can't compact, and nothing can depend on state other than those three events ([What that costs](#what-that-costs)).
- **A dynamic value is three functions.** `select` says what the value depends on, `resolve` fetches what it needs, and `build` turns that into code. The same rules hold for every kind, and named lifetimes (`once`, `perTurn`, `perStep`) keep the common cases one line ([The model](#the-model)).
- **What a session uses is recorded, and code is built from the record.** A fresh process calls `build` on the recorded value and never runs `resolve` again. Nothing drifts, nothing parses authored source, and `auto()` already works this way ([Cold starts](#cold-starts)).
- **Hooks act on occurrences.** A hook can cancel or compact once per occurrence, and gets a stable key for its own side effects ([Hooks: occurrences, not values](#hooks-occurrences-not-values)).
- **Most things get simpler, and one thing is lost.** Values can depend on anything in the session's view, packages return plain tools, and one rule covers every kind's failures. A value can't latch what something was at a past moment ([What gets harder](#what-gets-harder-and-what-we-give-up)).

**Status.** #4616 prototypes the runner, `select` and `resolve` for every kind, the dynamic `model` field, `auto()`, and hooks that return intents, and it deletes main's lifecycles, transforms, and durable callbacks. It doesn't yet have `build`, named lifetimes, hooks as occurrences, the single failure and drift rule, or a cap on selections. Where this doc and #4616 differ, this doc is the target.

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

Tests come on top. The transforms also run in every build: across this repo's fixtures and extensions, they parse 164 modules at about 0.6 ms each, and the output is 1.7 times the source.

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

### Three functions

```ts
// agent/tools/crm.ts
import { defineDynamic, defineTool } from "eve/tools";

export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.tenantId ?? null,
  resolve: async (tenantId) => (tenantId === null ? [] : await db.crmTools(tenantId)),
  build: (rows) =>
    Object.fromEntries(
      rows.map((row) => [
        row.slug,
        defineTool({
          description: row.description,
          inputSchema: row.inputSchema,
          execute: (input) => callCrm(row.endpoint, input),
        }),
      ]),
    ),
});
```

| Function                  | Runs                                                                 | Sync? | Returns                                       |
| ------------------------- | -------------------------------------------------------------------- | ----- | --------------------------------------------- |
| `select(view, ctx)`       | After every commit                                                   | Yes   | JSON: what the value depends on               |
| `resolve(selection, ctx)` | When the selection changes                                           | No    | JSON: the data the value is made of, recorded |
| `build(value)`            | Wherever the code is needed: after `resolve`, and in a fresh process | Yes   | Code: tools, connections, a model             |

- **`select` decides when.** It reads the session's view and identity, and eve compares a digest of what it returns with the last one. Nothing else triggers a value.
- **`resolve` does the I/O.** It runs once per new selection, and its result is recorded in the session's durable state. It receives the selection, the session's identity, the channel, and an `abortSignal`, and doesn't run in the session's context: reading session state throws, pointing at `select`.
- **`build` makes code from data.** It's synchronous, so it can't do I/O, and it runs wherever a value's code is needed, including a process that has never seen this session.
- **Both are optional.** A value without I/O has no `resolve`, and `build` reads the selection. A value without code has no `build`, and `resolve`'s data is the value.
- **The entry point types the result.** `defineDynamic` from `eve/tools` returns tools, from `eve/skills` skills, from `eve/models` a model, and from `eve` a whole subagent. `undefined` or `null` contributes nothing.

### Named lifetimes

Most of main's dynamic values run once per session, turn, or step. Those are named, and exported next to every `defineDynamic` and `defineHook`:

| On `main`         | With reactions     | Resolves                         |
| ----------------- | ------------------ | -------------------------------- |
| `session.started` | `select: once`     | Once per session                 |
| `turn.started`    | `select: perTurn`  | Once per turn                    |
| `step.started`    | `select: perStep`  | Once per model call              |
| Not possible      | Any other `select` | Whenever what it returns changes |

They're ordinary selects, so they compose:

```ts
select: (view, { session }) => ({ turn: perTurn(view), team: session.auth.current?.attributes.team }),
```

### What `select` reads

`view` is the session's public tables, as `eve/events` folds them, with selectors such as `idle(view)`, plus:

| Field           | What it is                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `view.latest`   | The position of the latest fact of each type, and `"*"` for the latest fact. Selecting a position resolves once per new fact |
| `view.turn`     | The latest turn, running or not, with its `id`, `status`, and `input`                                                        |
| `view.messages` | The conversation as the model sees it. Read lazily, and only available in commits inside a turn step                         |
| `view.model`    | The model the session uses, for kinds that run after the model                                                               |

The second argument holds the session's ID, auth, schedule, and predecessor, and the channel's kind, continuation token, and metadata.

### Data or code

`build` exists only where a value carries code:

| Kind                                    | The value                        | `build`                                         |
| --------------------------------------- | -------------------------------- | ----------------------------------------------- |
| Instructions                            | Content and role                 | None                                            |
| Skills                                  | Markdown, and files              | None                                            |
| A local subagent                        | Its agent config                 | None                                            |
| A model by gateway ID                   | The ID and its settings          | eve's                                           |
| A model as a provider object            | Whatever config the author needs | The author's: it creates the provider           |
| Tools                                   | Whatever data the tools need     | The author's, always                            |
| Connections                             | Whatever data they need          | The author's: it creates `getToken` and headers |
| A remote agent with `auth` or `headers` | Its URL and description          | The author's                                    |

Both rules fail loudly. A `resolve` that returns a tool isn't JSON, so it fails with "`resolve` must return JSON: build tools in `build`". A `build` that returns a promise fails because `build` is synchronous.

### Where dynamic values go

A dynamic value fills one place in a definition. Each place is its own reaction, with its own selection and record.

| Where                                                                  | Status                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| A whole file in `tools/`, `skills/`, `instructions/`, `connections/`   | Supported                                      |
| A whole subagent, local or remote, at `subagents/<name>/`              | Supported. `null` omits it                     |
| `defineAgent({ model })`, in `agent.ts` and in a subagent's `agent.ts` | Supported, including `auto()`                  |
| A dynamic `agent.ts`                                                   | A build error that points at the `model` field |
| `compaction.model`, `build`, `defaultTools`, `experimental`            | Static: read at build, or before any session   |
| A single field: a description, a schema, a URL, `available`            | Not yet. Each widens a field type later        |

Three different things vary over a session, and a field's type says which it takes:

| Kind              | Evaluated                                        | For                                                                                  |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Static**        | At build or deploy                               | `build`, channels, schedules, workflow tools                                         |
| **Dynamic value** | After a commit, when its selection changes       | What the model sees, and which capabilities exist                                    |
| **Callback**      | When it's used, in context, free to have effects | What's needed only when something runs: `execute`, `approval`, `getToken`, `headers` |

If it changes what the model sees, it's a dynamic value. If it's needed only when something executes, it's a callback, created in `build`.

**The model is a field, not a dynamic `agent.ts`.** One place holds one coupled decision: the model and its settings, `{ model, reasoning?, modelContextWindowTokens?, modelOptions? }`, which travel together. Everything that can't vary stays a static field beside it, `model: auto(...)` reads as it does on `main`, and a subagent can keep a static description while choosing its own model.

**Widening a field later is additive** for authors: `T` becomes `T | Dynamic<T>`, and every static definition still type-checks. The cost falls on code that reads definitions, such as agent info and build-time name checks. `available` for subagents and remote agents is the likely first.

### Cold starts

Each reaction keeps a record in the session's durable state: the selection's digest, the value (`resolve`'s result, or the selection when there's no `resolve`), the position it changed at, and the deployment that resolved it. Code lives in a process-local cache.

```text
a step needs a value's code
  ├─ this process built it from this record ─▶ use it
  └─ it didn't ─▶ build(recorded value)
                    └─ what the model sees differs from what it was offered ─▶ fail closed
```

- **`resolve` never runs again for a selection it already resolved.** A fresh process builds from the record, so a cold start reads no database, asks no router, and mints no token.
- **What the model was offered is recorded too,** such as tool declarations and the model's reference. A rebuild that offers something different fails closed: a changed tool's calls fail with `Tool "query" changed since it was offered.`, and a changed model with `The model changed since this session chose it`. That's one rule for every kind, and it fires only when `build` isn't deterministic.
- **A new deployment resolves again.** Only idle sessions move to a new deployment, so values with code resolve under it before the next turn uses them. Values that are only data keep theirs until their selection changes.

This is the path `auto()` needed, made general and public:

| `auto()` in #4616                                                    | With `build`                        |
| -------------------------------------------------------------------- | ----------------------------------- |
| `select` returns `{ turnId, input }`                                 | `select`                            |
| `resolve` asks the router, and returns an option key                 | `resolve`, whose result is recorded |
| The option key becomes a model                                       | `build(recorded)`                   |
| A fresh process calls an internal `rebuild` from the recorded option | A fresh process calls `build`       |

The internal `rebuild` and every kind's `reconcile` go away. Re-running `resolve` in a fresh process, which #4616 does for every kind but `auto()`, goes too.

### Freshness

A value is what its selection says until the selection changes. That's the whole rule:

- **Instructions append when their content changes.** A per-turn brief that comes back the same isn't appended again.
- **What `resolve` reads beyond its selection isn't watched.** A value that reads `session.auth.current` in `resolve` doesn't change when the caller does. Select it if it can change.
- **Data fetched in `resolve` stays** until the selection asks again. A value that should refresh every turn selects `perTurn`.

### Failures

A `select`, `resolve`, or `build` that throws withdraws its value: the capability isn't offered, and the error is logged. eve tries again when the selection or the deployment changes, not on every commit. A model has nothing to fall back to, so the model call that needs it fails. That replaces main's four rules.

### Hooks: occurrences, not values

A hook has the same shape, with an `events` map as the other form:

```ts
// agent/hooks/compact-when-idle.ts
import { idle } from "eve/events";
import { compact, defineHook } from "eve/hooks";

export default defineHook({
  select: (view) => (idle(view) ? (view.turn?.id ?? null) : null),
  resolve: (turnId) => (turnId === null ? null : compact({ reason: "The session went idle." })),
});
```

What a hook returns is different in kind from what a dynamic value returns:

- **A value is current state.** Its record is replaced when its selection changes, and whatever reads it reads the latest.
- **A hook's result is an occurrence.** Each new selection, or each new fact for an `events` handler, is one occurrence, and the hook runs once for it.
- **Intents are applied once per occurrence.** `cancel(reason?)` stops the turn running when the hook resolved, and `compact({ reason? })` compacts before the next model call. A second idle stretch is a new occurrence, so it compacts again.
- **Side effects run at least once.** `ctx.occurrence` is a stable key for the occurrence, to pass as an idempotency key: an email, a charge, a ticket.

In #4616, intents sit in the hook's slot like a value, with a set of keys already acted on. A plain `compact()` is keyed `default`, so it compacts once per session, and an author has to invent a name per occurrence. Treating results as occurrences removes the set and the naming.

The split is the one Signals makes between computeds and effects: values are derived and cached, hooks act. They share `select` and "run when the selection changes", and nothing else.

### Order, and the comparison with Signals

After each commit, eve runs reactions in a fixed order: hooks, memory, the model, connections, subagents, tools, skills, instructions.

- **Hooks first,** so a cancel takes effect before anything else resolves.
- **The model before the rest,** so later kinds can read `view.model`. Hooks, memory, and the model itself get an error if they read it.
- **Tools after connections and subagents,** so tool names can be checked against theirs.

That's the whole dependency structure: one value and two orderings. A reviewer noted that this is close to TC39 Signals, and that if selects could read shared derivations and earlier values as tracked dependencies, the graph could decide the order. The comparison fits: `select` is a computed's dependency read, the digest its equality check, `resolve` the effect. Three things keep it from carrying over directly:

- **Dependencies have to be durable.** A cold process must know what a value depended on. An explicit `select` returns something serializable to digest and record. Tracking reads automatically would mean recording every read value, which ends up as a less inspectable selection.
- **`resolve` is async.** Async computeds are the unsettled part of the Signals proposal.
- **Cycles.** If selects read each other, cycles become possible. A fixed order rules them out.

The order isn't API, and shouldn't be documented as such. Shared derivations, a memoized function of the view computed once per commit, can be added later without changing it, and so can reading another value from a `select`.

### What it costs to run

Each `select` runs after every commit. In the standalone prototype, 20 unchanged reactions cost about 7 µs per commit, and commits that only carry streamed deltas skip everything but hooks. `resolve` runs only on a change: a vision router decides when the answer flips, rather than before every model call, and connections no longer resolve again before every model call.

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
  resolve: (image) => (image ? "google/gemini-3.5-flash" : "zai/glm-5.2"),
}),
```

The value depends on whether there's an image, and says so. It resolves when that flips, rather than before every model call. A gateway ID is data, so a cold start has nothing to build beyond the provider eve creates for the ID.

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

An author can write the same thing with `decide()`, and it now behaves the same in every process:

```ts
model: defineDynamic({
  select: (view) => (view.turn === null ? null : { turn: view.turn.id, input: turnText(view.turn) }),
  resolve: async (turn) => {
    if (turn === null) return null;
    const { answers } = await decide({ state: { input: turn.input }, questions: { tier: TIER } });
    return answers.tier.choice; // "hard" | "easy", recorded
  },
  build: (tier) => (tier === "hard" ? openai("gpt-6-sol") : openai("gpt-6-luna")),
}),
```

In #4616, this re-ran `decide()` in every fresh process that needed a provider object, and failed the call if the decision came out differently.

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
  resolve: (model) =>
    model === null
      ? null
      : defineAgent({ description: "Analyze financial and accounting data.", model }),
});
```

The behavior differs. `main` snapshots the parent's model when the session starts. This version follows it: the parent's model is part of the selection, so a change resolves the subagent again. Keeping the first model isn't expressible ([What gets harder](#what-gets-harder-and-what-we-give-up)).

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
  resolve: async (principal) => (principal === null ? [] : await listEnabledAccounts(principal)),
  build: (accounts) =>
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

`main` warns that connection handlers "may run again when a parked turn resumes or a durable step retries", so they must be idempotent, without side effects. Here `listEnabledAccounts` runs once per caller, and a cold start only builds the connections from the recorded accounts. The selection is the whole principal, so a different caller resolves again.

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
  resolve: async () => (await listTables()).map(({ name, columns }) => ({ name, columns })),
  build: (tables) =>
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

A few more lines: the fetch and the code are separate. In exchange, the rules about what `execute` and `inputSchema` may capture are gone. `build` could create a client, call a helper, or keep a schema in a local variable.

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

// used from build
build: ({ baseUrl }) => ({ search: createSearchTool(baseUrl) }),
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
  build: (role) =>
    role === "admin"
      ? { list_users: listUsers, delete_user: deleteUser }
      : { list_users: listUsers },
});
```

No I/O, so no `resolve`: `build` reads the selection. A role that changes mid-session changes the tools at the next model call.

### A tool that returns a random number

This one shows what happens to a value that isn't a function of its inputs:

```ts
// main
"session.started": () => {
  const x = Math.random();
  return { lucky: defineTool({ description: "Returns the lucky number.", execute: () => ({ x }) }) };
},

// #4616
select: () => null,
resolve: () => {
  const x = Math.random();
  return { lucky: defineTool({ description: "Returns the lucky number.", execute: () => ({ x }) }) };
},

// reactions
select: once,
resolve: () => Math.random(),
build: (x) => ({ lucky: defineTool({ description: "Returns the lucky number.", execute: () => ({ x }) }) }),
```

|           | What a cold start does                                                                            | What the author sees                                                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`    | Calls the hoisted `execute` with the snapshot `{ x }`                                             | The same number for the whole session                                                                                                                                                                                                                                          |
| #4616     | Runs `resolve` again, which picks a new `x`. The declaration matches, so the new tool is accepted | A different number whenever a step lands in a process without the session's code: another instance, an evicted cache, a restart. Never locally. If `x` were in the description, the tool would fail closed, and with a constant selection it would stay failed for the session |
| Reactions | Calls `build` with the recorded `x`                                                               | The same number for the whole session. A `resolve` that returned the tool directly would fail immediately, because a tool isn't JSON                                                                                                                                           |

Only randomness inside `build` could still drift, and `build` is the one function documented as pure.

### A playbook for the caller's team

```ts
// reactions (main is at the top of this doc)
export default defineDynamic({
  select: (_view, { session }) => session.auth.current?.attributes.team ?? null,
  resolve: (team) => (team && PLAYBOOKS[team] ? defineSkill({ markdown: PLAYBOOKS[team] }) : null),
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
  resolve: async ({ principal }) => {
    const brief = await loadBrief(principal);
    return brief ? defineInstructions({ content: brief, role: "user" }) : null;
  },
});
```

The behavior differs. `main` appends the brief every turn, even when it hasn't changed. Reactions append it when its content changes, which is usually what's wanted. A brief that must repeat every turn has to differ, for example by naming the turn.

### Instructions for a long conversation

```ts
export default defineDynamic({
  select: (view) => view.session.turnCount > 6,
  resolve: (long) =>
    long ? defineInstructions({ content: "Summarize what's settled before answering." }) : null,
});
```

On `main`, this is a `turn.started` handler that recounts on every turn. Here it resolves twice per session: at the start, and when the conversation crosses the line.

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

// reactions
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

- **Cancelling is a return value.** It targets the turn that was running, and there's no rule about calling it before a promise settles.
- **Compacting when idle** isn't possible on `main`, where hooks are observe-only ([Hooks: occurrences, not values](#hooks-occurrences-not-values)).
- **Persisting every fact to a database** reads the same in both, keyed on `meta.id`. A side effect that must happen once per occurrence, such as an email, keys on `ctx.occurrence` instead of on coordinates copied from the event.

## What gets simpler

### For authors

| On `main`                                                              | With reactions                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Pick an event from the kind's allowlist                                | Select what the value depends on, or use a named lifetime    |
| The latest handler owns the file; a turn result shadows the session's  | One `select` per value                                       |
| Steering skips `turn.started`                                          | A value that depends on messages selects them                |
| Inline callbacks, JSON captures, inline schemas, `eve extension build` | `build` is ordinary code                                     |
| `defineDurableCallback`, `defineDurableSchema`                         | Deleted                                                      |
| Handlers may run again on recovery, so keep them idempotent            | `resolve` runs once per selection; a cold start runs `build` |
| Four failure rules                                                     | One                                                          |
| A different message snapshot for instructions                          | One view                                                     |
| Hooks observe, with `ctx.cancel()` and its timing rules                | Hooks return `cancel()` or `compact()`, once per occurrence  |
| Every captured value persisted, secrets included                       | What's recorded is exactly what `resolve` returns            |

Most of main's dynamic-capabilities guide explains these: the events table for every kind, "Events and recovery" for connections, and "Author replayable callbacks", "Create dynamic tools in a package", and "Identity and redeploys" for tools. With reactions, the guide is the three functions, the named lifetimes, and the rule for `build`.

### For eve

- **Deleted:** the six lifecycles, dynamic tool building and metadata, the two transforms and their bundler plugin, durable callbacks and schemas, rebind, and the memory lifecycle: the 4,330 lines [above](#inside-eve).
- **In their place:** one runner and an adapter per kind, about 2,200 lines in #4616. Across the repo, #4616 adds about 5,400 lines and removes about 16,400, tests and fixtures included.
- **With `build`,** more goes: each kind's `reconcile`, the internal `rebuild`, and re-running `resolve` in a fresh process. `auto()` stops being a special case.
- **Builds stop parsing authored source.**

## What gets harder, and what we give up

- **A value can't latch.** "The parent's model when the session started" isn't expressible, because a `select` is stateless and can't remember an earlier answer. We accept this: the cases are rare, and a value that changes with its inputs is easier to predict.
- **Simple cases gain a line.** `"session.started": () => x` becomes `select: once` and `resolve: () => x`. Named lifetimes keep it to one line, but it's a concept to learn.
- **Repeating requires a change.** User-role instructions append when their content changes, so a message that must repeat every turn has to differ.
- **What `resolve` needs goes in the selection.** A value that decides from the user's message puts the message in its selection, under a size cap. `auto()` refuses inputs over 16,000 characters already, so its selection stays under any reasonable cap.
- **Selects that read messages run only inside turn steps.** Commits outside one, such as a task settling between turns, skip them and keep their value.
- **Identity read in `resolve` isn't watched.** A value has to select whatever it needs to follow.
- **Three functions, and rules for two of them.** `resolve` returns JSON, and `build` is synchronous. Both fail immediately, with messages that say where the code goes.
- **A new error.** "Changed since it was offered" appears when a `build` isn't deterministic. `main` never showed it, because `main` replayed captured values instead.

## Open questions

1. **A failed dynamic connection.** `main` keeps a failed dynamic connection's static namesake hidden, so it can't reappear as a fallback with different auth. Does withdrawing the value preserve that?
2. **Caps.** How large can a selection and a recorded value be? The standalone prototype capped selections at 4 KiB; something nearer 64 KiB leaves room for a message or a few dozen rows.
3. **`perStep`.** Which commit does it resolve after, relative to the model call it's for?
4. **Messages outside turn steps.** Should a `select` that reads `view.messages` see the conversation in every commit, at the cost of loading it?
5. **The conversation in `resolve`.** `auto()`'s `resolve` reads messages from before the turn. That's safe for any `resolve` now that its result is recorded and never recomputed. Should authored `resolve` get `ctx.messages` too, and how would an author know a change to it doesn't resolve again?
6. **Occurrence keys and retries.** A hook's key has to be the same when a step is retried. Does a retried commit keep its positions, so a key derived from them holds?
7. **Tools that change mid-turn.** Anthropic invalidates the prompt cache when tool definitions change, and OpenAI recommends a stable tool list with `allowed_tools`. Should tools change only at turn start, and be masked or appended mid-turn where a provider supports it?
8. **`available` first.** It's the widening with the clearest payoff: optional subagents and remote agents per caller, without a whole dynamic file.
