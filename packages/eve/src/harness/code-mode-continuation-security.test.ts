import { describe, expect, it } from "vitest";

import {
  ensureCodeModeContinuationSecurity,
  getCodeModeContinuationSecurity,
} from "#harness/code-mode-continuation-security.js";
import type { HarnessSession } from "#harness/types.js";

describe("code mode continuation security", () => {
  it("creates and reuses one session signing key", () => {
    const session = { state: {} } as HarnessSession;
    const secured = ensureCodeModeContinuationSecurity(session);
    const first = getCodeModeContinuationSecurity(secured);
    const repeated = ensureCodeModeContinuationSecurity(secured);

    expect(first.signingKey).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(getCodeModeContinuationSecurity(repeated)).toEqual(first);
  });
});
