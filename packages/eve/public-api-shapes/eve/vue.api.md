# eve/vue

## Export names

- AgentObservation: src/client/conversation-state.d.ts#AgentObservation
- AskedCall: src/protocol/session-reader.d.ts#AskedCall
- ConversationAgentSession: src/client/conversation-state.d.ts#ConversationAgentSession
- ConversationState: src/client/conversation-state.d.ts#ConversationState
- Delivery: src/shared/delivery.d.ts#Delivery
- DeliveryResult: src/shared/delivery.d.ts#DeliveryResult
- EveInteractionPart: src/client/message-types.d.ts#EveInteractionPart
- EveMessage: src/client/message-types.d.ts#EveMessage
- EveMessageMetadata: src/client/message-types.d.ts#EveMessageMetadata
- EveMessagePart: src/client/message-types.d.ts#EveMessagePart
- EveToolPart: src/client/message-types.d.ts#EveToolPart
- Interaction: src/protocol/session-reader.d.ts#Interaction
- PrepareSend: src/client/eve-agent-store-state.d.ts#PrepareSend
- UseEveAgentOptions: src/vue/use-eve-agent.d.ts#UseEveAgentOptions
- UseEveAgentReturn: src/vue/use-eve-agent.d.ts#UseEveAgentReturn
- UseEveAgentSnapshot: src/vue/use-eve-agent.d.ts#UseEveAgentSnapshot
- UseEveAgentStatus: src/vue/use-eve-agent.d.ts#UseEveAgentStatus
- signInEnding: src/protocol/session-reader.d.ts#signInEnding
- useEveAgent: src/vue/use-eve-agent.d.ts#useEveAgent

## Peer boundaries

- @vue/reactivity/dist/reactivity.d.ts#ComputedRef

## Declaration closure

### src/channel/session.d.ts

```ts
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
export type TurnPolicy = "steer" | "queue";
```

### src/client/agent-session.d.ts

```ts
export declare class ClientAgentSession implements SessionReader {
  #private;
  readonly name: string;
  readonly id: string;
  readonly taskId: string | undefined;
  constructor(context: ClientSessionContext, opened: ChildOpened);
  stream(options?: SessionStreamOptions): AsyncGenerator<SessionStreamEvent>;
  follow(options?: SessionStreamOptions): AsyncIterable<FollowedEvent>;
}
```

### src/client/conversation-state.d.ts

```ts
export interface ConversationAgentSession {
  readonly sessionId: string;
  readonly name: string;
  readonly callId: string;
  readonly turnId: string;
  readonly taskId?: string;
  readonly observation: AgentObservation;
}
export interface ConversationState {
  readonly view: SessionView;
  readonly previews: SessionPreviews;
  readonly messages: readonly EveMessage[];
  readonly agents: Readonly<Record<string, ConversationAgentSession>>;
}
export type AgentObservation =
  | {
      readonly status: "not-followed";
    }
  | {
      readonly status: "following" | "idle";
      readonly conversation: ConversationState;
    }
  | {
      readonly status: "unavailable";
      readonly conversation?: ConversationState;
    };
```

### src/client/eve-agent-store-state.d.ts

```ts
export interface EveAgentStoreCallbacks {
  readonly onError?: (error: Error) => void;
  readonly onEvent?: (event: SessionStreamEvent) => void;
  readonly onFinish?: (snapshot: EveAgentStoreSnapshot) => void;
  readonly onSessionChange?: (session: ClientSessionState | undefined) => void;
  readonly prepareSend?: PrepareSend;
}
export interface EveAgentStoreSnapshot extends ConversationState {
  readonly view: SessionView;
  readonly error: Error | undefined;
  readonly events: readonly SessionStreamEvent[];
  readonly session: ClientSessionState | undefined;
  readonly status: EveAgentStoreStatus;
}
export type EveAgentStoreStatus = "idle" | "busy" | "resuming";
export type PrepareSend = (input: SendTurnPayload) => SendTurnPayload | Promise<SendTurnPayload>;
```

### src/client/message-types.d.ts

```ts
export interface EveMessage {
  readonly id: string;
  readonly metadata?: EveMessageMetadata;
  readonly parts: readonly EveMessagePart[];
  readonly role: "assistant" | "user";
}
export interface EveMessageMetadata {
  readonly optimistic?: true;
  readonly result?: unknown;
  readonly status?: "complete" | "failed" | "streaming" | "submitted";
  readonly turnId?: string;
}
export type EveInteractionPart = Interaction & {
  readonly type: "interaction";
};
export type EveMessagePart =
  | {
      readonly id?: string;
      readonly state?: "done" | "streaming";
      readonly stepIndex?: number;
      readonly text: string;
      readonly type: "text";
    }
  | {
      readonly id?: string;
      readonly state?: "done" | "streaming";
      readonly stepIndex?: number;
      readonly text: string;
      readonly type: "reasoning";
    }
  | {
      readonly filename?: string;
      readonly mediaType: string;
      readonly size?: number;
      readonly stepIndex?: number;
      readonly type: "file";
      readonly url?: string;
    }
  | EveInteractionPart
  | EveToolPart;
export type EveToolPart = {
  readonly type: "tool";
  readonly callId: string;
  readonly stepIndex: number;
  readonly kind: CapabilityKind;
  readonly name: string;
  readonly label: string;
  readonly interaction?: Interaction;
} & (
  | {
      readonly state: "streaming";
      readonly inputText: string;
      readonly input?: never;
      readonly output?: never;
      readonly error?: never;
    }
  | {
      readonly state: CallState;
      readonly inputText?: never;
      readonly input?: unknown;
      readonly output?: unknown;
      readonly error?: ErrorInfo;
    }
);
```

### src/client/open-stream.d.ts

```ts
export interface FollowedEvent {
  readonly event: SessionStreamEvent;
  readonly cursor: number;
}
```

### src/client/session.d.ts

```ts
declare const followSession: unique symbol;
export declare class ClientSession implements SessionOperations<
  SendTurnOptions,
  RespondTurnOptions,
  {
    readonly signal?: AbortSignal;
  }
> {
  #private;
  constructor(context: ClientSessionContext, state: ClientSessionState);
  static create<TOutput = unknown>(
    context: ClientSessionContext,
    input: SendTurnInput<TOutput> & CreateSessionOptions,
  ): Promise<{
    readonly response: Delivery<TOutput>;
    readonly session: ClientSession;
  }>;
  static prewarm(
    context: ClientSessionContext,
    options?: CreateSessionOptions,
  ): Promise<ClientSession>;
  get id(): string;
  get state(): ClientSessionState;
  snapshot(options?: { readonly signal?: AbortSignal }): Promise<SessionSnapshot>;
  send<TOutput = unknown>(
    message: SendTurnInput<TOutput>["message"],
    options?: SendTurnOptions<TOutput>,
  ): Promise<Delivery<TOutput>>;
  respond<TOutput = unknown>(
    answers: readonly Answer[],
    options?: RespondTurnOptions<TOutput>,
  ): Promise<Delivery<TOutput>>;
  cancel(options?: {
    readonly signal?: AbortSignal;
    readonly turnId?: string | null;
  }): Promise<Delivery>;
  clear(options?: { readonly signal?: AbortSignal }): Promise<Delivery>;
  compact(options?: { readonly signal?: AbortSignal }): Promise<Delivery>;
  reset(options?: { readonly reason?: string; readonly signal?: AbortSignal }): Promise<Delivery>;
  stream(options?: SessionStreamOptions): AsyncIterable<SessionStreamEvent>;
  agent(opened: ChildOpened): ClientAgentSession;
  [followSession](options: FollowSessionOptions): AsyncIterable<SessionStreamEvent>;
}
export interface ClientSessionContext {
  readonly host: string;
  readonly redirect?: ClientRedirectPolicy;
  resolveHeaders(perRequest?: Readonly<Record<string, string>>): Promise<Headers>;
}
interface FollowSessionOptions extends SessionStreamOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly onCaughtUp?: () => void;
  readonly resolveReconnectPolicy?: () => SessionStreamOptions["streamReconnectPolicy"];
  readonly resolveHeaders?: () => Readonly<Record<string, string>> | undefined;
}
```

### src/client/types.d.ts

```ts
export interface ClientSessionState {
  readonly sessionId: string;
  readonly streamIndex: number;
}
export interface CreateSessionOptions {
  readonly stubs?: readonly ToolStub[];
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
}
export interface ResolvedStreamReconnectPolicy {
  readonly streamOpenReconnectPolicy?: StreamReconnectRetryPolicy;
  readonly retryableErrorStatuses?: readonly number[];
}
export interface SendTurnInput<TOutput = unknown> extends SendTurnOptions<TOutput> {
  readonly message: MessageContent;
}
export interface SendTurnOptions<TOutput = unknown> {
  readonly turnPolicy?: TurnPolicy;
  readonly clientContext?: string | readonly string[] | JsonObject;
  readonly outputSchema?: StandardJSONSchemaV1<unknown, TOutput> | JsonObject;
  readonly streamReconnectPolicy?: StreamReconnectPolicy;
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
}
export interface SessionSnapshot {
  readonly events: readonly SessionStreamEvent[];
  readonly session: ClientSessionState;
}
export interface StreamReconnectRetryPolicy {
  readonly baseDelayMs?: number;
  readonly maxAttempts?: number;
  readonly maxDelayMs?: number;
}
export type ClientAuth =
  | {
      readonly basic: {
        readonly username: string;
        readonly password: TokenValue;
      };
    }
  | {
      readonly bearer: TokenValue;
    }
  | {
      readonly vercelOidc: {
        readonly token: TokenValue;
      };
    };
export type ClientRedirectPolicy = NonNullable<RequestInit["redirect"]>;
export type HeadersValue =
  | Readonly<Record<string, string>>
  | (() => Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>);
export type RespondTurnOptions<TOutput = unknown> = Omit<SendTurnOptions<TOutput>, "turnPolicy">;
export type SendTurnPayload<TOutput = unknown> =
  | (SendTurnOptions<TOutput> & {
      readonly answers?: never;
      readonly message: MessageContent;
    })
  | (RespondTurnOptions<TOutput> & {
      readonly answers: readonly Answer[];
      readonly turnPolicy?: never;
      readonly message?: never;
    });
export type StreamReconnectPolicy =
  | ResolvedStreamReconnectPolicy
  | {
      readonly reconnect: false;
    };
export type TokenValue = string | (() => string | Promise<string>);
```

### src/compiled/@standard-schema/spec/index.d.ts

```ts
declare namespace StandardJSONSchemaV1 {
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    readonly jsonSchema: StandardJSONSchemaV1.Converter;
  }
  interface Converter {
    readonly input: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>;
    readonly output: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>;
  }
  type Target = "draft-2020-12" | "draft-07" | "openapi-3.0" | ({} & string);
  interface Options {
    readonly target: Target;
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
declare namespace StandardTypedV1 {
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: Types<Input, Output> | undefined;
  }
  interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  type InferInput<Schema extends StandardTypedV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];
  type InferOutput<Schema extends StandardTypedV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}
interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardJSONSchemaV1.Props<Input, Output>;
}
interface StandardTypedV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
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

### src/protocol/session-projection/request-status.d.ts

```ts
export type RequestStatus = "working" | "awaiting-input" | "completed" | "failed" | "cancelled";
```

### src/protocol/session-projection/selectors.d.ts

```ts
export type CallState =
  | "requested"
  | "approval"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";
```

### src/protocol/session-projection/tables.d.ts

```ts
export interface CallPreview {
  readonly callId: string;
  readonly runId?: string;
  readonly name: string;
  readonly kind?: CapabilityKind;
  readonly input: string;
  readonly output?: JsonValue;
  readonly label?: string;
}
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
export interface PartPreview {
  readonly partId: string;
  readonly runId?: string;
  readonly kind: string;
  readonly text: string;
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
export interface SessionPreviews {
  readonly parts: Table<PartPreview>;
  readonly calls: Table<CallPreview>;
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
export declare function signInEnding(
  outcome: InteractionOutcome,
): "connected" | "declined" | "failed" | "timed out" | "cancelled";
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

### src/tool-stubs/types.d.ts

```ts
export type ToolStub = {
  readonly id: string;
  readonly tool: string;
  readonly match?: Readonly<Record<string, JsonObject | boolean>>;
} & (
  | {
      readonly outcome: ToolStubOutcome;
      readonly outcomes?: never;
    }
  | {
      readonly outcome?: never;
      readonly outcomes: readonly [ToolStubOutcome, ...ToolStubOutcome[]];
    }
);
export type ToolStubOutcome =
  | {
      readonly response: JsonValue;
      readonly throw?: never;
    }
  | {
      readonly response?: never;
      readonly throw: {
        readonly message: string;
        readonly name?: string;
      };
    };
```

### src/vue/use-eve-agent.d.ts

```ts
export declare function useEveAgent(options?: UseEveAgentOptions): UseEveAgentReturn;
export interface UseEveAgentOptions extends EveAgentStoreCallbacks {
  readonly agent?: string;
  readonly auth?: ClientAuth;
  readonly headers?: HeadersValue;
  readonly host?: string;
  readonly initialEvents?: readonly SessionStreamEvent[];
  readonly initialSession?: ClientSessionState;
  readonly optimistic?: boolean;
  readonly followAgents?: boolean;
  readonly followIdle?: boolean;
  readonly prewarm?: boolean;
  readonly resume?: boolean;
  readonly session?: ClientSession;
}
export interface UseEveAgentReturn {
  readonly cancel: () => Promise<Delivery>;
  readonly previews: ComputedRef<EveAgentStoreSnapshot["previews"]>;
  readonly messages: ComputedRef<EveAgentStoreSnapshot["messages"]>;
  readonly agents: ComputedRef<EveAgentStoreSnapshot["agents"]>;
  readonly error: ComputedRef<Error | undefined>;
  readonly view: ComputedRef<EveAgentStoreSnapshot["view"]>;
  readonly events: ComputedRef<readonly SessionStreamEvent[]>;
  readonly resume: () => Promise<void>;
  readonly prewarm: () => Promise<void>;
  readonly newSession: () => void;
  readonly reset: () => Promise<Delivery>;
  readonly clear: () => Promise<Delivery>;
  readonly compact: () => Promise<Delivery>;
  readonly send: <TOutput = unknown>(
    message: MessageContent,
    options?: SendTurnOptions<TOutput>,
  ) => Promise<Delivery<TOutput>>;
  readonly respond: <TOutput = unknown>(
    answers: Parameters<ClientSession["respond"]>[0],
    options?: RespondTurnOptions<TOutput>,
  ) => Promise<Delivery<TOutput>>;
  readonly session: ComputedRef<ClientSessionState | undefined>;
  readonly status: ComputedRef<UseEveAgentStatus>;
}
export type UseEveAgentSnapshot = EveAgentStoreSnapshot;
export type UseEveAgentStatus = EveAgentStoreStatus;
```
