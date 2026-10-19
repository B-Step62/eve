# eve/channels/github

## Export names

- GitHubApiError: src/public/channels/github/api.d.ts#GitHubApiError
- GitHubApiMethod: src/public/channels/github/api.d.ts#GitHubApiMethod
- GitHubApiOptions: src/public/channels/github/api.d.ts#GitHubApiOptions
- GitHubApiResponse: src/public/channels/github/api.d.ts#GitHubApiResponse
- GitHubAppId: src/public/channels/github/auth.d.ts#GitHubAppId
- GitHubAppRef: src/public/channels/github/inbound-types.d.ts#GitHubAppRef
- GitHubBotName: src/public/channels/github/auth.d.ts#GitHubBotName
- GitHubChannel: src/public/channels/github/githubChannel.d.ts#GitHubChannel
- GitHubChannelConfig: src/public/channels/github/githubChannel.d.ts#GitHubChannelConfig
- GitHubChannelContext: src/public/channels/github/githubChannel.d.ts#GitHubChannelContext
- GitHubChannelCredentials: src/public/channels/github/auth.d.ts#GitHubChannelCredentials
- GitHubChannelEvents: src/public/channels/github/githubChannel.d.ts#GitHubChannelEvents
- GitHubChannelState: src/public/channels/github/state.d.ts#GitHubChannelState
- GitHubCheckRunEvent: src/public/channels/github/inbound-types.d.ts#GitHubCheckRunEvent
- GitHubCheckSuiteEvent: src/public/channels/github/inbound-types.d.ts#GitHubCheckSuiteEvent
- GitHubCiEvent: src/public/channels/github/inbound-types.d.ts#GitHubCiEvent
- GitHubCiPayload: src/public/channels/github/inbound-types.d.ts#GitHubCiPayload
- GitHubComment: src/public/channels/github/inbound-types.d.ts#GitHubComment
- GitHubConversationKind: src/public/channels/github/inbound-types.d.ts#GitHubConversationKind
- GitHubConversationRef: src/public/channels/github/inbound-types.d.ts#GitHubConversationRef
- GitHubDelivery: src/public/channels/github/inbound-types.d.ts#GitHubDelivery
- GitHubEventContext: src/public/channels/github/githubChannel.d.ts#GitHubEventContext
- GitHubHandle: src/public/channels/github/binding.d.ts#GitHubHandle
- GitHubInboundContext: src/public/channels/github/githubChannel.d.ts#GitHubInboundContext
- GitHubInboundResult: src/public/channels/github/githubChannel.d.ts#GitHubInboundResult
- GitHubInstallationToken: src/public/channels/github/auth.d.ts#GitHubInstallationToken
- GitHubIssueAction: src/public/channels/github/inbound-types.d.ts#GitHubIssueAction
- GitHubIssueEvent: src/public/channels/github/inbound-types.d.ts#GitHubIssueEvent
- GitHubJsonObject: src/public/channels/github/api.d.ts#GitHubJsonObject
- GitHubPostedComment: src/public/channels/github/api.d.ts#GitHubPostedComment
- GitHubPrivateKey: src/public/channels/github/auth.d.ts#GitHubPrivateKey
- GitHubProgressConfig: src/public/channels/github/githubChannel.d.ts#GitHubProgressConfig
- GitHubPullRequestAction: src/public/channels/github/inbound-types.d.ts#GitHubPullRequestAction
- GitHubPullRequestContextConfig: src/public/channels/github/pr-context.d.ts#GitHubPullRequestContextConfig
- GitHubPullRequestEvent: src/public/channels/github/inbound-types.d.ts#GitHubPullRequestEvent
- GitHubReactionContent: src/public/channels/github/api.d.ts#GitHubReactionContent
- GitHubReceiveTarget: src/public/channels/github/githubChannel.d.ts#GitHubReceiveTarget
- GitHubRepositoryRef: src/public/channels/github/inbound-types.d.ts#GitHubRepositoryRef
- GitHubThread: src/public/channels/github/binding.d.ts#GitHubThread
- GitHubUser: src/public/channels/github/inbound-types.d.ts#GitHubUser
- GitHubWebhookSecret: src/public/channels/github/auth.d.ts#GitHubWebhookSecret
- GitHubWebhookVerifier: src/public/channels/github/verify.d.ts#GitHubWebhookVerifier
- GitHubWorkflowRunEvent: src/public/channels/github/inbound-types.d.ts#GitHubWorkflowRunEvent
- defaultGitHubAuth: src/public/channels/github/defaults.d.ts#defaultGitHubAuth
- githubChannel: src/public/channels/github/githubChannel.d.ts#githubChannel
- githubContinuationToken: src/public/channels/github/inbound.d.ts#githubContinuationToken

## Peer boundaries

## Declaration closure

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

### src/channel/prompt-queue.d.ts

```ts
export interface PromptQueueState {
  shownPromptId?: string;
}
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

### src/channel/routes.d.ts

```ts
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

### src/channel/session.d.ts

```ts
export interface Session extends SessionReader {
  send(message: MessageContent, options: SessionSendOptions): Promise<Delivery>;
  respond<const TAnswers extends readonly Answer[]>(
    answers: StrictAnswers<TAnswers>,
    options: SessionRespondOptions,
  ): Promise<Delivery>;
  cancel(
    options?: SessionControlOptions & {
      readonly turnId?: string | null;
    },
  ): Promise<Delivery>;
  clear(options?: SessionControlOptions): Promise<Delivery>;
  compact(options?: SessionControlOptions): Promise<Delivery>;
  reset(
    options?: SessionControlOptions & {
      readonly reason?: string;
    },
  ): Promise<Delivery>;
  stream(options?: SessionStreamOptions): AsyncIterable<SessionStreamEvent>;
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

### src/protocol/session-projection/reader.d.ts

```ts
export interface AskedCall {
  readonly callId: string;
  readonly name: string;
  readonly input?: JsonValue;
}
export interface Interaction {
  readonly interactionId: string;
  readonly turnId: string;
  readonly stepIndex: number;
  readonly taskId?: string;
  readonly request: Omit<InteractionRequest, "signIn"> & {
    readonly signIn?: Omit<SignInChallenge, "callbackUrl">;
  };
  readonly call?: AskedCall;
  readonly status: "open" | "settled";
  readonly outcome?: InteractionOutcome;
  readonly reason?: string;
  readonly answer?: Answer;
}
```

### src/protocol/session-projection/request-status.d.ts

```ts
export type RequestStatus = "working" | "awaiting-input" | "completed" | "failed" | "cancelled";
```

### src/protocol/session-projection/session-view.d.ts

```ts
declare const sessionViewBrand: unique symbol;
export interface SessionView {
  readonly [sessionViewBrand]: true;
}
```

### src/public/channels/github/api.d.ts

```ts
export declare class GitHubApiError extends Error {
  readonly body: unknown;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  constructor(input: {
    readonly body: unknown;
    readonly method: string;
    readonly path: string;
    readonly status: number;
  });
}
export interface GitHubApiOptions extends GitHubAuthApiOptions {}
export interface GitHubApiResponse<T = unknown> {
  readonly body: T;
  readonly ok: boolean;
  readonly status: number;
}
export interface GitHubPostedComment {
  readonly htmlUrl: string | undefined;
  readonly id: number;
  readonly raw: unknown;
  readonly url: string | undefined;
}
export type GitHubApiMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type GitHubJsonObject = JsonObject;
export type GitHubReactionContent =
  "+1" | "-1" | "confused" | "eyes" | "heart" | "hooray" | "laugh" | "rocket";
```

### src/public/channels/github/auth.d.ts

```ts
export interface GitHubAuthApiOptions {
  readonly apiBaseUrl?: string;
  readonly fetch?: typeof fetch;
}
export interface GitHubChannelCredentials {
  readonly appId?: GitHubAppId;
  readonly privateKey?: GitHubPrivateKey;
  readonly webhookSecret?: GitHubWebhookSecret;
  readonly appSlug?: GitHubBotName;
  readonly installationToken?: GitHubInstallationToken;
  readonly webhookVerifier?: GitHubWebhookVerifier;
}
export type GitHubAppId = number | string | (() => number | string | Promise<number | string>);
export type GitHubBotName = string | (() => string | Promise<string>);
export type GitHubInstallationToken = string | (() => string | Promise<string>);
export type GitHubPrivateKey = string | (() => string | Promise<string>);
export type GitHubWebhookSecret = string | (() => string | Promise<string>);
```

### src/public/channels/github/binding.d.ts

```ts
export interface GitHubHandle {
  readonly installationId: number | undefined;
  readonly repository: GitHubRepositoryRef;
  request<T = unknown>(input: {
    readonly body?: GitHubJsonObject;
    readonly method: GitHubApiMethod;
    readonly path: string;
  }): Promise<GitHubApiResponse<T>>;
}
export interface GitHubThread {
  readonly kind: GitHubConversationKind;
  post(message: string): Promise<GitHubPostedComment>;
  react(content: GitHubReactionContent): Promise<void>;
}
```

### src/public/channels/github/defaults.d.ts

```ts
export declare function defaultGitHubAuth(ctx: GitHubInboundContext): SessionAuthContext;
```

### src/public/channels/github/githubChannel.d.ts

```ts
export declare function githubChannel(config?: GitHubChannelConfig): GitHubChannel;
export interface GitHubChannel extends Channel<GitHubChannelState, GitHubReceiveTarget> {}
export interface GitHubChannelConfig {
  readonly api?: GitHubApiOptions;
  readonly botName?: GitHubBotName;
  readonly credentials?: GitHubChannelCredentials;
  readonly events?: GitHubChannelEvents;
  readonly progress?: GitHubProgressConfig;
  readonly pullRequestContext?: GitHubPullRequestContextConfig;
  readonly route?: string;
  readonly turnPolicy?: TurnPolicy;
  onComment?(
    ctx: GitHubInboundContext,
    comment: GitHubComment,
  ): GitHubInboundResult | Promise<GitHubInboundResult>;
  onCheckSuite?(
    ctx: GitHubInboundContext,
    checkSuite: GitHubCheckSuiteEvent,
  ): GitHubInboundResult | Promise<GitHubInboundResult>;
  onCheckRun?(
    ctx: GitHubInboundContext,
    checkRun: GitHubCheckRunEvent,
  ): GitHubInboundResult | Promise<GitHubInboundResult>;
  onIssue?(
    ctx: GitHubInboundContext,
    issue: GitHubIssueEvent,
  ): GitHubInboundResult | Promise<GitHubInboundResult>;
  onPullRequest?(
    ctx: GitHubInboundContext,
    pullRequest: GitHubPullRequestEvent,
  ): GitHubInboundResult | Promise<GitHubInboundResult>;
  onWorkflowRun?(
    ctx: GitHubInboundContext,
    workflowRun: GitHubWorkflowRunEvent,
  ): GitHubInboundResult | Promise<GitHubInboundResult>;
}
export interface GitHubChannelContext {
  readonly conversation: GitHubConversationRef;
  readonly github: GitHubHandle;
  readonly repository: GitHubRepositoryRef;
  readonly thread: GitHubThread;
  state: GitHubChannelState;
}
export interface GitHubChannelEvents {
  readonly "call.progress"?: GitHubEventHandler<"call.progress">;
  readonly "call.settled"?: GitHubEventHandler<"call.settled">;
  readonly "call.requested"?: GitHubEventHandler<"call.requested">;
  readonly "interaction.opened"?: GitHubEventHandler<"interaction.opened">;
  readonly "interaction.settled"?: GitHubEventHandler<"interaction.settled">;
  readonly "response.admitted"?: GitHubEventHandler<"response.admitted">;
  readonly "content.delta"?: GitHubEventHandler<"content.delta">;
  readonly "content.completed"?: GitHubEventHandler<"content.completed">;
  readonly "session.ended"?: GitHubEventHandler<"session.ended">;
  readonly "delivery.settled"?: GitHubEventHandler<"delivery.settled">;
  readonly "turn.settled"?: GitHubEventHandler<"turn.settled">;
  readonly "turn.started"?: GitHubEventHandler<"turn.started">;
}
export interface GitHubEventContext extends GitHubChannelContext, ChannelContinuationOps {}
export interface GitHubInboundContext {
  readonly conversation: GitHubConversationRef;
  readonly delivery: GitHubDelivery;
  readonly github: GitHubHandle;
  readonly repository: GitHubRepositoryRef;
  readonly sender: GitHubUser;
  readonly thread: GitHubThread;
}
export interface GitHubProgressConfig {
  readonly reactions?: boolean;
}
export interface GitHubReceiveTarget {
  readonly initialMessage?: string;
  readonly installationId?: number;
  readonly issueNumber?: number;
  readonly owner: string;
  readonly pullRequestNumber?: number;
  readonly repositoryId?: number;
  readonly repo: string;
}
export type GitHubInboundResult = {
  readonly auth: SessionAuthContext | null;
  readonly context?: readonly string[];
  readonly title?: string;
} | null;
type GitHubEventHandler<T extends SessionEvent["type"]> = (
  event: ChannelEventOf<T>,
  ctx: ChannelEventContext<GitHubEventContext>,
) => void | Promise<void>;
```

### src/public/channels/github/inbound-types.d.ts

```ts
export interface GitHubAppRef {
  readonly slug: string | null;
}
export interface GitHubCheckRunEvent extends GitHubCiEvent {
  readonly checkRunId: number;
}
export interface GitHubCheckSuiteEvent extends GitHubCiEvent {
  readonly checkSuiteId: number;
}
export interface GitHubCiEvent {
  readonly action: string;
  readonly app: GitHubAppRef;
  readonly conclusion: string | null;
  readonly headSha: string | null;
  readonly pullRequests: readonly number[];
  readonly raw: JsonObject;
  readonly status: string | null;
}
export interface GitHubComment {
  readonly author: GitHubUser | undefined;
  readonly body: string;
  readonly htmlUrl: string | undefined;
  readonly id: number;
  readonly raw: JsonObject;
  readonly url: string | undefined;
}
export interface GitHubConversationRef {
  readonly issueNumber: number | null;
  readonly kind: GitHubConversationKind;
  readonly pullRequestNumber: number | null;
}
export interface GitHubDelivery {
  readonly event: string;
  readonly hookId: string | undefined;
  readonly id: string;
}
export interface GitHubIssueEvent {
  readonly action: GitHubIssueAction;
  readonly issueNumber: number;
  readonly raw: JsonObject;
}
export interface GitHubPullRequestEvent {
  readonly action: GitHubPullRequestAction;
  readonly headSha: string | null;
  readonly pullRequestNumber: number;
  readonly raw: JsonObject;
}
export interface GitHubRepositoryRef {
  readonly fullName: string;
  readonly id: number;
  readonly name: string;
  readonly owner: string;
  readonly private: boolean;
}
export interface GitHubUser {
  readonly htmlUrl: string | undefined;
  readonly id: number;
  readonly login: string;
  readonly type: string;
  readonly url: string | undefined;
}
export interface GitHubWorkflowRunEvent extends GitHubCiEvent {
  readonly workflowRunId: number;
}
export type GitHubCiPayload = GitHubCheckRunEvent | GitHubCheckSuiteEvent | GitHubWorkflowRunEvent;
export type GitHubConversationKind = "issue" | "pull_request" | "review_thread";
export type GitHubIssueAction =
  | "assigned"
  | "closed"
  | "edited"
  | "labeled"
  | "opened"
  | "reopened"
  | "unassigned"
  | "unlabeled"
  | (string & {});
export type GitHubPullRequestAction =
  | "closed"
  | "edited"
  | "labeled"
  | "opened"
  | "ready_for_review"
  | "reopened"
  | "synchronize"
  | "unlabeled"
  | (string & {});
```

### src/public/channels/github/inbound.d.ts

```ts
export declare function githubContinuationToken(input: {
  readonly conversationKind: GitHubConversationKind;
  readonly issueNumber?: number | null;
  readonly pullRequestNumber?: number | null;
  readonly repositoryId: number;
  readonly reviewThreadRootCommentId?: number | null;
}): string;
```

### src/public/channels/github/pr-context.d.ts

```ts
export interface GitHubPullRequestContextConfig {
  readonly excludedFiles?: readonly string[];
}
```

### src/public/channels/github/state.d.ts

```ts
export interface GitHubChannelState extends PromptQueueState {
  baseRef: string | null;
  baseSha: string | null;
  checkoutPath: string | null;
  conversationKind: GitHubConversationKind;
  defaultBranch: string | null;
  headRef: string | null;
  headSha: string | null;
  installationId: number | null;
  issueNumber: number | null;
  owner: string;
  pullRequestNumber: number | null;
  repo: string;
  repositoryId: number;
  reviewCommentId: number | null;
  reviewThreadRootCommentId: number | null;
  triggeringCommentId: number | null;
  triggeringUserLogin: string | null;
  pendingSignIns?: Record<string, string>;
}
```

### src/public/channels/github/verify.d.ts

```ts
export type GitHubWebhookVerifier = (request: Request, body: string) => unknown | Promise<unknown>;
```

### src/public/definitions/channel.d.ts

```ts
declare const CHANNEL_METADATA_TYPE: unique symbol;
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
export interface ChannelEventContext<TChannel = ChannelContinuationOps> extends SessionContext {
  readonly channel: TChannel;
  readonly position: FactPosition;
  readonly view: SessionView;
}
export type ChannelEventOf<T extends SessionEvent["type"]> = Extract<
  SessionEvent,
  {
    type: T;
  }
>;
export type ChannelMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
export type ReceiveInput<TReceiveTarget = Record<string, unknown>> =
  GenericReceiveInput<TReceiveTarget>;
```

### src/shared/channel-context.d.ts

```ts
export interface ChannelContinuationOps {
  readonly continuation?: {
    readonly token: string;
    alias(token: string): void;
  };
}
```

### src/shared/channel-definition.d.ts

```ts
export interface GenericReceiveInput<TReceiveTarget = Record<string, unknown>> {
  readonly message: MessageContent;
  readonly target: Readonly<TReceiveTarget>;
  readonly auth: SessionAuthContext | null;
}
```

### src/shared/delivery.d.ts

```ts
export interface Delivery<TOutput = unknown> {
  readonly sessionId: string;
  readonly deliveryId: string;
  stream(options?: DeliveryReadOptions): AsyncIterable<SessionStreamEvent>;
  result(options?: DeliveryReadOptions): Promise<DeliveryResult<TOutput>>;
}
export interface DeliveryReadOptions {
  readonly signal?: AbortSignal;
}
export type DeliveryResult<TOutput = unknown> = {
  readonly deliveryId: string;
  readonly sessionId: string;
  readonly outcome: DeliveryOutcome;
  readonly sessionEnded: boolean;
  readonly reply: string | undefined;
  readonly data: TOutput | undefined;
  readonly interactions: readonly Interaction[];
} & (
  | {
      readonly status: Exclude<RequestStatus, "working" | "failed">;
      readonly error?: never;
    }
  | {
      readonly status: "failed";
      readonly error: ErrorInfo;
    }
);
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
