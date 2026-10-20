import type { UserContent } from "ai";

import type { ChannelAdapter } from "#channel/adapter.js";
import {
  type ChannelCreateResult,
  type ChannelReceiveContext,
  type ChannelSendOptions,
  createChannelOperations,
} from "#channel/channel-operations.js";
import {
  isCompiledChannel,
  type ChannelReference,
  type CompiledChannel,
} from "#channel/compiled-channel.js";
import type { InferReceiveTarget } from "#channel/receive-target.js";
import type { Session } from "#channel/session.js";
import type { Runtime, SessionAuthContext, TurnPolicy } from "#channel/types.js";
import type { ResolvedChannelDefinition } from "#runtime/types.js";
import type { SessionHistoryMessage } from "#shared/session-history.js";

/**
 * Options for sending a message to a channel selected with `ctx.to(...)`.
 */
export interface CrossChannelSendOptions {
  readonly auth: SessionAuthContext | null;
  /** Prior conversation added before the message, as on `send()`. */
  readonly history?: readonly SessionHistoryMessage[];
  readonly turnPolicy?: TurnPolicy;
}

/** Options for creating a session at a channel selected with `ctx.to(...)`. */
export interface CrossChannelCreateOptions {
  readonly auth: SessionAuthContext | null;
  /** Prior conversation the session starts with. */
  readonly history?: readonly SessionHistoryMessage[];
  /** First message, which runs the first turn only when this call starts the session. */
  readonly message?: string | UserContent;
}

/** Delivery bound to one channel-specific proactive target. */
export interface CrossChannelTargetHandle {
  /** Starts a session at the target, or continues the one that owns it. */
  send(message: string | UserContent, options: CrossChannelSendOptions): Promise<Session>;
  /**
   * Starts a session at the target only when no session owns it. Otherwise
   * returns the owner with `created: false` and delivers nothing.
   */
  create(options: CrossChannelCreateOptions): Promise<ChannelCreateResult>;
}

/** Selects another authored channel and one of its proactive targets. */
export type CrossChannelToFn = <TChannel extends ChannelReference<unknown>>(
  channel: TChannel,
  target: InferReceiveTarget<TChannel>,
) => CrossChannelTargetHandle;

/**
 * Channel record consumed by the receiver — keeps the public-facing
 * `definition` reference so callers can identify a target by value
 * (the same module-default they imported in their route file).
 */
export interface CrossChannelTarget {
  readonly name: string;
  readonly definition: CompiledChannel;
  readonly receive?: CompiledChannel["receive"];
  readonly adapter?: ChannelAdapter;
  readonly turnPolicy?: CompiledChannel["turnPolicy"];
}

/**
 * Projects an agent's resolved channels into the receiver-input shape.
 *
 * Framework-internal fetch-only channels carry no `definition` reference
 * and are filtered out at this boundary — only authored channels backed
 * by a `defineChannel` value can be receive targets.
 */
export function toCrossChannelTargets(
  channels: readonly ResolvedChannelDefinition[],
): readonly CrossChannelTarget[] {
  return channels.flatMap((channel) =>
    channel.definition === undefined
      ? []
      : [
          {
            name: channel.name,
            definition: channel.definition,
            receive: channel.receive,
            adapter: channel.adapter,
            turnPolicy: channel.turnPolicy,
          },
        ],
  );
}

/**
 * Builds the `ctx.to(channel, target)` closure used by route and schedule handlers.
 */
export function createCrossChannelToFn(
  runtime: Runtime,
  channels: readonly CrossChannelTarget[],
): CrossChannelToFn {
  return (channel, target) =>
    createCrossChannelTargetHandle(runtime, resolveTargetByReference(channel, channels), target);
}

/**
 * Builds a `to()` handle for a channel found by its path-derived name, as
 * workflow tool bodies address channels.
 */
export function createNamedCrossChannelTargetHandle(
  runtime: Runtime,
  channels: readonly CrossChannelTarget[],
  name: string,
  target: Readonly<Record<string, unknown>>,
): CrossChannelTargetHandle {
  const channel = channels.find((candidate) => candidate.name === name);
  if (channel === undefined) {
    const available = channels.map((candidate) => `"${candidate.name}"`).join(", ");
    throw new Error(
      `ctx.to(): no channel named "${name}". Pass the path-derived name of a file in agent/channels/` +
        (available === "" ? "; this agent has no channels." : `: ${available}.`),
    );
  }
  return createCrossChannelTargetHandle(runtime, channel, target);
}

function createCrossChannelTargetHandle(
  runtime: Runtime,
  channel: CrossChannelTarget,
  target: unknown,
): CrossChannelTargetHandle {
  const receiveTarget = target as Readonly<Record<string, unknown>>;
  return {
    async send(message, options) {
      return await invokeChannelReceive({
        runtime,
        target: channel,
        input: { auth: options.auth, history: options.history, message, target: receiveTarget },
        turnPolicy: options.turnPolicy,
      });
    },
    async create(options) {
      let result: ChannelCreateResult | undefined;
      const session = await invokeChannelReceive({
        runtime,
        target: channel,
        input: {
          auth: options.auth,
          history: options.history,
          message: options.message ?? "",
          target: receiveTarget,
        },
        create: {
          message: options.message,
          onCreate: (created) => {
            result = created;
          },
        },
      });
      if (result === undefined) {
        throw new Error(
          `ctx.to().create(): channel "${channel.name}" receive() returned a session without delivering through from().send(), so eve cannot tell whether it created one.`,
        );
      }
      return { created: result.created, session };
    },
  };
}

interface InvokeChannelReceiveInput {
  readonly runtime: Runtime;
  readonly target: Pick<CrossChannelTarget, "name" | "receive" | "adapter" | "turnPolicy">;
  readonly input: {
    readonly auth: SessionAuthContext | null;
    readonly history?: readonly SessionHistoryMessage[];
    readonly message: string | UserContent;
    readonly target: Readonly<Record<string, unknown>>;
  };
  readonly turnPolicy?: TurnPolicy;
  /** Present for `create()`: the channel's `send()` becomes a create at the same address. */
  readonly create?: {
    readonly message: string | UserContent | undefined;
    readonly onCreate: (result: ChannelCreateResult) => void;
  };
}

/**
 * Shared authored `receive(input, ctx)` invocation used by route, schedule,
 * and workflow tool delivery.
 */
async function invokeChannelReceive(args: InvokeChannelReceiveInput): Promise<Session> {
  const { name } = args.target;
  if (!args.target.receive) {
    throw new Error(
      `ctx.to(): channel "${name}" does not implement receive(). ` +
        `Declare a receive hook on the channel to accept cross-channel sessions.`,
    );
  }
  if (!args.target.adapter) {
    throw new Error(`ctx.to(): channel "${name}" has no adapter — cannot build ctx.from().`);
  }
  const channelOperations = createChannelOperations({
    adapter: args.target.adapter,
    channelName: name,
    runtime: args.runtime,
    turnPolicy: args.turnPolicy ?? args.target.turnPolicy,
  });
  return await args.target.receive(
    args.input,
    withHandoffDelivery(channelOperations, name, args.input.history, args.create),
  );
}

/**
 * The channel's `receive()` decides the address and state; the handoff decides the verb.
 * Its `history` joins the channel's `send()` unless the channel passed its own.
 */
function withHandoffDelivery(
  operations: ChannelReceiveContext,
  channelName: string,
  history: readonly SessionHistoryMessage[] | undefined,
  create: InvokeChannelReceiveInput["create"],
): ChannelReceiveContext {
  return {
    ...operations,
    from(address) {
      const source = operations.from(address);
      return {
        ...source,
        async send(message, options) {
          const withHistory = { ...options, history: options.history ?? history };
          if (create === undefined) return await source.send(message, withHistory);
          const result = await source.create(toCreateOptions(withHistory, channelName, create));
          create.onCreate(result);
          return result.session;
        },
      };
    },
  };
}

function toCreateOptions(
  options: ChannelSendOptions,
  channelName: string,
  create: NonNullable<InvokeChannelReceiveInput["create"]>,
) {
  const { callback, context, outputSchema, turnPolicy, ...createOptions } =
    options as ChannelSendOptions & { readonly state?: unknown };
  const unsupported = Object.entries({ callback, context, outputSchema, turnPolicy })
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  if (unsupported.length > 0) {
    throw new Error(
      `ctx.to().create(): channel "${channelName}" receive() passed ${unsupported.join(", ")} to from().send(), which create() does not support.`,
    );
  }
  return { ...createOptions, message: create.message } as Parameters<
    ReturnType<ChannelReceiveContext["from"]>["create"]
  >[0];
}

function resolveTargetByReference(
  ref: unknown,
  channels: readonly CrossChannelTarget[],
): CrossChannelTarget {
  for (const channel of channels) {
    if (channel.definition === ref) {
      return channel;
    }
  }
  const structurallyMatchedTarget = resolveTargetByRouteFingerprint(ref, channels);
  if (structurallyMatchedTarget !== null) {
    return structurallyMatchedTarget;
  }
  throw new Error(
    "ctx.to(): the channel passed as the first argument is not registered " +
      "in this agent's channels/. Import the channel module's default export from " +
      "agent/channels/<name>.ts and pass that value.",
  );
}

function resolveTargetByRouteFingerprint(
  ref: unknown,
  channels: readonly CrossChannelTarget[],
): CrossChannelTarget | null {
  if (!isCompiledChannel(ref)) {
    return null;
  }

  const refFingerprint = createRouteFingerprint(ref);
  if (refFingerprint === null) {
    return null;
  }

  const matches = new Map<string, CrossChannelTarget>();

  for (const channel of channels) {
    if (createRouteFingerprint(channel.definition) !== refFingerprint) {
      continue;
    }
    matches.set(channel.name, channel);
  }

  if (matches.size === 1) {
    return [...matches.values()][0]!;
  }
  if (matches.size > 1) {
    throw new Error(
      "ctx.to(): the channel passed as the first argument matches multiple " +
        "registered channels by route shape. Import a channel with a unique route set " +
        "from agent/channels/<name>.ts before passing it to ctx.to().",
    );
  }

  return null;
}

function createRouteFingerprint(channel: CompiledChannel): string | null {
  if (channel.routes.length === 0) {
    return null;
  }

  const routes = channel.routes
    .map((route) => `${route.method.toUpperCase()} ${route.path}`)
    .sort();
  return routes.join("\n");
}
