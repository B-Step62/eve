import { createMcpTraceFetch } from "#runtime/connections/mcp-tracing.js";
import {
  startConnectionEventOwner,
  retireConnectionEventOwner,
} from "#runtime/connections/events/owner.js";
import { connectionEventStore } from "#runtime/connections/events/store.js";
import { createMcpTracing } from "#tracing/eve/mcp.js";
import { withConnectionEventSpan } from "#tracing/eve/connection-events.js";
import { principalOf } from "#execution/session/principal.js";
import { z } from "zod";
import { toInputSchema } from "#tools/schema.js";
import { createHash } from "node:crypto";
import {
  createMCPClient,
  type Experimental_MCPEventDefinition as EventDefinition,
  type Experimental_ManagedMCPEvents as ManagedEvents,
} from "#compiled/@ai-sdk/mcp/index.js";
import { contextStorage } from "#context/container.js";
import { AuthKey, SessionIdKey, SessionTraceSeedKey } from "#context/keys.js";
import { BundleKey } from "#runtime/sessions/runtime-context-keys.js";
import type { ResolvedConnectionDefinition } from "#runtime/types.js";
import type {
  ConnectionToolExecuteOptions,
  ConnectionToolMetadata,
} from "#shared/connection-types.js";
import type { ManagedEventSubscribeInput } from "#shared/connection-events.js";
import { parseJsonObject } from "#shared/json.js";
import { principalKey, resolveConnectionPrincipal } from "#runtime/connections/principal.js";
import { connectionEventDestination } from "#runtime/connections/events/path.js";
import type { EventBinding } from "#runtime/connections/events/state.js";

const LIST = "events_list_subscriptions";
const GET = "events_get_subscription";
const STOP = "events_unsubscribe";
const PREFIX = "events_subscribe_";
const MAX_BINDINGS = 100;

export function isEventAction(name: string): boolean {
  return name === LIST || name === GET || name === STOP || name.startsWith(PREFIX);
}

export class ConnectionEventActions {
  private readonly connection: ResolvedConnectionDefinition;
  private readonly headers: () => Promise<Record<string, string>>;
  private readonly transportFetch: typeof fetch | undefined;
  constructor(
    connection: ResolvedConnectionDefinition,
    headers: () => Promise<Record<string, string>>,
    transportFetch?: typeof fetch,
  ) {
    this.connection = connection;
    this.headers = headers;
    this.transportFetch = transportFetch;
  }

  private scope() {
    const ctx = contextStorage.getStore();
    if (ctx === undefined) throw new Error("Event subscriptions require an active eve session.");
    if (ctx.get(BundleKey)?.nodeId !== undefined)
      throw new Error(
        "Experimental event subscriptions currently require a root-agent connection.",
      );
    const authorization = this.connection.authorization;
    if (
      authorization === undefined ||
      typeof authorization === "function" ||
      authorization.vercelConnect?.experimental_events === undefined
    ) {
      throw new Error("Event subscriptions require a static Connect events provider.");
    }
    const principal = resolveConnectionPrincipal(
      this.connection.connectionName,
      authorization,
      ctx,
    );
    const sessionId = ctx.require(SessionIdKey);
    const owner = principalKey(principal);
    const executionPrincipal = principalOf(ctx.get(AuthKey));
    const connector = authorization.vercelConnect.connector;
    const owned = (binding: EventBinding) =>
      binding.connectionName === this.connection.connectionName &&
      binding.instanceId === this.connection.instanceId &&
      binding.connector === connector &&
      binding.principalKey === owner &&
      binding.executionPrincipal === executionPrincipal;
    return {
      ctx,
      principal,
      sessionId,
      owner,
      executionPrincipal,
      owned,
      backend: authorization.vercelConnect.experimental_events,
      connector,
    };
  }

  private async withClient<T>(run: (events: ManagedEvents) => Promise<T>): Promise<T> {
    const { backend, principal } = this.scope();
    const adapter = await backend.createAdapter({
      principal,
      connection: { url: this.connection.url },
      destination: { path: connectionEventDestination(this.connection.connectionName) },
    });
    // A fresh authenticated transport keeps catalogs isolated between people sharing a session.
    let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;
    const config = {
      transport: {
        type: "http" as const,
        fetch: createMcpTraceFetch({
          connectionName: this.connection.connectionName,
          fetcher: this.transportFetch,
          getProtocolVersion: () => client?.initializeResult?.protocolVersion,
        }),
        url: this.connection.url,
        headers: await this.headers(),
      },
      protocolVersionDiscovery: this.connection.protocolVersionDiscovery,
      experimental_events: { adapter: { createAdapter: () => adapter } },
    };
    client = await createMCPClient(config);
    try {
      return await run(client.experimental_events);
    } finally {
      await client.close();
    }
  }

  private async catalog(events: ManagedEvents): Promise<EventDefinition[]> {
    const result: EventDefinition[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    let discovered = 0;
    for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
      const page = await withConnectionEventSpan(
        {
          ctx: this.scope().ctx,
          connectionName: this.connection.connectionName,
          operation: "catalog",
        },
        () =>
          createMcpTracing().list({
            connectionName: this.connection.connectionName,
            method: "events/list",
            execute: () => events.list({ params: { cursor }, options: { timeout: 15_000 } }),
          }),
      );
      discovered += page.events.length;
      if (discovered > 1000) throw new Error("MCP event catalog exceeds the 1000-event limit.");
      result.push(...page.events.filter((event) => event.delivery.includes("webhook")));
      cursor = page.nextCursor ?? undefined;
      if (cursor === undefined) return result;
      if (seen.has(cursor)) throw new Error("MCP event catalog returned a repeated cursor.");
      seen.add(cursor);
    }
    throw new Error("MCP event catalog exceeds the 20-page limit.");
  }

  async metadata(): Promise<ConnectionToolMetadata[]> {
    return this.withClient(async (events) => {
      const catalog = await this.catalog(events);
      return [
        ...catalog.map((event) => ({
          name: actionName(event.name),
          description: `Watch ${event.name}. ${event.description ?? ""} Events reach this connection's authored callback; expiresAt=null watches until stopped.`,
          inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["arguments", "expiresAt"],
            properties: {
              arguments: event.inputSchema,
              expiresAt: {
                type: ["string", "null"],
                description: "ISO deadline, or null until stopped",
              },
            },
          },
        })),
        ...managementMetadata(),
      ];
    });
  }

  /** Existing watches must remain stoppable when upstream discovery fails. */
  recoveryMetadata(): ConnectionToolMetadata[] {
    this.scope();
    return managementMetadata().map((tool) => ({
      ...tool,
      description: `MCP discovery is unavailable. ${tool.description}`,
    }));
  }

  async execute(
    name: string,
    input: unknown,
    options: ConnectionToolExecuteOptions,
  ): Promise<unknown> {
    const args = parseJsonObject(input);
    const { ctx, principal, connector, backend, sessionId, owner, executionPrincipal, owned } =
      this.scope();
    const store = connectionEventStore(this.connection, {
      principalKey: owner,
      executionPrincipal,
    });
    const bindings = await store.list();
    const save = async (binding: EventBinding): Promise<EventBinding> => {
      const saved = await store.save(binding);
      bindings[binding.id] = saved;
      return saved;
    };
    if (name === LIST)
      return {
        subscriptions: Object.values(bindings).filter(owned).map(subscriptionResult),
      };
    if (name === GET || name === STOP) {
      let binding = Object.values(bindings).find(
        (binding) =>
          owned(binding) && (binding.subscription?.id === args.id || binding.id === args.id),
      );
      if (binding === undefined)
        throw new Error("Unknown subscription for this caller and account.");
      if (name === STOP) {
        binding = await save({ ...binding, retired: true });
        await retireConnectionEventOwner(binding.id);
      }
      const events = await backend.createAdapter({
        principal,
        connection: { url: this.connection.url },
        destination: { path: connectionEventDestination(this.connection.connectionName) },
      });
      if (binding.subscription === undefined) {
        const request = binding.request;
        const subscription = await withConnectionEventSpan(
          {
            ctx,
            connectionName: this.connection.connectionName,
            bindingId: binding.id,
            operation: "recover",
          },
          () => events.subscribe({ ...request, options: { timeout: 30_000 } }),
        );
        binding = {
          ...binding,
          subscription,
          retired: name === STOP ? true : binding.retired,
        };
        binding = await save(binding);
      }
      const subscriptionId = binding.subscription!.id;
      const subscription = await withConnectionEventSpan(
        {
          ctx,
          connectionName: this.connection.connectionName,
          bindingId: binding.id,
          subscriptionId,
          operation: name === STOP ? "unsubscribe" : "get",
        },
        () =>
          name === STOP
            ? events.unsubscribe({ id: subscriptionId, options: { timeout: 30_000 } })
            : events.getSubscription({ id: subscriptionId, options: { timeout: 30_000 } }),
      );
      binding = { ...binding, retired: name === STOP ? true : binding.retired, subscription };
      binding = await save(binding);
      return subscriptionResult(binding);
    }
    return this.withClient(async (events) => {
      const definition = (await this.catalog(events)).find(
        (event) => actionName(event.name) === name,
      );
      if (definition === undefined)
        throw new Error("Unknown event subscription action for this account.");
      const schema =
        typeof definition.inputSchema === "boolean"
          ? { allOf: [definition.inputSchema] }
          : definition.inputSchema;
      const valid = await toInputSchema(schema)["~standard"].validate(
        parseJsonObject(args.arguments),
      );
      if (valid.issues !== undefined)
        throw new Error("Event arguments do not match the authorized catalog schema.");
      const eventArguments = parseJsonObject(valid.value);
      const expiresAt = args.expiresAt;
      if (
        expiresAt !== null &&
        (typeof expiresAt !== "string" ||
          !z.iso.datetime({ offset: true }).safeParse(expiresAt).success)
      )
        throw new Error("expiresAt must be an ISO deadline or null.");
      const id = createHash("sha256")
        .update(
          JSON.stringify([
            sessionId,
            this.connection.instanceId,
            this.connection.connectionName,
            owner,
            executionPrincipal,
            options.callId,
          ]),
        )
        .digest("hex");
      let binding = bindings[id];
      if (binding === undefined) {
        if (Object.keys(bindings).length >= MAX_BINDINGS)
          throw new Error(
            "This caller has reached its 100-subscription limit for this connection.",
          );
        const request: ManagedEventSubscribeInput = {
          name: definition.name,
          arguments: structuredClone(eventArguments) as ManagedEventSubscribeInput["arguments"],
          expiresAt,
          idempotencyKey: id,
          context: { eve: { version: 1, sessionId, bindingId: id } },
        };
        binding = {
          id,
          sessionId,
          connectionName: this.connection.connectionName,
          instanceId: this.connection.instanceId,
          connector,
          principalKey: owner,
          executionPrincipal,
          auth: structuredClone(ctx.get(AuthKey) ?? null),
          traceSeed: ctx.get(SessionTraceSeedKey),
          request,
        };
        binding = await save(binding);
      }
      if (!owned(binding) || binding.retired)
        throw new Error("Subscription binding is no longer active.");
      if (binding.subscription !== undefined) return subscriptionResult(binding);
      await startConnectionEventOwner(binding, ctx.require(BundleKey));
      const request = binding.request;
      const subscription = await withConnectionEventSpan(
        {
          ctx,
          connectionName: this.connection.connectionName,
          bindingId: binding.id,
          operation: "subscribe",
        },
        () =>
          events.subscribe({
            ...request,
            options: { signal: options.abortSignal, timeout: 30_000 },
          }),
      );
      binding = {
        ...binding,
        subscription: {
          ...subscription,
          // Snapshot the SDK's readonly JSON into eve's owned, mutable state.
          arguments: structuredClone(
            subscription.arguments,
          ) as ManagedEventSubscribeInput["arguments"],
        },
      };
      binding = await save(binding);
      return subscriptionResult(binding);
    });
  }
}

function subscriptionResult(binding: EventBinding) {
  return {
    ...(binding.subscription ?? {
      id: binding.id,
      name: binding.request.name,
      status: "pending",
    }),
    retired: binding.retired ?? false,
  };
}

function actionName(eventName: string): string {
  return `${PREFIX}${createHash("sha256").update(eventName).digest("hex").slice(0, 24)}`;
}

function managementMetadata(): ConnectionToolMetadata[] {
  return [
    {
      name: LIST,
      description:
        "List this caller's event subscriptions for this connection. status is Connect's last-known state; retired=true means eve accepts no new event work for this subscription, regardless of status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    ...[GET, STOP].map((name) => ({
      name,
      description:
        name === GET
          ? "Get one of this caller's subscriptions and refresh its Connect status. retired=true means eve accepts no new event work for this subscription, regardless of status."
          : "Stop one of this caller's subscriptions. eve retires it before requesting cancellation from Connect; retired=true does not confirm upstream cancellation.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    })),
  ];
}
