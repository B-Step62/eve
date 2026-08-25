import { randomBytes } from "node:crypto";

import type { HarnessSession } from "#harness/types.js";
import type { CodeModeContinuationSecurity } from "#shared/code-mode-runtime.js";

const STATE_KEY = "eve.harness.codeModeContinuationSecurity";
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

interface StoredSecurity {
  readonly signingKey: string;
  readonly version: 1;
}

export function ensureCodeModeContinuationSecurity(session: HarnessSession): HarnessSession {
  if (session.state?.[STATE_KEY] !== undefined) {
    getCodeModeContinuationSecurity(session);
    return session;
  }
  return {
    ...session,
    state: {
      ...session.state,
      [STATE_KEY]: {
        signingKey: randomBytes(32).toString("base64url"),
        version: 1,
      } satisfies StoredSecurity,
    },
  };
}

export function getCodeModeContinuationSecurity(
  session: HarnessSession,
): CodeModeContinuationSecurity {
  const stored = session.state?.[STATE_KEY];
  if (
    typeof stored !== "object" ||
    stored === null ||
    (stored as { version?: unknown }).version !== 1 ||
    typeof (stored as { signingKey?: unknown }).signingKey !== "string"
  ) {
    throw new Error("code_mode continuation security state is missing or invalid");
  }
  return { signingKey: (stored as StoredSecurity).signingKey, maxAgeMs: MAX_AGE_MS };
}
