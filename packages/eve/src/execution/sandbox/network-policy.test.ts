import { describe, expect, it, vi } from "vitest";

import { recoverVercelUserNetworkPolicy } from "#execution/sandbox/bindings/vercel-base-runtime.js";
import {
  createSandboxNetworkPolicyControl,
  mergeSandboxNetworkCredentials,
  withSandboxNetworkCredentials,
} from "#execution/sandbox/network-policy.js";
import type { SandboxNetworkPolicy } from "#shared/sandbox-network-policy.js";

const rule = [{ transform: [{ headers: { Authorization: "Basic token" } }] }];
const credentials = { "github.com": rule };

function control(userPolicy: SandboxNetworkPolicy) {
  const applied: SandboxNetworkPolicy[] = [];
  const readUserPolicy = vi.fn(async () => userPolicy);
  const session = createSandboxNetworkPolicyControl({
    async apply(policy) {
      applied.push(policy);
    },
    readUserPolicy,
  });
  return { applied, readUserPolicy, session };
}

describe("mergeSandboxNetworkCredentials", () => {
  it("keeps allow-all open and attaches the rules", () => {
    expect(mergeSandboxNetworkCredentials("allow-all", credentials)).toEqual({
      allow: { "*": [], "github.com": rule },
    });
  });

  it("keeps the user's hosts and subnets and replaces rules on credential hosts", () => {
    expect(
      mergeSandboxNetworkCredentials(
        { allow: ["github.com", "npmjs.org"], subnets: { deny: ["10.0.0.0/8"] } },
        credentials,
      ),
    ).toEqual({
      allow: { "github.com": rule, "npmjs.org": [] },
      subnets: { deny: ["10.0.0.0/8"] },
    });
  });
});

describe("sandbox network credentials", () => {
  it.each<[string, SandboxNetworkPolicy]>([
    ["deny-all", "deny-all"],
    ["a list without the host", { allow: ["npmjs.org"] }],
    ["subnets only", { subnets: { allow: ["10.0.0.0/8"] } }],
  ])("refuses a host outside %s without writing a policy", async (_, policy) => {
    const { applied, session } = control(policy);

    await expect(withSandboxNetworkCredentials(session, credentials, vi.fn())).rejects.toThrow(
      "does not allow github.com",
    );
    expect(applied).toEqual([]);
  });

  it("allows a host matched by a wildcard entry", async () => {
    const { applied, session } = control({ allow: ["*.github.com"] });

    await withSandboxNetworkCredentials(session, { "api.github.com": rule }, async () => {});

    expect(applied).toEqual([
      { allow: { "*.github.com": [], "api.github.com": rule } },
      { allow: ["*.github.com"] },
    ]);
  });

  it("restores the user's policy when the operation fails", async () => {
    const { applied, session } = control({ allow: ["github.com"] });

    await expect(
      withSandboxNetworkCredentials(session, credentials, async () => {
        throw new Error("fetch failed");
      }),
    ).rejects.toThrow("fetch failed");
    expect(applied.at(-1)).toEqual({ allow: ["github.com"] });
  });

  it("keeps credentials across a user setNetworkPolicy and restores that policy after", async () => {
    const { applied, readUserPolicy, session } = control("allow-all");

    await withSandboxNetworkCredentials(session, credentials, async () => {
      await session.setNetworkPolicy({ allow: ["github.com"] });
    });

    expect(applied).toEqual([
      { allow: { "*": [], "github.com": rule } },
      { allow: { "github.com": rule } },
      { allow: ["github.com"] },
    ]);
    expect(readUserPolicy).toHaveBeenCalledTimes(1);
  });

  it("refuses a sandbox without a network-policy binding", async () => {
    await expect(withSandboxNetworkCredentials({}, credentials, vi.fn())).rejects.toThrow(
      "mutable network policy",
    );
  });
});

describe("recoverVercelUserNetworkPolicy", () => {
  const redacted = [{ transform: [{ headers: { Authorization: "<redacted>" } }] }];

  it("treats a missing live policy as allow-all", () => {
    expect(recoverVercelUserNetworkPolicy(undefined, undefined, ["github.com"])).toBe("allow-all");
  });

  it("drops leftover rules on the credential hosts", () => {
    expect(
      recoverVercelUserNetworkPolicy(
        { allow: { "codeload.github.com": redacted, "github.com": redacted } },
        undefined,
        ["github.com", "codeload.github.com"],
      ),
    ).toEqual({ allow: { "codeload.github.com": [], "github.com": [] } });
  });

  it("recovers redacted header rules elsewhere from the configured policy", () => {
    const configured = {
      allow: { "api.example.com": rule, "github.com": [] },
    };

    expect(
      recoverVercelUserNetworkPolicy(
        { allow: { "api.example.com": redacted, "github.com": redacted } },
        configured,
        ["github.com"],
      ),
    ).toBe(configured);
  });

  it("refuses redacted header rules it cannot recover", () => {
    expect(() =>
      recoverVercelUserNetworkPolicy(
        { allow: { "api.example.com": redacted, "github.com": [] } },
        { allow: ["api.example.com", "github.com"] },
        ["github.com"],
      ),
    ).toThrow("Vercel does not return their values");
  });
});
