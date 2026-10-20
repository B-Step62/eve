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

## Run it

Needs Rust with the `wasm32-unknown-unknown` target, and Node 24.

```sh
cd packages/kernel-spike
pnpm install
pnpm spike:build   # kernel.node, kernel.wasm, fx-mini
pnpm spike:test    # cargo test, hosts A and C, host B
pnpm spike:bench
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

## What this prototype does not test

- **Crashes on Workflow are simulated.** Host B throws in-process instead of
  killing the process, and it runs only on world-local, not world-vercel.
- **Real model, tool, and session work:** no real providers, codecs,
  permissions, compaction, MCP, ACP, or TUI.
- **eve itself:** the eve features in the contract (tasks, approvals, the
  deferred tool catalog) are not exercised. eve's real `turnStep` was not
  replaced. That is the next step after this prototype.
