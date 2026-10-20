---
issue: TBD
status: draft
last_updated: "2026-10-19"
---

# Proposal: one Rust kernel for fx and eve

## 1. Summary

We will make one shared kernel for fx and eve. We will write the kernel in
Rust. fx and eve will each become a distribution of this kernel. Each
distribution adds user-space code. All user-space code stays in TypeScript or
JavaScript. This is the same model that Turbopack uses.

The kernel does not own the loop or durability. The kernel is a
deterministic state machine. It tells its host which effect to do next, and
the host gives back the result. Each case connects the kernel to its own host:

- eve continues to use Workflow SDK workflows (`"use workflow"` and
  `"use step"`).
- libfx in durable mode uses `~/Code/durable-harness`.
- The fx TUI, `fx ask`, and libfx in in-process mode use one in-process
  runner. Its session store is optional.

All hosts use the same kernel. The model must see the same results on each
host.

fx gives the requirements. eve has more functions than fx because eve is a
distributed system. fx is a CLI on one machine. The local case must be a
simple case of the distributed case. It must not be a different code path.

## 2. Sources

| System          | Location                 | Revision    |
| --------------- | ------------------------ | ----------- |
| fx              | `~/Code/fx`              | `0b31a736`  |
| durable-harness | `~/Code/durable-harness` | `7672c9d`   |
| eve             | `packages/eve/src`       | this branch |

## 3. Terms

| Term            | Meaning                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Kernel          | The shared Rust core. It has the agent logic. The host calls it. It does not do I/O.                            |
| Distribution    | A product that uses the kernel: fx or eve.                                                                      |
| User space      | TypeScript or JavaScript code that a distribution or a user writes.                                             |
| Host            | The code that calls the kernel. A host has a runner and an optional session store.                              |
| Runner          | The part of a host that runs the loop and the effects.                                                          |
| Session store   | The part of a host that keeps the kernel state and the effect results. It is optional.                          |
| World           | The storage and queue interface of the Workflow SDK (`@workflow/world`).                                        |
| Session         | One conversation. On eve and durable libfx, one session is one World run.                                       |
| Turn            | One user input and all the work that the agent does for it.                                                     |
| Effect          | One unit of work with an external result, for example a model call or a tool call.                              |
| Intent          | The log record that the kernel writes before an effect starts.                                                  |
| Outcome         | The log record that the kernel writes after an effect stops.                                                    |
| Fold            | The function that reads the session log and makes the session state.                                            |
| Fence           | A rule that stops a stale writer from changing the log.                                                         |
| Anchor          | The record that tells which process or message owns an open effect.                                             |
| Command         | An order from the kernel to the host about an open effect, for example `cancel`.                                |
| Tool descriptor | The data that a tool gives about itself: read-only or write, targets, environment, and action class.            |
| Evidence        | The facts that a host reports about a failed model call: delivery certainty, streamed bytes, and failure cause. |
| Steer           | A user message that arrives while a turn runs.                                                                  |
| Compaction      | The procedure that makes old turns shorter so that the context fits the model.                                  |

## 4. Target structure

The host owns the loop. The kernel is a function that the host calls. The
distribution gives the host its settings and its effect handlers.

A host has two parts:

- **Runner.** The runner calls the kernel, runs the effects, and receives the
  inputs. Each case has a runner.
- **Session store.** The store keeps the kernel state and the effect results.
  The store is optional. Without a store, the session stops when the process
  stops.

```text
┌──────────────────────────── Distribution ────────────────────────────┐
│ settings · surfaces (TUI, ACP, HTTP) · tools · hooks · instructions  │
│                                                                      │
│  ┌────────────────────────────── Host ────────────────────────────┐  │
│  │ Runner: runs the loop · runs effects · receives inputs         │  │
│  │                                                                │  │
│  │   inputs, effect results           ┌───────────────────────┐   │  │
│  │  ─────────────────────────────────▶│                       │   │  │
│  │                                    │      Rust kernel      │   │  │
│  │   effect requests, commands,       │  agent logic, no I/O  │   │  │
│  │   events                           │                       │   │  │
│  │  ◀─────────────────────────────────│                       │   │  │
│  │                                    └───────────────────────┘   │  │
│  │                                                                │  │
│  │ Session store (optional): state · effect results · blobs       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

One loop step:

1. The runner calls `advance(state, inputs)`. The inputs are user inputs and
   effect results.
2. The kernel returns the new state, the effect requests, the commands, and
   the events (section 7.1).
3. If there is a store, the runner writes the state to it. The runner runs
   each effect request with a handler from the distribution. It sends the
   events to the distribution.
4. When an effect stops, the runner goes back to step 1 with the result.

### 4.1 Cases

There are five cases. Three cases use the same in-process runner (section
7.4).

| Case              | Distribution                         | Runner                 | Session store                            | Model handler                       | Tool handlers    |
| ----------------- | ------------------------------------ | ---------------------- | ---------------------------------------- | ----------------------------------- | ---------------- |
| eve               | eve framework and the authored agent | Workflow SDK workflows | The World                                | AI SDK `LanguageModel`              | eve tools        |
| libfx, durable    | An app that uses libfx               | durable-harness        | The World                                | `model-codecs` over the app `fetch` | libfx host tools |
| libfx, in-process | An app that uses libfx               | In-process runner      | None, memory, or a store from the app    | `model-codecs` over the app `fetch` | libfx host tools |
| fx TUI            | The interactive fx CLI               | In-process runner      | Local session log                        | `model-codecs`                      | `native-tools`   |
| fx ask            | `fx ask` and `fx acp`                | In-process runner      | Local session log, or none (`--no-save`) | `model-codecs`                      | `native-tools`   |

Only eve and durable libfx have a runner that can move a session to a
different process. In the three in-process cases, a crash stops the session.
The session continues only when the user resumes it.

### 4.2 Crates

A runner can use two Rust crates to run effects. The kernel does not use them.

| Crate          | Contents                                                                                                         | Used by                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `model-codecs` | Wire formats for Gateway, Responses, Chat Completions, Codex, and Grok. SSE parsing.                             | libfx and the fx CLI. eve uses the AI SDK.                   |
| `native-tools` | File tools, identity-bound file changes, the indexer, the shell, managed processes, `safe_git`, and `web_fetch`. | The fx CLI. Other runners can use it as a host tool library. |

The kernel and the in-process runner have three build outputs:

- A Node-API addon for eve and libfx.
- A WebAssembly module for browsers and, possibly, Workflow code (open item
  2).
- A static library that links into the fx CLI binary.

### 4.3 Layers

Each layer owns one level of work. A layer does not do the work of a
different layer.

| Layer              | Owns                                                                                                                                                                                                                                                | Does not own                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Kernel             | Agent logic. The kernel selects the next effect, the effect order, the steer and cancel result, the recovery strategy, the permission result, the compaction time, and the text that the model sees.                                                | I/O, storage, transports, process control, configuration files, file discovery, provider wire formats. |
| Host               | The loop and, if there is a store, durability. The runner calls the kernel, runs effects, receives inputs, and starts child runs. The store keeps the state and the blobs, and fences stale writers. The runner gives the kernel prepared evidence. | Agent decisions. A host does not make text for the model. A host does not select a retry strategy.     |
| Model codecs crate | Provider wire formats. It changes a normal model request into an HTTP body. It changes an SSE stream into normal model events.                                                                                                                      | The decision to retry. Transport. Credentials.                                                         |
| Native tools crate | Tool operations on a real machine. It also gives a descriptor for each tool: read-only or write, targets, and command class.                                                                                                                        | The permission result. The model text for a hold.                                                      |
| Distribution       | Product policy and surfaces. It resolves the settings one time and gives the kernel a prepared session config. It finds `AGENTS.md` and skill files. It shows the UI.                                                                               | The turn loop.                                                                                         |

### 4.4 Boundary changes in this revision

The previous revision put the work of a different layer in the kernel in
eight places. This revision moves the work to the layer that owns it.

| Item                                                    | Previous location                                | Problem                                                                                           | New location                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large result storage (R12) and compaction records (R11) | Kernel "keeps" the data                          | Storage is I/O. The kernel contract says "no I/O".                                                | Kernel requests `blob.put` and `blob.get` effects. The host stores the data.                                                                                    |
| Provider protocols (R8, open item 5)                    | Kernel, with a special "host model" path for eve | Two levels in one interface: HTTP wire format and AI SDK `LanguageModel`. eve was a special case. | The kernel requests one normal `model.call` effect. Each host does it in its own way: the model codecs crate over `fetch` (fx CLI, libfx), or the AI SDK (eve). |
| Stall and network evidence (R8)                         | Kernel                                           | The kernel does not see the network.                                                              | The host reports evidence in the `model.call` result: delivery certainty, streamed bytes, and failure cause. The kernel decides with `decide(Evidence)`.        |
| Interrupt during generation (R7)                        | Kernel                                           | The stream is in the host. The kernel cannot stop it.                                             | The kernel returns a `cancel` command for the open effect. The host stops the stream and reports the partial output.                                            |
| Routine command list (R17)                              | Kernel permission layers                         | It is knowledge about shell commands. In fx, it is in `shell_command`, not in admission.          | The tool descriptor gives the command class. The kernel policy uses the class.                                                                                  |
| Child sessions (R5) and continue, resume, fork (R4)     | Kernel                                           | A child session is a run. A session catalog is storage.                                           | Host. The kernel owns only the subagent authority (R19) and the `child.message` effect.                                                                         |
| Managed processes (R16)                                 | Kernel contract                                  | Processes are a tool domain.                                                                      | Native tools crate. The kernel sees only tool calls and tool results.                                                                                           |
| fx security tools (open item 1)                         | "Kernel tools in Rust"                           | Tools with I/O in a kernel with no I/O.                                                           | Native tools crate. eve can use it as a host tool library through Node-API.                                                                                     |

These items stay in the kernel on purpose:

- **The model review (R18).** The review is a decision. The kernel makes the
  review prompt and reads the review result. The review itself is a
  `model.call` effect with the purpose `permission_review`.
- **The context gate (R13).** The decision to hold a tool call until scoped
  instructions arrive is a kernel decision. File discovery is a
  `context.resolve` effect.
- **Tool order (R9).** The kernel knows which calls are read-only from the
  tool descriptors. The kernel gives an order constraint. The host selects
  how much parallel work to do.

## 5. Function of each system

|                           | fx (Zig)                                                                                                             | durable-harness (TS)                                                                                                                                                                                                                            | eve (TS)                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Function in this proposal | Gives the requirements for the agent loop and the local CLI.                                                         | Becomes the host for durable libfx.                                                                                                                                                                                                             | Gives the user-space model. It is the distributed superset. Its workflows stay the host for eve. |
| Agent loop                | Native code, approximately 755,000 lines. Each command must start in 2 ms or less. The binary must be 7 MiB or less. | It has no agent loop. It adapts Pi, fx, Claude Code, Codex, OpenCode, and the AI SDK.                                                                                                                                                           | The AI SDK `ToolLoopAgent` and a session state machine.                                          |
| Durability                | A local `log.jsonl` file. libfx also has a World log with leases (`sdk/durable.js`).                                 | One World run for each session. A fold reads the raw events. Each effect has an intent and an outcome. Each effect has a replay rule (`safe` or `never`). Anchors show liveness. There are no heartbeats. An in-band fence stops stale writers. | One Workflow run for each session. Steps replay in a deterministic sequence.                     |
| Formal models             | TLA+ models. Bun drivers check the models against the real code.                                                     | None. It uses vitest suites, 10 `cli-check` invariants, and crash drills.                                                                                                                                                                       | Guard invariants and test tiers.                                                                 |

**Decisions:**

- eve continues to use Workflow SDK workflows for durability.
- libfx uses durable-harness for durability. The libfx lease chain
  (`sdk/durable.js`) goes away.
- The kernel does not depend on either host.

The two hosts have one conflict. In durable-harness, an effect with the rule
`never` does not run again after a crash. The model gets a message that the
effect possibly had an effect. This is the same as the fx `idempotent` rule.
In eve, Workflow runs an interrupted step again. The kernel gives each effect
a replay rule. Each host must obey that rule (R2). eve keeps its workflows,
but its step code must change so that it obeys the rule.

## 6. Comparison of fx and eve

Status values:

- **Same:** the two systems do the same thing.
- **Different:** the two systems do related things, but the rules are not the
  same.
- **fx only:** eve does not have this function.
- **eve only:** fx does not have this function.

The DH notes show what durable-harness already does. These notes apply to
libfx.

| Function                                                | fx                                                                                                                                                                                                                         | eve                                                                                                                    | Status                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Turn loop                                               | There is no step limit by default. You can set `max_agent_steps`.                                                                                                                                                          | There is no step limit for each turn. There are session limits for tokens, cost, and time.                             | Different                                                                                                                           |
| Parallel tool calls                                     | Read-only calls run in parallel groups of 16 or fewer. A write call stops the group. Results come back in the sequence of the calls.                                                                                       | The AI SDK runs calls in parallel.                                                                                     | Different. DH runs calls one at a time.                                                                                             |
| Steer                                                   | A steer can stop the model while the model writes its response. A steer waits while a tool runs. Only text input can steer. Each steer has an ID, and the kernel uses it one time only.                                    | A steer can stop the model only before the model starts its response. After that, the steer waits for the next commit. | Different. In DH, a steer is an inbox input. Each harness sets its own rules.                                                       |
| Cancel                                                  | Cancel the turn, pause the recovery, or refuse an approval that waits.                                                                                                                                                     | Cancel the turn, cancel the tasks, or stop the child sessions.                                                         | Different. DH can only withdraw an input before the kernel uses it. DH cannot stop a turn that runs.                                |
| Provider recovery                                       | A pure function (`decide(Evidence)`) selects the recovery. It uses the delivery certainty. It waits without limit when the network is not available. It finds stalls. It does not retry only because there is no response. | Three attempts, then a Workflow step retry.                                                                            | fx only                                                                                                                             |
| Saved response                                          | fx does not send a model request again if the response is in the log.                                                                                                                                                      | Step replay gives the saved result.                                                                                    | Same. In DH, each model call is a `safe` effect. Its output is the full response.                                                   |
| Tool replay after a crash                               | Each tool has an `idempotent` flag. fx does not run a non-idempotent call again.                                                                                                                                           | eve runs an interrupted step again.                                                                                    | Conflict. DH (`safe` or `never`) agrees with fx. The eve step code must obey the kernel replay rule (R2).                           |
| One writer                                              | A file lock. A second writer waits 2 seconds, then stops.                                                                                                                                                                  | The Workflow run has one owner.                                                                                        | DH: in-band fence. The fold also ignores stale writes.                                                                              |
| Local session store                                     | Each line has a CRC. Data goes to disk at durability points. A torn last line is removed. The session file is made at the first turn.                                                                                      | A local World in `.eve/.workflow-data`.                                                                                | Different. The local store for the fx CLI is an open item (section 10).                                                             |
| Continue, resume, fork                                  | `-c` for each workspace. `--resume <id>` from all workspaces. `/fork`.                                                                                                                                                     | `eve dev --resume` only.                                                                                               | fx only                                                                                                                             |
| Compaction                                              | User text and final responses stay the same. The model writes notes and a ledger. The records (`M`, `T`, `L`) stay available. A BM25 search finds them.                                                                    | Old tool results become shorter. Then a summary replaces old turns. Then a new run starts.                             | Different. Available records are fx only.                                                                                           |
| Large tool results                                      | The model gets a handle and a preview. It uses `read_tool_result` to read the full result.                                                                                                                                 | Media goes to sandbox attachments.                                                                                     | fx only                                                                                                                             |
| Subagents                                               | `run` makes a temporary child. `message` makes a named child that stays. A child cannot have children. A child gets a copy of the parent authority. A child cannot get more authority.                                     | Declared agents, root copies, remote agents, and workspace agents. Each call is a task.                                | Different. eve is the superset.                                                                                                     |
| Hooks                                                   | `PreToolUse` can change or stop a tool call. `Stop` can continue the turn one time. `PostTurnEnd` and `AttentionRequired` only observe.                                                                                    | Hooks observe events. A hook can call `cancel()`.                                                                      | fx only (`PreToolUse` and `Stop`)                                                                                                   |
| Project instructions                                    | Global, parent-directory, and workspace `AGENTS.md` files. A scoped `AGENTS.md` file arrives before a tool touches its directory.                                                                                          | Authored instructions only.                                                                                            | fx only                                                                                                                             |
| Skills                                                  | Many search roots in the workspace, up to HOME, and global roots.                                                                                                                                                          | `agent/skills` and extensions.                                                                                         | Different                                                                                                                           |
| Deferred tools                                          | `capability_search`, `mcp_select_tool`, and a schema size limit.                                                                                                                                                           | `eve__search`, `eve__tool`, and `eve__skill`.                                                                          | Same                                                                                                                                |
| MCP                                                     | stdio, HTTP, and SSE. Project `.mcp.json` files must have user approval. OAuth. Elicitation. Resources and prompts.                                                                                                        | HTTP connections. OAuth through Vercel Connect or a self-hosted flow.                                                  | Different. stdio and project approval are fx only.                                                                                  |
| Permissions                                             | Modes, rules, grants, a list of routine commands, and a model review. If the review finds a problem, fx holds the action and tells the model.                                                                              | Each tool has an `approval` value. If `auto()` finds a problem, eve asks the user.                                     | Different. The mode and rule layer is fx only.                                                                                      |
| Workspace and shell                                     | The real project directory. A cached snapshot of the login shell. `safe_git`. Managed processes with a TTY.                                                                                                                | A sandbox at `/workspace`. No host directories.                                                                        | Different. DH has `virtual` (files in the log), `sandbox()` (one VM for each session, with no secrets in the VM), and hybrid lanes. |
| Move to a different machine                             | Not applicable. fx runs on one machine.                                                                                                                                                                                    | Not applicable.                                                                                                        | DH has `workspaceNote` and `recoveryNote`.                                                                                          |
| Runtime settings                                        | Environment, then profile workspace, then profile, then project `.fx.json`.                                                                                                                                                | Compile-time `agent.ts`.                                                                                               | fx only                                                                                                                             |
| ACP                                                     | Load, resume, client MCP, modes, steer, and images.                                                                                                                                                                        | No load, no resume, and no client MCP.                                                                                 | fx is the superset.                                                                                                                 |
| Channels, schedules, memory, evals, remote agents, OTel | None                                                                                                                                                                                                                       | Yes                                                                                                                    | eve only                                                                                                                            |

## 7. Kernel contract and hosts

### 7.1 Kernel contract

The kernel does no I/O. The kernel does not write to a log. This lets the
same kernel run on more than one host.

- **Open.** The distribution resolves the settings one time. It gives the
  kernel a prepared session config: model selection, permission mode and
  rules, limits, tool descriptors, and hook points. The kernel does not read
  settings files or environment variables.
- **State.** The kernel state is a serializable value. The host keeps it. The
  state has a version. A newer kernel can migrate an older state.
- **Advance.** The signature is
  `advance(state, inputs) → (state, effect requests, commands, events)`.
  The inputs are user inputs (prompt, steer, cancel), effect results, and
  host values (clock, random values). The host can call `advance` while
  effects are open.
- **Effect requests.** Each request has a stable key, a kind, a replay rule
  (`safe` or `never`), an order constraint (R9), and an input. The effect
  kinds are:

  | Kind                   | Purpose                                                                                   |
  | ---------------------- | ----------------------------------------------------------------------------------------- |
  | `model.call`           | One model request. The purpose is `agent`, `compaction`, `permission_review`, or `title`. |
  | `tool.call`            | One tool call.                                                                            |
  | `hook.run`             | One hook handler (R10).                                                                   |
  | `context.resolve`      | Find the scoped instructions for a set of paths (R13).                                    |
  | `blob.put`, `blob.get` | Store or read a large result or a compaction record (R11, R12).                           |
  | `child.message`        | Start a subagent, or send a message to one (R19).                                         |
  | `user.ask`             | Ask the user a question (R20).                                                            |

- **Commands.** A command tells the host to change an open effect. The only
  command is `cancel(key)`. The host stops the effect and reports its partial
  output (R7).
- **Effect results.** The host gives back one result for each request:
  - `completed`, with the output.
  - `failed`, with the error and the evidence. For `model.call`, the
    evidence is the delivery certainty, the streamed bytes, and the failure
    cause (R8).
  - `interrupted`, with the partial output. The host uses this result after a
    cancel, and when a `never` effect was open during a crash.
- **Events.** The kernel emits events in one vocabulary. Each host and
  distribution maps them to its own protocol: eve protocol events,
  `libfx/hook` events, or ACP updates.
- **Determinism.** The same state and the same inputs always give the same
  output. The kernel does not read the clock, random values, or the
  environment.

The kernel does not know which host it runs on. Each host must pass the same
conformance suite (section 11).

### 7.2 eve host: Workflow SDK

eve continues to use workflows. The session workflow
(`execution/session/*`) stays the host. It is the runner, and the World is the store. These parts
change:

- **Kernel in steps.** The turn step (`turnStep`) calls the kernel. The
  kernel replaces the AI SDK `ToolLoopAgent` and the session state machine.
  The workflow keeps the kernel state as its workflow value.
- **Effects in steps.** The host runs each effect request in a `"use step"`
  function. The step result is the effect result. Step replay gives the saved
  result after a crash. This agrees with the kernel contract for `safe`
  effects.
- **`never` effects.** Workflow runs an interrupted step again. This does not
  agree with the kernel contract (R2). For a `never` effect, the host must
  first record an intent. If the step runs again and the intent has no
  outcome, the step must not run the tool again. The step must give
  `interrupted` as its result.
- **Effect handlers.** The eve host does each effect kind with existing eve
  code:
  - `model.call` with the AI SDK `LanguageModel` of the agent.
  - `tool.call` with authored and provided eve tools.
  - `child.message` with the current subagent tasks.
  - `hook.run` with `defineHook` handlers.
  - `user.ask` with the current input requests.
- **Parallel work.** The host can run read-only effects as parallel steps.
- **What stays the same.** These parts stay the same:
  - Workflow tools (`defineWorkflowTool`).
  - Tasks and subagents as workflow runs.
  - The session inbox.
  - Deployment handoff.
  - The handoff to a new run after compaction.
- **Runtime dependencies.** The eve rule says that `nitro` is the only runtime
  dependency. This rule must change so that eve can have the kernel binaries.
  Each platform gets an optional package, as `@next/swc-*` does. A
  WebAssembly build is the fallback.
- **Workflow sandbox.** Workflow code runs in a deterministic VM. The kernel
  must run only in step code, or the kernel must be available as WebAssembly
  in workflow code. This is an open item (section 10).

### 7.3 Durable libfx host: durable-harness

In durable mode, libfx uses `packages/harness-world` from durable-harness. The kernel becomes
a durable-harness `Harness`. Its `drive(ctx)` function calls the kernel and
runs each effect request with `ctx.effect`. libfx does `model.call` with the
model codecs crate over the host `fetch`. It does `tool.call` with libfx host
tools.

durable-harness gives libfx these functions:

- **Session and log.** One session is one World run. Inputs are
  `hook_received` events on an inbox hook. The input kinds are `prompt`,
  `steer`, `followUp`, and `withdraw`.
- **Effect sandwich.** `ctx.effect(key, options, fn)` writes an intent, runs
  `fn`, and writes an outcome. If the log has the result, the call gives that
  result. A harness must not use a result that is not in the log.
- **Replay rule.** After a crash, a `safe` effect runs again. A `never`
  effect becomes interrupted. This agrees with the kernel contract.
- **Fold.** The fold is the only code that reads the raw log. The first writer
  for each memo key wins. An outcome applies only to a record that runs.
- **Liveness.** There are no heartbeats. Each open effect has an anchor:

  | Location | How durable-harness finds a dead owner                |
  | -------- | ----------------------------------------------------- |
  | Vercel   | Only a redelivery of the queue message                |
  | Local    | The process ID, the boot ID, and the operating system |
  | Browser  | The Web Lock                                          |

- **Writer fence.** If the World has an in-band fence, the World refuses
  writes from a stale owner. If not, the fold ignores those writes.
- **Lanes.** An effect can need a capability: `workspace`, `gateway`,
  `machine`, or `secrets`. If the current host does not have the capability,
  durable-harness moves the session to a host that has it.

We will remove two libfx durability systems:

- The libfx lease system (`sdk/durable.js`).
- The `harness-fx` replay of recorded engine input and output. The kernel
  state is serializable, so libfx does not need this replay.

### 7.4 In-process runner: fx TUI, fx ask, and in-process libfx

The in-process runner is a Rust crate. It runs the loop in the process that
calls it. It does not use a World or a queue. Three cases use it:

| Case              | Effect handlers                                                                                | Session store                               | Inputs                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| fx TUI            | `model-codecs` and `native-tools`, in Rust                                                     | Local session log                           | Prompts, steers, cancels, and `user.ask` answers from the TUI |
| fx ask and fx acp | `model-codecs` and `native-tools`, in Rust                                                     | Local session log, or none with `--no-save` | One prompt from the command line, or ACP messages             |
| libfx, in-process | `model-codecs` over the app `fetch`, and JavaScript host tools through Node-API or WebAssembly | None, memory, or a store from the app       | Calls from the app: `prompt`, `steer`, `cancel`               |

The runner has these rules:

- **Store interface.** The session store is a small interface: open, append,
  read, put blob, get blob, and close. The runner works with no store. The
  local session log, the memory store, and app stores use the same
  interface.
- **Effect handler interface.** Rust handlers and JavaScript handlers use the
  same interface. The fx CLI links Rust handlers directly. libfx passes
  JavaScript callbacks through Node-API or WebAssembly.
- **Concurrency.** The runner runs read-only effects in parallel when the
  kernel order constraint lets it (R9). It obeys `cancel` commands at once
  (R7).
- **Crash.** A crash stops the session. Nothing restarts it. When the user
  resumes the session (`fx -c`, `fx --resume`, or a libfx app that opens the
  same session), the runner reads the state from the store. Each open `never`
  effect becomes `interrupted` (R2). Each open `safe` effect runs again.
- **No store.** Without a store, a crash loses the session. This is the
  expected result for `--no-save` and for in-memory libfx sessions.
- **Upgrade to durable mode.** A libfx app can change from the in-process
  runner to durable-harness. The agent code, the tools, and the events stay
  the same (R30).

### 7.5 Gaps in durable-harness

durable-harness does not do these things that durable libfx needs. They become
requirements in [section 8](#8-requirements).

1. **Parallel effects.** The kernel lets read-only calls run in parallel (R9). The
   durable-harness tool bridge runs calls one at a time.
2. **Bounded fold.** durable-harness reads the full log at each cold start.
   A run can have 25,000 events and 10,000 steps, but no more. fx sessions
   are long and use compaction (R3). eve starts a new run after compaction.
   durable-harness must have the same function, or a fold snapshot.
3. **Stop a turn that runs.** durable-harness can only withdraw an input that
   the kernel did not use. Durable libfx must have a user cancel. It must also have a
   steer that can stop the model while it writes its response (R7).
4. **Fixed names.** The run names, step names, hook tokens, and queue prefixes
   use the durable-harness name. libfx must set its own names (R27).
5. **Formal models.** durable-harness has no formal models. We must change
   the fx TLA+ models in `durable/` and `sdk/` so that they check the
   durable-harness rules.

## 8. Requirements

Each requirement has an ID (R1 to R30). Tests and TLA+ properties must use
these IDs.

Each requirement names its owner. The owners are the layers in
[section 4.3](#43-layers):

- **Kernel:** the Rust core. It makes decisions and does no I/O.
- **Host:** each runner and its session store.
- **Codecs:** the model codecs crate.
- **Tools:** the native tools crate.
- **Dist:** the user space of a distribution.

### 8.1 Durability and sessions

- **R1. Host-neutral kernel (kernel).** The kernel does no I/O. It obeys the
  contract in [section 7.1](#71-kernel-contract). It must run on the eve
  Workflow host and on the libfx durable-harness host without changes.
- **R2. Replay rule (kernel and each host).** Each effect must declare `safe`
  or `never`. The default for tools is `never`. If a `never` effect is open
  after a crash, the host must not run it again. The host gives the result
  `interrupted` with the partial output. The kernel tells the model that the
  effect possibly had an effect. durable-harness already obeys this rule. The
  eve step code must change so that it obeys this rule.
- **R3. Bounded state (kernel, host).**
  - Kernel: after compaction, the kernel state must stay small. Large data
    goes to blobs.
  - Host: the cold-start time must not increase with the age of the session.
    The eve host continues to start a new run after compaction. The libfx
    host must get the same function, or a fold snapshot. Each session must
    stay in the World limits for each run.
- **R4. Continue, resume, and fork (host, dist).** The kernel state is
  serializable, so the kernel does not need a special function for these
  operations.
  - Continue the last session that a host opened in this workspace.
  - Resume a session by ID from any workspace. Bind the session to the new
    workspace.
  - Fork a session at a turn boundary. Copy the state at that boundary. Do
    not write to the source run.
- **R5. Child sessions (host).** The host does `child.message` effects. Each
  child session is its own run. The parent records the start and the end of
  the child. If a child crashes before it starts, the result is `lost`. A
  user cannot resume a child session directly.

### 8.2 Turn loop

- **R6. Step limit (kernel).** The user can set the step limit. By default,
  there is no limit. At the limit, the turn stops. A notice tells the user
  how to continue.
- **R7. Steer and cancel (kernel, host).**
  - Kernel: the kernel decides the result of each steer and cancel.
    1. A steer stops the model while the model writes its response.
    2. A steer waits while a tool runs.
    3. A user cancel always has priority.
    4. The kernel uses each steer ID one time only.
    5. If the input is not text only, the input becomes a new turn.
    6. If the parent waits for a subagent, the parent yields.

    To stop an open effect, the kernel returns a `cancel` command.

  - Host: steers and cancels are inbox inputs, so they are durable. The host
    gives them to `advance` while effects are open. The host obeys each
    `cancel` command and reports the partial output.

- **R8. Provider recovery (kernel, host, codecs).**
  - Kernel: write `decide(Evidence)` again in Rust.
    1. Use the delivery certainty to select retry, continue, or regenerate.
    2. When the network is not available, wait without a limit.
    3. When the provider stream stalls, show the stall.
    4. Do not retry only because there is no response.
    5. Do not fail a turn only because the retry count is high.
  - Host: report the evidence in each failed `model.call` result. The
    evidence is the delivery certainty, the streamed bytes, and the failure
    cause.
  - Codecs: classify provider errors into failure causes.
- **R9. Tool order (kernel, host).**
  - Kernel: read-only calls can run in parallel. A write call must wait for
    the calls before it, and the calls after it must wait for the write call.
    The kernel puts this order constraint in each effect request. It uses the
    tool descriptors to know which calls are read-only. Results go to the
    model in the sequence of the calls. The model never gets a tool call
    without its result.
  - Host: obey the order constraint. The host selects how much parallel work
    to do. The eve host can use parallel steps. durable-harness must get
    parallel effects in one drive.
- **R10. Hook points (kernel, dist).** The kernel requests a `hook.run`
  effect at each hook point. Distributions and users write the handlers in
  TypeScript.
  - `PreToolUse` can change or stop a tool call.
  - `Stop` can continue a turn one time.
  - `AttentionRequired` and `PostTurnEnd` observe.

  These hook points add to `defineHook`. Today, eve hooks only observe events.

### 8.3 Context

- **R11. Compaction with available records (kernel).** User messages and final
  responses must stay the same. The model writes notes and a ledger in a
  `model.call` effect with the purpose `compaction`. The kernel stores the
  `M`, `T`, and `L` records with `blob.put` effects. The model can read them
  by handle or by search. Compaction can start:
  - Automatically, at a set percentage of the context window.
  - When the user requests it.
  - When the context is too large for the model.

  Compaction can occur during a turn.

- **R12. Tool result handles (kernel).** If a result is larger than the
  limit, the kernel stores the full result with a `blob.put` effect. The model
  gets a handle and a preview. `read_tool_result` reads the result by byte
  range or by query. It is a kernel tool that requests `blob.get`.
- **R13. Project instructions (kernel, dist).**
  - Kernel: before a tool call touches a path, the kernel requests a
    `context.resolve` effect for that path. If the result has new
    instructions, the kernel adds them and holds the tool call one time. On
    resume, the kernel requests the same paths again. The kernel applies the
    size limits.
  - Dist: find the global, parent-directory, and scoped `AGENTS.md` files.
    Apply the rank and the omission reasons.
- **R14. Stable prompt sequence (kernel).** The prompt has this sequence:
  1. The stable prefix.
  2. The overlay for each step.
  3. The history.
  4. The current input.
  5. The suffix for the turn.

  This makes the eve rules for the deferred-tool catalog general, so that the
  prompt cache stays valid.

### 8.4 Tools and permissions

- **R15. Host workspace (dist, tools).** The workspace is a directory on the host.
  Commands use the login shell of the user. The workspace root is a session
  property. It is not always `/workspace`. If recovery occurs on a different
  machine, the model must get a note. durable-harness already sends this note
  (`workspaceNote`).
- **R16. Managed processes (tools).** The kernel does not know about
  processes. It sees only tool calls and tool results. If a process runs
  longer than its yield time, the model gets a handle. The handle stays
  available across turns. The model can send input to the process or stop
  it. A TTY is available. When fx stops, it stops the full process tree. The
  model gets each part of the output one time only.
- **R17. Permission layers (kernel, tools, dist).**
  - Kernel: apply the layers in this sequence:
    1. Mode.
    2. Rules.
    3. Session grants.
    4. Routine actions.
    5. The model review.

    A grant applies only to the exact action and the exact environment. The
    `approval` value of an eve tool is one input to this sequence.

  - Tools: each tool descriptor gives the action class, the targets, and the
    environment. The shell tool finds routine commands (for example
    `git status` or `npm test`). The list of routine commands is in the tools
    crate, not in the kernel.
  - Dist: resolve the mode and the rules from the settings. Give them to the
    kernel in the session config.

- **R18. Review hold (kernel).** The review is a `model.call` effect with the
  purpose `permission_review`. In `auto` mode, if the review returns
  `caution`, the kernel holds the action. The kernel tells the model the
  reason. The kernel does not ask a person. The kernel keeps each review
  result for the turn. If the reviewer is not available, the kernel tries
  again a limited number of times.
- **R19. Subagent authority (kernel).** A child gets a copy of the parent
  authority when it starts. A child cannot get more authority. A prompt from
  a child is never a user approval.
- **R20. Questions to the user (kernel, host).** The kernel requests a
  `user.ask` effect with typed questions and options. If no person is
  available, the host gives the result `unavailable`. The kernel then uses a
  specified fallback.
- **R21. MCP functions (dist on kernel connections).**
  - stdio transport.
  - The user must approve project MCP files.
  - The kernel replaces `${VAR}` values only after approval.
  - Resources and prompts.
  - Elicitation.
  - A size limit for tool schemas that load late.

### 8.5 Surfaces and distribution

- **R22. Local start (dist).** A CLI turn must not need Nitro, an HTTP port, a
  Node process, a World, or a compile step for each session. The fx CLI
  binary links the kernel, the in-process runner, the local session log,
  `model-codecs`, and `native-tools` statically. The binary loads JavaScript
  user space only when an extension needs it.
- **R23. Runtime settings (dist).** The user can set values in a profile and
  for each workspace. Environment variables have priority. The project file
  accepts only keys that are safe in a repository.
- **R24. ACP functions (dist).** ACP is a surface. The kernel gives the
  events and accepts the inputs that ACP needs.
  - Load and resume.
  - Client MCP, and MCP over ACP.
  - Modes and settings.
  - Steer.
  - Images.
  - Permission requests.
- **R25. Script use (dist).** `ask --json` has a stable schema. The exit codes
  are documented: 130 for SIGINT and 143 for SIGTERM. Progress messages go to
  stderr.
- **R26. Providers (codecs, dist).**
  - Grok OAuth.
  - OpenAI-compatible providers, set in JSON.
  - A review model and a title model for each provider.
- **R27. Distribution names (libfx host).** libfx sets its run names, step
  names, hook tokens, and queue prefixes. Today, durable-harness uses fixed
  names. eve keeps its Workflow names (`workflow//eve@…`). The standard
  Workflow CLI and dashboard must continue to show the sessions of both
  distributions.
- **R28. Local session log (host).** The local session log of the fx CLI must
  keep the properties of the current fx session store:
  1. A write stays on disk after a process crash.
  2. Data goes to disk only at durability points.
  3. The store repairs a torn last line.
  4. If a line in the middle is bad, the store opens the log as read-only.
  5. The store makes session files only at the first turn.
  6. Blobs have content addresses.
  7. Directories have mode 0700. Files have mode 0600.
  8. The store does not follow symbolic links.

  The log format is an open item (section 10).

- **R29. In-process runner (host).** One Rust runner serves the fx TUI,
  `fx ask`, `fx acp`, and in-process libfx (section 7.4). It works with no
  store, a memory store, the local session log, or a store from the app. Rust
  and JavaScript effect handlers use the same interface. After a crash, the
  runner continues only when the user resumes the session.
- **R30. Same agent in both libfx modes (dist).** A libfx app can change from
  the in-process runner to durable-harness. It changes only its durability
  option. The agent definition, the tools, the hooks, and the events stay the
  same. libfx has this property today with `memory()`, `local()`, and
  `vercel()`.

## 9. Functions that eve has and fx does not have

These eve functions must continue to operate. fx gets them through user space:

- Channels, schedules, remote agents, workspace agents, and memory providers.
- Evals, tool stubs, OTel, and client SDKs.
- Deployment handoff and stranded-session handling.
- Workflow tools and the task kernel (`research/executor-neutral-core.md`).
- Isolated sandboxes with network policy.

The kernel must keep these distributed rules. For fx, each rule has a simple
local form.

- More than one worker can serve a session. A fence controls them.
- Recovery can occur on a different version of the code.
- There is no ambient filesystem.
- Secrets do not go into the sandbox. durable-harness decision 6 has the same
  rule.
- Each authorization check uses the identity of the principal.

## 10. Open items

1. **Policy defaults in the kernel.** Section 4.1 puts the decisions in the
   kernel and the operations in the crates and the distributions. Some
   decisions have a default policy that a distribution can want to change,
   for example the compaction strategy or the permission layer sequence. We
   must decide which kernel policies a distribution can replace, and how.
   The "lean core" principle tells us to keep this list short.

2. **Kernel in Workflow code.** Workflow code runs in a deterministic VM.
   There are two options:
   - **Option A:** The kernel runs only in step code. The workflow keeps the
     kernel state as a serializable value. Each turn step loads the state,
     calls the kernel, and runs the effects.
   - **Option B:** The kernel also runs as WebAssembly in workflow code. The
     workflow calls the kernel directly, and each effect is one step.

   Option A is closer to the current eve design (`turnStep`). Option B gives
   one step for each effect.

3. **Local session log format.** The fx CLI log must keep the properties in
   R28. There are two options:
   - **Option A:** Keep the current fx v2 format (`log.jsonl` and blobs),
     with the kernel state and the effect results as its records.
   - **Option B:** Use the World event format in local files, so that
     `@workflow/cli` can read fx sessions. A durable libfx app can then open
     a session that the fx CLI started.

   Option A is simpler. Option B lets a session move from the fx CLI to
   durable libfx.

4. **durable-harness modes for libfx.** durable-harness has two modes:
   - **Strict:** the host waits for each write.
   - **Run-ahead (`on`):** the host sends writes in a pipeline. It can roll
     back. It accepts inputs before they are durable.

   We must select the default mode for libfx.

5. **Normal model interface.** The `model.call` effect has one normal
   request and one normal result (section 7.1). We must specify them. They
   must contain all the data that these consumers use:
   - The model codecs crate (Gateway, Responses, Chat Completions, Codex,
     Grok).
   - The AI SDK `LanguageModel` specification, which eve uses.
   - The evidence for `decide(Evidence)` (R8).

6. **Event set.** We must specify the kernel event vocabulary (section
   7.1). Each host maps it to its own protocol. The vocabulary must contain the
   data of three event sets:
   - The `libfx/hook` events.
   - The durable-harness live events and marks.
   - The eve protocol events.

   The kernel does not know these protocols.

## 11. How to make the requirements into tests

- **Conformance suite.** Make one test suite that does not depend on the host.
  Use an R-ID for each test. Run the suite against the Rust kernel in each of the
  five cases in section 4.1. Start with these tests:
  - The deterministic fx end-to-end tests (fake gateway) and the libfx tests
    in `sdk/tests`.
  - The eve fixture evals with mock models.
  - The durable-harness kernel suites: `in-band-fence`, `chaos`, `drills`,
    `invariants`, `runahead`, and `fold`. These tests apply to the libfx host.
  - The 10 invariants of `cli-check`. These tests apply to eve and durable libfx.
- **Kernel tests.** The kernel does no I/O, so its tests do not need a host.
  Give the kernel a state and a list of effect results. Compare the effect
  requests and the events with the expected values.
- **TLA+ models.** Write a model of the kernel contract (section 7.1). Change
  the fx `durable/` and `sdk/` models so that they check each host against
  this contract. Write new models for the gaps: parallel effects, bounded
  state, and cancel. Keep the trace drivers, so that the models check the
  Rust code.
- **Crash tests.** Make the durable-harness `ChaosSpec` and SIGKILL drills a
  test tier. Run them against each case that has a session store.
- **Boundary checks.** Make the layers in section 4.3 into mechanical checks:
  - The kernel crate has no I/O dependencies. It does not use `std::fs`,
    `std::net`, `std::process`, `std::time::SystemTime`, or an async runtime.
    Use `clippy` `disallowed-methods` and a dependency allowlist.
  - The kernel crate does not depend on the model codecs crate or the native
    tools crate. These crates do not depend on the kernel crate.
  - Hosts and distributions use only the published kernel API (eve rule 45).
  - Add the eve rules to `guard:invariants`. fx uses its
    `check-*-boundary.sh` scripts in the same way.

## 12. Sequence of work

1. Close open items 2 and 5. All other work depends on them.
2. Write a research document for R1, R2, R3, and R9. The subject is the
   kernel contract (section 7.1), the replay rule on each host, bounded state,
   and tool order. The kernel tests and the conformance suite are the acceptance
   tests.
3. Write a research document for R7, R8, and R10. The subjects are steer,
   cancel, the recovery policy, and the hook seams. These items change the
   eve harness rules the most.
4. Make a prototype of the eve Workflow host. Replace the AI SDK
   `ToolLoopAgent` in `turnStep` with the kernel. Run the eve fixture evals.
5. Make a prototype for R22, R28, and R29. The prototype is a static fx
   binary with the kernel, the in-process runner, and the local session log. Measure it against the 2 ms
   limit and the 7 MiB limit.
6. Do the user-space items: R13, R15 to R17, R21, and R23 to R26.

## 13. Prototype results

`packages/kernel-spike` is a prototype of the kernel contract (section 7.1). Its
README has the full results. The kernel in the prototype is small. It has
model calls, tool calls, tool order, steer, cancel, the replay rule, and a
port of the fx recovery policy. The prototype runs five scenarios on three
hosts:

- Host A: the in-process runner (fx CLI case), with real `abort()` crashes.
- Host B: Workflow SDK workflows (eve case). The kernel runs in step code
  (Node-API) or in workflow code (WebAssembly).
- Host C: durable-harness (durable libfx case), with `SIGKILL` crashes.

All scenarios pass on all hosts. The kernel has no host-specific code.

These results change the proposal:

1. **Open item 2.** Option B works on the default Workflow VM engine
   (`node:vm`), because the synchronous WebAssembly constructors are
   available. With option B, the `plain` turn has 5 steps instead of 11.
   Option B does not work on the QuickJS engine, because QuickJS has no
   WebAssembly.
2. **R2 on Workflow.** A `never` step can use `getStepMetadata().attempt`. If
   the attempt is more than 1, the step gives `interrupted`. The step must not
   throw for a usual failure. We must confirm with the Workflow team that the
   attempt count is correct on each World.
3. **R7 on Workflow.** Workflow cannot stop a step that runs. The prototype
   uses a marker that the step reads. eve must have a cancel channel for open
   steps.
4. **Section 7.5, gap 1.** durable-harness ran parallel effects in one drive
   on world-local. This gap is smaller than the proposal says.
5. **durable-harness inputs.** durable-harness has no cancel input kind. The
   prototype uses `followUp`. libfx must have a cancel input kind.
6. **State at the boundary.** Keep the kernel state in Rust between calls. A
   call then takes approximately 1 µs. If the state crosses the boundary as
   JSON on each call, the call takes approximately 1.1 ms for each MB.
7. **Model requests.** Each `model.call` request copies the full history. This
   costs approximately 1.5 ms for each MB. The normal model request (open
   item 5) must refer to the history, not copy it.
8. **Size of the port.** For pure logic, the Rust port is not shorter than
   the Zig source. The recovery policy has 259 lines of Rust and 216 lines of
   Zig. The line estimate for the kernel must increase until we port and
   measure a module with much I/O and memory allocation.
9. **fx CLI budget.** The `fx-mini` binary is 883 KB. It starts in
   approximately 0.5 ms more than the time to start a process.

### 13.1 Comparison with eve

The prototype runs one real eve session in three ways. All three use the same
scenarios, world-local, and a scripted model. Everything except the agent loop
is eve's own code. The README of `packages/kernel-spike` has the full tables.

- **eve:** eve as it is today. The AI SDK `ToolLoopAgent` runs in `turnStep`.
- **eve-native:** the kernel (Node-API) runs in `turnStep` and replaces the
  `ToolLoopAgent`. One `turnStep` makes one model call and runs its tools, as
  in eve.
- **eve-wasm:** the kernel (WebAssembly) runs in eve's session workflow code.
  Each `turnStep` runs one batch of effects.

| One turn (2 model calls, 3 tool calls) | Time   | Steps | Bytes written |
| -------------------------------------- | ------ | ----- | ------------- |
| eve                                    | 350 ms | 4     | 51 KB         |
| eve-native                             | 337 ms | 4     | 56 KB         |
| eve-wasm                               | 539 ms | 8     | 113 KB        |

| 20 turns, each with a 5 KB tool result | Time    | Bytes written |
| -------------------------------------- | ------- | ------------- |
| eve                                    | 3418 ms | 1065 KB       |
| eve-native                             | 3210 ms | 1307 KB       |
| eve-wasm                               | 8988 ms | 1671 KB       |

These results change the proposal:

1. **Open item 2.** Use the native kernel in step code, inside the eve step
   that exists today (`turnStep`). It is as fast as eve. Do not use option B
   for eve. eve-wasm needs more steps, and each eve step carries eve's session
   values. Workflow also replays the workflow code, so each WebAssembly call
   to the kernel runs again on each replay. eve-wasm is 1.6 times slower than
   eve on one turn and 2.6 times slower at 20 turns.
2. **R2.** eve-native keeps eve's step size: one model call and all of its
   tools in one step. If a crash occurs during a tool, the step runs again.
   To obey R2, the step must record an intent before each `never` tool, and
   give `interrupted` when it runs again. The step boundary does not do this.
3. **Bytes in eve-native.** eve-native writes 10–23% more bytes than eve.
   The kernel state keeps a copy of the history in eve's session state. eve's
   session machine also keeps the user messages. We must keep only one
   history.
4. **Where the time goes.** In all three modes, most of the time is the cost
   of each Workflow step. The kernel uses less CPU than eve's harness. At
   1 MB of history, one model step takes 0.86 ms in the kernel and 10 ms in
   eve's harness. But this difference is small compared to the step cost.
5. **R9.** eve ran the write at the same time as the two reads. The kernel
   runs the write after the reads. eve has no write fence today.

### 13.2 Comparison with fx

The prototype also links the kernel into the fx binary (`packages/kernel-spike/fx`).
The kernel replaces the agent loop of `fx ask`. fx's own code does the model
calls and the tool calls. Both binaries are `ReleaseSafe` builds of fx
`0b31a736`.

| Item                                   | fx           | fx with the kernel            |
| -------------------------------------- | ------------ | ----------------------------- |
| Binary size                            | 11,951,632 B | 12,488,992 B (+537 KB, +4.5%) |
| `fx --version`                         | 2.7 ms       | 2.8 ms                        |
| One turn (2 model calls, 3 tool calls) | 54 ms        | 37 ms                         |
| 20 model steps                         | 315 ms       | 295 ms                        |

These results change the proposal:

1. **Size.** The kernel, the Rust standard library, and serde_json add
   537 KB. fx's own agent loop is still in the binary. The 7 MiB limit for fx
   releases applies to a PGSO build, which this prototype did not make.
2. **Startup.** Linking in the kernel does not change startup time. The
   kernel loads only when a turn starts.
3. **Time.** Each model step takes the same time on both. The kernel path is
   16 ms faster on each run only because it does less work than fx's loop.
   It does not build the full prompt prefix, and it does not run observer
   hooks or admission. This is not a speedup that a full kernel would keep.
