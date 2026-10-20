import { contextScopeValue, withContextScopeValue } from "#context/container.js";

import type { DynamicKey, Memo, Occurrence } from "#dynamic/definition.js";
import { createLogger } from "#internal/logging.js";
import type { JsonValue } from "#shared/json.js";
import { canonicalJson, digestOf } from "./state.js";

// Memos keep observations under the keys a scope's latest evaluation used.

/** The largest key eve accepts, in UTF-8 bytes of canonical JSON. */
const KEY_CAP = 64 * 1024;
/** The largest memo result eve keeps, in UTF-8 bytes of JSON. */
const RESULT_CAP = 1024 * 1024;

const log = createLogger("reactions.memos");

const RUNNING_GLOBAL_KEY = Symbol.for("eve.reactions.memo-running");

/** A key's canonical JSON form and its digest. */
export function keyOf(key: DynamicKey, label: string, method: string): { readonly digest: string } {
  const json = toJson(key ?? null, `"${label}": ${method} key`);
  const size = Buffer.byteLength(canonicalJson(json));
  if (size > KEY_CAP) {
    throw new Error(
      `"${label}": ${method} received a ${Math.ceil(size / 1024)} KB key; a key is at most 64 KB. Key on an ID, such as a tenant or turn ID.`,
    );
  }
  return { digest: digestOf(json) };
}

/** One scope's memos for one evaluation. */
export interface MemoRun {
  readonly memo: Memo;
  /** The records this evaluation used, by key digest: what the scope keeps when it succeeds. */
  used(): Readonly<Record<string, JsonValue>>;
  /** The evaluation settled: a later call throws. */
  close(): void;
}

export function openMemos(input: {
  /** What the records belong to: a definition, or a hook's handler. */
  readonly scope: string;
  /** The file, for errors. */
  readonly label: string;
  readonly sessionId: string;
  readonly abortSignal: AbortSignal;
  /** The records the scope kept. */
  readonly kept: Readonly<Record<string, JsonValue>> | undefined;
  /**
   * Set when eve restores rather than evaluates: a key without a kept record fails with this
   * message, instead of running.
   */
  readonly restoring?: string;
  /** A deployment change discarded the scope's memos, so a missing key runs for that reason. */
  readonly afterDeployment?: boolean;
}): MemoRun {
  const token = {};
  const used: Record<string, JsonValue> = {};
  const seen = new Set<string>();
  let closed = false;
  const memo = (async (key: DynamicKey, fn: (occurrence: Occurrence) => unknown) => {
    assertCallable(input.label, "ctx.memo", closed, token);
    const { digest } = keyOf(key, input.label, "ctx.memo");
    if (seen.has(digest)) {
      throw new Error(
        `"${input.label}" called ctx.memo twice with the same key (${digest}) in one evaluation. Give each memo a distinct key, such as ["tables", ctx.session.id] and ["flags", ctx.turn?.id ?? null].`,
      );
    }
    seen.add(digest);
    const kept = input.kept?.[digest];
    if (kept !== undefined) {
      used[digest] = kept;
      return cloneJson(kept);
    }
    if (input.restoring !== undefined) {
      throw new Error(`"${input.label}": ${input.restoring} (memo key ${digest}).`);
    }
    const occurrence: Occurrence = {
      abortSignal: input.abortSignal,
      idempotencyKey: `${input.sessionId}:${input.scope}:memo:${digest}`,
    };
    const started = Date.now();
    const result = toJson(
      (await withContextScopeValue(RUNNING_GLOBAL_KEY, token, () => fn(occurrence))) ?? null,
      `"${input.label}": ctx.memo (key ${digest}) returned`,
    );
    assertResultSize(result, input.label, digest);
    // The key can hold tenant or principal IDs, so diagnostics name only its digest.
    log.debug("Ran a memo", {
      durationMs: Date.now() - started,
      file: input.label,
      key: digest,
      reason: input.afterDeployment === true ? "deployment change" : "new key",
    });
    used[digest] = result;
    return cloneJson(result);
  }) as Memo;
  return {
    close: () => {
      closed = true;
    },
    memo,
    used: () => used,
  };
}

function assertCallable(label: string, method: string, closed: boolean, token: object): void {
  if (contextScopeValue(RUNNING_GLOBAL_KEY) === token) {
    throw new Error(
      `"${label}" called ${method} inside a memo. Memos don't nest: call ${method} from the definition, and pass what the inner one needs from outside.`,
    );
  }
  if (closed) {
    throw new Error(
      `"${label}" called ${method} after its evaluation settled. Await every ${method} before the function returns.`,
    );
  }
}

function assertResultSize(result: JsonValue, label: string, digest: string): void {
  const size = Buffer.byteLength(JSON.stringify(result));
  if (size > RESULT_CAP) {
    throw new Error(
      `"${label}": ctx.memo (key ${digest}) returned ${Math.ceil(size / 1024)} KB of JSON; a memo result is at most 1 MB, and every step of the session carries it. Keep an ID, and fetch the rest where it's used.`,
    );
  }
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Checks that `value` is JSON, naming the path and type of the first part that isn't, such as
 * `Date at $.accounts[2].createdAt`. A property whose value is `undefined` is left out, as
 * `JSON.stringify` does.
 */
export function toJson(value: unknown, subject: string): JsonValue {
  const visit = (current: unknown, path: string): JsonValue => {
    if (current === null) return null;
    switch (typeof current) {
      case "string":
      case "boolean":
        return current;
      case "number":
        if (Number.isFinite(current)) return current;
        throw notJson(subject, String(current), path);
      case "object": {
        if (Array.isArray(current)) {
          return current.map((entry, index) => {
            if (entry === undefined) throw notJson(subject, "undefined", `${path}[${index}]`);
            return visit(entry, `${path}[${index}]`);
          });
        }
        const prototype = Object.getPrototypeOf(current) as unknown;
        if (prototype !== Object.prototype && prototype !== null) {
          throw notJson(subject, (current as object).constructor?.name ?? "object", path);
        }
        const record: Record<string, JsonValue> = {};
        for (const [key, entry] of Object.entries(current)) {
          if (entry === undefined) continue;
          const at = /^[A-Za-z_$][\w$]*$/.test(key)
            ? `${path}.${key}`
            : `${path}[${JSON.stringify(key)}]`;
          record[key] = visit(entry, at);
        }
        return record;
      }
      default:
        throw notJson(subject, typeof current, path);
    }
  };
  return visit(value, "$");
}

function notJson(subject: string, type: string, path: string): Error {
  return new Error(
    `${subject} ${type} at ${path}. Memo keys and results must be JSON: return plain data, and build tools, clients, or dates from it outside the memo.`,
  );
}
