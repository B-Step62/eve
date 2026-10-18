# eve/channels

## Export names

- AgentDescription: src/channel/agent-description.d.ts#AgentDescription
- AgentSkillDescription: src/channel/agent-description.d.ts#AgentSkillDescription
- AgentSkillFileDescription: src/channel/agent-description.d.ts#AgentSkillFileDescription
- AgentToolDescription: src/channel/agent-description.d.ts#AgentToolDescription
- AttachSessionFn: src/channel/routes.d.ts#AttachSessionFn
- AudienceCaller: src/shared/conversation-context.d.ts#AudienceCaller
- AudienceContext: src/shared/conversation-context.d.ts#AudienceContext
- Channel: src/public/definitions/channel.d.ts#Channel
- ChannelAudience: src/shared/channel-audience.d.ts#ChannelAudience
- ChannelCommitHandler: src/public/definitions/channel.d.ts#ChannelCommitHandler
- ChannelContinuationOps: src/public/definitions/channel.d.ts#ChannelContinuationOps
- ChannelCors: src/channel/cors.d.ts#ChannelCors
- ChannelCorsOptions: src/channel/cors.d.ts#ChannelCorsOptions
- ChannelDefinition: src/public/definitions/channel.d.ts#ChannelDefinition
- ChannelDelivery: src/shared/channel-delivery.d.ts#ChannelDelivery
- ChannelEventContext: src/public/definitions/channel.d.ts#ChannelEventContext
- ChannelEvents: src/public/definitions/channel.d.ts#ChannelEvents
- ChannelFrom: src/channel/channel-operations.d.ts#ChannelFrom
- ChannelInfo: src/shared/channel-info.d.ts#ChannelInfo
- ChannelKind: src/shared/channel-info.d.ts#ChannelKind
- ChannelReceiveContext: src/channel/channel-operations.d.ts#ChannelReceiveContext
- ChannelResolveSession: src/channel/channel-operations.d.ts#ChannelResolveSession
- ChannelRespondOptions: src/channel/channel-operations.d.ts#ChannelRespondOptions
- ChannelSendOptions: src/channel/channel-operations.d.ts#ChannelSendOptions
- ChannelSource: src/channel/channel-operations.d.ts#ChannelSource
- CommittedLine: src/channel/adapter.d.ts#CommittedLine
- ConversationEnvironment: src/shared/conversation-context.d.ts#ConversationEnvironment
- DELETE: src/channel/routes.d.ts#DELETE
- Delivery: src/shared/delivery.d.ts#Delivery
- DeliveryResult: src/shared/delivery.d.ts#DeliveryResult
- DisabledRouteSentinel: src/public/definitions/channel.d.ts#DisabledRouteSentinel
- FetchFileContext: src/shared/channel-definition.d.ts#FetchFileContext
- FetchFileFunction: src/shared/channel-definition.d.ts#FetchFileFunction
- FetchFileResult: src/shared/channel-definition.d.ts#FetchFileResult
- GET: src/channel/routes.d.ts#GET
- HEAD: src/channel/routes.d.ts#HEAD
- HttpRouteDefinition: src/channel/routes.d.ts#HttpRouteDefinition
- InferChannelMetadata: src/public/definitions/channel.d.ts#InferChannelMetadata
- InvokeToolFn: src/channel/invoke-tool.d.ts#InvokeToolFn
- InvokeToolOptions: src/channel/invoke-tool.d.ts#InvokeToolOptions
- InvokeToolResult: src/channel/invoke-tool.d.ts#InvokeToolResult
- MessageContent: src/shared/message-content.d.ts#MessageContent
- MessageFilePart: src/shared/message-content.d.ts#MessageFilePart
- MessagePart: src/shared/message-content.d.ts#MessagePart
- MessageTextPart: src/shared/message-content.d.ts#MessageTextPart
- OPTIONS: src/channel/routes.d.ts#OPTIONS
- PATCH: src/channel/routes.d.ts#PATCH
- POST: src/channel/routes.d.ts#POST
- PUT: src/channel/routes.d.ts#PUT
- RouteDefinition: src/channel/routes.d.ts#RouteDefinition
- RouteHandlerArgs: src/channel/routes.d.ts#RouteHandlerArgs
- Session: src/channel/session.d.ts#Session
- SessionHandle: src/channel/session.d.ts#SessionHandle
- SessionNotActiveError: src/channel/session-not-active-error.d.ts#SessionNotActiveError
- SessionOperations: src/shared/session.d.ts#SessionOperations
- SessionRespondOptions: src/channel/session.d.ts#SessionRespondOptions
- SessionSendOptions: src/channel/session.d.ts#SessionSendOptions
- SessionStrandedError: src/channel/session-stranded-error.d.ts#SessionStrandedError
- TurnPolicy: src/channel/types.d.ts#TurnPolicy
- UploadPolicyInput: src/public/channels/upload-policy.d.ts#UploadPolicyInput
- WS: src/channel/routes.d.ts#WS
- WebSocketMessage: src/channel/routes.d.ts#WebSocketMessage
- WebSocketPeer: src/channel/routes.d.ts#WebSocketPeer
- WebSocketRouteDefinition: src/channel/routes.d.ts#WebSocketRouteDefinition
- WebSocketRouteHandler: src/channel/routes.d.ts#WebSocketRouteHandler
- WebSocketRouteHooks: src/channel/routes.d.ts#WebSocketRouteHooks
- WebSocketUpgradeRequest: src/channel/routes.d.ts#WebSocketUpgradeRequest
- WebSocketUpgradeResult: src/channel/routes.d.ts#WebSocketUpgradeResult
- WebSocketUpgradeServerBridge: src/channel/websocket-upgrade-server.d.ts#WebSocketUpgradeServerBridge
- answerFromText: src/channel/resolve-text.d.ts#answerFromText
- attachmentError: src/public/channels/attachment-error.d.ts#attachmentError
- createWebSocketUpgradeServer: src/channel/websocket-upgrade-server.d.ts#createWebSocketUpgradeServer
- defineChannel: src/public/definitions/channel.d.ts#defineChannel
- disableRoute: src/public/definitions/channel.d.ts#disableRoute
- isChannel: src/public/channels/index.d.ts#isChannel
- isDisabledRouteSentinel: src/public/definitions/channel.d.ts#isDisabledRouteSentinel

## Peer boundaries

- @types/node/buffer.buffer.d.ts#Buffer
- @types/node/http.d.ts#Server

## Declaration closure

### src/channel/adapter.d.ts

```ts
export interface CommittedLine {
  readonly facts: readonly SessionEvent[];
  readonly position: number;
}
```

### src/channel/agent-description.d.ts

```ts
export interface AgentDescription {
  readonly name: string;
  readonly description?: string;
  readonly tools: readonly AgentToolDescription[];
  readonly skills: readonly AgentSkillDescription[];
}
export interface AgentSkillDescription {
  readonly name: string;
  readonly description: string;
}
export interface AgentSkillFileDescription {
  readonly path: string;
  readonly size: number;
}
export interface AgentToolDescription {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  readonly outputSchema?: JsonObject;
  readonly approval: boolean;
}
```

### src/channel/channel-operations.d.ts

```ts
export interface ChannelReceiveContext<TState = undefined> {
  readonly from: ChannelFrom<TState>;
  readonly resolveSession: ChannelResolveSession;
}
export interface ChannelSource<TState = undefined> {
  send(message: MessageContent, options: ChannelSendOptions<TState>): Promise<Delivery>;
  respond<const TResponses extends readonly Answer[]>(
    answers: StrictAnswers<TResponses>,
    options: ChannelRespondOptions<TState>,
  ): Promise<Delivery>;
  cancel(
    options?: {
      readonly turnId?: string | null;
    } & SessionControlOptions,
  ): Promise<Delivery>;
  compact(options?: SessionControlOptions): Promise<Delivery>;
  clear(options?: SessionControlOptions): Promise<Delivery>;
  reset(
    options?: {
      readonly reason?: string;
    } & SessionControlOptions,
  ): Promise<Delivery>;
}
export type ChannelFrom<TState = undefined> = (address: string) => ChannelSource<TState>;
export type ChannelResolveSession = (address: string) => Promise<Session | undefined>;
export type ChannelRespondOptions<TState = undefined> = BaseChannelRespondOptions<TState>;
export type ChannelSendOptions<TState = undefined> = BaseChannelSendOptions & {
  readonly state?: Partial<TState>;
};
interface BaseChannelRespondOptions<TState = undefined> {
  readonly auth: SessionAuthContext | null;
  readonly outputSchema?: JsonObject;
  readonly context?: readonly string[];
  readonly state?: Partial<TState>;
}
interface BaseChannelSendOptions {
  readonly auth: SessionAuthContext | null;
  readonly context?: readonly string[];
  readonly outputSchema?: JsonObject;
  readonly title?: string;
  readonly turnPolicy?: TurnPolicy;
}
```

### src/channel/compiled-channel.d.ts

```ts
export declare const CHANNEL_SENTINEL: "eve:channel";
export interface ChannelReference<
  TReceiveTarget = Record<string, unknown>,
> extends TypedReceiveTarget<TReceiveTarget> {
  readonly __kind: typeof CHANNEL_SENTINEL;
}
```

### src/channel/cors.d.ts

```ts
export interface ChannelCorsOptions {
  readonly origin?: string | readonly string[];
  readonly methods?: "*" | readonly string[];
  readonly allowHeaders?: "*" | readonly string[];
  readonly exposeHeaders?: "*" | readonly string[];
  readonly credentials?: boolean;
  readonly maxAge?: string | number | false;
  readonly preflight?: {
    readonly statusCode?: number;
  };
}
export type ChannelCors = boolean | ChannelCorsOptions;
```

### src/channel/cross-channel-receive.d.ts

```ts
export interface CrossChannelTargetHandle {
  send(message: MessageContent, options: CrossChannelSendOptions): Promise<Delivery>;
}
export type CrossChannelToFn = <TChannel extends ChannelReference<unknown>>(
  channel: TChannel,
  target: InferReceiveTarget<TChannel>,
) => CrossChannelTargetHandle;
interface CrossChannelSendOptions {
  readonly auth: SessionAuthContext | null;
  readonly turnPolicy?: TurnPolicy;
}
```

### src/channel/invoke-tool.d.ts

```ts
export interface InvokeToolOptions {
  readonly auth: SessionAuthContext;
  readonly initiator?: SessionAuthContext;
  readonly forwardedBy?: SessionAuthContext;
  readonly key?: string;
  readonly signal?: AbortSignal;
}
export type InvokeToolFn = (
  name: string,
  input: unknown,
  options: InvokeToolOptions,
) => Promise<InvokeToolResult>;
export type InvokeToolResult =
  | {
      readonly outcome: "completed";
      readonly output: unknown;
      readonly modelOutput: ToolModelOutput;
    }
  | {
      readonly outcome: "failed";
      readonly error: ErrorInfo;
    }
  | {
      readonly outcome: "rejected";
      readonly reason: string;
      readonly connections?: readonly string[];
      readonly cause?: {
        readonly policy: string;
      };
    };
```

### src/channel/receive-target.d.ts

```ts
declare const receiveTargetMarker: unique symbol;
export interface TypedReceiveTarget<TTarget = Record<string, unknown>> {
  readonly [receiveTargetMarker]?: TTarget;
}
export type InferReceiveTarget<TChannel> =
  TChannel extends TypedReceiveTarget<infer TTarget> ? TTarget : Record<string, unknown>;
```

### src/channel/resolve-text.d.ts

```ts
export declare function answerFromText(
  text: string,
  interaction: TextResolvable,
): Answer | undefined;
interface TextResolvable {
  readonly interactionId: string;
  readonly request: Pick<InteractionRequest, "allowFreeform" | "options">;
}
```

### src/channel/routes.d.ts

```ts
export declare function DELETE<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function GET<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function HEAD<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function OPTIONS<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function PATCH<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function POST<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function PUT<TState = undefined>(
  path: string,
  handler: RouteHandler<TState>,
): HttpRouteDefinition<TState>;
export declare function WS<TState = undefined>(
  path: string,
  handler: WebSocketRouteHandler<TState>,
): WebSocketRouteDefinition<TState>;
export interface HttpRouteDefinition<TState = undefined> {
  readonly transport?: "http";
  readonly method: ChannelMethod;
  readonly path: string;
  readonly handler: RouteHandler<TState>;
}
export interface RouteHandlerArgs<TState = undefined> {
  readonly from: ChannelFrom<TState>;
  readonly resolveSession: ChannelResolveSession;
  attachSession: AttachSessionFn;
  readonly to: CrossChannelToFn;
  params: Readonly<Record<string, string>>;
  waitUntil: (task: Promise<unknown>) => void;
  requestIp: string | null;
  describe(): Promise<AgentDescription>;
  listSkillFiles(skill: string): Promise<readonly AgentSkillFileDescription[]>;
  readSkill(skill: string, path?: string): Promise<Uint8Array>;
  readonly invokeTool: InvokeToolFn;
}
export interface WebSocketMessage {
  readonly data: unknown;
  readonly id: string;
  readonly rawData: unknown;
  arrayBuffer(): ArrayBuffer | SharedArrayBuffer;
  blob(): Blob;
  json<T = unknown>(): T;
  text(): string;
  uint8Array(): Uint8Array;
}
export interface WebSocketPeer {
  readonly id: string;
  readonly context: Record<string, unknown>;
  readonly namespace: string;
  readonly request: Request;
  readonly remoteAddress?: string;
  readonly topics: Set<string>;
  close(code?: number, reason?: string): void;
  publish(
    topic: string,
    data: unknown,
    options?: {
      compress?: boolean;
    },
  ): void;
  send(
    data: unknown,
    options?: {
      compress?: boolean;
    },
  ): number | void | undefined;
  subscribe(topic: string): void;
  terminate(): void;
  unsubscribe(topic: string): void;
}
export interface WebSocketRouteDefinition<TState = undefined> {
  readonly transport: "websocket";
  readonly method: "WEBSOCKET";
  readonly path: string;
  readonly handler: WebSocketRouteHandler<TState>;
}
export interface WebSocketRouteHooks {
  close?(
    peer: WebSocketPeer,
    details: {
      code?: number;
      reason?: string;
    },
  ): void | Promise<void>;
  error?(peer: WebSocketPeer, error: Error): void | Promise<void>;
  message?(peer: WebSocketPeer, message: WebSocketMessage): void | Promise<void>;
  open?(peer: WebSocketPeer): void | Promise<void>;
  upgrade?(
    request: WebSocketUpgradeRequest,
  ): Promise<WebSocketUpgradeResult> | WebSocketUpgradeResult;
}
export interface WebSocketUpgradeRequest extends Request {
  readonly context?: Record<string, unknown>;
}
export type AttachSessionFn = (sessionId: string) => Session;
export type RouteDefinition<TState = undefined> =
  HttpRouteDefinition<TState> | WebSocketRouteDefinition<TState>;
export type RouteHandler<TState = undefined> = (
  req: Request,
  args: RouteHandlerArgs<TState>,
) => Promise<Response>;
export type WebSocketRouteHandler<TState = undefined> = (
  req: Request,
  args: RouteHandlerArgs<TState>,
) => Promise<WebSocketRouteHooks> | WebSocketRouteHooks;
export type WebSocketUpgradeResult =
  | {
      readonly context?: Record<string, unknown>;
      readonly handled?: boolean;
      readonly headers?: WebSocketHeaders;
      readonly namespace?: string;
    }
  | Response
  | void;
type WebSocketHeaders = Headers | readonly (readonly [string, string])[] | Record<string, string>;
```

### src/channel/session-not-active-error.d.ts

```ts
export declare class SessionNotActiveError extends Error {
  readonly code = "EVE_SESSION_NOT_ACTIVE";
  readonly retryable: boolean;
  constructor(options?: { readonly retryable?: boolean });
  static is(error: unknown): error is SessionNotActiveError;
}
```

### src/channel/session-stranded-error.d.ts

```ts
export declare class SessionStrandedError extends Error {
  readonly owner: StrandedSessionOwner;
  constructor(owner: StrandedSessionOwner, message?: string);
  static is(error: unknown): error is SessionStrandedError;
}
interface StrandedSessionOwner {
  readonly eveVersion?: string;
}
```

### src/channel/session.d.ts

```ts
export interface Session extends SessionOperations {
  stream(options?: SessionStreamOptions): AsyncIterable<SessionStreamEvent>;
}
export interface SessionHandle {
  readonly id: string;
  readonly auth: SessionAuth;
  readonly continuation?: {
    readonly token: string;
    alias(rawToken: string): void;
  };
}
export type SessionRespondOptions = SessionDeliveryOptions;
export type SessionSendOptions = SessionDeliveryOptions & {
  readonly title?: string;
  readonly turnPolicy?: TurnPolicy;
};
interface SessionDeliveryOptions {
  readonly auth: SessionAuthContext | null;
  readonly context?: readonly string[];
  readonly outputSchema?: JsonObject;
}
```

### src/channel/types.d.ts

```ts
export interface SessionAuthContext {
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly authenticator: string;
  readonly issuer?: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly subject?: string;
}
export interface SessionControlOptions {
  readonly auth?: SessionAuthContext | null;
}
export interface SessionParent {
  readonly callId: string;
  readonly rootSessionId: string;
  readonly sessionId: string;
  readonly turn: SessionTurn;
}
export interface SessionTurn {
  readonly id: string;
  readonly sequence: number;
}
export type TurnPolicy = "steer" | "queue";
```

### src/channel/websocket-upgrade-server.d.ts

```ts
export declare function createWebSocketUpgradeServer(): WebSocketUpgradeServerBridge;
export interface WebSocketUpgradeServerBridge {
  readonly route: WebSocketRouteHandler;
  readonly server: Server;
}
```

### src/client/types.d.ts

```ts
export interface ResolvedStreamReconnectPolicy {
  readonly streamOpenReconnectPolicy?: StreamReconnectRetryPolicy;
  readonly retryableErrorStatuses?: readonly number[];
}
export interface StreamReconnectRetryPolicy {
  readonly baseDelayMs?: number;
  readonly maxAttempts?: number;
  readonly maxDelayMs?: number;
}
export type StreamReconnectPolicy =
  | ResolvedStreamReconnectPolicy
  | {
      readonly reconnect: false;
    };
```

### src/context/keys.d.ts

```ts
export interface SessionAuth {
  readonly current: SessionAuthContext | null;
  readonly initiator: SessionAuthContext | null;
}
```

### src/context/session-context.d.ts

```ts
export interface SessionContext {
  readonly session: {
    readonly id: string;
    readonly auth: SessionAuth;
    readonly turn: SessionTurn;
    readonly parent?: SessionParent;
    readonly schedule?: SessionSchedule;
    readonly predecessor?: SessionPredecessor;
  };
  getSandbox(): Promise<RuntimeSandboxSession>;
  getSandbox<Session extends SandboxSession>(
    environment: SandboxEnvironment<object | undefined, Session>,
  ): Promise<RuntimeSandboxSession<Session>>;
}
```

### src/context/session-schedule.d.ts

```ts
export interface SessionSchedule {
  readonly definition: string;
  readonly instance?: string;
  readonly occurrenceId?: string;
}
```

### src/protocol/session-event.d.ts

```ts
export interface SessionEventMeta {
  readonly position: FactPosition;
  readonly at: string;
  readonly endOfLine?: boolean;
}
export type SessionEvent = Fact | Progress;
export type SessionStreamEvent = SessionEvent & {
  readonly meta: SessionEventMeta;
};
```

### src/protocol/session-events/authoring.d.ts

```ts
export declare const authoringEventTypes: readonly [
  "session.started",
  "session.ended",
  "delivery.admitted",
  "delivery.consumed",
  "delivery.settled",
  "turn.started",
  "turn.paused",
  "turn.settled",
  "model.requested",
  "model.started",
  "model.retried",
  "model.settled",
  "content.delta",
  "content.completed",
  "call.input",
  "call.requested",
  "call.started",
  "call.progress",
  "call.settled",
  "usage.recorded",
  "context.started",
  "context.settled",
  "interaction.opened",
  "interaction.settled",
  "response.submitted",
  "response.admitted",
  "response.settled",
  "child.opened",
  "task.ended",
  "task.started",
];
export type AuthoringEventType = (typeof authoringEventTypes)[number];
```

### src/protocol/session-events/envelope.d.ts

```ts
export interface Envelope<TType extends string, TData> {
  readonly type: TType;
  readonly scope?: Scope;
  readonly data: TData;
}
export interface ErrorInfo {
  readonly name?: string;
  readonly code: string;
  readonly message: string;
  readonly id?: string;
  readonly hint?: string;
}
export interface FactPosition {
  readonly line: number;
  readonly index: number;
}
export interface Principal {
  readonly id: string;
  readonly type: string;
  readonly issuer?: string;
}
export interface Scope {
  readonly turnId?: string;
  readonly taskId?: string;
  readonly runId?: string;
  readonly changeId?: string;
}
export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly costUsd?: number;
}
export interface ValueReference {
  readonly ref?: string;
  readonly mediaType?: string;
  readonly size?: number;
  readonly preview?: string;
  readonly withheld?: true;
}
export type Cause =
  | {
      readonly deliveryId: string;
    }
  | {
      readonly turnId: string;
    }
  | {
      readonly taskId: string;
    }
  | {
      readonly callId: string;
    }
  | {
      readonly interactionId: string;
    }
  | {
      readonly responseId: string;
    }
  | {
      readonly changeId: string;
    }
  | {
      readonly policy: string;
    }
  | {
      readonly hook: string;
    };
export type UserPart =
  | {
      readonly kind: "text";
      readonly text: string;
    }
  | {
      readonly kind: "file";
      readonly mediaType: string;
      readonly filename?: string;
      readonly size?: number;
      readonly ref?: string;
      readonly url?: string;
      readonly unavailable?: true;
    };
```

### src/protocol/session-events/facts.d.ts

```ts
export type Fact =
  | SessionFact
  | DeliveryFact
  | TurnFact
  | ModelFact
  | ContentFact
  | CallFact
  | TaskFact
  | InteractionFact
  | ResponseFact
  | ChildFact
  | ContextFact
  | UsageFact;
export type Progress = ContentProgress | CallProgressRecord;
```

### src/protocol/session-events/families/call.d.ts

```ts
export interface CallInputData {
  readonly callId: string;
  readonly name?: string;
  readonly kind?: CapabilityKind;
  readonly delta: string;
}
export interface CallProgressData {
  readonly callId: string;
  readonly output: JsonValue;
  readonly label?: string;
}
export interface CallRequestedData {
  readonly callId: string;
  readonly owner: CallOwner;
  readonly capability: Capability;
  readonly input?: JsonValue;
  readonly inputRef?: ValueReference;
  readonly inputError?: ErrorInfo;
}
export interface CallSettledData {
  readonly callId: string;
  readonly outcome: CallOutcome;
  readonly output?: JsonValue;
  readonly outputRef?: ValueReference;
  readonly outputOf?: {
    readonly callId: string;
  };
  readonly error?: ErrorInfo;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly label?: string;
}
export interface CallStartedData {
  readonly callId: string;
  readonly clearedBy?: ClearedBy;
  readonly taskId?: string;
}
export interface Capability {
  readonly kind: CapabilityKind;
  readonly name: string;
  readonly label?: string;
  readonly remote?: true;
}
export type CallFact = CallRequested | CallStarted | CallSettled;
export type CallInput = Envelope<"call.input", CallInputData>;
export type CallOutcome = "completed" | "failed" | "rejected" | "interrupted" | "abandoned";
export type CallOwner =
  | {
      readonly runId: string;
    }
  | {
      readonly callId: string;
    };
export type CallProgress = Envelope<"call.progress", CallProgressData>;
export type CallProgressRecord = CallInput | CallProgress;
export type CallRequested = Envelope<"call.requested", CallRequestedData>;
export type CallSettled = Envelope<"call.settled", CallSettledData>;
export type CallStarted = Envelope<"call.started", CallStartedData>;
export type CapabilityKind = "tool" | "agent" | "skill" | "control";
export type ClearedBy =
  | {
      readonly policy: string;
    }
  | {
      readonly grant: {
        readonly interactionId: string;
      };
    }
  | {
      readonly interactionId: string;
    };
```

### src/protocol/session-events/families/child.d.ts

```ts
export interface ChildOpenedData {
  readonly sessionId: string;
  readonly owner:
    | {
        readonly callId: string;
      }
    | {
        readonly taskId: string;
      };
  readonly name: string;
  readonly stream: string;
}
export type ChildFact = ChildOpened;
export type ChildOpened = Envelope<"child.opened", ChildOpenedData>;
```

### src/protocol/session-events/families/content.d.ts

```ts
export interface ContentCompletedData {
  readonly partId: string;
  readonly runId: string;
  readonly kind: ContentKind;
  readonly value?: JsonValue;
  readonly valueRef?: ValueReference;
  readonly phase: ContentPhase;
  readonly interrupted?: true;
  readonly mediaType?: string;
  readonly fallbackText?: string;
}
export interface ContentDeltaData {
  readonly partId: string;
  readonly kind?: ContentKind;
  readonly delta: string;
}
export type ContentCompleted = Envelope<"content.completed", ContentCompletedData>;
export type ContentDelta = Envelope<"content.delta", ContentDeltaData>;
export type ContentFact = ContentCompleted;
export type ContentKind = "text" | "reasoning" | "result" | "file" | (string & {});
export type ContentPhase = "narration" | "reply" | (string & {});
export type ContentProgress = ContentDelta;
```

### src/protocol/session-events/families/context.d.ts

```ts
export interface ContextSettledData {
  readonly changeId: string;
  readonly kind: ContextKind;
  readonly outcome: ContextOutcome;
  readonly selects?: null | {
    readonly turnId: string;
  };
  readonly error?: ErrorInfo;
}
export interface ContextStartedData {
  readonly changeId: string;
  readonly kind: ContextKind;
  readonly turnId?: string;
  readonly cause?: Cause;
  readonly trigger?: {
    readonly inputTokens: number;
  };
}
export type ContextFact = ContextStarted | ContextSettled;
export type ContextKind = "compaction" | "clear" | (string & {});
export type ContextOutcome = "completed" | "failed" | "cancelled" | "interrupted";
export type ContextSettled = Envelope<"context.settled", ContextSettledData>;
export type ContextStarted = Envelope<"context.started", ContextStartedData>;
```

### src/protocol/session-events/families/delivery.d.ts

```ts
export interface DeliveryAdmittedData {
  readonly deliveryId: string;
  readonly principal?: Principal;
  readonly source?: DeliverySource;
  readonly clientContext?: JsonValue;
}
export interface DeliveryConsumedData {
  readonly deliveryId: string;
  readonly turnId: string;
  readonly parts: readonly UserPart[];
}
export interface DeliverySettledData {
  readonly deliveryId: string;
  readonly outcome: DeliveryOutcome;
  readonly turnId?: string;
  readonly reason?: string;
}
export type DeliveryAdmitted = Envelope<"delivery.admitted", DeliveryAdmittedData>;
export type DeliveryConsumed = Envelope<"delivery.consumed", DeliveryConsumedData>;
export type DeliveryFact = DeliveryAdmitted | DeliveryConsumed | DeliverySettled;
export type DeliveryOutcome =
  "handled" | "awaiting-input" | "applied" | "ignored" | "refused" | "failed";
export type DeliverySettled = Envelope<"delivery.settled", DeliverySettledData>;
export type DeliverySource =
  | {
      readonly channel: string;
      readonly scheduleId?: string;
      readonly caller?: {
        readonly sessionId: string;
        readonly callId?: string;
      };
    }
  | {
      readonly control: string;
    }
  | {
      readonly callback: string;
    };
```

### src/protocol/session-events/families/interaction.d.ts

```ts
export interface InteractionOpenedData {
  readonly interactionId: string;
  readonly subject: InteractionSubject;
  readonly request: InteractionRequest;
  readonly origin?: InteractionOrigin;
  readonly audience?: {
    readonly principalIds: readonly string[];
  };
}
export interface InteractionOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly style?: InteractionOptionStyle;
}
export interface InteractionOrigin {
  readonly sessionId: string;
  readonly interactionId: string;
  readonly call?: {
    readonly callId: string;
    readonly name: string;
    readonly input?: JsonValue;
  };
}
export interface InteractionRequest {
  readonly kind: InteractionKind;
  readonly prompt: string;
  readonly title?: string;
  readonly options?: readonly InteractionOption[];
  readonly allowFreeform?: boolean;
  readonly display?: InteractionDisplay;
  readonly link?: {
    readonly url: string;
    readonly label?: string;
  };
  readonly signIn?: SignInChallenge;
}
export interface InteractionSettledData {
  readonly interactionId: string;
  readonly outcome: InteractionOutcome;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly response?: {
    readonly [key: string]: JsonValue;
  };
}
export interface SignInChallenge {
  readonly name: string;
  readonly displayName?: string;
  readonly url?: string;
  readonly userCode?: string;
  readonly expiresAt?: string;
  readonly instructions?: string;
  readonly callbackUrl?: string;
}
export type InteractionDisplay = "confirmation" | "select" | "text";
export type InteractionFact = InteractionOpened | InteractionSettled;
export type InteractionKind = "approval" | "question" | "sign-in" | "budget";
export type InteractionOpened = Envelope<"interaction.opened", InteractionOpenedData>;
export type InteractionOptionStyle = "primary" | "danger" | "default";
export type InteractionOutcome =
  | "accepted"
  | "declined"
  | "invalid"
  | "failed"
  | "withdrawn"
  | "interrupted"
  | "abandoned"
  | "expired";
export type InteractionSettled = Envelope<"interaction.settled", InteractionSettledData>;
export type InteractionSubject =
  | {
      readonly callId: string;
    }
  | {
      readonly turnId: string;
    }
  | {
      readonly taskId: string;
    }
  | {
      readonly responseId: string;
    };
```

### src/protocol/session-events/families/model.d.ts

```ts
export interface ModelRequestedData {
  readonly runId: string;
  readonly owner: ModelOwner;
}
export interface ModelRetriedData {
  readonly runId: string;
  readonly attempt: number;
  readonly error: ErrorInfo;
}
export interface ModelSettledData {
  readonly runId: string;
  readonly outcome: ModelOutcome;
  readonly finishReason?: string;
  readonly generationId?: string;
  readonly error?: ErrorInfo;
}
export interface ModelStartedData {
  readonly runId: string;
  readonly modelId: string;
  readonly attempt: number;
}
export type ModelFact = ModelRequested | ModelStarted | ModelRetried | ModelSettled;
export type ModelOutcome = "completed" | "failed" | "interrupted" | "abandoned";
export type ModelOwner =
  | {
      readonly turnId: string;
    }
  | {
      readonly changeId: string;
    };
export type ModelRequested = Envelope<"model.requested", ModelRequestedData>;
export type ModelRetried = Envelope<"model.retried", ModelRetriedData>;
export type ModelSettled = Envelope<"model.settled", ModelSettledData>;
export type ModelStarted = Envelope<"model.started", ModelStartedData>;
```

### src/protocol/session-events/families/response.d.ts

```ts
export interface Answer extends ResponseValue {
  readonly interactionId: string;
}
export interface ResponseAdmittedData {
  readonly responseId: string;
}
export interface ResponseSettledData {
  readonly responseId: string;
  readonly outcome: ResponseOutcome;
  readonly reason?: string;
}
export interface ResponseSubmittedData {
  readonly responseId: string;
  readonly interactionId: string;
  readonly deliveryId: string;
  readonly value?: ResponseValue;
}
export interface ResponseValue {
  readonly optionId?: string;
  readonly text?: string;
}
export type ResponseAdmitted = Envelope<"response.admitted", ResponseAdmittedData>;
export type ResponseFact = ResponseSubmitted | ResponseAdmitted | ResponseSettled;
export type ResponseOutcome =
  "applied" | "refused" | "failed" | "withdrawn" | "abandoned" | "expired";
export type ResponseSettled = Envelope<"response.settled", ResponseSettledData>;
export type ResponseSubmitted = Envelope<"response.submitted", ResponseSubmittedData>;
```

### src/protocol/session-events/families/session.d.ts

```ts
export interface RuntimeIdentity {
  readonly agentId: string;
  readonly agentName?: string;
  readonly eveVersion: string;
  readonly build?: {
    readonly deployedAt?: string;
    readonly gitBranch?: string;
    readonly gitSha?: string;
  };
}
export interface SessionEndedData {
  readonly outcome: SessionOutcome;
  readonly cause?: Cause;
  readonly error?: ErrorInfo;
}
export interface SessionPredecessor {
  readonly sessionId: string;
}
export interface SessionStartedData {
  readonly parent?: {
    readonly sessionId: string;
    readonly callId: string;
  };
  readonly predecessor?: SessionPredecessor;
  readonly runtime?: RuntimeIdentity;
  readonly trace?: TraceContext;
}
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
}
export type SessionEnded = Envelope<"session.ended", SessionEndedData>;
export type SessionFact = SessionStarted | SessionEnded;
export type SessionOutcome = "completed" | "failed";
export type SessionStarted = Envelope<"session.started", SessionStartedData>;
```

### src/protocol/session-events/families/task.d.ts

```ts
export interface TaskEndedData {
  readonly taskId: string;
  readonly outcome: TaskOutcome;
  readonly reason?: string;
  readonly error?: ErrorInfo;
}
export interface TaskStartedData {
  readonly taskId: string;
  readonly startedBy: {
    readonly callId: string;
  };
  readonly kind: "agent" | "tool" | (string & {});
  readonly name: string;
}
export type TaskEnded = Envelope<"task.ended", TaskEndedData>;
export type TaskFact = TaskStarted | TaskEnded;
export type TaskOutcome = "completed" | "failed" | "cancelled";
export type TaskStarted = Envelope<"task.started", TaskStartedData>;
```

### src/protocol/session-events/families/turn.d.ts

```ts
export interface TurnPausedData {
  readonly turnId: string;
  readonly awaiting: readonly {
    readonly interactionId: string;
  }[];
}
export interface TurnSettledData {
  readonly turnId: string;
  readonly outcome: TurnOutcome;
  readonly reply?: readonly string[];
  readonly cause?: Cause;
  readonly error?: ErrorInfo;
}
export interface TurnStartedData {
  readonly turnId: string;
  readonly cause: Cause;
  readonly follows: string | null;
  readonly trace?: TraceContext;
}
export type TurnFact = TurnStarted | TurnPaused | TurnSettled;
export type TurnOutcome = "completed" | "failed" | "cancelled";
export type TurnPaused = Envelope<"turn.paused", TurnPausedData>;
export type TurnSettled = Envelope<"turn.settled", TurnSettledData>;
export type TurnStarted = Envelope<"turn.started", TurnStartedData>;
```

### src/protocol/session-events/families/usage.d.ts

```ts
export interface UsageRecordedData {
  readonly owner?: UsageOwner;
  readonly kind: "model" | (string & {});
  readonly usage: Usage;
}
export type UsageFact = UsageRecorded;
export type UsageOwner =
  | {
      readonly runId: string;
    }
  | {
      readonly callId: string;
    }
  | {
      readonly changeId: string;
    };
export type UsageRecorded = Envelope<"usage.recorded", UsageRecordedData>;
```

### src/protocol/session-events/json.d.ts

```ts
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonArray = readonly JsonValue[];
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
```

### src/protocol/session-projection/request-status.d.ts

```ts
export type RequestStatus = "working" | "awaiting-input" | "completed" | "failed" | "cancelled";
```

### src/protocol/session-projection/tables.d.ts

```ts
export interface CallRow extends Introduced, Ended {
  readonly callId: string;
  readonly owner: CallOwner;
  readonly capability: Capability;
  readonly input?: JsonValue;
  readonly inputRef?: ValueReference;
  readonly inputError?: ErrorInfo;
  readonly status: "requested" | "running" | "settled";
  readonly clearedBy?: ClearedBy;
  readonly taskId?: string;
  readonly outcome?: CallOutcome;
  readonly output?: JsonValue;
  readonly outputRef?: ValueReference;
  readonly outputOf?: {
    readonly callId: string;
  };
  readonly error?: ErrorInfo;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly label?: string;
  readonly usage?: Usage;
}
export interface ChangeRow extends Introduced, Ended {
  readonly changeId: string;
  readonly kind: ContextKind;
  readonly turnId?: string;
  readonly cause?: Cause;
  readonly trigger?: {
    readonly inputTokens: number;
  };
  readonly status: "running" | "settled";
  readonly outcome?: ContextOutcome;
  readonly selects?: null | {
    readonly turnId: string;
  };
  readonly error?: ErrorInfo;
}
export interface ChildRow extends Introduced, ChildOpenedData {}
export interface DeliveryRow extends Introduced, Ended {
  readonly deliveryId: string;
  readonly principal?: Principal;
  readonly source?: DeliverySource;
  readonly clientContext?: JsonValue;
  readonly status: "admitted" | "consumed" | "settled";
  readonly turnId?: string;
  readonly consumedAt?: number;
  readonly parts?: readonly UserPart[];
  readonly outcome?: DeliveryOutcome;
  readonly reason?: string;
}
export interface Ended {
  readonly closedAt?: number;
  readonly endedAt?: string;
}
export interface InteractionRow extends Introduced, Ended {
  readonly interactionId: string;
  readonly subject: InteractionOpenedData["subject"];
  readonly request: InteractionOpenedData["request"];
  readonly origin?: InteractionOpenedData["origin"];
  readonly audience?: InteractionOpenedData["audience"];
  readonly status: "open" | "settled";
  readonly outcome?: InteractionOutcome;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly response?: {
    readonly [key: string]: JsonValue;
  };
}
export interface Introduced {
  readonly introducedAt: number;
  readonly startedAt: string;
}
export interface PartRow extends Introduced {
  readonly partId: string;
  readonly runId: string;
  readonly kind: ContentKind;
  readonly phase: ContentPhase;
  readonly value?: JsonValue;
  readonly valueRef?: ValueReference;
  readonly interrupted?: true;
  readonly mediaType?: string;
  readonly fallbackText?: string;
}
export interface ResponseRow extends Introduced, Ended {
  readonly responseId: string;
  readonly interactionId: string;
  readonly deliveryId: string;
  readonly value?: ResponseValue;
  readonly status: "submitted" | "admitted" | "settled";
  readonly outcome?: ResponseOutcome;
  readonly reason?: string;
}
export interface RunRow extends Introduced, Ended {
  readonly runId: string;
  readonly owner: ModelOwner;
  readonly status: "requested" | "running" | "settled";
  readonly step?: number;
  readonly modelId?: string;
  readonly attempt?: number;
  readonly outcome?: ModelOutcome;
  readonly finishReason?: string;
  readonly generationId?: string;
  readonly error?: ErrorInfo;
  readonly usage?: Usage;
}
export interface SessionRow extends Ended {
  readonly status: "new" | "open" | "ended";
  readonly startedAt?: string;
  readonly parent?: {
    readonly sessionId: string;
    readonly callId: string;
  };
  readonly runtime?: RuntimeIdentity;
  readonly outcome?: SessionOutcome;
  readonly cause?: Cause;
  readonly error?: ErrorInfo;
  readonly turnCount: number;
  readonly latestTurnId?: string;
}
export interface SessionView {
  readonly position: number;
  readonly session: SessionRow;
  readonly deliveries: Table<DeliveryRow>;
  readonly turns: Table<TurnRow>;
  readonly runs: Table<RunRow>;
  readonly parts: Table<PartRow>;
  readonly calls: Table<CallRow>;
  readonly tasks: Table<TaskRow>;
  readonly interactions: Table<InteractionRow>;
  readonly responses: Table<ResponseRow>;
  readonly children: Table<ChildRow>;
  readonly changes: Table<ChangeRow>;
  readonly usage: UsageTotals;
  readonly selection?: null | {
    readonly turnId: string;
  };
}
export interface TaskRow extends Introduced, Ended {
  readonly taskId: string;
  readonly startedBy: {
    readonly callId: string;
  };
  readonly kind: string;
  readonly name: string;
  readonly status: "running" | "ended";
  readonly outcome?: TaskOutcome;
  readonly reason?: string;
  readonly error?: ErrorInfo;
}
export interface TurnRow extends Introduced, Ended {
  readonly turnId: string;
  readonly cause: Cause;
  readonly follows: string | null;
  readonly status: "running" | "settled";
  readonly runs?: number;
  readonly reply?: readonly string[];
  readonly outcome?: TurnOutcome;
  readonly error?: ErrorInfo;
  readonly endedBy?: Cause;
}
export interface UsageTotals {
  readonly total: Usage;
  readonly byKind: {
    readonly [kind: string]: Usage;
  };
}
type Table<TRow> = {
  readonly [id: string]: TRow;
};
```

### src/protocol/session-reader.d.ts

```ts
export interface AskedCall {
  readonly callId: string;
  readonly name: string;
  readonly input?: JsonValue;
}
export interface Interaction extends InteractionPlace {
  readonly interactionId: string;
  readonly request: Omit<InteractionRequest, "signIn"> & {
    readonly signIn?: Omit<SignInChallenge, "callbackUrl">;
  };
  readonly call?: AskedCall;
  readonly status: "open" | "settled";
  readonly outcome?: InteractionOutcome;
  readonly reason?: string;
  readonly answer?: Answer;
}
export interface InteractionPlace {
  readonly turnId: string;
  readonly stepIndex: number;
  readonly taskId?: string;
}
```

### src/public/channels/attachment-error.d.ts

```ts
export declare function attachmentError(
  message: string,
  options?: {
    readonly cause?: unknown;
  },
): Error;
```

### src/public/channels/index.d.ts

```ts
export declare function isChannel<TChannel extends Channel<any, any, any>>(
  channel: ChannelInfo,
  target: TChannel,
): channel is ChannelInfo<InferChannelMetadata<TChannel>>;
export declare function isChannel<TChannel extends Channel<any, any, any>>(
  channel: {
    readonly kind?: string;
  },
  target: TChannel,
): channel is {
  readonly kind: `channel:${string}`;
};
```

### src/public/channels/upload-policy.d.ts

```ts
export interface UploadPolicyConfig {
  readonly maxBytes: number;
  readonly allowedMediaTypes: readonly string[] | "*";
}
export type UploadPolicyInput = "disabled" | Partial<UploadPolicyConfig>;
```

### src/public/definitions/channel.d.ts

```ts
declare const CHANNEL_METADATA_TYPE: unique symbol;
declare const DISABLED_ROUTE_SENTINEL_KIND = "eve:disabled-channel";
export declare function defineChannel<
  TState = undefined,
  TCtx = void,
  TReceiveTarget = Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  definition: ChannelDefinition<TState, TCtx, TReceiveTarget, TMetadata>,
): Channel<TState, TReceiveTarget, TMetadata>;
export declare function disableRoute(): DisabledRouteSentinel;
export declare function isDisabledRouteSentinel(value: unknown): value is DisabledRouteSentinel;
export interface Channel<
  TState = undefined,
  TReceiveTarget = Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends ChannelReference<TReceiveTarget> {
  readonly [CHANNEL_METADATA_TYPE]?: TMetadata;
  readonly routes: readonly RouteDefinition<TState>[];
  readonly cors?: ChannelCorsOptions;
  readonly receive?: (
    input: ReceiveInput<TReceiveTarget>,
    ctx: ChannelReceiveContext<TState>,
  ) => Promise<Delivery>;
  readonly turnPolicy?: TurnPolicy;
}
export interface ChannelContinuationOps {
  readonly continuation?: {
    readonly token: string;
    alias(token: string): void;
  };
}
export interface ChannelEventContext<TChannel = ChannelContinuationOps> extends SessionContext {
  readonly channel: TChannel;
  readonly position: FactPosition;
  readonly view: SessionView;
}
export interface DisabledRouteSentinel {
  readonly kind: typeof DISABLED_ROUTE_SENTINEL_KIND;
}
export type ChannelCommitHandler<TCtx = void> = (
  line: CommittedLine,
  ctx: ChannelEventContext<ChannelContext<TCtx>>,
) => void | Promise<void>;
export type ChannelDefinition<
  TState = undefined,
  TCtx = void,
  TReceiveTarget = Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = GenericChannelDefinition<ChannelEvents<TCtx>, TState, TCtx, TReceiveTarget, TMetadata>;
export type ChannelEventHandler<T extends SessionEvent["type"], TCtx = void> = (
  event: ChannelEventOf<T>,
  ctx: ChannelEventContext<ChannelContext<TCtx>>,
) => void | Promise<void>;
export type ChannelEventOf<T extends SessionEvent["type"]> = Extract<
  SessionEvent,
  {
    type: T;
  }
>;
export type ChannelEvents<TCtx = void> = {
  readonly [T in AuthoringEventType]?: ChannelEventHandler<T, TCtx>;
} & {
  readonly committed?: ChannelCommitHandler<TCtx>;
};
export type ChannelMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
export type InferChannelMetadata<TChannel> =
  TChannel extends Channel<any, any, infer TMetadata> ? TMetadata : Record<string, unknown>;
export type ReceiveInput<TReceiveTarget = Record<string, unknown>> =
  GenericReceiveInput<TReceiveTarget>;
type ChannelContext<TCtx> = TCtx & ChannelContinuationOps;
```

### src/shared/channel-audience.d.ts

```ts
export declare const CHANNEL_AUDIENCES: readonly ["public", "private", "unknown"];
export type ChannelAudience = (typeof CHANNEL_AUDIENCES)[number];
```

### src/shared/channel-definition.d.ts

```ts
export interface FetchFileContext {
  readonly state: Readonly<Record<string, unknown>>;
  readonly session: SessionHandle;
}
export interface FetchFileResult {
  readonly bytes: Buffer;
  readonly mediaType?: string;
  readonly filename?: string;
}
export interface GenericChannelDefinition<
  TEvents,
  TState = undefined,
  TCtx = void,
  TReceiveTarget = Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly turnPolicy?: TurnPolicy;
  deliver?(
    payload: ChannelDelivery<TState>,
    ctx: TCtx,
  ): ChannelDelivery<TState> | void | Promise<ChannelDelivery<TState> | void>;
  readonly state?: TState;
  readonly cors?: ChannelCors;
  context?(state: NonNullable<TState>, session: SessionHandle): TCtx;
  readonly routes: readonly RouteDefinition<TState>[];
  receive?(
    input: GenericReceiveInput<TReceiveTarget>,
    ctx: ChannelReceiveContext<TState>,
  ): Promise<Delivery>;
  readonly events?: TEvents;
  readonly fetchFile?: FetchFileFunction;
  readonly uploadPolicy?: UploadPolicyInput;
  readonly metadata?: (state: NonNullable<TState>) => TMetadata;
  readonly audience?: (input: AudienceContext<TState>) => ChannelAudience;
}
export interface GenericReceiveInput<TReceiveTarget = Record<string, unknown>> {
  readonly message: MessageContent;
  readonly target: Readonly<TReceiveTarget>;
  readonly auth: SessionAuthContext | null;
}
export type FetchFileFunction = (
  url: string,
  context?: FetchFileContext,
) => Promise<Buffer | FetchFileResult | null>;
```

### src/shared/channel-delivery.d.ts

```ts
export interface ChannelDelivery<TState = undefined> {
  readonly message?: MessageContent;
  readonly answers?: readonly Answer[];
  readonly context?: readonly string[];
  readonly outputSchema?: JsonObject;
  readonly state?: Partial<TState>;
}
```

### src/shared/channel-info.d.ts

```ts
export interface ChannelInfo<TMetadata = Readonly<Record<string, unknown>>> {
  readonly kind: ChannelKind;
  readonly continuationToken?: string;
  readonly metadata: TMetadata;
}
export type ChannelKind = `channel:${string}` | "http" | "schedule" | "subagent" | "unknown";
```

### src/shared/conversation-context.d.ts

```ts
export interface AudienceContext<TState> {
  readonly state: TState;
  readonly caller: AudienceCaller;
  readonly channel: ConversationContext["channel"];
  readonly environment: ConversationEnvironment;
}
export interface ConversationContext {
  readonly channel: {
    readonly kind: ChannelKind;
    readonly name?: string;
  };
  readonly audience: ChannelAudience;
  readonly environment: ConversationEnvironment;
  readonly principalType: string;
}
export type AudienceCaller =
  | {
      readonly type: "anonymous";
    }
  | {
      readonly type: "principal";
      readonly principal: {
        readonly kind: string;
        readonly authenticator: string;
        readonly attributes: Readonly<Record<string, string | readonly string[]>>;
      };
    };
export type ConversationEnvironment = "development" | "preview" | "production";
```

### src/shared/delivery.d.ts

```ts
export interface Delivery<TOutput = unknown> extends AsyncIterable<SessionStreamEvent> {
  readonly sessionId: string;
  readonly deliveryId: string;
  result(): Promise<DeliveryResult<TOutput>>;
}
export interface DeliveryResult<TOutput = unknown> {
  readonly deliveryId: string;
  readonly sessionId: string;
  readonly status: RequestStatus;
  readonly sessionEnded: boolean;
  readonly reply: string | undefined;
  readonly data: TOutput | undefined;
  readonly events: SessionStreamEvent[];
  readonly interactions: readonly Interaction[];
}
```

### src/shared/input.d.ts

```ts
declare const validatedAnswerBrand: unique symbol;
export type StrictAnswers<TAnswers extends readonly Answer[]> = TAnswers & {
  readonly [TIndex in keyof TAnswers]: TAnswers[TIndex] extends Answer
    ? StrictAnswer<TAnswers[TIndex]>
    : TAnswers[TIndex];
};
export type ValidatedAnswer = Answer & {
  readonly [validatedAnswerBrand]: true;
};
type IsWidenedAnswer<TAnswer extends Answer> = keyof TAnswer extends keyof Answer
  ? keyof Answer extends keyof TAnswer
    ? Answer extends TAnswer
      ? true
      : false
    : false
  : false;
type StrictAnswer<TAnswer extends Answer> = TAnswer extends ValidatedAnswer
  ? TAnswer
  : IsWidenedAnswer<TAnswer> extends true
    ? never
    : TAnswer & {
        readonly [TKey in Exclude<keyof TAnswer, keyof Answer>]: never;
      };
```

### src/shared/message-content.d.ts

```ts
export interface MessageFilePart<
  TData extends Uint8Array | ArrayBuffer | string | URL = Uint8Array | ArrayBuffer | string | URL,
> {
  readonly type: "file";
  readonly mediaType: string;
  readonly filename?: string;
  readonly data: TData;
}
export interface MessageTextPart {
  readonly type: "text";
  readonly text: string;
}
export type MessageContent<TData extends MessageFilePart["data"] = MessageFilePart["data"]> =
  string | readonly MessagePart<TData>[];
export type MessagePart<TData extends MessageFilePart["data"] = MessageFilePart["data"]> =
  MessageTextPart | MessageFilePart<TData>;
```

### src/shared/sandbox-environment.d.ts

```ts
declare const CONFIGURATION_HASH: unique symbol;
declare const ENVIRONMENT: unique symbol;
declare const PROVIDER_RUNTIME: unique symbol;
export interface SandboxEnvironment<
  Options extends object | undefined = object,
  Session extends SandboxSession = SandboxSession,
> extends SandboxEnvironmentIdentity {
  open(...args: SandboxOpenArguments<Options>): Promise<RuntimeSandboxSession<Session>>;
}
export interface SandboxEnvironmentIdentity {
  readonly [CONFIGURATION_HASH]: string;
  readonly [ENVIRONMENT]: true;
  readonly [PROVIDER_RUNTIME]: SandboxProviderRuntime;
  readonly provider: string;
}
export interface SandboxSelectorContext {
  readonly session: {
    readonly auth: SessionAuth;
    readonly id: string;
    readonly parent?: SessionParent;
    readonly turn: SessionTurn;
  };
}
export type SandboxOpenArguments<Options> = Options extends undefined
  ? []
  : Record<never, never> extends Options
    ? [options?: Options]
    : [options: Options];
```

### src/shared/sandbox-provider.d.ts

```ts
export interface SandboxDeleteOptions {
  readonly signal?: AbortSignal;
}
export interface SandboxProviderFiles {
  list(): Promise<readonly string[]>;
  read(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
}
export interface SandboxProviderHandle<Session extends SandboxSession = SandboxSession> {
  readonly sandbox: Session;
  onRuntimeShutdown(): Promise<void>;
  onSandboxDelete(options?: SandboxDeleteOptions): Promise<void>;
  onSandboxStop(): Promise<void>;
}
export interface SandboxProviderHost {
  loadOptionalPackage<T>(input: {
    readonly autoInstall: boolean;
    readonly importModule: () => Promise<T>;
    readonly installPackageName?: string;
    readonly ignoredOptionalDependencies?: readonly string[];
    readonly missingMessage: string;
    readonly packageName: string;
  }): Promise<T>;
  resolveProjectPath(path: string): string;
}
export interface SandboxProviderImplementation<
  OpenOptions extends object | undefined,
  PreparedArtifact extends SandboxPreparedArtifact,
  SessionState,
  Session extends SandboxSession = SandboxSession,
> {
  onSessionEnd?(
    context: SandboxProviderSessionContext,
    artifact: Readonly<PreparedArtifact>,
    state: Readonly<SessionState>,
    options: {
      readonly reason: "completed" | "expired" | "failed";
    },
  ): Promise<void>;
  prepare(context: SandboxProviderPrepareContext): Promise<PreparedArtifact>;
  resume(
    context: SandboxProviderSessionContext,
    artifact: Readonly<PreparedArtifact>,
    state: Readonly<SessionState>,
  ): Promise<SandboxProviderHandle<Session>>;
  start(
    context: SandboxProviderSessionContext,
    options: Readonly<OpenOptions> | undefined,
    artifact: Readonly<PreparedArtifact>,
  ): Promise<{
    readonly handle: SandboxProviderHandle<Session>;
    readonly state: SessionState;
  }>;
}
export interface SandboxProviderPrepareContext {
  readonly files: SandboxProviderFiles;
  readonly host: SandboxProviderHost;
  readonly log?: (message: string) => void;
  readonly resources: SandboxProviderResources;
  readonly sourceRevision: string;
  readonly storagePath: string;
}
export interface SandboxProviderResourceFile {
  readonly content: string | Uint8Array;
  readonly relativePath: string;
}
export interface SandboxProviderResourceTree {
  readonly files: readonly SandboxProviderResourceFile[];
  readonly key: string;
  readonly mountPath: string;
  readonly targetPath: string;
}
export interface SandboxProviderResources {
  readonly skills?: SandboxProviderResourceTree;
  readonly source: SandboxProviderResourceSource;
  readonly workspace?: SandboxProviderResourceTree;
}
export interface SandboxProviderRuntime {
  readonly implementation: ErasedSandboxProviderImplementation;
  readonly providerName: string;
  readonly stateProtocolVersion: number;
}
export interface SandboxProviderSessionContext {
  readonly host: SandboxProviderHost;
  readonly session: SandboxSelectorContext["session"];
  readonly storagePath: string;
}
export type SandboxPreparedArtifact =
  | null
  | boolean
  | number
  | string
  | readonly SandboxPreparedArtifact[]
  | {
      readonly [key: string]: SandboxPreparedArtifact;
    };
export type SandboxProviderResourceSource =
  | {
      readonly kind: "none";
    }
  | {
      readonly key: string;
      readonly kind: "inline";
    }
  | {
      readonly key: string;
      readonly kind: "materialized";
      readonly path: string;
    };
type ErasedSandboxProviderImplementation = SandboxProviderImplementation<
  object | undefined,
  SandboxPreparedArtifact,
  SandboxPreparedArtifact,
  SandboxSession
>;
```

### src/shared/sandbox-session.d.ts

```ts
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
export interface SandboxProcess {
  readonly pid?: number;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly stderr: ReadableStream<Uint8Array>;
  wait(): PromiseLike<{
    exitCode: number;
  }>;
  kill(): PromiseLike<void>;
}
export interface SandboxReadBinaryFileOptions extends SandboxReadFileOptions {}
export interface SandboxReadFileOptions {
  path: string;
  signal?: AbortSignal;
}
export interface SandboxReadTextFileOptions extends SandboxReadFileOptions {
  encoding?: string;
  startLine?: number;
  endLine?: number;
}
export interface SandboxRemovePathOptions {
  readonly signal?: AbortSignal;
  readonly force?: boolean;
  readonly path: string;
  readonly recursive?: boolean;
}
export interface SandboxRunOptions {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
}
export interface SandboxSession {
  readonly run: (options: SandboxRunOptions) => PromiseLike<SandboxCommandResult>;
  readonly spawn: (options: SandboxSpawnOptions) => PromiseLike<SandboxProcess>;
  readonly readFile: (
    options: SandboxReadFileOptions,
  ) => PromiseLike<ReadableStream<Uint8Array> | null>;
  readonly readBinaryFile: (
    options: SandboxReadBinaryFileOptions,
  ) => PromiseLike<Uint8Array | null>;
  readonly readTextFile: (options: SandboxReadTextFileOptions) => PromiseLike<string | null>;
  readonly writeFile: (options: SandboxWriteFileOptions) => PromiseLike<void>;
  readonly writeBinaryFile: (options: SandboxWriteBinaryFileOptions) => PromiseLike<void>;
  readonly writeTextFile: (options: SandboxWriteTextFileOptions) => PromiseLike<void>;
  resolvePath(path: string): string;
  removePath(options: SandboxRemovePathOptions): Promise<void>;
}
export interface SandboxSpawnOptions extends SandboxRunOptions {}
export interface SandboxWriteBinaryFileOptions extends WriteOptions<Uint8Array> {}
export interface SandboxWriteFileOptions extends WriteOptions<ReadableStream<Uint8Array>> {}
export interface SandboxWriteTextFileOptions extends WriteOptions<string> {
  encoding?: string;
}
export type RuntimeSandboxSession<Session extends SandboxSession = SandboxSession> = Session & {
  delete(options?: SandboxDeleteOptions): Promise<void>;
  stop(): Promise<void>;
};
interface WriteOptions<T> {
  path: string;
  content: T;
  signal?: AbortSignal;
}
```

### src/shared/session.d.ts

```ts
export interface SessionOperations<
  TSendOptions = SessionSendOptions,
  TRespondOptions = SessionRespondOptions,
  TControlOptions = SessionControlOptions,
> extends SessionReader {
  send(message: MessageContent, options: TSendOptions): Promise<Delivery>;
  respond<const TAnswers extends readonly Answer[]>(
    answers: StrictAnswers<TAnswers>,
    options: TRespondOptions,
  ): Promise<Delivery>;
  cancel(
    options?: TControlOptions & {
      readonly turnId?: string | null;
    },
  ): Promise<Delivery>;
  clear(options?: TControlOptions): Promise<Delivery>;
  compact(options?: TControlOptions): Promise<Delivery>;
  reset(
    options?: TControlOptions & {
      readonly reason?: string;
    },
  ): Promise<Delivery>;
}
export interface SessionReader {
  readonly id: string;
  stream(options?: SessionStreamOptions): AsyncIterable<SessionStreamEvent>;
}
export interface SessionStreamOptions {
  readonly startIndex?: number;
  readonly follow?: boolean;
  readonly signal?: AbortSignal;
  readonly streamReconnectPolicy?: StreamReconnectPolicy;
}
```

### src/tools/model-output.d.ts

```ts
export type ToolModelOutput =
  | {
      readonly type: "text";
      readonly value: string;
    }
  | {
      readonly type: "json";
      readonly value: unknown;
    }
  | {
      readonly type: "content";
      readonly value: readonly ToolModelOutputPart[];
    };
export type ToolModelOutputPart =
  | {
      readonly type: "text";
      readonly text: string;
    }
  | {
      readonly type: "file";
      readonly data: {
        readonly type: "data";
        readonly data: string;
      };
      readonly mediaType: string;
      readonly filename?: string;
    };
```
