// Host C: the kernel as a durable-harness `Harness` (the durable libfx case).
//
// The durable-harness world is the store, and it holds the kernel's own log:
// each entry is an `in:<seq>` effect, and every SNAPSHOT_EVERY entries a
// `snap:<seq>` effect holds the kernel state. A new process loads the last
// snapshot, folds the entries after it, and asks the kernel which effects are
// open (`resume`). Model and tool calls are their own effects, so one that
// finished before the crash returns its recorded outcome.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { type DriveContext, EffectFailure, type Harness } from "durable-harness";

import type {
  EffectRequest,
  EffectResult,
  Entry,
  Input,
  KernelState,
  Output,
  SessionConfig,
} from "../../src/contract.ts";
import { Kernel } from "../../src/native.ts";
import type { ScenarioHost } from "../../src/scenario.ts";

export const RESULT_FILE = ".c-result.json";

/** Small, so the test scenarios cross a snapshot. */
const SNAPSHOT_EVERY = 4;

type Submission = ReturnType<DriveContext["pending"]>[number];

/** durable-harness has no cancel submission, so `followUp` carries it. */
function toInput(s: Submission): Input {
  if (s.kind === "steer") return { type: "steer", id: s.id, text: s.text ?? "" };
  if (s.kind === "followUp") return { type: "cancel", id: s.id };
  return { type: "prompt", id: s.id, text: s.text ?? "" };
}

export function kernelHarness(opts: {
  config: SessionConfig;
  host: ScenarioHost;
  send(input: Input): Promise<void>;
}): Harness {
  return {
    name: "kernel-spike",
    async drive(ctx) {
      let n = 0;
      for (let k = SNAPSHOT_EVERY; ctx.isMemoized(`snap:${k}`); k += SNAPSHOT_EVERY) n = k;
      const snapshot =
        n === 0
          ? undefined
          : await ctx.effect<KernelState>(
              `snap:${n}`,
              { name: "kernel.snapshot", replay: "safe", input: null },
              async () => {
                throw new Error(`snap:${n} is not recorded`);
              },
            );
      const kernel = new Kernel(opts.config, snapshot);
      const open = new Map<string, EffectRequest>();
      const running = new Map<string, { cancelled: boolean }>();
      const finished = new Map<string, EffectResult>();
      let stop: unknown;

      const apply = (out: Output) => {
        for (const e of out.effects) open.set(e.key, e);
        for (const c of out.commands) {
          const r = running.get(c.key);
          if (r) r.cancelled = true;
          else if (open.has(c.key))
            finished.set(c.key, { status: "interrupted", reason: "cancelled" });
        }
      };

      const feed = async (candidate: Input | undefined, placed: string[]) => {
        const seq = n + 1;
        const entry = await ctx.effect<Entry | undefined>(
          `in:${seq}`,
          { name: "kernel.entry", replay: "safe", input: candidate ?? null, placed },
          async () => (candidate === undefined ? undefined : { seq, input: candidate }),
        );
        if (!entry) throw new Error(`in:${seq} has no recorded entry`);
        n = seq;
        if (entry.input.type === "effect_result") {
          open.delete(entry.input.key);
          finished.delete(entry.input.key);
        }
        apply(kernel.replay([entry]));
        if (n % SNAPSHOT_EVERY === 0) {
          await ctx.effect(
            `snap:${n}`,
            { name: "kernel.snapshot", replay: "safe", input: null },
            async () => kernel.snapshot(),
          );
        }
      };

      const start = (req: EffectRequest) => {
        const flag = { cancelled: false };
        running.set(req.key, flag);
        const name = req.effect.kind === "tool_call" ? `tool.${req.effect.name}` : req.effect.kind;
        void ctx
          .effect(req.key, { name, replay: req.replay, input: req.effect }, async (io) =>
            opts.host.run(req, {
              crash: () => new Promise<never>(() => {}),
              send: opts.send,
              cancelled: () => flag.cancelled || io.signal.aborted,
            }),
          )
          .catch((err: unknown): EffectResult => {
            if (!(err instanceof EffectFailure)) throw err;
            return err.error.interrupted
              ? { status: "interrupted", reason: "crashed", partial: err.error.partial ?? null }
              : { status: "failed", error: err.error.message };
          })
          .then(
            (result) => {
              running.delete(req.key);
              finished.set(req.key, result);
            },
            (err: unknown) => {
              stop ??= err;
            },
          );
      };

      // Fold the logged entries after the snapshot, then open what the kernel says is open.
      while (ctx.isMemoized(`in:${n + 1}`)) await feed(undefined, []);
      open.clear();
      finished.clear();
      apply(kernel.resume());

      for (;;) {
        if (stop) throw stop;
        await ctx.refresh();
        const sub = ctx.pending().find((s) => s.kind !== "chaos" && s.kind !== "withdraw");
        if (sub) {
          await feed(toInput(sub), [sub.id]);
          continue;
        }
        const next = finished.entries().next();
        if (!next.done) {
          const [key, result] = next.value;
          await feed({ type: "effect_result", key, result }, []);
          continue;
        }
        for (const [key, req] of open) {
          if (!running.has(key) && req.after.every((k) => !open.has(k))) start(req);
        }
        if (open.size === 0 && kernel.isIdle()) break;
        await new Promise((r) => setTimeout(r, 20));
      }

      // A drive that started from a snapshot saw only the later events, so the
      // report folds the whole log from the start, as any reader of it can.
      const log: Entry[] = [];
      for (let seq = 1; seq <= n; seq++) {
        log.push(
          await ctx.effect<Entry>(
            `in:${seq}`,
            { name: "kernel.entry", replay: "safe", input: null },
            async () => {
              throw new Error(`in:${seq} is not recorded`);
            },
          ),
        );
      }
      const whole = new Kernel(opts.config).replay(log);
      writeFileSync(
        join(opts.host.ws, RESULT_FILE),
        JSON.stringify({
          state: kernel.snapshot(),
          commands: whole.commands,
          events: whole.events,
        }),
      );
      ctx.live({ type: "idle" });
    },
  };
}
