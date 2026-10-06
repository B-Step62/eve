---
issue: TBD
status: prototype
last_updated: "2026-10-06"
---

# Per-run event and step directories for `@workflow/world-local`

## Summary

`@workflow/world-local` 5.0.1 keeps every event and step file of every run in two flat directories, `events/` and `steps/`. Every read scoped to one run lists the whole directory and filters by file-name prefix, so its cost grows with every run the data directory has ever held. On a long-lived local store this dominates the runtime: one `events.list` took 918 ms on a 57k-file store, and libuv's four file threads sat near 99% in `scandir`.

This change stores each run's files in its own subdirectory, `events/<runId>/` and `steps/<runId>/`, under unchanged file names. Run-scoped reads list only that run. Existing flat stores are converted on first use. eve carries the change as a pnpm patch on `@workflow/world-local@5.0.1` (`patches/@workflow__world-local@5.0.1.patch`) until it is released upstream.

## Where the cost was

Every path below did one `readdir` of the full flat directory per call:

| Path                                                               | Caller frequency           |
| ------------------------------------------------------------------ | -------------------------- |
| `events.list({ runId })` (`paginatedFileSystemQuery`)              | Once per replay step       |
| `events.create(..., { sinceCursor })`, which returns the log delta | Almost every runtime write |
| First `events.create` per run per process (latest-seq scan)        | Once per run               |
| `events.listByCorrelationId`, hook lookups                         | Per hook resolution        |
| `steps.list({ runId })`                                            | Per replay                 |

5.0.1 already memoizes each run's latest event sequence in memory after the first scan, so plain creates were cheap. The `sinceCursor` creates and the listings were not.

## Design

- **Layout.** `events/<runId>/<runId>-<eventId>[.<tag>].json` and `steps/<runId>/<runId>-<stepId>[.<tag>].json`. The names stay the same so tag filtering, cursors and cache keys are unchanged. This matches how the Postgres and Vercel worlds scope storage by run.
- **Why not an in-memory index.** An index is per process. A CLI or the web UI reading next to a dev server would either rebuild it (a full scan) or read a stale one. A directory per run is correct across processes with no coordination.
- **Migration.** Before the first storage call in a process, every flat `*.json` file in `events/` and `steps/` is renamed into its run's directory.
  - Renames are atomic and never overwrite. If the destination is the same inode (an interrupted hard-link copy), the flat name is dropped. A different file at the destination is left in place and counted as skipped.
  - The run of a file comes from its name when the `-evnt_` / `-step_` separator occurs exactly once. Otherwise, as with a step id like `step_a-step_b` or a run id containing the separator, the `runId` stored in the file decides, and only if the name starts with it.
  - In-flight `*.json.tmp.<id>` writes are not moved.
  - The pass is safe to interrupt and to run concurrently from several processes. Every storage entry point, and the tagged `clear()`, awaits it, so nothing reads the per-run directories before the conversion has finished.
  - After conversion, a later pass costs one `readdir` of `events/` and of `steps/`, which by then hold one entry per run.

## Benchmark

Harness: [`scripts/world-local-layout-bench.mjs`](../scripts/world-local-layout-bench.mjs).

```sh
# APFS clone of a real store (no extra disk), padded to 50k event files.
# <benchStore> must be a new path outside <realStore>; prepare refuses anything else.
node scripts/world-local-layout-bench.mjs prepare <realStore> <benchStore> 50000
# Point at a world-local build's dist/index.js
node scripts/world-local-layout-bench.mjs run <world-local>/dist/index.js <benchStore> <label>
```

Store: a copy of a long-running local eve agent's data directory (206 real runs, 9.4k steps), padded to 50k event files with cloned files under synthetic run ids. Machine: Apple Silicon, APFS. The p50 in milliseconds is shown, with p95 in parentheses. Each listing reads all pages with `resolveData: 'all'`.

| Operation                                         | beta.48       | 5.0.1         | per-run           |
| ------------------------------------------------- | ------------- | ------------- | ----------------- |
| `events.create` with `sinceCursor` (61 writes)    | n/a           | 79.0 (113.4)  | **2.6 (3.9)**     |
| `events.create` `run_created`                     | 69.6          | 73.0          | **4.2**           |
| `events.create` `run_completed`                   | 66.0          | 84.8          | **10.5**          |
| `events.create`, step events without cursor (150) | 3.1 (6.0)     | 3.0 (5.4)     | 2.9 (4.5)         |
| `events.list`, 2-event run                        | 64.3 (76.3)   | 98.4 (101.7)  | **0.3 (0.3)**     |
| `events.list`, 117-event run                      | 81.3 (90.0)   | 104.6 (113.3) | **3.5 (4.0)**     |
| `events.list`, 1,672-event run                    | 350.7 (456.3) | 341.0 (506.3) | **143.9 (266.9)** |

What remains in the per-run column is proportional to the run's own size: the 1,672-event listing is dominated by reading and parsing its files (multi-MB step inputs), not by scanning.

**One-time conversion:** 22.8 s for about 59k files (around 0.35 ms per APFS rename on this machine). It logs a notice from 1,000 files up. After that, a process start takes 141–165 ms to initialize, compared with 132 ms on 5.0.1.

## Operational constraints

- **Stop older writers before upgrading.** The conversion runs once per process. If an older world-local (flat layout) keeps writing to the same data directory, its new files stay invisible to the upgraded process (those runs look truncated) until the next process start moves them. In eve, this means restarting every agent on a data directory at the same time when moving to this version.
- **Rollback is manual.** Older versions read only the flat layout and would see migrated runs as empty. To downgrade, stop every process on the data directory and run [`scripts/world-local-flatten-layout.mjs`](../scripts/world-local-flatten-layout.mjs) `<dataDir>`. It moves each per-run file back up one level under the same name and never overwrites. Nothing else on disk changed format, so this is the whole rollback.
- **Vendoring cache.** eve's vendored copy is rebuilt when any patched `dist/` file changes (`fingerprintFiles` in `scripts/vendor-compiled/@workflow/world-local.mjs`). Before this change only `dist/fs.js` was fingerprinted, so an edit to the patch that did not touch it left a stale `.generated/compiled` copy.

## Upstream

All of the code is internal to `@workflow/world-local`: the directory layout, the listings and the migration. eve cannot change it from outside, so the patch is temporary. The same change will be proposed to `vercel/workflow`, and eve can drop the patch once a release includes it.

## Not in this change

- **Retention for finished runs.** Nothing deletes old runs today. A store grows by about 1.5 GB/day under heavy use. Planned as a world-local option, off by default in the library, with eve enabling it for its own stores (proposed: 7 days).
- **Storing step input once.** Each step's input is written both to `steps/` and to the `step_created` event (175 KB–2 MB each). The Postgres world duplicates it too, so this is a local disk saving only.
