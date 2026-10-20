# kernel-spike

A prototype for [`research/fx-kernel-convergence.md`](../../research/fx-kernel-convergence.md).
It tests one claim: a Rust kernel with no I/O can run unchanged on every host
in that proposal. The kernel is deliberately small. The hosts and the
contract are what this prototype checks.

This package is private and not part of eve's build or CI. It has its own
pnpm workspace and lockfile, so its Workflow SDK and durable-harness packages
do not change how eve's dependencies resolve. Its scripts use a `spike:`
prefix.

## Layout

| Path                                       | What                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/kernel`                            | The kernel. `advance(state, inputs) → effects, commands, events`. No I/O. Version 2 decides tool approval (`approval.rs`) and compaction (`compaction.rs`) after eve. |
| `crates/runner`                            | The in-process runner (R29): threads for effects, `cancel` commands, and an optional store (none, memory, or a JSONL session log).                                    |
| `crates/fx-mini`                           | Host A. An fx-shaped binary on the runner: a scripted model, file tools, and a real `abort()` for crash scenarios.                                                    |
| `crates/kernel-napi`, `crates/kernel-wasm` | The Node-API and WebAssembly builds of the kernel.                                                                                                                    |
| `hosts/workflow`                           | Host B. The kernel on Workflow SDK workflows (the eve case). The kernel runs either in step code (Node-API) or in workflow code (WASM).                               |
| `hosts/durable-harness`                    | Host C. The kernel as a durable-harness `Harness` (the durable libfx case), in child processes that are SIGKILLed.                                                    |
| `scenarios/scenarios.json`                 | The five scenarios every host runs.                                                                                                                                   |
| `src/scenario.ts`, `test/assertions.ts`    | The TypeScript scenario host (the same script and tools as fx-mini) and one set of checks for every host.                                                             |
| `bench/napi.ts`                            | The cost of crossing the kernel boundary as the session grows.                                                                                                        |
| `baseline/`, `bench/kernel-turn.ts`        | eve three ways on the same work: today's eve, eve with the native kernel, eve with the WASM kernel (see below).                                                       |

## Run it

Needs Rust with the `wasm32-unknown-unknown` target, and Node 24.

```sh
cd packages/kernel-spike
pnpm install
pnpm spike:build   # kernel.node, kernel.wasm, fx-mini
pnpm spike:test    # cargo test, hosts A and C, host B
pnpm spike:bench
pnpm spike:baseline   # eve vs eve + native kernel vs eve + WASM kernel
```

## Scenarios

| Scenario         | What happens                                                                 | What every host must show                                                                                               |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `plain`          | The model reads two files and writes one, then answers.                      | All three calls run together (eve's rule, no write fence). The model gets the results in call order.                    |
| `crash_in_write` | The process stops after the write's side effect, before its result is saved. | The write runs again (eve's rule), so its side effect happens twice. The turn finishes.                                 |
| `crash_in_model` | The process stops during the second model call.                              | The second call runs again. The first call is not requested again. One tool call in total.                              |
| `steer`          | The user steers after the second chunk of a streamed reply.                  | The kernel returns `cancel` for the model call. The partial reply stays in history, then the steer, then the new reply. |
| `cancel`         | The user cancels during a slow tool call.                                    | The kernel returns `cancel` for the tool. The tool result says it was cancelled. The turn ends `cancelled`.             |

How each host crashes:

| Host | Crash                                                                                                        | Recovery                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| A    | `abort()` in the real process.                                                                               | A second process with `--resume` reads the JSONL session log.                   |
| B    | The step throws. This test is in one process, so Workflow retries the step, as it does when a process stops. | Workflow runs the step again.                                                   |
| C    | `SIGKILL` of the child process.                                                                              | A second process with `recoverActiveRuns` replays the session from world-local. |

## Results

All 20 host runs pass, plus 23 kernel tests: hosts A and C, and host B in both
of its modes.

The sections below up to "Kernel version 2" are the version 1 results. Version 2
removed the `never` replay rule, the write fence, and the port of fx's
recovery policy (`recovery.rs`), as decided in
[`fx-eve-behavior-alignment.md`](../../research/fx-eve-behavior-alignment.md).
The version 1 measurements stay here as a record.

### The contract held

- **No host-specific code in the kernel.** The same `advance` ran on all
  three hosts and in both host B modes. Each host is about 75–130 lines.
- **`never` works on Workflow without SDK changes (R2).** A `never` step
  checks `getStepMetadata().attempt`. This works only if the step never
  throws for an ordinary failure, since a retry for an error looks the same
  as a rerun after a crash. The step returns `failed` instead.
  `@workflow/core` also notes that attempt counts can include duplicate
  first attempts on worlds without an atomic start guard, such as
  world-local. Ask the Workflow team before relying on this rule.
- **Steer and cancel work without the kernel seeing the stream (R7).** The
  kernel returns `cancel(key)`, and the host stops the effect and reports
  the partial output. Workflow has no way to cancel a running step, so host
  B writes a marker that the step polls. eve needs a proper channel for this.
- **The kernel can run inside Workflow code (open item 2, option B).** The
  default `node:vm` engine keeps the synchronous `WebAssembly.Module` and
  `Instance` constructors. The WASM bytes ride in the workflow bundle (570
  KB as base64).
  - This removes every kernel step. The `plain` turn needs 5 steps instead
    of 11.
  - It does not work on the opt-in QuickJS engine, which has no
    WebAssembly.
- **durable-harness runs concurrent effects in one drive.** The two reads
  overlapped, and a recorded input committed while a model call was open.
  The proposal lists this as a gap (§7.5, item 1), so that gap is smaller
  than the proposal says.
  - durable-harness has no cancel submission kind, so host C sends cancel
    as `followUp`.
- **Kernel state does not need to be stored on durable-harness.** Each
  kernel input is recorded as an `in:<n>` effect, and a new process rebuilds
  the state by replaying them. Nothing runs again. The cost is that a cold
  start grows with the number of inputs (R3).

### The boundary

Times are from `bench/napi.ts` on an Apple silicon laptop. "small" is a steer
during a tool. "model" is a tool result that produces the next model request.

| State size | small, JSON state each call | small, state kept in Rust | small, WASM | model, JSON state | `JSON.stringify` alone |
| ---------- | --------------------------- | ------------------------- | ----------- | ----------------- | ---------------------- |
| 11 KB      | 18 µs                       | 1 µs                      | 143 µs      | 21 µs             | 5 µs                   |
| 100 KB     | 113 µs                      | 1 µs                      | 1.3 ms      | 172 µs            | 50 µs                  |
| 1 MB       | 1.1 ms                      | 1 µs                      | 11 ms       | 1.5 ms            | 0.4 ms                 |
| 10 MB      | 11 ms                       | 1 µs                      | 270 ms      | 16 ms             | 4.2 ms                 |

- **Keep the state in Rust between calls.** A call then costs about 1 µs at
  any size. Passing JSON state on every call costs about 1.1 ms per MB.
- **Every model request copies the full history,** so a model step costs
  about 1.5 ms per MB however the state is passed. `ModelRequest` should
  refer to the history (append-only deltas) instead of copying it.
- **The WASM path is about 10 times slower than Node-API.** The cause is the
  pure-JavaScript UTF-8 code that the Workflow VM needs. A binary format, or
  `TextEncoder` where it exists, would remove most of this.

### Host A: the fx CLI case

- **Size:** `fx-mini` is 883 KB as a stripped release build. That includes
  the kernel, the runner, serde_json, and the scripted handlers. fx's limit
  is 7 MiB.
- **Startup:** `fx-mini --version` takes about 0.5 ms more than spawning
  `/usr/bin/true`.
- **One full turn** (2 model calls, 3 tool calls, scripted, no sleeps):
  - about 8.5 ms more than a process spawn with no store;
  - about 13.6 ms with the local log, which writes one state record for each
    `advance` and calls fsync before each `never` effect.

### Zig to Rust size

`recovery.rs` is a direct port of `model_response_recovery.zig`, counting
non-blank, non-comment lines:

|            | Zig | Rust | Rust / Zig |
| ---------- | --- | ---- | ---------- |
| Production | 216 | 259  | 1.20       |
| Tests      | 294 | 208  | 0.71       |

For pure logic, Rust is not shorter. The serde derive and attribute lines
make it a little longer. The proposal's estimate assumed 0.5–0.7× across the
whole kernel. That is only plausible for Zig code that is heavy with
allocation and I/O, so the kernel estimate should move up until a module of
that kind is ported and measured.

## eve, eve with the native kernel, eve with the WASM kernel

`pnpm spike:baseline` runs one real eve session three ways, on the same
scenarios and the same world-local. It builds eve's JS first, because it runs
inside eve's own integration tier. The kernel modes are an experimental flag
in eve (`packages/eve/src/harness/kernel/`), off unless a session sets the
`eve.kernelMode` context key.

| Mode         | What runs the agent loop                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eve`        | Today's eve: the AI SDK `ToolLoopAgent` in `turnStep`.                                                                                                                                                                |
| `eve-native` | The kernel (Node-API) in `turnStep`, in place of the `ToolLoopAgent`. As in eve, one `turnStep` makes one model call and runs its tools. The kernel state rides eve's session state.                                  |
| `eve-wasm`   | The kernel (WASM) in eve's session workflow code (`execution/session/turn.ts`). Each `turnStep` runs one batch the kernel asks for: one model call, or one group of tool calls. A `never` tool is alone in its group. |

Everything else is eve's own: session creation, the inbox, channel delivery,
the session machine, and the event stream. The model is a scripted
`mockModel`, with the same two tools and no default tools.
`baseline/test/eve.integration.test.ts` checks every run: the files the tools
wrote, and the final reply in the event stream.

### One `plain` turn (2 model calls, 3 tool calls)

Times are the median of 5 runs after a warm-up, with kernel version 2. These
sessions do not ask for approval or compact.

| Mode       | Time   | Steps | Events | Written |
| ---------- | ------ | ----- | ------ | ------- |
| eve        | 355 ms | 4     | 19     | 51 KB   |
| eve-native | 345 ms | 4     | 17     | 59 KB   |
| eve-wasm   | 495 ms | 7     | 26     | 101 KB  |

### `growth`: N turns, each a 5 KB tool result and a reply

| Turns | eve              | eve-native       | eve-wasm         |
| ----- | ---------------- | ---------------- | ---------------- |
| 1     | 220 ms, 49 KB    | 185 ms, 57 KB    | 342 ms, 96 KB    |
| 5     | 939 ms, 231 KB   | 817 ms, 290 KB   | 1458 ms, 411 KB  |
| 10    | 1988 ms, 487 KB  | 1624 ms, 622 KB  | 3137 ms, 820 KB  |
| 20    | 3653 ms, 1066 KB | 3289 ms, 1385 KB | 8775 ms, 1689 KB |

Version 1 (before approval and compaction): one turn 350 / 337 / 539 ms;
20 turns 3418 / 3210 / 8988 ms. eve-native is still as fast as eve or
faster, and eve-wasm is still 1.4–2.4× slower. eve-native's state grew a
little (approval and compaction fields), so it now writes 16–30% more than
eve.

### What this shows

- **eve-native is as fast as eve.** It is 4 to 6 percent faster, and has the
  same steps. Workflow's cost for each step (the queue round trip, the event
  writes, and serialization) is most of the time. The kernel saves CPU (see
  below), but that CPU is a small part of the total.
  - It writes 10 to 23 percent more bytes. The kernel state has its own copy
    of the history in eve's session state, beside the user messages that
    eve's session machine still keeps. Removing that copy is the obvious fix.
  - It has 2 fewer events per turn, because it does not stream text deltas.
- **eve-wasm is slower, and it gets worse with every turn.** It takes 1.6
  times eve's time on 1 turn and 2.6 times at 20 turns. There are two causes:
  1. **More steps.** eve-wasm takes 2 steps per model call instead of 1,
     because each batch is its own step. It also needs one more step to end
     the turn, because only a step can publish events. Every eve `turnStep`
     carries eve's serialized context, session state, and history as its
     input, so more steps also means more bytes.
  2. **Replay.** Workflow re-runs the workflow function from the top each
     time it resumes, so every earlier `advance` call runs again. In WASM,
     `advance` is slow on large state (see below), so this cost grows with
     the session. The cost per run grows as the session grows, which fits
     this cause. I did not profile how much is replay and how much is the
     extra steps.
- **The kernel never writes anything itself.** Workflow records the inputs
  and outputs of steps. In eve-native, the kernel state is part of a step's
  session state, so Workflow records it. In eve-wasm, the kernel state is in
  workflow memory and is never recorded.

### One model step against history size, no Workflow

The same turn (a prompt, one model call, a text reply) through eve's harness
directly, and through the kernel
(`baseline/test/harness.integration.test.ts`, `bench/kernel-turn.ts`).

| History | eve harness | Kernel, state in Rust | Kernel, JSON state | Kernel, WASM |
| ------- | ----------- | --------------------- | ------------------ | ------------ |
| 10 KB   | 1.3 ms      | 0.02 ms               | 0.06 ms            | 0.4 ms       |
| 100 KB  | 1.6 ms      | 0.08 ms               | 0.47 ms            | 3.1 ms       |
| 1 MB    | 10 ms       | 0.86 ms               | 4.5 ms             | 37 ms        |
| 10 MB   | 67 ms       | 10 ms                 | 49 ms              | 850 ms       |

The toy kernel does less than eve's harness, so these numbers show only what
the boundary costs. The WASM column explains most of the replay cost above.

Host B (the kernel on bare Workflow, without eve) also writes its numbers to
`.spike-tmp/baseline/`, but it is not a comparison with eve.

## fx and fx with the kernel linked in

`fx/` compares fx (Zig) with fx that has the kernel linked in statically as
its agent loop. `fx/fx-kernel.patch` is the fx change, written against fx
`0b31a736`:

- `build.zig` gets a `-Dkernel-lib=<libkernel_ffi.a>` option.
- `src/core/cli/kernel_ask.zig` is the kernel path. `cli_ask.zig` uses it
  when the kernel is linked in and `FX_KERNEL=1` is set.
- The kernel path uses fx's own code for the work:
  - model calls go through `gateway_step.streamModelCompletion`;
  - `read_file` runs through `dispatchAuthorizedToolCall`;
  - `write_file` runs through fx's file mutation pipeline;
  - the result reaches `fx ask --json` through the same deps the orchestrator
    uses.
- The kernel itself is `crates/kernel-ffi`, a C ABI over the kernel crate.
  The state stays in Rust.

```sh
fx/build.sh <clean fx checkout> <out dir>     # needs Zig 0.17.0
node fx/run.mjs --bin <out>/fx-baseline --label fx
FX_KERNEL=1 node fx/run.mjs --bin <out>/fx-kernel --label fx+kernel
```

`fx/run.mjs` runs `fx ask --json --no-save` in full access against a
scripted gateway (`fx/fake-gateway.mjs`, the same wire format as fx's e2e
fake gateway), and checks the files and the final reply. Both binaries are
`ReleaseSafe`, which is how fx builds its releases. ReleaseSafe also strips
the binary here.

### Binary size and startup

| Binary                    | Size                          | `fx help` | `fx --version` |
| ------------------------- | ----------------------------- | --------- | -------------- |
| fx                        | 11,951,632 B                  | 3.2 ms    | 2.7 ms         |
| fx with the kernel linked | 12,488,992 B (+537 KB, +4.5%) | 2.8 ms    | 2.8 ms         |

Starting a process with `/usr/bin/true` takes 1.9 ms on the same machine, so
the startup difference is noise.

The +537 KB is the kernel plus the Rust standard library and serde_json. fx's
own agent loop is still in the binary. A real port would remove that loop,
but I did not measure how much that would save.

### Time (median of 10 runs, two rounds)

| Scenario                 | fx     | fx with the kernel | Model calls |
| ------------------------ | ------ | ------------------ | ----------- |
| plain (2 reads, 1 write) | 54 ms  | 37 ms              | 2           |
| steps-1                  | 53 ms  | 38 ms              | 2           |
| steps-5                  | 109 ms | 90 ms              | 6           |
| steps-10                 | 181 ms | 162 ms             | 11          |
| steps-20                 | 315 ms | 295 ms             | 21          |

- **Most of this time is a wait in fx, not work.** See "Where the time goes"
  below: about 10 ms of each model call is fx's gateway cancel watcher.
  The 13 ms that each extra model step costs on both binaries is mostly
  that wait.
- **The version 1 kernel path was about 16 ms faster because it skipped
  work:** the stable prompt prefix, observer hooks, admission, and
  presentation. Its requests were 7–13% smaller.
- **With `FX_KERNEL` unset, the kernel binary is fx.** Its times match the
  baseline.

## Kernel version 2: approval and compaction

Version 2 decides tool approval and compaction after eve
(`crates/kernel/src/approval.rs`, `compaction.rs`). See
[`research/fx-eve-behavior-alignment.md`](../../research/fx-eve-behavior-alignment.md)
for the behavior and the extension points.

### eve and eve with the native kernel

`baseline/test/hitl.integration.test.ts` runs the same sessions on eve and on
eve with the native kernel, and checks that both publish the same protocol
events in the same order (`turn.*`, `input.*`, `action*`, `message.completed`,
`compaction.*`). All 12 tests pass. It runs as part of `pnpm spike:baseline`.

| Session                                   | Checks                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| `always()`, approved                      | The write runs once; one `input.requested`.                  |
| `always()`, denied with "Not now."        | The write does not run; the model gets the denial and note.  |
| `once()`, two turns                       | Only the first turn asks.                                    |
| 6 turns of 1.5 KB in a 2,000-token window | Compaction runs; the next prompt has the checkpoint summary. |

In native mode, eve's own approval machinery still owns the person: the
kernel's `user_ask` parks the turn through `parkOnApprovals`, and the answer
is read back into the kernel. `auto()` and policy functions stay in eve
(`approval: "host"`).

### fx and fx with the kernel

`FX_PERMISSION_MODE` is set for each session. The scripted gateway answers
both fx's review and the kernel's review, because both use the
`permission_decision` tool.

| Session                       | fx                              | fx with the kernel             | fx, 1 ms poll | fx with the kernel, 1 ms poll |
| ----------------------------- | ------------------------------- | ------------------------------ | ------------- | ----------------------------- |
| plain (full access)           | 49 ms, 2 calls                  | 47 ms, 2 calls                 | 16 ms         | 17 ms                         |
| review-clear (auto, `.zshrc`) | 48 ms, 3 calls                  | 65 ms, 3 calls                 | 15 ms         | 15 ms                         |
| review-caution                | 48 ms, 3 calls                  | 66 ms, 3 calls                 | 14 ms         | 15 ms                         |
| ask-no-person (ask mode)      | 37 ms, 1 call, exit 1           | 36 ms, 1 call, exit 1          | 12 ms         | 11 ms                         |
| compaction (20 reads, 16k)    | 340 ms, 23 calls, 2 compactions | 321 ms, 22 calls, 1 compaction | 51 ms         | 49 ms                         |
| steps-5                       | 111 ms                          | 104 ms                         | 23 ms         | 22 ms                         |
| steps-10                      | 181 ms                          | 169 ms                         | 30 ms         | 31 ms                         |
| steps-20                      | 318 ms                          | 305 ms                         | 48 ms         | 50 ms                         |

Median of 5 runs. Model calls are the same in the 1 ms columns. Binary:
12,524,592 B (+573 KB over fx; +36 KB over the version 1 kernel).

- **With the 1 ms poll, fx and fx with the kernel take the same time in every
  session.** The differences are within 1–2 ms, which is noise here.
- **fx compacts at 80% with its own notes; the kernel at 90% with eve's
  checkpoint**, as decided.

### Where the time goes

Each streamed gateway request in fx starts a cancel watcher thread
(`GatewayCancelWatcher.run` in `src/gateway/client.zig`). The thread checks
for cancel, suspend, and timeouts, then sleeps 10 ms. When the request ends,
fx sets `done` and joins the thread, so it waits for the rest of that sleep.
That is up to 10 ms on each model call.

`fx/gateway-poll-1ms.patch` changes the sleep to 1 ms, and nothing else.
`fx/build.sh` builds it as `fx-kernel-1ms`; with `FX_KERNEL` unset it is fx.
With this patch, steps-20 goes from 318 ms to 48 ms.

- **The wait explains the slow kernel review.** fx's own reviewer uses its
  own transport, which has no watcher. The kernel's review goes through fx's
  agent stream client, which has one, so it waited one more time. With the
  1 ms poll the two paths are equal.
- **The fix in fx is to wake the watcher when the request ends,** not to
  poll faster. Against a real model each call takes seconds, so this costs
  about 10 ms on each call, not a large part of a turn.

## What this prototype does not test

- **Crashes on Workflow are simulated.** Host B throws in-process instead of
  killing the process, and it runs only on world-local, not world-vercel.
- **Real model, tool, and session work:** no real providers, codecs, MCP,
  ACP, or TUI. Approval and compaction run on eve and fx, but only with
  scripted models.
- **eve itself:** the eve features in the contract (tasks, approvals, the
  deferred tool catalog) are not exercised. eve's real `turnStep` was not
  replaced. That is the next step after this prototype.
