import type * as Vercel from "#compiled/@vercel/sandbox/index.js";
import type {
  SandboxNetworkCredentials,
  SandboxNetworkPolicy,
} from "#shared/sandbox-network-policy.js";

type NetworkPolicyRule = Vercel.NetworkPolicyRule;

/** How a provider applies and recovers network policy for one session handle. */
export interface SandboxNetworkPolicyBinding {
  /**
   * Puts `policy` in force. `userPolicy` is the part the user owns, for
   * providers that persist it across resumes.
   */
  apply(policy: SandboxNetworkPolicy, userPolicy: SandboxNetworkPolicy): Promise<void>;
  /**
   * Returns the user's policy when this handle has not seen one yet. Rules on
   * `credentialHosts` may be eve's own leftovers and are about to be replaced.
   */
  readUserPolicy(credentialHosts: readonly string[]): Promise<SandboxNetworkPolicy>;
}

/** eve-internal credential surface on a session; deliberately not exported publicly. */
interface SandboxNetworkCredentialControl {
  add(credentials: SandboxNetworkCredentials): Promise<void>;
  remove(hosts: readonly string[]): Promise<void>;
}

const networkCredentialControl = Symbol("eve.sandbox.networkCredentials");

export interface SandboxNetworkPolicyControl {
  readonly [networkCredentialControl]: SandboxNetworkCredentialControl;
  setNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void>;
}

/**
 * Owns a session's network policy: the user's policy is the limit, and eve's
 * credential rules are merged onto hosts it already allows. Every write
 * applies the merge, so a user `setNetworkPolicy` keeps eve's credentials and
 * removing a credential restores exactly the user's policy.
 */
export function createSandboxNetworkPolicyControl(
  binding: SandboxNetworkPolicyBinding,
): SandboxNetworkPolicyControl {
  let userPolicy: SandboxNetworkPolicy | undefined;
  const credentials = new Map<string, readonly NetworkPolicyRule[]>();
  let queue: Promise<unknown> = Promise.resolve();

  function serialized(operation: () => Promise<void>): Promise<void> {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  }

  async function applyMerged(user: SandboxNetworkPolicy): Promise<void> {
    await binding.apply(
      mergeSandboxNetworkCredentials(user, Object.fromEntries(credentials)),
      user,
    );
  }

  return {
    [networkCredentialControl]: {
      add: (added) =>
        serialized(async () => {
          const hosts = Object.keys(added);
          const user = userPolicy ?? (await binding.readUserPolicy(hosts));
          const blocked = hosts.filter((host) => !allowsHost(user, host));
          if (blocked.length > 0) {
            throw new Error(
              `The sandbox network policy does not allow ${blocked.join(", ")}, so eve cannot attach credentials there. Allow ${blocked.length === 1 ? "this host" : "these hosts"} in the sandbox networkPolicy.`,
            );
          }
          userPolicy = user;
          for (const [host, rules] of Object.entries(added)) credentials.set(host, rules);
          try {
            await applyMerged(user);
          } catch (error) {
            for (const host of hosts) credentials.delete(host);
            throw error;
          }
        }),
      remove: (hosts) =>
        serialized(async () => {
          const removed = hosts.filter((host) => credentials.delete(host));
          if (removed.length === 0 || userPolicy === undefined) return;
          await applyMerged(userPolicy);
        }),
    },
    setNetworkPolicy: (policy) =>
      serialized(async () => {
        userPolicy = policy;
        await applyMerged(policy);
      }),
  };
}

/**
 * Attaches `credentials` for the length of `operation`, then removes them.
 * Throws when the session cannot broker credentials or its policy does not
 * allow every host.
 */
export async function withSandboxNetworkCredentials<T>(
  sandbox: object,
  credentials: SandboxNetworkCredentials,
  operation: () => Promise<T>,
): Promise<T> {
  const control = getSandboxNetworkCredentialControl(sandbox);
  const hosts = Object.keys(credentials);
  await control.add(credentials);
  let outcome:
    | { readonly ok: true; readonly value: T }
    | { readonly error: unknown; readonly ok: false };
  try {
    outcome = { ok: true, value: await operation() };
  } catch (error) {
    outcome = { error, ok: false };
  }
  try {
    await control.remove(hosts);
  } catch (removalError) {
    throw new Error(
      `Could not remove brokered credentials for ${hosts.join(", ")} from the sandbox.`,
      {
        cause: outcome.ok ? removalError : new AggregateError([outcome.error, removalError]),
      },
    );
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

export function getSandboxNetworkCredentialControl(
  sandbox: object,
): SandboxNetworkCredentialControl {
  const control = (sandbox as Partial<SandboxNetworkPolicyControl>)[networkCredentialControl];
  if (control === undefined) {
    throw new Error(
      "Brokered credentials require a sandbox provider with mutable network policy (Vercel or microsandbox).",
    );
  }
  return control;
}

export function mergeSandboxNetworkCredentials(
  user: SandboxNetworkPolicy,
  credentials: SandboxNetworkCredentials,
): SandboxNetworkPolicy {
  if (Object.keys(credentials).length === 0) return user;
  if (user === "deny-all") throw new Error("A deny-all network policy cannot carry credentials.");
  const mutable = Object.fromEntries(
    Object.entries(credentials).map(([host, rules]) => [host, [...rules]]),
  );
  if (user === "allow-all") return { allow: { "*": [], ...mutable } };
  return { ...user, allow: { ...allowRecord(user.allow), ...mutable } };
}

function allowRecord(
  allow: Exclude<SandboxNetworkPolicy, string>["allow"],
): Record<string, NetworkPolicyRule[]> {
  if (allow === undefined) return {};
  if (Array.isArray(allow)) return Object.fromEntries(allow.map((host) => [host, []]));
  return { ...allow };
}

function allowsHost(policy: SandboxNetworkPolicy, host: string): boolean {
  if (policy === "allow-all") return true;
  if (policy === "deny-all") return false;
  return Object.keys(allowRecord(policy.allow)).some(
    (entry) =>
      entry === "*" || entry === host || (entry.startsWith("*.") && host.endsWith(entry.slice(1))),
  );
}
