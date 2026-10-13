import { afterEach, describe, expect, it, vi } from "vitest";
import { shutdownActiveSandboxHandles } from "#execution/sandbox/active-handles.js";
import { ContextContainer, contextStorage, loadContext } from "#context/container.js";
import { AuthKey, SandboxKey, SessionIdKey, SessionKey } from "#context/keys.js";
import { runStep } from "#context/run-step.js";
import { deserializeContext, serializeContext } from "#context/serialize.js";
import { withParkedStep } from "#internal/testing/session-machine.js";
import { defineState } from "#public/definitions/state.js";
import { BundleKey, type CompiledBundle } from "#runtime/sessions/runtime-context-keys.js";
import type { HarnessSession } from "#harness/types.js";
import { readDurableSession } from "#execution/durable-session-store.js";
import { importConversation, readLegacySnapshot } from "#execution/legacy-session/snapshot.js";
import { ensureSandboxAccess } from "#execution/sandbox/ensure.js";
import { mockSandbox } from "#internal/testing/mocks/mock-sandbox.js";
import { defineParentSandbox, defineSandbox } from "#public/definitions/sandbox.js";
import { defineSandboxProvider } from "#shared/sandbox-provider.js";
import { createBundledRuntimeCompiledArtifactsSource } from "#runtime/compiled-artifacts-source.js";
import type { RuntimeSandboxRegistry } from "#runtime/sandbox/registry.js";
import { loadSandboxPreparedArtifact } from "#runtime/sandbox/prepared-artifacts.js";

vi.mock("#runtime/sandbox/prepared-artifacts.js", () => ({
  loadSandboxPreparedArtifact: vi.fn(async () => null),
}));

function fixture(setup?: () => void, returnCopy = false, onSessionEnd?: () => Promise<void>) {
  const deleteSandbox = vi.fn(async () => {});
  const stopSandbox = vi.fn(async () => {});
  const shutdownSandbox = vi.fn(async () => {});
  const create = vi.fn(async () => {
    const sandbox = mockSandbox();
    return {
      sandbox: sandbox.session,
      onSandboxDelete: deleteSandbox,
      onRuntimeShutdown: shutdownSandbox,
      onSandboxStop: stopSandbox,
    };
  });
  const start = vi.fn(async () => ({ handle: await create(), state: null }));
  const provider = defineSandboxProvider({
    name: "test",
    environment: () => {
      const implementation = {
        prepare: async () => null,
        resume: create,
        start,
      };
      return onSessionEnd === undefined
        ? implementation
        : Object.assign(implementation, { onSessionEnd });
    },
  });
  const environment = provider.environment();
  const selector = defineSandbox(async () => {
    const sandbox = await environment.open();
    setup?.();
    return returnCopy ? { ...sandbox } : sandbox;
  });
  const registry: RuntimeSandboxRegistry = {
    sandbox: {
      definition: {
        environment,
        kind: "independent",
        logicalPath: "sandbox.ts",
        selector,
        revisionHash: "hash",
        sourceId: "sandbox",
        sourceKind: "module",
      },
      workspaceResourceRoot: { logicalPath: "", rootEntries: [] },
    },
  };
  return {
    create,
    deleteSandbox,
    onSessionEnd,
    registry,
    shutdownSandbox,
    start,
    stopSandbox,
  };
}
async function open(
  registry: RuntimeSandboxRegistry,
  id = "session-1",
  state: Parameters<typeof ensureSandboxAccess>[0]["state"] = null,
  nodeId = "__root__",
) {
  const context = new ContextContainer();
  context.set(SessionKey, {
    auth: { current: null, initiator: null },
    sessionId: id,
    turn: { id: "turn", sequence: 0 },
  });
  return await contextStorage.run(context, async () => {
    const access = await ensureSandboxAccess({
      compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      nodeId,
      registry,
      sessionId: id,
      state,
    });
    return { access, sandbox: await access.get() };
  });
}
function inheritingChildRegistry(rootRegistry: RuntimeSandboxRegistry): RuntimeSandboxRegistry {
  const parent = rootRegistry.sandbox;
  if (parent === null) throw new Error("Root registry has no sandbox.");
  return {
    sandbox: {
      definition: {
        kind: "parent",
        logicalPath: "sandbox.ts",
        selector: defineParentSandbox(),
        revisionHash: "child-hash",
        sourceId: "child-sandbox",
        sourceKind: "module",
      },
      inheritance: {
        definition: parent.definition,
        nodeId: "__root__",
        workspaceResourceRoot: parent.workspaceResourceRoot,
      },
      workspaceResourceRoot: { logicalPath: "", rootEntries: [] },
    },
  };
}
afterEach(() => shutdownActiveSandboxHandles());

describe("ensureSandboxAccess", () => {
  it("does not prepare or start anything until the sandbox is requested", async () => {
    const value = fixture();
    await ensureSandboxAccess({
      compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      nodeId: "__root__",
      registry: value.registry,
      sessionId: "unused",
      state: null,
    });
    expect(value.create).not.toHaveBeenCalled();
  });

  it("keeps missing production artifacts fatal without starting a sandbox", async () => {
    vi.mocked(loadSandboxPreparedArtifact).mockResolvedValueOnce(undefined);
    const value = fixture();
    await expect(open(value.registry)).rejects.toThrow();
    expect(value.create).not.toHaveBeenCalled();
  });

  it("creates and returns a real sandbox", async () => {
    const value = fixture();
    expect((await open(value.registry)).sandbox).toBeTruthy();
    expect(value.create).toHaveBeenCalledOnce();
  });
  it("resumes persisted provider state without invoking the selector", async () => {
    const setup = vi.fn();
    const value = fixture(setup);
    await open(value.registry, "session-1", {
      session: { providerName: "test", state: null, stateProtocolVersion: 1 },
    });
    expect(setup).not.toHaveBeenCalled();
    expect(value.create).toHaveBeenCalledOnce();
  });

  it("starts a fresh sandbox for a session imported from eve 0.54", async () => {
    const setup = vi.fn();
    const value = fixture(setup);
    const imported = importConversation(
      readLegacySnapshot({
        sessionId: "session-1",
        snapshot: {
          version: 1,
          session: {
            sessionId: "session-1",
            continuationToken: "http:legacy",
            history: [],
            agent: { system: "" },
            // eve 0.54 persisted a backend reconnect record, not provider state.
            sandboxState: {
              initialized: true,
              session: {
                backendName: "test",
                metadata: { sandboxId: "sbx_old" },
                sessionKey: "old",
              },
            },
          },
        },
      }),
    );

    await open(
      value.registry,
      "session-1",
      readDurableSession(imported.sessionState).sandboxState ?? null,
    );

    expect(setup).toHaveBeenCalledOnce();
    expect(value.start).toHaveBeenCalledOnce();
  });

  it("passes empty live options when a child inherits its parent sandbox", async () => {
    const value = fixture();

    await open(inheritingChildRegistry(value.registry));

    expect(value.create).toHaveBeenCalledOnce();
  });

  it("rejects a fabricated sandbox", async () => {
    const value = fixture(undefined, true);
    await expect(open(value.registry)).rejects.toThrow("must return the sandbox it opens");
  });

  it("shares one selector invocation across concurrent first access", async () => {
    const value = fixture();
    const context = new ContextContainer();
    context.set(SessionKey, {
      auth: { current: null, initiator: null },
      sessionId: "session-1",
      turn: { id: "turn", sequence: 0 },
    });
    await contextStorage.run(context, async () => {
      const access = await ensureSandboxAccess({
        compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
        nodeId: "__root__",
        registry: value.registry,
        sessionId: "session-1",
        state: null,
      });
      const [first, second] = await Promise.all([access.get(), access.get()]);
      expect(second).toBe(first);
    });
    expect(value.create).toHaveBeenCalledOnce();
  });

  it("starts one sandbox when separate accesses to a shared session open concurrently", async () => {
    const value = fixture();
    const [owner, subagent] = await Promise.all([open(value.registry), open(value.registry)]);
    expect(value.start).toHaveBeenCalledOnce();
    expect(value.create).toHaveBeenCalledTimes(2);
    expect(await subagent.access.captureState()).toEqual(await owner.access.captureState());
  });

  it("shares the parent's start with a subagent that inherits its sandbox", async () => {
    const value = fixture();
    const [owner, subagent] = await Promise.all([
      open(value.registry),
      open(inheritingChildRegistry(value.registry), "session-1", null, "child"),
    ]);
    expect(value.start).toHaveBeenCalledOnce();
    expect(value.create).toHaveBeenCalledTimes(2);
    expect(await subagent.access.captureState()).toEqual(await owner.access.captureState());
  });

  it("lets only one waiter retry after a shared start fails", async () => {
    const value = fixture();
    value.start.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      throw new Error("start failed");
    });
    const results = await Promise.allSettled([
      open(value.registry),
      open(value.registry),
      open(value.registry),
    ]);
    expect(results.map(({ status }) => status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
    expect(value.start).toHaveBeenCalledTimes(2);
  });

  it("retries session setup after a selector failure", async () => {
    let attempts = 0;
    const value = fixture(() => {
      attempts += 1;
      if (attempts === 1) throw new Error("setup failed");
    });
    const context = new ContextContainer();
    context.set(SessionKey, {
      auth: { current: null, initiator: null },
      sessionId: "session-1",
      turn: { id: "turn", sequence: 0 },
    });
    await contextStorage.run(context, async () => {
      const access = await ensureSandboxAccess({
        compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
        nodeId: "__root__",
        registry: value.registry,
        sessionId: "session-1",
        state: null,
      });
      await expect(access.get()).rejects.toThrow("setup failed");
      await shutdownActiveSandboxHandles();
      expect(value.shutdownSandbox).not.toHaveBeenCalled();
      await expect(access.get()).resolves.toBeTruthy();
    });
    expect(attempts).toBe(2);
  });

  it("tracks dedicated handles for server shutdown", async () => {
    const value = fixture();
    await open(value.registry);
    await shutdownActiveSandboxHandles();
    expect(value.shutdownSandbox).toHaveBeenCalledOnce();
  });

  it("deletes a dedicated sandbox and creates a fresh handle on next access", async () => {
    const value = fixture();
    const { access } = await open(value.registry);
    await access.delete?.();
    await access.get();
    expect(value.deleteSandbox).toHaveBeenCalledOnce();
    expect(value.create).toHaveBeenCalledTimes(2);
  });

  it("passes terminal cleanup to the provider from durable state", async () => {
    const onSessionEnd = vi.fn(async () => {});
    const value = fixture(undefined, false, onSessionEnd);
    const { access } = await open(value.registry);

    await access.end?.("expired");

    expect(onSessionEnd).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ session: expect.objectContaining({ id: "session-1" }) }),
      null,
      null,
      { reason: "expired" },
    );
    expect(value.deleteSandbox).not.toHaveBeenCalled();
    await expect(access.captureState()).resolves.toEqual({ session: null });
  });

  it("falls back to resumed handle deletion when the provider has no terminal hook", async () => {
    const value = fixture();
    const { access } = await open(value.registry);

    await access.end?.("completed");

    expect(value.deleteSandbox).toHaveBeenCalledOnce();
    await expect(access.captureState()).resolves.toEqual({ session: null });
  });

  it("does not start a sandbox just to end a session that never opened one", async () => {
    const value = fixture();
    const access = await ensureSandboxAccess({
      compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      nodeId: "__root__",
      registry: value.registry,
      sessionId: "unused",
      state: null,
    });

    await access.end?.("expired");

    expect(value.start).not.toHaveBeenCalled();
    expect(value.create).not.toHaveBeenCalled();
  });

  it("does not end a sandbox borrowed from another session", async () => {
    const onSessionEnd = vi.fn(async () => {});
    const value = fixture(undefined, false, onSessionEnd);
    const access = await ensureSandboxAccess({
      compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
      nodeId: "__root__",
      ownsSandbox: false,
      registry: value.registry,
      sessionId: "child",
      state: {
        session: { providerName: "test", state: null, stateProtocolVersion: 1 },
      },
    });

    await access.end?.("completed");

    expect(onSessionEnd).not.toHaveBeenCalled();
    expect(value.create).not.toHaveBeenCalled();
  });
});

describe("inheriting child dispatch", () => {
  it.each(["agent", "worker"])(
    "initializes the owner's selector before %s receives its sandbox snapshot",
    async (toolName) => {
      const creator = defineState(`sandbox-creator-${toolName}`, () => "");
      const auth = {
        attributes: {},
        authenticator: "test",
        principalId: "delegating-user",
        principalType: "user",
      };
      const setup = vi.fn(() => {
        const session = loadContext().require(SessionKey);
        expect(session.sessionId).toBe("root-owner");
        expect(session.auth.current).toEqual(auth);
        creator.update(() => session.auth.current?.principalId ?? "");
      });
      const value = fixture(setup);
      const childRegistry = inheritingChildRegistry(value.registry);
      const bundle = {
        compiledArtifactsSource: createBundledRuntimeCompiledArtifactsSource(),
        graph: {
          root: { nodeId: "__root__", sandboxRegistry: value.registry },
          nodesByNodeId: new Map([["worker", { sandboxRegistry: childRegistry }]]),
        },
        subagentRegistry: {
          subagentsByName: new Map([["worker", { definition: { nodeId: "worker" } }]]),
        },
      } as unknown as CompiledBundle;
      const ctx = new ContextContainer();
      ctx.set(BundleKey, bundle);
      ctx.set(AuthKey, auth);
      ctx.set(SessionIdKey, "root-owner");
      const session: HarnessSession = {
        agent: { modelReference: { id: "test" }, system: "", tools: [] },
        compaction: { recentWindowSize: 10, threshold: 100_000 },
        continuationToken: "root-token",
        history: [],
        sessionId: "root-owner",
      };
      const result = await runStep(ctx, session, async (parent) => ({
        next: null,
        session: withParkedStep(parent, {
          tasks: ["first", "second"].map((callId) => ({
            callId,
            entry: { entryPoint: "serve", taskId: callId },
            input: { message: "work" },
            kind: "workflow-task",
            toolName,
            workflowId: "agent-workflow",
          })),
        }),
      }));
      expect(setup).toHaveBeenCalledOnce();
      expect(value.start).toHaveBeenCalledOnce();
      expect(result.session.sandboxState?.session?.providerName).toBe("test");
      await contextStorage.run(ctx, async () => expect(creator.get()).toBe(auth.principalId));

      // The child consumes the same persisted snapshot that buildSubagentRunInput forwards.
      await Promise.all([
        open(childRegistry, "root-owner", result.session.sandboxState, "worker"),
        open(childRegistry, "root-owner", result.session.sandboxState, "worker"),
      ]);
      expect(setup).toHaveBeenCalledOnce();
      expect(value.start).toHaveBeenCalledOnce();

      // Rehydrate durable authored state without invoking the fixture's bundle loader.
      const serialized = serializeContext(ctx);
      delete serialized[BundleKey.name];
      const resumed = await deserializeContext(serialized);
      resumed.set(BundleKey, bundle);
      await runStep(resumed, result.session, async (parent) => {
        expect(creator.get()).toBe(auth.principalId);
        await loadContext().require(SandboxKey).get();
        return { next: null, session: parent };
      });
      expect(setup).toHaveBeenCalledOnce();
      expect(value.start).toHaveBeenCalledOnce();
    },
  );
});
