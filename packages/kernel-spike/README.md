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

| Path                                       | What                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/kernel`                            | The kernel. `advance(state, inputs) → effects, commands, events`. No I/O. Includes a port of fx `model_response_recovery.zig` with its tests, and fx's tool grouping rule. |
| `crates/runner`                            | The in-process runner (R29): threads for effects, `cancel` commands, and an optional store (none, memory, or a JSONL session log).                                         |
| `crates/fx-mini`                           | Host A. An fx-shaped binary on the runner: a scripted model, file tools, and a real `abort()` for crash scenarios.                                                         |
| `crates/kernel-napi`, `crates/kernel-wasm` | The Node-API and WebAssembly builds of the kernel.                                                                                                                         |
| `hosts/workflow`                           | Host B. The kernel on Workflow SDK workflows (the eve case). The kernel runs either in step code (Node-API) or in workflow code (WASM).                                    |
| `hosts/durable-harness`                    | Host C. The kernel as a durable-harness `Harness` (the durable libfx case), in child processes that are SIGKILLed.                                                         |
| `scenarios/scenarios.json`                 | The five scenarios every host runs.                                                                                                                                        |
| `src/scenario.ts`, `test/assertions.ts`    | The TypeScript scenario host (the same script and tools as fx-mini) and one set of checks for every host.                                                                  |
| `bench/napi.ts`                            | The cost of crossing the kernel boundary as the session grows.                                                                                                             |
| `baseline/`, `bench/kernel-turn.ts`        | Today's eve on the same work, for comparison (see [Baseline](#baseline-todays-eve)).                                                                                       |

## Run it

Needs Rust with the `wasm32-unknown-unknown` target, and Node 24.

```sh
cd packages/kernel-spike
pnpm install
pnpm spike:build   # kernel.node, kernel.wasm, fx-mini
pnpm spike:test    # cargo test, hosts A and C, host B
pnpm spike:bench
pnpm spike:baseline   # today's eve on the same work (builds eve's JS first)
```

## Scenarios

| Scenario         | What happens                                                                 | What every host must show                                                                                               |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `plain`          | The model reads two files and writes one, then answers.                      | The reads run at the same time. The write starts after both reads end. The model gets the results in call order.        |
| `crash_in_write` | The process stops after the write's side effect, before its result is saved. | The write ran once. The model is told it "may or may not have taken effect". The turn finishes.                         |
| `crash_in_model` | The process stops during the second model call.                              | The second call runs again. The first call is not requested again. One tool call in total.                              |
| `steer`          | The user steers after the second chunk of a streamed reply.                  | The kernel returns `cancel` for the model call. The partial reply stays in history, then the steer, then the new reply. |
| `cancel`         | The user cancels during a slow tool call.                                    | The kernel returns `cancel` for the tool. The tool result says it was cancelled. The turn ends `cancelled`.             |

How each host crashes:

| Host | Crash                                                                                                        | Recovery                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| A    | `abort()` in the real process.                                                                               | A second process with `--resume` reads the JSONL session log.                                      |
| B    | The step throws. This test is in one process, so Workflow retries the step, as it does when a process stops. | Workflow runs the step again. A `never` step with `attempt > 1` reports `interrupted { crashed }`. |
| C    | `SIGKILL` of the child process.                                                                              | A second process with `recoverActiveRuns` replays the session from world-local.                    |

## Results

All 20 host runs pass, plus 22 kernel tests: hosts A and C, and host B in both
of its modes. Three repeated runs gave the same results.

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

## Baseline: today's eve

`pnpm spike:baseline` runs today's eve on the same work and prints the
comparison. It builds eve's JS first, because the eve half runs inside eve's
own integration tier.

- **Baseline 1** (`baseline/test/eve.integration.test.ts`) is a real eve
  session on world-local: `workflowEntry`, `turnStep`, and the AI SDK
  `ToolLoopAgent`. It uses a scripted `mockModel`, the same two tools, and
  no default tools. Host B runs the same work in
  `hosts/workflow/test/baseline.test.ts`. Both are measured with the World
  API (`src/metrics.ts`).
- **Baseline 2** (`baseline/test/harness.integration.test.ts`) times one eve
  model step against history size. It drives eve's harness directly, with no
  Workflow. `bench/kernel-turn.ts` times the same turn through the kernel.

The baseline files use eve's `#` imports, so they typecheck only inside eve's
test tier. They are not in this package's `tsconfig.json`.

### One `plain` turn on world-local

The turn has 2 model calls and 3 tool calls. Times are the median of 5 runs
after a warm-up.

| Host                 | Time   | Steps | Events | Written |
| -------------------- | ------ | ----- | ------ | ------- |
| eve                  | 349 ms | 4     | 19     | 51 KB   |
| Host B, kernel steps | 776 ms | 13    | 42     | 131 KB  |
| Host B, WASM         | 485 ms | 6     | 21     | 40 KB   |

- **eve's step is coarser.** eve has 2 `turnStep`s, one for each model call,
  and runs the tools inside those steps. Host B makes each model call and
  each tool call its own step.
  - So a crash during an eve tool reruns that step's model call and all of
    its tools. That is the rerun rule that R2 changes.
  - eve also ran the write at the same time as the two reads, so it has no
    write fence (R9).
- **Running the kernel in steps costs too much.** It is about 2.2 times
  eve's time and 2.6 times eve's bytes, because the kernel state goes into
  and out of every kernel step.
- **WASM in workflow code is close to eve.** Time is about 1.4 times eve's
  on one turn. It writes fewer bytes, with 2 more steps that give finer
  durability.

### `growth`: N turns, each a 5 KB tool result and a reply

| Turns | eve              | Host B, kernel steps | Host B, WASM    |
| ----- | ---------------- | -------------------- | --------------- |
| 1     | 197 ms, 48 KB    | 455 ms, 90 KB        | 252 ms, 26 KB   |
| 5     | 848 ms, 231 KB   | 1720 ms, 411 KB      | 802 ms, 107 KB  |
| 10    | 1651 ms, 487 KB  | 3333 ms, 898 KB      | 1577 ms, 220 KB |
| 20    | 3298 ms, 1067 KB | 6767 ms, 2155 KB     | 3354 ms, 486 KB |

Bytes written for each turn, between 10 and 20 turns:

| Host                 | Per turn |
| -------------------- | -------- |
| eve                  | 58 KB    |
| Host B, kernel steps | 126 KB   |
| Host B, WASM         | 27 KB    |

- **WASM keeps up with eve and writes half as much.** At 20 turns the times
  are the same, and WASM writes less than half of eve's bytes.
- **Both grow with history.** In eve, each `turnStep` writes the session
  snapshot. In the kernel, each model-call step input carries the history.

### One model step against history size, no Workflow

The step is one prompt, one model call, and one text reply.

| History | eve harness | Kernel, state in Rust | Kernel, JSON state | Kernel, WASM |
| ------- | ----------- | --------------------- | ------------------ | ------------ |
| 10 KB   | 1.0 ms      | 0.01 ms               | 0.06 ms            | 0.4 ms       |
| 100 KB  | 1.4 ms      | 0.09 ms               | 0.46 ms            | 2.8 ms       |
| 1 MB    | 7–10 ms     | 0.8 ms                | 4.3 ms             | 34 ms        |
| 10 MB   | 63 ms       | 9.5 ms                | 45 ms              | 923 ms       |

- **The kernel with its state in Rust is 7 to 70 times faster than eve's
  harness** for the same turn. But the toy kernel does much less: eve also
  runs hooks, emits events, estimates tokens, adds prompt-cache markers, and
  converts messages for the AI SDK. Read this as a ceiling on the boundary
  cost, not as an expected speedup.
- **Passing JSON state on every call takes away most of that lead** at
  1 MB and above.
- **WASM is the slowest.** It is too slow for long sessions until its UTF-8
  code is replaced. That matters, because WASM is the case that wins on
  steps and bytes above.

## What this prototype does not test

- **Crashes on Workflow are simulated.** Host B throws in-process instead of
  killing the process, and it runs only on world-local, not world-vercel.
- **Real model, tool, and session work:** no real providers, codecs,
  permissions, compaction, MCP, ACP, or TUI.
- **eve itself:** the eve features in the contract (tasks, approvals, the
  deferred tool catalog) are not exercised. eve's real `turnStep` was not
  replaced. That is the next step after this prototype.
