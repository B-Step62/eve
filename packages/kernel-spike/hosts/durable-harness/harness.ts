// Host C: the kernel as a durable-harness `Harness` (the durable libfx case).
//
// Every kernel input is an `in:<n>` effect whose output is the input itself,
// so the log holds the exact input sequence. A new process rebuilds the
// kernel by replaying those inputs (nothing runs again), then continues
// live. Model and tool calls are their own effects with the kernel's replay
// rule, so a crashed `never` call comes back as interrupted.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { type DriveContext, EffectFailure, type Harness } from "durable-harness";

import type {
  Command,
  EffectRequest,
  EffectResult,
  Input,
  KernelEvent,
  Output,
  SessionConfig,
} from "../../src/contract.ts";
import { Kernel } from "../../src/native.ts";
import type { ScenarioHost } from "../../src/scenario.ts";

export const RESULT_FILE = ".c-result.json";

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
      const kernel = new Kernel(opts.config);
      const commands: Command[] = [];
      const events: KernelEvent[] = [];
      const open = new Map<string, EffectRequest>();
      const running = new Map<string, { cancelled: boolean }>();
      const finished = new Map<string, EffectResult>();
      let stop: unknown;
      let n = 0;

      const apply = (out: Output) => {
        commands.push(...out.commands);
        events.push(...out.events);
        for (const e of out.effects) open.set(e.key, e);
        for (const c of out.commands) {
          const r = running.get(c.key);
          if (r) r.cancelled = true;
          else if (open.has(c.key))
            finished.set(c.key, { status: "interrupted", reason: "cancelled" });
        }
      };

      const feed = async (candidate: Input | undefined, placed: string[]) => {
        const recorded = await ctx.effect(
          `in:${n}`,
          { name: "kernel.input", replay: "safe", input: candidate ?? null, placed },
          async () => candidate,
        );
        n++;
        if (!recorded) throw new Error(`in:${n - 1} has no recorded input`);
        if (recorded.type === "effect_result") {
          open.delete(recorded.key);
          finished.delete(recorded.key);
        }
        apply(kernel.advance([recorded]));
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

      // Replay: rebuild the kernel from the recorded inputs.
      while (ctx.isMemoized(`in:${n}`)) await feed(undefined, []);

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

      writeFileSync(
        join(opts.host.ws, RESULT_FILE),
        JSON.stringify({ state: kernel.snapshot(), commands, events }),
      );
      ctx.live({ type: "idle" });
    },
  };
}
