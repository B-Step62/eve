---
issue: TBD
status: draft
last_updated: "2026-10-20"
---

# fx and eve behavior alignment

Companion to [`fx-kernel-convergence.md`](./fx-kernel-convergence.md). This
document decides the behavior of the shared kernel, one capability at a time.

## Rule

eve is the reference. fx changes to eve's behavior, with two exceptions:

1. **Mutually exclusive behavior.** If a behavior depends on the host (a local
   CLI or a distributed service, a person at a terminal or a channel), the
   kernel gets an extension point. Each distribution supplies its own
   implementation.
2. **eve is weaker, and the behavior is not host specific.** The kernel keeps
   fx's behavior, and eve gains it. Each of these items needs a decision. They
   are marked **Decide**.

## Classes

| Class         | Meaning                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| **eve**       | The kernel does what eve does. fx changes.                                                                   |
| **Decide**    | eve is weaker. Each was decided: **fx** (the kernel keeps fx's behavior) or **eve** (fx loses its behavior). |
| **Extension** | The behavior is host specific. The kernel has a seam with two implementations.                               |
| **Dist**      | Not in the kernel. Each distribution keeps its own.                                                          |

## Capabilities

### Turn and loop

| Capability                | eve                                                             | fx                                                              | Class            | Kernel behavior                                                                    |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Input while a turn runs   | `turnPolicy`: `steer` (default) or `queue`, set by the channel  | A steer if it is text only, else the next turn                  | **eve**          | `turnPolicy` per input. fx sends `steer`.                                          |
| When a steer applies      | Before output or effects start. After that, at the next commit. | During generation it stops the stream. During a tool, it waits. | **fx** (decided) | A steer stops generation. It never stops a tool that runs.                         |
| Cancel                    | Cancels the turn, its tasks, and child sessions                 | Cancels the turn. A pending approval is refused.                | **eve**          | eve's scope. The kernel sends `cancel` for each open effect and closes each child. |
| Step limit                | None for each turn                                              | Optional, none by default                                       | **eve**          | No limit by default. The option stays because it costs nothing.                    |
| Session budgets           | Input tokens, output tokens, cost, and time for each session    | None                                                            | **eve**          | Kernel checks before each model call. fx gets budgets.                             |
| Turn ends while tasks run | No. The turn holds until the tasks settle.                      | No tasks                                                        | **eve**          | The kernel holds the turn while task effects are open.                             |
| Structured output         | `outputSchema` and the `eve__reply` tool                        | None                                                            | **eve**          | The kernel owns the reply-tool rule. fx gets it.                                   |
| Tools that end the turn   | `endsTurn`                                                      | None                                                            | **eve**          | Kernel rule from the tool descriptor.                                              |

### Tools and effects

| Capability               | eve                                                                                      | fx                                                                                  | Class             | Kernel behavior                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Parallel calls           | All calls of a response run together                                                     | Read-only groups run together. A write stops the group.                             | **eve** (decided) | All calls of a response run together. No write fence.                                                                    |
| Crash during a tool      | The step runs again, with the model call and all tools                                   | A `never` tool is not run again. The model gets "may or may not have taken effect". | **eve** (decided) | The host runs an interrupted effect again. R2 is withdrawn.                                                              |
| Large tool results       | Each tool cuts its own output                                                            | Result store, handle, preview, and `read_tool_result`                               | **eve** (decided) | Each tool cuts its own output. The kernel does not store results.                                                        |
| Tool media               | Staged in the sandbox. History keeps a reference.                                        | Images inline, with limits                                                          | **Extension**     | `blob.put` effect. eve stages in the sandbox. fx keeps inline bytes.                                                     |
| Deferred tools           | `eve__search`, `eve__tool`, `eve__skill`, a listing that never changes the prompt prefix | `capability_search`, `mcp_select_tool`, a schema budget                             | **eve**           | eve's catalog tools and cache rules. fx's search ranking can be the search implementation.                               |
| Dynamic tools            | `defineDynamic` at session, turn, or step start                                          | Fixed set, plus MCP                                                                 | **eve**           | `tools.resolve` effect at those events. fx answers it with its fixed set and MCP.                                        |
| Workflow tools and tasks | `execute`, `task`, `serve`; `eve__task_wait`, `eve__task_cancel`                         | Managed shell processes                                                             | **Extension**     | One "long effect" contract: start, observe, cancel. eve backs it with workflow runs. fx backs it with managed processes. |

### Approval and permission

| Capability           | eve                                                            | fx                                                                                  | Class         | Kernel behavior                                                                                                                                            |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy for each tool | `approval`: `always`, `never`, `once`, `auto()`, or a function | Tool descriptor `requires_approval`                                                 | **eve**       | eve's policy values on the tool descriptor.                                                                                                                |
| Session policy       | None                                                           | Mode (`ask`, `auto`, `full-access`), rules, remembered grants, routine command list | **Extension** | A `policy.decide` seam before each tool call. eve's default uses only the tool policy. fx's implementation adds mode, rules, grants, and the routine list. |
| `auto()` review      | Decision model. `caution` asks a person.                       | Review model. `caution` holds the action and tells the model.                       | **Extension** | The review is a `model.call` with the purpose `permission_review`. What `caution` does is set in the session config: `ask` (eve) or `hold` (fx).           |
| Asking a person      | Input request. The turn parks durably until an answer arrives. | Prompt in the terminal, or `permission_required` when no person is present          | **Extension** | `user.ask` effect. The host parks (eve) or prompts (fx). With no person, the host returns `unavailable`.                                                   |
| Grant scope          | `once()` with an `approvalKey`, for the session                | Exact action and environment, for the session                                       | **eve**       | `once` grants with an `approvalKey` in kernel state. fx's key is the exact action.                                                                         |

### Context

| Capability   | eve                                                                 | fx                                                        | Class         | Kernel behavior                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------- | --------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instructions | Authored, plus dynamic instructions at session and turn start       | System prompt, plus `AGENTS.md` files                     | **Extension** | `context.resolve` effect at session start, turn start, and before a tool touches a path. eve answers with its dynamic instructions. fx answers with `AGENTS.md`. |
| Compaction   | At 90% of the context window: summary checkpoint plus recent window | At 80%: notes, ledger, and records the model can retrieve | **eve**       | eve's trigger and summary shape. Records are optional: with a store, the kernel writes the compacted text to it.                                                 |
| Memory       | Recall at turn start, capture at turn end                           | None                                                      | **eve**       | `memory.recall` and `memory.capture` effects at those events. fx answers with none.                                                                              |
| Skills       | Authored skills, `eve__skill`                                       | Many discovery roots, the `skill` tool                    | **Dist**      | Discovery is distribution policy. Loading is the catalog tool.                                                                                                   |
| Prompt order | Stable prefix, catalog listing as messages, history                 | Stable prefix, overlay for each step, history             | **eve**       | eve's cache rules. fx's overlay becomes appended context messages.                                                                                               |

### Model and recovery

| Capability         | eve                                        | fx                                                                              | Class             | Kernel behavior                                                                                 |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| Provider transport | AI SDK `LanguageModel`                     | Own codecs                                                                      | **Extension**     | `model.call` effect (already in the prototype).                                                 |
| Retry              | 3 attempts, then the Workflow step retries | `decide(Evidence)`, which never fails a turn only because it retried many times | **eve** (decided) | 3 attempts with backoff, then the turn fails. The Workflow step retry stays the crash backstop. |
| Empty response     | One more attempt                           | Recovery policy                                                                 | **eve**           | One more attempt, then the recovery policy.                                                     |
| Title              | None                                       | Title model, as a side call                                                     | **Dist**          |                                                                                                 |

### Hooks and events

| Capability       | eve                                                           | fx                                                           | Class            | Kernel behavior                                                                              |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------- |
| Event vocabulary | Protocol events (`turn.*`, `step.*`, `message.*`, `action.*`) | `libfx/hook` events                                          | **eve**          | The kernel emits eve's protocol events. fx maps them to its UI and to `libfx/hook`.          |
| Hooks that act   | `cancel()` only                                               | `PreToolUse` (change or stop a call), `Stop` (continue once) | **fx** (decided) | `hook.run` effect at `PreToolUse` and `Stop`. eve's `defineHook` gets the two return values. |

### Sessions and surfaces

| Capability                       | eve                                              | fx                                                                       | Class         | Kernel behavior                                                                         |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| Durability                       | Workflow                                         | Local log                                                                | **Extension** | The host (already in the proposal).                                                     |
| Subagents                        | Tasks: declared agents, remote agents, root copy | `run` and `message`, no nesting, the child copies the parent's authority | **eve**       | eve's task model. fx's authority snapshot becomes the kernel rule for each child (R19). |
| Resume, fork, settings, ACP, TUI | Their own                                        | Their own                                                                | **Dist**      |                                                                                         |

## Extension points

The kernel needs these seams. Each is an effect or a session config value, so
the kernel stays free of I/O.

| Seam                              | Form                                               | eve                               | fx                                |
| --------------------------------- | -------------------------------------------------- | --------------------------------- | --------------------------------- |
| `policy.decide`                   | Effect before each tool call                       | Tool policy only                  | Mode, rules, grants, routine list |
| `review.caution`                  | Session config: `ask` or `hold`                    | `ask`                             | `hold`                            |
| `user.ask`                        | Effect                                             | Durable input request             | Terminal prompt, or `unavailable` |
| `context.resolve`                 | Effect at session start, turn start, and tool path | Dynamic instructions              | `AGENTS.md` discovery             |
| `tools.resolve`                   | Effect at session, turn, and step start            | `defineDynamic` tools             | Fixed set and MCP                 |
| `memory.recall`, `memory.capture` | Effects at turn start and end                      | Memory providers                  | None                              |
| `blob.put`, `blob.get`            | Effects                                            | Sandbox attachments and the World | Session log blobs                 |
| Long effect                       | Start, observe, cancel                             | Workflow tool runs and tasks      | Managed processes                 |
| `model.call`                      | Effect                                             | AI SDK                            | fx codecs                         |
| `hook.run`                        | Effect at `PreToolUse` and `Stop`                  | `defineHook`                      | fx hook registry                  |

## Decisions

| Item                                 | Decision | Effect                                              |
| ------------------------------------ | -------- | --------------------------------------------------- |
| A steer stops generation             | fx       | eve changes.                                        |
| Hooks that act                       | fx       | eve's `defineHook` gets `PreToolUse` and `Stop`.    |
| Never run a tool again after a crash | eve      | fx loses R2. The kernel has no `never` replay rule. |
| Write fence                          | eve      | All calls of a response run together.               |
| Patient retry                        | eve      | 3 attempts, then the turn fails.                    |
| Large result handles                 | eve      | Each tool cuts its own output.                      |

## Kernel version 2

The prototype kernel has the loop, tool order, steer, cancel, the replay
rule, and the recovery policy. Version 2 adds the decisions that eve and fx
both make, so that the kernel has real work to do:

1. **Approval and permission.** Tool policies (`always`, `never`, `once`,
   `auto`), `policy.decide`, the `permission_review` model call, `caution` as
   `ask` or `hold`, `user.ask`, and `once` grants in kernel state.
2. **Compaction.** eve's trigger and summary shape, with a `compaction`
   model call. Optional records go through `blob.put`.

Version 2 also applies the decisions above: no write fence, no `never`
replay rule, and eve's retry policy in place of `decide(Evidence)`.

Each item is tested in the kernel crate, and then on two hosts: eve with the
native kernel, and fx with the kernel linked in. eve already has both behaviors, so eve's behavior is the reference.

Later versions can add session budgets, turn policy, hooks, tasks,
structured output, dynamic tools, memory, and subagents. These items need host plumbing that the prototype does not have.
