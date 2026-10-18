# eve/tools

## Export names

- AgentMessageResult: src/tools/workflow-definition.d.ts#AgentMessageResult
- AgentResponse: src/tools/workflow-definition.d.ts#AgentResponse
- AgentSendOptions: src/tools/workflow-definition.d.ts#AgentSendOptions
- AgentSession: src/tools/workflow-definition.d.ts#AgentSession
- ApprovalResponder: src/tools/definition.d.ts#ApprovalResponder
- ApprovedCall: src/tools/definition.d.ts#ApprovedCall
- DisabledToolSentinel: src/tools/definition.d.ts#DisabledToolSentinel
- DynamicEvents: src/dynamic/definition.d.ts#DynamicEvents
- DynamicResolveContext: src/dynamic/definition.d.ts#DynamicResolveContext
- DynamicResolverEvent: src/dynamic/definition.d.ts#DynamicResolverEvent
- DynamicSentinel: src/dynamic/definition.d.ts#DynamicSentinel
- DynamicToolEntry: src/tools/dynamic.d.ts#DynamicToolEntry
- DynamicToolEvents: src/tools/dynamic.d.ts#DynamicToolEvents
- DynamicToolResult: src/tools/dynamic.d.ts#DynamicToolResult
- DynamicToolSet: src/tools/dynamic.d.ts#DynamicToolSet
- MatchedConnectionResult: src/public/tools/result.d.ts#MatchedConnectionResult
- MatchedToolResult: src/public/tools/result.d.ts#MatchedToolResult
- SettledCallRow: src/public/tools/result.d.ts#SettledCallRow
- ToolAnswer: src/tools/definition.d.ts#ToolAnswer
- ToolAskOptions: src/tools/definition.d.ts#ToolAskOptions
- ToolAuthOptions: src/tools/auth.d.ts#ToolAuthOptions
- ToolAuthProvider: src/tools/auth.d.ts#ToolAuthProvider
- ToolContext: src/tools/definition.d.ts#ToolContext
- ToolDefinition: src/tools/definition.d.ts#ToolDefinition
- ToolLabelDefinition: src/tools/definition.d.ts#ToolLabelDefinition
- ToolModelOutput: src/tools/model-output.d.ts#ToolModelOutput
- ToolModelOutputPart: src/tools/model-output.d.ts#ToolModelOutputPart
- ToolQuestion: src/tools/definition.d.ts#ToolQuestion
- ToolResultFromFn: src/public/tools/result.d.ts#ToolResultFromFn
- ToolResultSource: src/public/tools/result.d.ts#ToolResultSource
- WorkflowAgentMetadata: src/tools/workflow-definition.d.ts#WorkflowAgentMetadata
- WorkflowExecuteToolDefinition: src/tools/workflow-definition.d.ts#WorkflowExecuteToolDefinition
- WorkflowServeCall: src/tools/workflow-definition.d.ts#WorkflowServeCall
- WorkflowServeContext: src/tools/workflow-definition.d.ts#WorkflowServeContext
- WorkflowServeReceive: src/tools/workflow-definition.d.ts#WorkflowServeReceive
- WorkflowServeToolDefinition: src/tools/workflow-definition.d.ts#WorkflowServeToolDefinition
- WorkflowStepToolContext: src/tools/workflow-definition.d.ts#WorkflowStepToolContext
- WorkflowTaskToolDefinition: src/tools/workflow-definition.d.ts#WorkflowTaskToolDefinition
- WorkflowToolContext: src/tools/workflow-definition.d.ts#WorkflowToolContext
- WorkflowToolDefinition: src/tools/workflow-definition.d.ts#WorkflowToolDefinition
- defineDurableCallback: src/tools/durable-callbacks.d.ts#defineDurableCallback
- defineDurableSchema: src/tools/durable-schema.d.ts#defineDurableSchema
- defineDynamic: src/public/definitions/dynamic-tools.d.ts#defineDynamic
- defineTool: src/tools/definition.d.ts#defineTool
- defineWorkflowTool: src/tools/workflow-definition.d.ts#defineWorkflowTool
- disableTool: src/tools/definition.d.ts#disableTool
- isDisabledToolSentinel: src/tools/definition.d.ts#isDisabledToolSentinel
- toolOutput: src/tools/model-output.d.ts#toolOutput
- toolOutputPart: src/tools/model-output.d.ts#toolOutputPart
- toolResultFrom: src/public/tools/result.d.ts#toolResultFrom

## Peer boundaries

## Declaration closure

### src/approval/definition.d.ts

```ts
export interface ApprovalConfiguration<TInput = Record<string, unknown>> {
  readonly prompt?: ApprovalPrompt<TInput>;
  readonly request: ApprovalPolicy<TInput>;
  readonly response?: ApprovalResponsePolicy<TInput>;
}
export interface ApprovalContext<TInput = Record<string, unknown>> extends SessionContext {
  readonly abortSignal: AbortSignal;
  readonly callId: string;
  readonly toolAnnotations?: ConnectionToolAnnotations;
  readonly toolInput?: ApprovalToolInput<TInput>;
  readonly toolName: string;
}
export interface ApprovalPromptContext<TInput = Record<string, unknown>> {
  readonly callId: string;
  readonly input: TInput;
  readonly toolName: string;
}
export interface ApprovalRequest<TInput = Record<string, unknown>> {
  readonly callId: string;
  readonly interactionId: string;
  readonly principal: SessionAuthContext | null;
  readonly toolInput?: ApprovalToolInput<TInput>;
  readonly toolName: string;
}
export interface ApprovalResponse {
  readonly decision: "approve" | "deny";
  readonly principal: SessionAuthContext;
}
export interface ApprovalResponseAuth {
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
  requireAuth(provider: ToolAuthProvider, options?: ToolAuthOptions): never;
}
export interface ApprovalResponseContext<TInput = Record<string, unknown>> {
  readonly auth: ApprovalResponseAuth;
  readonly request: ApprovalRequest<TInput>;
  readonly response: ApprovalResponse;
  readonly session: ApprovalResponseSession;
}
export interface ApprovalResponseSession {
  readonly id: string;
  readonly initiator: SessionAuthContext | null;
  readonly parent?: SessionParent;
  readonly turn: SessionTurn;
}
export interface ConnectionToolAnnotations {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
  readonly [key: string]: unknown;
}
export type Approval<TInput = Record<string, unknown>> =
  ApprovalPolicy<TInput> | ApprovalConfiguration<TInput>;
export type ApprovalPolicy<TInput = Record<string, unknown>> = (
  ctx: ApprovalContext<TInput>,
) => ApprovalStatus | Promise<ApprovalStatus>;
export type ApprovalPrompt<TInput = Record<string, unknown>> = (
  context: ApprovalPromptContext<TInput>,
) => string;
export type ApprovalResponseDecision =
  | {
      readonly status: "allowed";
    }
  | {
      readonly reason: string;
      readonly status: "rejected";
    };
export type ApprovalResponsePolicy<TInput = Record<string, unknown>> = (
  ctx: ApprovalResponseContext<TInput>,
) => ApprovalResponseDecision | Promise<ApprovalResponseDecision>;
export type ApprovalStatus =
  | undefined
  | boolean
  | "not-applicable"
  | "approved"
  | "denied"
  | "user-approval"
  | {
      readonly type: "not-applicable";
      readonly reason?: never;
    }
  | {
      readonly type: "approved";
      readonly reason?: string;
    }
  | {
      readonly type: "denied";
      readonly reason?: string;
    }
  | {
      readonly type: "user-approval";
      readonly reason?: never;
    };
type ApprovalToolInput<TInput> = TInput extends object ? Readonly<TInput> : TInput;
```

### src/channel/session.d.ts

```ts
export interface Session extends SessionOperations {
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
export interface SendTurnOptions<TOutput = unknown> {
  readonly turnPolicy?: TurnPolicy;
  readonly clientContext?: string | readonly string[] | JsonObject;
  readonly outputSchema?: StandardJSONSchemaV1<unknown, TOutput> | JsonObject;
  readonly streamReconnectPolicy?: StreamReconnectPolicy;
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
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
declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    readonly validate: (
      value: unknown,
      options?: StandardSchemaV1.Options | undefined,
    ) => Result<Output> | Promise<Result<Output>>;
  }
  type Result<Output> = SuccessResult<Output> | FailureResult;
  interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  interface PathSegment {
    readonly key: PropertyKey;
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
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
interface StandardTypedV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
```

### src/connections/errors.d.ts

```ts
export interface ConnectionAuthorizationChallenge {
  readonly url?: string;
  readonly userCode?: string;
  readonly expiresAt?: string;
  readonly instructions?: string;
  readonly displayName?: string;
}
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

### src/dynamic/definition.d.ts

```ts
export declare const DYNAMIC_SENTINEL_KIND: "eve:dynamic";
export interface DynamicResolveContext {
  readonly abortSignal?: AbortSignal;
  readonly model: {
    readonly id: string;
  } | null;
  readonly session: {
    readonly id: string;
    readonly auth: SessionAuth;
    readonly schedule?: import("#context/session-schedule.js").SessionSchedule;
    readonly predecessor?: SessionPredecessor;
  };
  readonly channel: ChannelInfo;
  readonly conversation?: ConversationContext;
  readonly messages: readonly ModelMessage[];
}
export type DynamicEvents<TResult = unknown> = {
  readonly [K in DynamicToolEventName]?: (
    event: DynamicResolverEvent<K>,
    ctx: DynamicResolveContext,
  ) => TResult | Promise<TResult>;
};
export type DynamicResolverEvent<K extends DynamicToolEventName> = {
  beforeSession: SessionStartedPoint["fact"];
  beforeTurn: TurnStartedPoint["fact"];
  beforeModel: StepStartedPoint["fact"];
}[K];
export type DynamicSentinel<TResult = unknown> = {
  readonly kind: typeof DYNAMIC_SENTINEL_KIND;
  readonly events: DynamicEvents<TResult>;
};
export type DynamicToolEventName = "beforeSession" | "beforeTurn" | "beforeModel";
```

### src/harness/session-machine/change-points.d.ts

```ts
export interface SessionStartedPoint {
  readonly type: "session.started";
  readonly data: {
    readonly runtime?: RuntimeIdentity;
  };
  readonly fact: FactOf<"session.started">;
}
export interface StepStartedPoint {
  readonly type: "step.started";
  readonly data: {
    readonly modelId: string;
    readonly sequence: number;
    readonly stepIndex: number;
    readonly turnId: string;
  };
  readonly fact: FactOf<"model.requested">;
}
export interface TurnStartedPoint {
  readonly type: "turn.started";
  readonly data: {
    readonly sequence: number;
    readonly turnId: string;
  };
  readonly fact: FactOf<"turn.started">;
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
export type FactOf<TType extends Fact["type"]> = Extract<
  Fact,
  {
    readonly type: TType;
  }
>;
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
export interface Ended {
  readonly closedAt?: number;
  readonly endedAt?: string;
}
export interface Introduced {
  readonly introducedAt: number;
  readonly startedAt: string;
}
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

### src/public/definitions/connections/events.d.ts

```ts
export interface ConnectionEvent {
  readonly eventId: string;
  readonly name: string;
  readonly timestamp: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly cursor: string | null;
}
export interface ConnectionEventContext {
  readonly origin: ConnectionEventOrigin;
  readonly deliveryId: string;
  readonly auth: SessionAuthContext | null;
  readonly attachSession: (sessionId: string) => Session;
}
export interface ConnectionEventOrigin {
  readonly sessionId: string;
  readonly connectionName: string;
  readonly subscriptionId: string;
}
export interface ConnectionEvents {
  readonly onEvent: (
    input: ConnectionEventContext & {
      readonly event: ConnectionEvent;
    },
  ) => void | PromiseLike<void>;
  readonly onGap?: (
    input: ConnectionEventContext & {
      readonly cursor: string | null;
      readonly truncated?: true;
    },
  ) => void | PromiseLike<void>;
  readonly onTerminated?: (
    input: ConnectionEventContext & {
      readonly error: {
        readonly code: number;
        readonly message: string;
        readonly data?: unknown;
      };
    },
  ) => void | PromiseLike<void>;
}
```

### src/public/definitions/connections/mcp.d.ts

```ts
export interface McpClientConnectionDefinition {
  readonly experimental?: {
    readonly events?: ConnectionEvents;
  };
  readonly url: string;
  readonly protocolVersionDiscovery?: boolean;
  readonly forwardPrincipal?: boolean;
  readonly description: string;
  auth?: ConnectionAuthDefinition;
  readonly instanceKey?: string;
  approval?: Approval;
  headers?: HeadersDefinition;
  toolCall?: ConnectionToolCallDefinition;
  tools?: ToolFilterDefinition;
}
```

### src/public/definitions/connections/openapi.d.ts

```ts
export interface OpenAPIConnectionDefinition {
  readonly spec: OpenAPISpecSource;
  readonly baseUrl?: string;
  readonly description: string;
  auth?: ConnectionAuthDefinition;
  readonly instanceKey?: string;
  approval?: Approval;
  headers?: HeadersDefinition;
  toolCall?: ConnectionToolCallDefinition;
  operations?: ToolFilterDefinition;
}
export type OpenAPISpecSource = string | Record<string, unknown>;
```

### src/public/definitions/connections/tool-call.d.ts

```ts
export interface ConnectionToolCallDefinition {
  readonly providedArguments?: ProvidedArgumentsDefinition;
}
export type ProvidedArgumentContext = SessionContext & {
  readonly callId: string;
  readonly toolName: string;
};
export type ProvidedArgumentValue =
  | JsonValue
  | Promise<JsonValue>
  | ((ctx: ProvidedArgumentContext) => JsonValue | Promise<JsonValue>);
export type ProvidedArgumentsDefinition = Readonly<Record<string, ProvidedArgumentValue>>;
```

### src/public/definitions/dynamic-tools.d.ts

```ts
export declare function defineDynamic<const TEvents extends DynamicToolEvents>(definition: {
  readonly events: ExactDefinition<TEvents, DynamicToolEvents>;
}): DynamicSentinel<DynamicToolResult>;
```

### src/public/definitions/exact.d.ts

```ts
export type ExactDefinition<TInput, TShape> = TInput & {
  readonly [TKey in Exclude<keyof TInput, keyof TShape>]: never;
};
```

### src/public/tools/result.d.ts

```ts
export declare const toolResultFrom: ToolResultFromFn;
export interface MatchedConnectionResult {
  readonly callId: string;
  readonly connectionToolName: string;
  readonly output: unknown;
  readonly toolName: string;
}
export interface MatchedToolResult<TOutput> {
  readonly callId: string;
  readonly output: TOutput;
  readonly toolName: string;
}
export interface ToolResultFromFn {
  <TInput, TOutput>(
    result: ToolResultSource,
    tool: ToolDefinition<TInput, TOutput>,
  ): MatchedToolResult<TOutput> | undefined;
  (result: ToolResultSource, connection: ConnectionDefinition): MatchedConnectionResult | undefined;
}
export type SettledCallRow = Pick<CallRow, "callId" | "capability" | "outcome" | "output">;
export type ToolResultSource = SettledCallRow | undefined;
type ConnectionDefinition = McpClientConnectionDefinition | OpenAPIConnectionDefinition;
```

### src/shared/channel-audience.d.ts

```ts
export declare const CHANNEL_AUDIENCES: readonly ["public", "private", "unknown"];
export type ChannelAudience = (typeof CHANNEL_AUDIENCES)[number];
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

### src/shared/connection-events.d.ts

```ts
export interface ConnectionEventsAdapter {
  subscribe(input: ManagedEventSubscribeInput): Promise<ManagedEventSubscription>;
  getSubscription(input: {
    id: string;
    options?: {
      timeout?: number;
    };
  }): Promise<ManagedEventSubscription>;
  unsubscribe(input: {
    id: string;
    options?: {
      timeout?: number;
    };
  }): Promise<ManagedEventSubscription>;
}
export interface ConnectionEventsBackend {
  createAdapter(input: {
    principal: ConnectionPrincipal;
    connection: {
      url: string;
    };
    destination: {
      path: string;
    };
  }): Promise<ConnectionEventsAdapter>;
  verify(
    request: Request,
    options: {
      path: string;
    },
  ): Promise<ConnectionEventDelivery>;
}
export interface ManagedEventSubscription {
  id: string;
  name: string;
  arguments: EventJsonObject;
  status: "pending" | "active" | "needs_auth" | "stopped" | "expired" | "failed";
  expiresAt: string | null;
  cleanupStatus?: "pending" | "complete" | "exhausted";
}
export type ConnectionEventDelivery = {
  version: 1;
  deliveryId: string;
  subscriptionId: string;
  source: {
    type: "mcp";
    connectorId: string;
  };
  context: Record<string, unknown>;
} & (
  | {
      event: ConnectionEvent;
    }
  | {
      control: {
        type: "gap";
        cursor: string | null;
        truncated?: true;
      };
    }
  | {
      control: {
        type: "terminated";
        error: {
          code: number;
          message: string;
          data?: unknown;
        };
      };
    }
);
export type EventJson = string | number | boolean | null | readonly EventJson[] | EventJsonObject;
export type EventJsonObject = {
  [key: string]: EventJson | undefined;
};
export type ManagedEventSubscribeInput = {
  name: string;
  arguments: EventJsonObject;
  context?: EventJsonObject;
  idempotencyKey: string;
  ttlMs: number | null;
  options?: {
    signal?: AbortSignal;
    timeout?: number;
    maxTotalTimeout?: number;
  };
};
```

### src/shared/connection-types.d.ts

```ts
export interface AuthorizationCallback {
  readonly params: Readonly<Record<string, string>>;
  readonly method: string;
  readonly body?: string;
}
export interface ConnectionAuthorizationContext {
  readonly url: string;
}
export interface InteractiveAuthorizationDefinition<
  Resume = JsonValue,
> extends AuthorizationDefinitionBase {
  readonly principalType: "user";
  getToken(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
  }): Promise<TokenResult>;
  startAuthorization(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
    readonly callbackUrl: string;
  }): Promise<{
    readonly challenge: ConnectionAuthorizationChallenge;
    readonly resume?: Resume;
  }>;
  completeAuthorization(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
    readonly callbackUrl: string;
    readonly resume?: Resume;
    readonly callback: AuthorizationCallback;
  }): Promise<TokenResult>;
}
export interface NonInteractiveAuthorizationDefinition extends AuthorizationDefinitionBase {
  getToken(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
  }): Promise<TokenResult>;
  readonly startAuthorization?: undefined;
  readonly completeAuthorization?: undefined;
}
export interface TokenResult {
  readonly token: string;
  readonly expiresAt?: number;
  readonly providerSubject?: string;
}
export type AuthorizationDefinition<Resume extends JsonValue = JsonValue> =
  NonInteractiveAuthorizationDefinition | InteractiveAuthorizationDefinition<Resume>;
export type ConnectionAuthDefinition = AuthorizationDefinition | ConnectionAuthResolver;
export type ConnectionAuthResolver = (
  ctx: SessionContext,
) => AuthorizationDefinition | Promise<AuthorizationDefinition>;
export type ConnectionPrincipal =
  | {
      readonly type: "app";
    }
  | {
      readonly type: "user";
      readonly id: string;
      readonly issuer?: string;
      readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
    };
export type HeaderValue =
  string | Promise<string> | ((ctx: SessionContext) => string | Promise<string>);
export type HeadersDefinition =
  | Readonly<Record<string, HeaderValue>>
  | ((
      ctx: SessionContext,
    ) => Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>);
export type ToolFilterDefinition =
  | {
      readonly allow: readonly string[];
    }
  | {
      readonly block: readonly string[];
    };
interface AuthorizationDefinitionBase {
  readonly principalType?: "app" | "user";
  readonly vercelConnect?: {
    readonly experimental_events?: ConnectionEventsBackend;
    readonly connector: string;
  };
  readonly displayName?: string;
  evict?(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
  }): void | Promise<void>;
}
```

### src/shared/conversation-context.d.ts

```ts
export interface ConversationContext {
  readonly channel: {
    readonly kind: ChannelKind;
    readonly name?: string;
  };
  readonly audience: ChannelAudience;
  readonly environment: ConversationEnvironment;
  readonly principalType: string;
}
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

### src/shared/history-message.d.ts

```ts
export type HistoryMessage =
  SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage;
interface CustomPart {
  type: "custom";
  kind: `${string}.${string}`;
  providerOptions?: ProviderOptions;
}
interface FilePart {
  type: "file";
  data: FileData | DataContent | URL | ProviderReference;
  filename?: string;
  mediaType: string;
  providerOptions?: ProviderOptions;
}
interface ImagePart {
  type: "image";
  image: DataContent | URL | ProviderReference;
  mediaType?: string;
  providerOptions?: ProviderOptions;
}
interface ReasoningFilePart {
  type: "reasoning-file";
  data: FileDataData | FileDataUrl | DataContent | URL;
  mediaType: string;
  providerOptions?: ProviderOptions;
}
interface ReasoningPart {
  type: "reasoning";
  text: string;
  providerOptions?: ProviderOptions;
}
interface TextPart {
  type: "text";
  text: string;
  providerOptions?: ProviderOptions;
}
interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerOptions?: ProviderOptions;
  providerExecuted?: boolean;
}
interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: ToolResultOutput;
  providerOptions?: ProviderOptions;
}
type AssistantContent =
  | string
  | Array<
      | TextPart
      | CustomPart
      | FilePart
      | ReasoningPart
      | ReasoningFilePart
      | ToolCallPart
      | ToolResultPart
      | ToolApprovalRequest
    >;
type AssistantModelMessage = {
  role: "assistant";
  content: AssistantContent;
  providerOptions?: ProviderOptions;
};
type DataContent = string | Uint8Array | ArrayBuffer;
type FileData =
  | FileDataData
  | FileDataUrl
  | {
      type: "reference";
      reference: ProviderReference;
    }
  | {
      type: "text";
      text: string;
    };
type FileDataData = {
  type: "data";
  data: DataContent;
};
type FileDataUrl = {
  type: "url";
  url: URL;
  originalUrl?: string;
};
type JSONValue =
  | null
  | boolean
  | number
  | string
  | readonly JSONValue[]
  | {
      readonly [key: string]: JSONValue | undefined;
    };
type ProviderOptions = Record<
  string,
  {
    [key: string]: JSONValue | undefined;
  }
>;
type ProviderReference = Record<string, string> & {
  type?: never;
};
type SystemModelMessage = {
  role: "system";
  content: string;
  providerOptions?: ProviderOptions;
};
type ToolApprovalRequest = {
  type: "tool-approval-request";
  approvalId: string;
  toolCallId: string;
  reason?: string;
  isAutomatic?: boolean;
  signature?: string;
  inputSchemaInput?: unknown;
};
type ToolApprovalResponse = {
  type: "tool-approval-response";
  approvalId: string;
  approved: boolean;
  reason?: string;
  providerExecuted?: boolean;
};
type ToolContent = Array<ToolResultPart | ToolApprovalResponse>;
type ToolModelMessage = {
  role: "tool";
  content: ToolContent;
  providerOptions?: ProviderOptions;
};
type ToolResultOutput =
  | {
      type: "text";
      value: string;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "json";
      value: JSONValue;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "execution-denied";
      reason?: string;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "error-text";
      value: string;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "error-json";
      value: JSONValue;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "content";
      value: Array<
        | {
            type: "text";
            text: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file";
            data: FileData;
            mediaType: string;
            filename?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-data";
            data: string;
            mediaType: string;
            filename?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-url";
            url: string;
            mediaType?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-id";
            fileId: string | Record<string, string>;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-reference";
            providerReference: ProviderReference;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-data";
            data: string;
            mediaType: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-url";
            url: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-file-id";
            fileId: string | Record<string, string>;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-file-reference";
            providerReference: ProviderReference;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "custom";
            providerOptions?: ProviderOptions;
          }
      >;
    };
type UserContent = string | Array<TextPart | ImagePart | FilePart>;
type UserModelMessage = {
  role: "user";
  content: UserContent;
  providerOptions?: ProviderOptions;
};
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

### src/tools/auth.d.ts

```ts
export interface ToolAuthOptions {
  readonly connection?: ConnectionAuthorizationContext;
  readonly displayName?: string;
  readonly authKey?: string;
}
export type ToolAuthDefinition = AuthorizationDefinition;
export type ToolAuthProvider = ToolAuthDefinition;
```

### src/tools/definition.d.ts

```ts
declare const DISABLED_TOOL_SENTINEL_KIND = "eve:disabled-tool";
export declare function defineTool<TInput = unknown, TOutput = unknown>(
  definition: ToolDefinition<TInput, TOutput>,
): ToolDefinition<TInput, TOutput>;
export declare function defineTool<
  TInputSchema extends StandardSchemaV1<unknown, unknown> | StandardJSONSchemaV1<unknown, unknown>,
  TOutputSchema extends StandardJSONSchemaV1<unknown, unknown>,
  TReturn extends
    | Promise<StandardJSONSchemaV1.InferOutput<TOutputSchema>>
    | StandardJSONSchemaV1.InferOutput<TOutputSchema>
    | AsyncIterable<StandardJSONSchemaV1.InferOutput<TOutputSchema>>,
>(definition: {
  description: ToolDefinition<unknown, unknown>["description"];
  endsTurn?: ToolDefinition<unknown, StandardJSONSchemaV1.InferOutput<TOutputSchema>>["endsTurn"];
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  execute(input: StandardSchemaV1.InferOutput<TInputSchema>, ctx: ToolContext): TReturn;
  label?: ToolDefinition<
    StandardSchemaV1.InferOutput<TInputSchema>,
    StandardJSONSchemaV1.InferOutput<TOutputSchema>
  >["label"];
  approval?: ToolDefinition<StandardSchemaV1.InferOutput<TInputSchema>, unknown>["approval"];
  toModelOutput?: ToolDefinition<
    unknown,
    StandardJSONSchemaV1.InferOutput<TOutputSchema>
  >["toModelOutput"];
}): ToolDefinitionWithExecuteReturn<
  StandardSchemaV1.InferOutput<TInputSchema>,
  StandardJSONSchemaV1.InferOutput<TOutputSchema>,
  TReturn
>;
export declare function defineTool<
  TOutputSchema extends StandardJSONSchemaV1<unknown, unknown>,
  TReturn extends
    | Promise<StandardJSONSchemaV1.InferOutput<TOutputSchema>>
    | StandardJSONSchemaV1.InferOutput<TOutputSchema>
    | AsyncIterable<StandardJSONSchemaV1.InferOutput<TOutputSchema>>,
>(definition: {
  description: ToolDefinition<unknown, unknown>["description"];
  endsTurn?: ToolDefinition<unknown, StandardJSONSchemaV1.InferOutput<TOutputSchema>>["endsTurn"];
  inputSchema: JsonObject;
  outputSchema: TOutputSchema;
  execute(input: Record<string, unknown>, ctx: ToolContext): TReturn;
  label?: ToolDefinition<
    Record<string, unknown>,
    StandardJSONSchemaV1.InferOutput<TOutputSchema>
  >["label"];
  approval?: ToolDefinition<Record<string, unknown>, unknown>["approval"];
  toModelOutput?: ToolDefinition<
    unknown,
    StandardJSONSchemaV1.InferOutput<TOutputSchema>
  >["toModelOutput"];
}): ToolDefinitionWithExecuteReturn<
  Record<string, unknown>,
  StandardJSONSchemaV1.InferOutput<TOutputSchema>,
  TReturn
>;
export declare function defineTool<TReturn>(definition: {
  description: ToolDefinition<unknown, unknown>["description"];
  endsTurn?: ToolDefinition<unknown, ToolOutputFromExecuteReturn<TReturn>>["endsTurn"];
  inputSchema: JsonObject;
  outputSchema?: JsonObject;
  execute(input: Record<string, unknown>, ctx: ToolContext): TReturn;
  label?: ToolDefinition<Record<string, unknown>, ToolOutputFromExecuteReturn<TReturn>>["label"];
  approval?: ToolDefinition<Record<string, unknown>, unknown>["approval"];
  toModelOutput?: ToolDefinition<unknown, ToolOutputFromExecuteReturn<TReturn>>["toModelOutput"];
}): ToolDefinitionWithExecuteReturn<
  Record<string, unknown>,
  ToolOutputFromExecuteReturn<TReturn>,
  TReturn
>;
export declare function defineTool<
  TSchema extends StandardSchemaV1<unknown, unknown> | StandardJSONSchemaV1<unknown, unknown>,
  TReturn,
>(definition: {
  description: ToolDefinition<unknown, unknown>["description"];
  endsTurn?: ToolDefinition<unknown, ToolOutputFromExecuteReturn<TReturn>>["endsTurn"];
  inputSchema: TSchema;
  outputSchema?: JsonObject;
  execute(input: StandardSchemaV1.InferOutput<TSchema>, ctx: ToolContext): TReturn;
  label?: ToolDefinition<
    StandardSchemaV1.InferOutput<TSchema>,
    ToolOutputFromExecuteReturn<TReturn>
  >["label"];
  approval?: ToolDefinition<StandardSchemaV1.InferOutput<TSchema>, unknown>["approval"];
  toModelOutput?: ToolDefinition<unknown, ToolOutputFromExecuteReturn<TReturn>>["toModelOutput"];
}): ToolDefinitionWithExecuteReturn<
  StandardSchemaV1.InferOutput<TSchema>,
  ToolOutputFromExecuteReturn<TReturn>,
  TReturn
>;
export declare function disableTool(): DisabledToolSentinel;
export declare function isDisabledToolSentinel(value: unknown): value is DisabledToolSentinel;
export interface ApprovalResponder extends SessionAuthContext {
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
}
export interface ApprovedCall {
  readonly responder: ApprovalResponder;
}
export interface DisabledToolSentinel {
  readonly kind: typeof DISABLED_TOOL_SENTINEL_KIND;
}
export interface PublicToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends ToolDefinitionBase {
  label?: ToolLabelDefinition<TInput, TOutput>;
  inputSchema: PublicToolInputSchema<TInput>;
  outputSchema?: PublicToolOutputSchema<TOutput>;
}
export interface ToolAskOptions {
  readonly signal?: AbortSignal;
}
export interface ToolDefinition<TInput = unknown, TOutput = unknown> extends PublicToolDefinition<
  TInput,
  TOutput
> {
  execute(input: TInput, ctx: ToolContext): Promise<TOutput> | TOutput | AsyncIterable<TOutput>;
  endsTurn?: boolean | ((output: TOutput) => boolean | Promise<boolean>);
  approval?: Approval<ApprovalContextInput<TInput>>;
  toModelOutput?: (output: TOutput) => ToolModelOutput | Promise<ToolModelOutput>;
}
export interface ToolLabelDefinition<TInput = unknown, TOutput = unknown> {
  start(input: Readonly<TInput>): string;
  delta?(input: Readonly<TInput>, partial: Readonly<TOutput>): string;
  complete?(input: Readonly<TInput>, output: Readonly<TOutput>): string;
}
export type PublicToolInputSchema<TInput = unknown> =
  StandardSchemaV1<unknown, TInput> | StandardJSONSchemaV1<unknown, TInput> | JsonObject;
export type PublicToolOutputSchema<TOutput = unknown> =
  StandardJSONSchemaV1<unknown, TOutput> | JsonObject;
export type ToolAnswer =
  | {
      readonly status: "answered";
      readonly optionId?: string;
      readonly responder?: Principal;
      readonly text?: string;
    }
  | {
      readonly status: "cancelled";
    }
  | {
      readonly status: "unavailable";
    };
export type ToolContext = SessionContext & {
  readonly abortSignal: AbortSignal;
  readonly callId: string;
  readonly toolName: string;
  readonly messages: readonly ModelMessage[];
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
  requireAuth(provider: ToolAuthProvider, options?: ToolAuthOptions): never;
  readonly approval?: ApprovedCall;
};
export type ToolQuestion = Pick<
  InteractionRequest,
  "prompt" | "title" | "options" | "allowFreeform" | "display"
>;
interface ToolDefinitionBase {
  readonly availableInSubagents?: boolean;
  readonly deferred?: boolean;
  readonly description: string;
}
type ApprovalContextInput<TInput> = unknown extends TInput ? Record<string, unknown> : TInput;
type ToolDefinitionWithExecuteReturn<TInput, TOutput, TReturn> = ToolDefinition<TInput, TOutput> & {
  execute(input: TInput, ctx: ToolContext): TReturn;
};
type ToolOutputFromExecuteReturn<TReturn> =
  TReturn extends Promise<infer TOutput>
    ? TOutput
    : TReturn extends AsyncIterable<infer TOutput>
      ? TOutput
      : TReturn;
```

### src/tools/durable-callbacks.d.ts

```ts
export declare function defineDurableCallback<
  TClosure extends object,
  TArgs extends unknown[],
  TResult,
>(input: {
  readonly callback: (closure: TClosure, ...args: TArgs) => TResult;
  readonly closure: TClosure & DurableCallbackJsonObject<TClosure>;
}): (...args: TArgs) => TResult;
export type DurableCallbackJsonObject<T extends object> =
  Extract<keyof T, symbol> extends never
    ? {
        readonly [TKey in keyof T]:
          DurableCallbackJsonValue<Exclude<T[TKey], undefined>> | Extract<T[TKey], undefined>;
      }
    : never;
type DurableCallbackJsonValue<T> = T extends (...args: never[]) => unknown
  ? never
  : T extends JsonPrimitive
    ? T
    : T extends readonly (infer TItem)[]
      ? readonly DurableCallbackJsonValue<TItem>[]
      : T extends object
        ? DurableCallbackJsonObject<T>
        : never;
```

### src/tools/durable-schema.d.ts

```ts
export declare function defineDurableSchema<
  TClosure extends object,
  TSchema extends ToolSchemaSource | undefined,
>(input: {
  readonly closure: TClosure & DurableCallbackJsonObject<TClosure>;
  readonly schema: (closure: TClosure) => TSchema;
}): DurableSchema<TSchema>;
type DurableSchema<TSchema> = TSchema extends StandardSchemaV1
  ? ToolSchema<StandardSchemaV1.InferInput<TSchema>, StandardSchemaV1.InferOutput<TSchema>>
  : TSchema;
```

### src/tools/dynamic.d.ts

```ts
export interface DynamicToolEntry<TInput = Record<string, unknown>, TOutput = any> {
  readonly availableInSubagents?: boolean;
  readonly deferred?: boolean;
  readonly label?: ToolLabelDefinition<TInput, TOutput>;
  readonly description: string;
  readonly endsTurn?: boolean | ((output: TOutput) => boolean | Promise<boolean>);
  readonly inputSchema: PublicToolInputSchema<TInput>;
  readonly outputSchema?: PublicToolOutputSchema<TOutput>;
  execute(input: TInput, ctx: ToolContext): TOutput | Promise<TOutput>;
  readonly toModelOutput?: (output: TOutput) => ToolModelOutput | Promise<ToolModelOutput>;
  readonly approval?: Approval<TInput>;
}
export type DynamicToolEvents = {
  readonly [K in DynamicToolEventName]?: (
    event: DynamicResolverEvent<K>,
    ctx: DynamicResolveContext,
  ) => DynamicToolResult | Promise<DynamicToolResult>;
};
export type DynamicToolResult = DynamicToolEntry<any, any> | DynamicToolSet | null;
export type DynamicToolSet = Readonly<Record<string, DynamicToolEntry<any, any>>>;
```

### src/tools/model-output.d.ts

```ts
export declare const toolOutput: {
  text(value: string): ToolModelOutput;
  json(value: unknown): ToolModelOutput;
  content(value: readonly ToolModelOutputPart[]): ToolModelOutput;
};
export declare const toolOutputPart: {
  text(text: string): ToolModelOutputPart;
  file(
    base64: string,
    options: {
      readonly mediaType: string;
      readonly filename?: string;
    },
  ): ToolModelOutputPart;
};
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

### src/tools/schema.d.ts

```ts
export type ToolSchema<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output> &
  StandardJSONSchemaV1<Input, Output>;
export type ToolSchemaSource = StandardJSONSchemaV1 | StandardSchemaV1 | Record<string, unknown>;
```

### src/tools/workflow-definition.d.ts

```ts
declare const WORKFLOW_TOOL_BRAND: unique symbol;
export declare function defineWorkflowTool(
  definition: ServeDefinition<Record<string, unknown>, unknown> & {
    inputSchema: JsonObject;
  },
): WorkflowServeToolDefinition<Record<string, unknown>>;
export declare function defineWorkflowTool<TInput = unknown, TOutput = unknown>(
  definition: Unbranded<WorkflowExecuteToolDefinition<TInput, TOutput>>,
): WorkflowExecuteToolDefinition<TInput, TOutput>;
export declare function defineWorkflowTool<TInput = unknown, TOutput = unknown>(
  definition: Unbranded<WorkflowServeToolDefinition<TInput, TOutput>>,
): WorkflowServeToolDefinition<TInput, TOutput>;
export declare function defineWorkflowTool<TInput = unknown, TOutput = unknown>(
  definition: Unbranded<WorkflowTaskToolDefinition<TInput, TOutput>>,
): WorkflowTaskToolDefinition<TInput, TOutput>;
export declare function defineWorkflowTool<
  TInputSchema extends Schema,
  TOutputSchema extends StandardJSONSchemaV1<unknown, unknown>,
  TReturn extends EntryPointReturn<InferOutput<TOutputSchema>>,
>(
  definition: WithSchemas<
    ExecuteDefinition<InferInput<TInputSchema>, TReturn>,
    TInputSchema,
    TOutputSchema
  >,
): WorkflowExecuteToolDefinition<InferInput<TInputSchema>, InferOutput<TOutputSchema>>;
export declare function defineWorkflowTool<
  TInputSchema extends Schema,
  TOutputSchema extends StandardJSONSchemaV1<unknown, unknown>,
  TReturn extends EntryPointReturn<InferOutput<TOutputSchema>>,
>(
  definition: WithSchemas<
    TaskDefinition<InferInput<TInputSchema>, TReturn>,
    TInputSchema,
    TOutputSchema
  >,
): WorkflowTaskToolDefinition<InferInput<TInputSchema>, InferOutput<TOutputSchema>>;
export declare function defineWorkflowTool<
  TInputSchema extends Schema,
  TOutputSchema extends StandardJSONSchemaV1<unknown, unknown>,
>(
  definition: WithSchemas<
    ServeDefinition<InferInput<TInputSchema>, InferOutput<TOutputSchema>>,
    TInputSchema,
    TOutputSchema
  >,
): WorkflowServeToolDefinition<InferInput<TInputSchema>, InferOutput<TOutputSchema>>;
export declare function defineWorkflowTool<TReturn extends EntryPointReturn<unknown>>(
  definition: ExecuteDefinition<Record<string, unknown>, TReturn> & {
    inputSchema: JsonObject;
  },
): WorkflowExecuteToolDefinition<Record<string, unknown>, WorkflowReturn<TReturn>>;
export declare function defineWorkflowTool<TReturn extends EntryPointReturn<unknown>>(
  definition: TaskDefinition<Record<string, unknown>, TReturn> & {
    inputSchema: JsonObject;
  },
): WorkflowTaskToolDefinition<Record<string, unknown>, WorkflowReturn<TReturn>>;
export declare function defineWorkflowTool<
  TSchema extends Schema,
  TReturn extends EntryPointReturn<unknown>,
>(
  definition: WithInputSchema<ExecuteDefinition<InferInput<TSchema>, TReturn>, TSchema>,
): WorkflowExecuteToolDefinition<InferInput<TSchema>, WorkflowReturn<TReturn>>;
export declare function defineWorkflowTool<
  TSchema extends Schema,
  TReturn extends EntryPointReturn<unknown>,
>(
  definition: WithInputSchema<TaskDefinition<InferInput<TSchema>, TReturn>, TSchema>,
): WorkflowTaskToolDefinition<InferInput<TSchema>, WorkflowReturn<TReturn>>;
export declare function defineWorkflowTool<TSchema extends Schema>(
  definition: WithInputSchema<ServeDefinition<InferInput<TSchema>, unknown>, TSchema>,
): WorkflowServeToolDefinition<InferInput<TSchema>>;
export interface AgentResponse<TOutput = unknown> {
  result(): Promise<AgentMessageResult<TOutput>>;
}
export interface AgentSendOptions<TOutput = unknown> {
  readonly outputSchema?: SendTurnOptions<TOutput>["outputSchema"];
  readonly signal?: AbortSignal;
}
export interface AgentSession {
  send<TOutput = unknown>(
    message: MessageContent<string | URL>,
    options?: AgentSendOptions<TOutput>,
  ): Promise<AgentResponse<TOutput>>;
}
export interface WorkflowAgentMetadata {
  readonly description: string;
}
export interface WorkflowExecuteToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends WorkflowToolDefinitionBase<TInput, TOutput> {
  execute(input: TInput, ctx: WorkflowToolContext): Promise<TOutput> | AsyncIterable<TOutput>;
  task?: never;
  serve?: never;
}
export interface WorkflowServeCall<TInput = unknown> {
  readonly callId: string;
  readonly input: TInput;
  readonly abortSignal: AbortSignal;
}
export interface WorkflowServeToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends WorkflowToolDefinitionBase<TInput, TOutput> {
  serve(
    receive: WorkflowServeReceive<TInput>,
    ctx: WorkflowServeContext<TOutput>,
  ): Promise<TOutput>;
  execute?: never;
  task?: never;
}
export interface WorkflowTaskToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends WorkflowToolDefinitionBase<TInput, TOutput> {
  task(input: TInput, ctx: WorkflowToolContext): Promise<TOutput> | AsyncIterable<TOutput>;
  execute?: never;
  serve?: never;
}
export type AgentMessageResult<TOutput = unknown> = Pick<
  DeliveryResult<TOutput>,
  "data" | "reply" | "status" | "sessionEnded"
> & {
  readonly error?: {
    readonly message: string;
  };
};
export type WorkflowServeContext<TOutput = unknown> = WorkflowSharedContext & {
  reply(output: TOutput): void;
};
export type WorkflowServeReceive<TInput = unknown> = () => Promise<WorkflowServeCall<TInput>>;
export type WorkflowSharedContext = Pick<
  ToolContext,
  "session" | "toolName" | "getToken" | "requireAuth"
> & {
  agent(name: string): AgentSession;
  agents: Readonly<Record<string, WorkflowAgentMetadata>>;
  ask(request: ToolQuestion, options?: ToolAskOptions): PromiseLike<ToolAnswer>;
};
export type WorkflowStepToolContext = Pick<
  ToolContext,
  "abortSignal" | "callId" | "session" | "toolName" | "getToken" | "requireAuth"
>;
export type WorkflowToolContext = WorkflowSharedContext &
  Pick<ToolContext, "callId"> & {
    readonly abortSignal: AbortSignal;
  };
export type WorkflowToolDefinition<TInput = unknown, TOutput = unknown> =
  | WorkflowExecuteToolDefinition<TInput, TOutput>
  | WorkflowTaskToolDefinition<TInput, TOutput>
  | WorkflowServeToolDefinition<TInput, TOutput>;
interface WorkflowToolDefinitionBase<TInput, TOutput> extends PublicToolDefinition<
  TInput,
  TOutput
> {
  readonly [WORKFLOW_TOOL_BRAND]: true;
  approval?: Approval<unknown extends TInput ? Record<string, unknown> : TInput>;
  toModelOutput?: (output: TOutput) => ToolModelOutput | Promise<ToolModelOutput>;
}
type DefinitionFields<TInput, TOutput> = Omit<
  WorkflowToolDefinitionBase<TInput, TOutput>,
  typeof WORKFLOW_TOOL_BRAND
>;
type EntryPointReturn<TOutput> = Promise<TOutput> | AsyncIterable<TOutput>;
type ExecuteDefinition<TInput, TReturn> = DefinitionFields<TInput, WorkflowReturn<TReturn>> & {
  execute(input: TInput, ctx: WorkflowToolContext): TReturn;
  task?: never;
  serve?: never;
};
type InferInput<TSchema extends Schema> = StandardSchemaV1.InferOutput<TSchema>;
type InferOutput<TSchema extends StandardJSONSchemaV1<unknown, unknown>> =
  StandardJSONSchemaV1.InferOutput<TSchema>;
type Schema = StandardSchemaV1<unknown, unknown> | StandardJSONSchemaV1<unknown, unknown>;
type ServeDefinition<TInput, TOutput> = DefinitionFields<TInput, TOutput> & {
  serve(
    receive: WorkflowServeReceive<TInput>,
    ctx: WorkflowServeContext<TOutput>,
  ): Promise<TOutput>;
  execute?: never;
  task?: never;
};
type TaskDefinition<TInput, TReturn> = DefinitionFields<TInput, WorkflowReturn<TReturn>> & {
  task(input: TInput, ctx: WorkflowToolContext): TReturn;
  execute?: never;
  serve?: never;
};
type Unbranded<T> = T extends unknown ? Omit<T, typeof WORKFLOW_TOOL_BRAND> : never;
type WithInputSchema<TDefinition, TSchema> = Omit<TDefinition, "inputSchema"> & {
  inputSchema: TSchema;
};
type WithSchemas<TDefinition, TInputSchema, TOutputSchema> = Omit<
  TDefinition,
  "inputSchema" | "outputSchema"
> & {
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
};
type WorkflowReturn<T> = T extends AsyncIterable<infer Output> ? Output : Awaited<T>;
```
