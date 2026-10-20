// One set of expectations for every host. A host adapter runs a scenario
// (crashing and recovering when the scenario says so) and returns what the
// kernel ended with; these checks read that and the workspace trace.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect } from "vitest";

import type { Command, KernelEvent, KernelState, Message } from "../src/contract.ts";
import type { ScenarioName } from "../src/scenario.ts";

export interface RunResult {
  ws: string;
  state: KernelState;
  commands: Command[];
  events: KernelEvent[];
}

export interface HostTraits {
  /** The host obeys `replay: never` after a crash (fx, libfx, durable-harness), or runs the effect again (Workflow, eve). */
  replayNever: boolean;
  /** The host runs read-only calls at the same time. */
  parallelReads: boolean;
}

type Trace = { kind: string; id?: string; name?: string; index?: number }[];

function trace(ws: string): Trace {
  return readFileSync(join(ws, ".trace.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Trace[number]);
}

function file(ws: string, path: string): string | undefined {
  const p = join(ws, path);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
}

function lastAssistant(history: Message[]): string | undefined {
  const m = history.findLast((m) => m.role === "assistant");
  return m?.role === "assistant" ? m.text : undefined;
}

function turnEnd(events: KernelEvent[]): unknown {
  return events.findLast((e) => e.type === "turn_ended")?.reason;
}

/** The model never sees a tool call without its result. */
function expectPaired(history: Message[]): void {
  const calls = history.flatMap((m) =>
    m.role === "assistant" ? m.tool_calls.map((c) => c.id) : [],
  );
  const results = history.flatMap((m) => (m.role === "tool" ? [m.call_id] : []));
  expect(results.toSorted()).toEqual(calls.toSorted());
}

export function check(name: ScenarioName, r: RunResult, traits: HostTraits): void {
  const t = trace(r.ws);
  const h = r.state.history;
  expect(r.state.turn).toBeNull();
  expectPaired(h);
  const at = (kind: string, id: string) => t.findIndex((l) => l.kind === kind && l.id === id);

  switch (name) {
    case "plain": {
      expect(turnEnd(r.events)).toBe("completed");
      expect(lastAssistant(h)).toBe("Done.");
      expect(file(r.ws, "out.txt")).toBe("alpha+beta\n");
      // eve's rule: all calls of a response run together, with no write fence.
      if (traits.parallelReads) {
        // Both reads start before either ends.
        expect(at("tool_start", "r2")).toBeLessThan(at("tool_end", "r1"));
      }
      // Tool results reach the model in call order.
      expect(
        h.filter((m) => m.role === "tool").map((m) => (m.role === "tool" ? m.call_id : "")),
      ).toEqual(["r1", "r2", "w1"]);
      break;
    }
    case "crash_in_write": {
      expect(turnEnd(r.events)).toBe("completed");
      const result = h.find((m) => m.role === "tool");
      if (traits.replayNever) {
        // R2: the write ran once, and the model was told it may have run.
        expect(file(r.ws, "report.txt")).toBe("report\n");
        expect(t.filter((l) => l.kind === "side_effect")).toHaveLength(1);
        expect(result?.role === "tool" && result.content).toContain(
          "may or may not have taken effect",
        );
      } else {
        // A Workflow host runs the interrupted step again, so the side effect happens twice.
        expect(file(r.ws, "report.txt")).toBe("report\nreport\n");
        expect(t.filter((l) => l.kind === "side_effect")).toHaveLength(2);
        expect(result?.role === "tool" && result.content).toBe("ok");
      }
      expect(lastAssistant(h)).toBe("The write may not have finished, so I did not retry it.");
      break;
    }
    case "crash_in_model": {
      expect(turnEnd(r.events)).toBe("completed");
      // The crashed model call ran again; the saved one was not requested again.
      const calls = (i: number) => t.filter((l) => l.kind === "model_call" && l.index === i).length;
      expect(calls(0)).toBe(1);
      expect(calls(1)).toBe(2);
      expect(t.filter((l) => l.kind === "tool_start")).toHaveLength(1);
      expect(lastAssistant(h)).toBe("It says alpha.");
      break;
    }
    case "steer": {
      expect(turnEnd(r.events)).toBe("completed");
      expect(r.commands).toContainEqual({ type: "cancel", key: "t1.s0.a0.model" });
      const steer = h.findIndex((m) => m.role === "steering");
      expect(steer).toBeGreaterThan(0);
      const partial = h[steer - 1];
      expect(partial?.role === "assistant" && partial.partial).toBe(true);
      const text = partial?.role === "assistant" ? partial.text : "";
      expect(text.length).toBeGreaterThan(0);
      expect("I will look at a.txt and then summarize it for you.".startsWith(text)).toBe(true);
      expect(text.length).toBeLessThan(
        "I will look at a.txt and then summarize it for you.".length,
      );
      expect(lastAssistant(h)).toBe("OK, looking at b.txt instead.");
      break;
    }
    case "cancel": {
      expect(turnEnd(r.events)).toBe("cancelled");
      expect(r.commands).toContainEqual({ type: "cancel", key: "t1.tool.r1" });
      const result = h.find((m) => m.role === "tool");
      expect(result?.role === "tool" && result.content).toBe("Cancelled by the user.");
      expect(t.some((l) => l.kind === "tool_end")).toBe(false);
      break;
    }
  }
}
