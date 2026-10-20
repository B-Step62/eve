---
issue: TBD
status: draft
last_updated: "2026-10-20"
---

# Proposal: one Rust kernel for fx and eve

## 1. Summary

We will make one shared kernel for fx and eve. We will write the kernel in
Rust. fx and eve each become a distribution of this kernel. Each distribution
adds user-space code in TypeScript or JavaScript. This is the model that
Turbopack uses.

The kernel is a deterministic state machine with no I/O. It tells its host
which effect to do next, and the host gives back the result. The kernel makes
the agent decisions: the turn loop, steer and cancel, tool approval,
compaction, and model retry. The host does the work and keeps the session
durable:

- eve continues to use Workflow SDK workflows (`"use workflow"` and
  `"use step"`).
- libfx in durable mode uses `durable-harness`.
- The fx TUI, `fx ask`, and in-process libfx use one in-process runner, with
  an optional local session log.

All hosts store the same kernel records (section 6). The model sees the same
results on each host.

fx gives the requirements. eve is the distributed superset. The local case is
a simple case of the distributed case, not a different code path. When fx
and eve do the same thing in different ways, the kernel uses eve's behavior,
with three exceptions: fx's steer, fx's hooks, and behavior that depends on
the host. Behavior that depends on the host is an extension point
(section 5). [`fx-eve-behavior-alignment.md`](./fx-eve-behavior-alignment.md)
records each decision.

A prototype (`packages/kernel-spike`) runs the kernel in eve, in fx, and on
three test hosts. Section 10 has the results.

## 2. Sources

| System          | Location                 | Revision    |
| --------------- | ------------------------ | ----------- |
| fx              | `~/Code/fx`              | `0b31a736`  |
| durable-harness | `~/Code/durable-harness` | `7672c9d`   |
| eve             | `packages/eve/src`       | this branch |

## 3. Terms

| Term            | Meaning                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| Kernel          | The shared Rust core. It makes the agent decisions. The host calls it. It does no I/O.        |
| Distribution    | A product that uses the kernel: fx or eve.                                                    |
| User space      | TypeScript or JavaScript code that a distribution or a user writes.                           |
| Host            | The code that calls the kernel: a runner and an optional session store.                       |
| Runner          | The part of a host that runs the loop and the effects.                                        |
| Session store   | The part of a host that keeps the kernel records. It is optional.                             |
| World           | The storage and queue interface of the Workflow SDK (`@workflow/world`).                      |
| Turn            | One user input and all the work that the agent does for it.                                   |
| Effect          | One unit of work with an external result, for example a model call or a tool call.            |
| Entry           | One kernel input with its number in the session log (`seq`).                                  |
| Snapshot        | The kernel state. It contains the `seq` of its last entry.                                    |
| Intent          | A record that a host writes before a `replay: never` effect starts.                           |
| Command         | An order from the kernel to the host about an open effect. The only command is `cancel`.      |
| Tool descriptor | The data that a tool gives about itself: name, description, approval policy, and replay rule. |
| Extension point | A kernel effect or config value where each distribution gives its own behavior.               |

## 4. Structure

```text
┌──────────────────────────── Distribution ────────────────────────────┐
│ settings · surfaces (TUI, ACP, HTTP) · tools · hooks · instructions  │
│                                                                      │
│  ┌────────────────────────────── Host ────────────────────────────┐  │
│  │ Runner: runs the loop · runs effects · receives inputs         │  │
│  │                                                                │  │
│  │   inputs, effect results           ┌───────────────────────┐   │  │
│  │  ─────────────────────────────────▶│      Rust kernel      │   │  │
│  │   effects, commands, events,       │  agent logic, no I/O  │   │  │
│  │   entries                          │                       │   │  │
│  │  ◀─────────────────────────────────│                       │   │  │
│  │                                    └───────────────────────┘   │  │
│  │ Session store (optional): entries · snapshots · intents        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

One loop step:

1. The runner calls `advance(state, inputs)`. The inputs are user inputs and
   effect results.
2. The kernel returns the new state, the effects to run, the commands, the
   events, and the entries for the log.
3. If there is a store, the runner writes the entries and, at times, a
   snapshot. It runs each effect with a handler from the distribution, and it
   sends the events to the distribution.
4. When an effect stops, the runner goes back to step 1 with the result.

### 4.1 Cases

| Case              | Runner                 | Session store                            | Model handler                       | Tool handlers    |
| ----------------- | ---------------------- | ---------------------------------------- | ----------------------------------- | ---------------- |
| eve               | Workflow SDK workflows | The World                                | AI SDK `LanguageModel`              | eve tools        |
| libfx, durable    | durable-harness        | The World                                | `model-codecs` over the app `fetch` | libfx host tools |
| libfx, in-process | In-process runner      | None, memory, or a store from the app    | `model-codecs` over the app `fetch` | libfx host tools |
| fx TUI            | In-process runner      | Local session log                        | `model-codecs`                      | `native-tools`   |
| fx ask, fx acp    | In-process runner      | Local session log, or none (`--no-save`) | `model-codecs`                      | `native-tools`   |

Only eve and durable libfx can move a session to a different process. In the
in-process cases, a crash stops the session. The session continues only when
the user resumes it. The local session log keeps fx's durability (R28).

### 4.2 Layers

| Layer          | Owns                                                                                                                                        | Does not own                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Kernel         | The next effect, steer and cancel, tool approval, compaction, model retry, and the text that the model sees.                                | I/O, storage, transports, processes, settings files, file discovery, wire formats. |
| Host           | The loop and durability. It runs effects, receives inputs, stores the kernel records, and obeys the replay rule.                            | Agent decisions. A host does not make text for the model.                          |
| `model-codecs` | Provider wire formats: a normal model request to an HTTP body, an SSE stream to normal model events.                                        | The decision to retry. Transport. Credentials.                                     |
| `native-tools` | Tool operations on a real machine: files, shell, managed processes, `safe_git`, `web_fetch`. A descriptor for each tool.                    | The approval result. The model text for a hold.                                    |
| Distribution   | Product policy and surfaces. It resolves settings one time and gives the kernel a prepared session config. It answers the extension points. | The turn loop.                                                                     |

The kernel and the in-process runner have three builds: a Node-API addon (eve,
libfx), a WebAssembly module (browsers), and a static library (the fx CLI).

## 5. Kernel contract

The kernel does no I/O. The same state and the same inputs always give the
same output. The kernel does not read the clock, random values, or the
environment.

- **Open.** The distribution gives a prepared session config: the system
  prompt, the tool descriptors, the step limit, the approval settings, and
  the compaction settings.
- **Advance.** `advance(state, inputs) → (state, effects, commands, events,
entries)`. The inputs are `prompt`, `steer`, `cancel`, and effect results.
  The host can call `advance` while effects are open.
- **Replay and resume.** Section 6.
- **Effects.** Each effect has a stable key, a kind, a replay rule, and an
  input:

  | Kind            | Purpose                                                                 |
  | --------------- | ----------------------------------------------------------------------- |
  | `model_call`    | One model request. Purpose: `agent`, `permission_review`, `compaction`. |
  | `tool_call`     | One tool call.                                                          |
  | `policy_decide` | The host's session policy for one tool call.                            |
  | `user_ask`      | Ask a person to approve a call.                                         |
  | `blob_put`      | Store data that the kernel does not keep, such as a compaction record.  |
  | `wait`          | A backoff before a retry. The kernel has no clock.                      |

  Later effects: `hook_run` (R10), `context_resolve` (R13), `child_message`
  (R5), `memory_recall`, `tools_resolve`.

- **Commands.** `cancel(key)`. The host stops the effect and reports its
  partial output.
- **Results.** `completed` with the output, `failed` with the error and
  whether a retry can help, or `interrupted` (`cancelled` or `crashed`) with
  the partial output.
- **Events.** One vocabulary. Each host maps it to its own protocol: eve
  protocol events, `libfx/hook` events, or ACP updates.

### 5.1 Extension points

Each extension point is an effect or a config value, so the kernel stays free
of I/O.

| Extension point      | Form                                 | eve                                   | fx                                       |
| -------------------- | ------------------------------------ | ------------------------------------- | ---------------------------------------- |
| Replay after a crash | Tool descriptor `replay`; host obeys | The step runs again                   | A `never` tool does not run again (R2)   |
| `policy_decide`      | Effect before a tool call            | The tool's own policy function        | Mode, rules, grants, routine commands    |
| `caution`            | Config: `ask` or `hold`              | `ask`                                 | `hold`                                   |
| `user_ask`           | Effect                               | Durable input request; the turn parks | Terminal prompt; `failed` with no person |
| `model_call`         | Effect                               | AI SDK                                | `model-codecs`                           |
| `envelope_tokens`    | Config                               | `requestEnvelopeTokens`               | The size of fx's tool schemas            |
| `blob_put`           | Effect                               | Sandbox attachments and the World     | Session log blobs                        |
| `hook_run`           | Effect at `PreToolUse` and `Stop`    | `defineHook`                          | fx hook registry                         |
| `context_resolve`    | Effect                               | Dynamic instructions                  | `AGENTS.md` discovery                    |
| Long effect          | Start, observe, cancel               | Workflow tool runs and tasks          | Managed processes                        |

## 6. Session log

All hosts store the same kernel records. The kernel gives the records to the
host. The host decides only where they go.

- An **entry** is `{ seq, input }`. `advance` gives the entries that it used.
- A **snapshot** is the kernel state. It contains the `seq` of its last entry.
- `replay(state, entries)` adds entries to a state. It ignores an entry that
  the state already has, so a host can write or replay an entry two times. A
  missing entry is an error.
- `resume(state)` gives the open effects and the cancels that they must get.
  It uses only the state. Hosts do not store effects or commands.
- An **intent** is the one host record that is not a kernel record. A host
  that obeys `replay: never` writes it, with fsync, before the effect starts.

```text
Durable host (eve on Workflow): the Workflow event log is the only durable record.
  ┌──────────────┬──────────────┬──────────────┐
  │ step 1 result│ step 2 result│ step 3 result│ ...
  │ snapshot @4  │ snapshot @9  │ snapshot @12 │
  └──────────────┴──────────────┴──────────────┘
  Each turnStep commits the snapshot with eve's session, in one step result.
  A crash runs the step again from the previous snapshot.

Local host (fx, in-process libfx): no log below it, so the file is the store.
  session.jsonl: entry · entry · intent · entry · ... · snapshot · entry ...
  On resume: load the last snapshot, replay the entries after it, call resume.
  An open `never` effect with an intent becomes `interrupted { crashed }`.
```

A durable host does not keep a second log. A second log next to the World
needs two writes that the host cannot commit together.

| Host              | Records                                                               |
| ----------------- | --------------------------------------------------------------------- |
| eve               | A snapshot in eve's session state, in each `turnStep` result.         |
| durable-harness   | `in:<seq>` entry effects and `snap:<seq>` snapshot effects.           |
| In-process runner | JSONL: entries, intents, and a snapshot every 32 entries and at idle. |

## 7. Requirements

Each requirement has an ID. Tests use these IDs. The owner of each
requirement is a layer from section 4.2.

### 7.1 Durability and sessions

- **R1. Host-neutral kernel (kernel).** The kernel obeys section 5. It runs
  on each host without changes.
- **R2. Replay rule (kernel, host).** Each tool descriptor declares `replay`:
  `safe` or `never`. The kernel puts the rule on each `tool_call` effect. A
  local host (the in-process runner, durable-harness) must not run an open
  `never` effect again after a crash. It reports `interrupted { crashed }`,
  and the kernel tells the model that the effect may or may not have taken
  effect. This keeps fx's guarantee for writes and commands. A Workflow host
  runs the step again, as eve does today. eve can obey the rule later: the
  step records an intent before a `never` tool and reports `interrupted` when
  the step runs again.
- **R3. Bounded state (kernel, host).** After compaction, the kernel state
  stays small. The cold-start time does not increase with the age of the
  session: a host loads a snapshot, not the full log.
- **R4. Continue, resume, and fork (host, dist).** These use the session
  log. Fork copies the snapshot at a turn boundary.
- **R5. Child sessions (host).** The host does `child_message` effects. Each
  child is its own run.

### 7.2 Turn loop

- **R6. Step limit (kernel).** Optional. There is no limit by default.
- **R7. Steer and cancel (kernel, host).** A steer stops the model while the
  model writes its response (fx's rule). A steer never stops a tool that
  runs. A cancel has priority over a steer. The kernel returns `cancel`
  commands; the host stops the effect and reports the partial output.
- **R8. Model retry (kernel, host).** A failed model call that the host
  marks retryable gets three attempts with backoff (eve's rule). Then the
  turn fails. The host's own step retry stays the crash backstop.
- **R9. Tool calls (kernel).** All calls of one model response run together
  (eve's rule). Results go to the model in the sequence of the calls. The
  model never gets a tool call without its result.
- **R10. Hooks that act (kernel, dist).** `hook_run` at `PreToolUse` (change
  or stop a call) and `Stop` (continue the turn one time). This is fx's
  behavior; eve's `defineHook` gets these points.

### 7.3 Context

- **R11. Compaction (kernel).** eve's rules: a summary checkpoint and a
  recent tail when the request reaches the threshold of the context window.
  The tail is the last messages that fit beside the summary reserve. A
  previous checkpoint goes into the next summary. The estimate contains the
  system prompt, the tool list, the history, and `envelope_tokens`. Records
  of compacted text are optional, through `blob_put`.
- **R12. Large tool results (tools).** Each tool cuts its own output (eve's
  rule). The kernel stores no results.
- **R13. Project instructions (kernel, dist).** `context_resolve` at session
  start, turn start, and before a tool touches a path. eve answers with
  dynamic instructions; fx answers with `AGENTS.md` files.
- **R14. Stable prompt sequence (kernel).** The stable prefix, then the
  catalog and context messages, then the history. This keeps the prompt
  cache valid (eve's rules for the deferred-tool catalog).

### 7.4 Tools and approval

- **R15. Host workspace (dist, tools).** The workspace root is a session
  property. After recovery on a different machine, the model gets a note.
- **R16. Managed processes (tools).** The kernel sees only tool calls and
  results. Long processes are a "long effect" (section 5.1).
- **R17. Approval (kernel, dist).** Each tool has an `approval` policy:
  `never`, `always`, `once`, `auto`, or `host`. The kernel decides the first
  four. `host` sends `policy_decide` for that tool. With `host_policy`, every
  call goes to `policy_decide` first. The host answers `allow`, `deny`,
  `ask`, `review`, or `default`. fx's mode, rules, and grants are fx's answer.
- **R18. Review (kernel).** A review is a `model_call` with the purpose
  `permission_review` and the `permission_decision` tool. Only an explicit
  `clear` clears. A failed review, or an action over 64 KiB, is `caution`.
  `caution` is `ask` (eve) or `hold` (fx).
- **R19. Subagent authority (kernel).** A child gets a copy of the parent
  authority. A child cannot get more authority.
- **R20. Asking a person (kernel, host).** `user_ask` parks the turn (eve) or
  prompts (fx). If no person can answer, the host returns `failed`, and the
  turn fails. eve and fx both do this today.
- **R21. MCP (dist).** stdio, project approval, resources, prompts,
  elicitation, and a schema size limit stay fx functions over the kernel.

### 7.5 Surfaces and distribution

- **R22. Local start (dist).** A CLI turn does not need Nitro, an HTTP port,
  a Node process, or a World. The fx binary links the kernel, the runner,
  `model-codecs`, and `native-tools` statically.
- **R23. Runtime settings (dist).** Profile and workspace settings stay fx
  functions. The kernel gets a prepared config.
- **R24. ACP (dist).** The kernel gives the events and accepts the inputs
  that ACP needs.
- **R25. Script use (dist).** `ask --json` has a stable schema and
  documented exit codes.
- **R26. Providers (codecs, dist).** Provider support stays in
  `model-codecs`.
- **R27. Distribution names (libfx host).** libfx sets its own run, step,
  hook, and queue names.
- **R28. Local session log (host).** The fx local session log keeps the
  properties of the current fx store: writes stay on disk after a crash,
  fsync at durability points (including each intent), a torn last line is
  repaired, a bad middle line opens the log read-only, files are made at the
  first turn, blobs have content addresses, mode 0700 and 0600, and no
  symbolic links. Its records are the kernel records (section 6).
- **R29. In-process runner (host).** One Rust runner serves the fx TUI,
  `fx ask`, `fx acp`, and in-process libfx, with no store, a memory store,
  the local session log, or an app store.
- **R30. Same agent in both libfx modes (dist).** A libfx app changes only
  its durability option to move from the in-process runner to
  durable-harness.

### 7.6 Functions that only eve has

These eve functions continue to operate. fx gets them through user space:
channels, schedules, remote agents, memory, evals, OTel, client SDKs,
deployment handoff, workflow tools and tasks, and isolated sandboxes.

## 8. Open items

1. **R2 on eve.** eve runs an interrupted step again. Should eve record an
   intent before a `never` tool and obey R2? The prototype does not do this.
   Workflow's step attempt count can tell a rerun, but we must confirm with
   the Workflow team that the count is correct on each World.
2. **fx admission.** fx decides, prompts, and reviews in one call. The fx
   host gets a decision with no prompt and no review, but it reads "this needs
   a review" from a refusal reason (`turn_review_budget_exhausted`). fx
   admission must return `review` directly.
3. **The kernel's copy of the history.** eve-native still writes 8–12% more
   than eve, because the snapshot holds the full history. The normal model
   request must refer to the history, not copy it, and eve must keep one
   history.
4. **Normal model interface.** Specify one normal request and result that the
   model codecs and the AI SDK both use.
5. **Event set.** Specify the kernel events so that each host can map them to
   eve protocol events, `libfx/hook` events, and durable-harness live events.
6. **Policy that a distribution can replace.** Keep the list short. Today it
   is the extension points in section 5.1.
7. **durable-harness gaps.** A cancel input kind, a way to stop a turn that
   runs, distribution names (R27), and formal models.
8. **fx gateway wait.** fx's gateway cancel watcher costs up to 10 ms on each
   model call (section 10.3). The fix is in fx and does not depend on the
   kernel.

## 9. Tests

- **Kernel tests.** Give the kernel a state and inputs, and compare the
  effects and events. Every kernel test also checks that `resume` rebuilds
  exactly the effects that `advance` gave.
- **Conformance suite.** The same scenarios on each host, with an R-ID for
  each test. Crash tests use real `abort()` and `SIGKILL`.
- **Parity suites.** The same sessions on a product with and without the
  kernel. The two must give the same results and the same protocol events.
- **Boundary checks.** The kernel crate has no I/O dependencies, and it does
  not depend on `model-codecs` or `native-tools`.
- **TLA+ models.** Model the kernel contract and the session log. Change the
  fx `durable/` and `sdk/` models to check each host against them.

## 10. Prototype results

`packages/kernel-spike` has the kernel, the in-process runner, the bindings,
three test hosts, the eve integration (`packages/eve/src/harness/kernel`,
behind the `eve.kernelMode` context key), and an fx patch. Its README has the
full tables and the commands.

The kernel has the turn loop, steer, cancel, model retry, approval,
compaction, the replay rule, and the session log. It has 27 tests.

### 10.1 Test hosts

Five scenarios (`plain`, `crash_in_write`, `crash_in_model`, `steer`,
`cancel`) pass on each host:

| Host                 | Case          | Crash       | After a crash in a `never` write                       |
| -------------------- | ------------- | ----------- | ------------------------------------------------------ |
| A: in-process runner | fx CLI        | `abort()`   | Not run again; the model is told it may have run (R2). |
| B: Workflow SDK      | eve           | step throws | The step runs again; the write occurs two times.       |
| C: durable-harness   | durable libfx | `SIGKILL`   | Not run again; the model is told it may have run (R2). |

### 10.2 eve

One real eve session runs in three modes. All use the same scenarios, the
same world-local, and the same scripted model. Everything except the agent
loop is eve's own code. Median of 5 runs:

| Mode                               | One turn | 20 turns | Bytes at 20 turns |
| ---------------------------------- | -------- | -------- | ----------------- |
| eve (AI SDK `ToolLoopAgent`)       | 380 ms   | 4055 ms  | 1067 KB           |
| eve-native (kernel in `turnStep`)  | 342 ms   | 3208 ms  | 1169 KB           |
| eve-wasm (kernel in workflow code) | 499 ms   | 9438 ms  | 1686 KB           |

A parity suite runs approval and compaction sessions on eve and eve-native:
`always()` approved, `always()` denied with a note, `once()` over two turns,
and six turns that compact in a 2,000-token window. All pass, and both modes
publish the same protocol events in the same order, with compactions at the
same points.

Conclusions:

1. **Use the native kernel in `turnStep`.** It is as fast as eve. Do not run
   the kernel in workflow code: eve-wasm needs more steps, and Workflow
   replays the workflow code, so each kernel call runs again on each replay.
2. **eve's own approval machinery stays.** A kernel `user_ask` parks the
   turn through eve's existing approval code, so channels, response policies,
   and `input.resolved` behave as before. `auto()` and policy functions stay
   in eve (`approval: host`).
3. **The kernel uses less CPU than eve's harness.** At 1 MB of history, one
   model step takes 0.8 ms in the kernel and 9 ms in eve's harness. The cost
   of each Workflow step is much larger than both.
4. **One difference stays in the prompt.** After an approval, eve keeps a
   `[Pending approvals]` message in the model history. The kernel does not.

### 10.3 fx

The kernel replaces the agent loop of `fx ask`. fx's own code does the model
calls, the tool calls, and the permission decisions. Both binaries are
`ReleaseSafe` builds of fx `0b31a736`. The last two columns use one change in
fx: its gateway cancel watcher sleeps 1 ms, not 10 ms.

| Session                        | fx     | fx with the kernel | fx, 1 ms | fx with the kernel, 1 ms |
| ------------------------------ | ------ | ------------------ | -------- | ------------------------ |
| plain (2 reads, 1 write)       | 49 ms  | 47 ms              | 16 ms    | 17 ms                    |
| review returns `clear`         | 48 ms  | 65 ms              | 15 ms    | 15 ms                    |
| review returns `caution`       | 48 ms  | 66 ms              | 14 ms    | 15 ms                    |
| `ask` mode, no person          | 37 ms  | 36 ms              | 12 ms    | 11 ms                    |
| 20 reads in a 16k-token window | 340 ms | 321 ms             | 51 ms    | 49 ms                    |

Each session makes the same model calls on both binaries. The binary with the
kernel is 12,524,832 B (+573 KB, +4.8%). Startup time does not change.

Conclusions:

1. **The kernel adds no measurable time.** With the 1 ms wait, fx and fx with
   the kernel take the same time in each session. Most of the time in fx is
   a wait in its gateway client: each streamed request joins a watcher thread
   that sleeps 10 ms between checks.
2. **The decision logic is shared.** eve and fx already use the same review
   contract: a `permission_decision` tool with `clear` or `caution`. When no
   person can approve, both fail the turn.
3. **fx compacts earlier.** fx compacts at 80% with its own notes. The kernel
   compacts at 90% with eve's checkpoint. This is the decided change for fx.
4. **fx with the kernel does not store the session.** The prototype runs
   `fx ask --no-save`. fx's session log, resume, and R2 are not yet connected
   to the kernel in fx. The in-process runner (host A) shows that path: the
   kernel records, intents with fsync, and R2 after `abort()`.
