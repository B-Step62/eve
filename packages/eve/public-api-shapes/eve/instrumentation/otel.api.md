# eve/instrumentation/otel

## Export names

- ManagedTraceOptions: src/tracing/eve/otel-declaration.d.ts#ManagedTraceOptions
- OtelDeclaration: src/tracing/eve/otel-declaration.d.ts#OtelDeclaration
- OtelIntegration: src/tracing/eve/otel-declaration.d.ts#OtelIntegration
- OtelIntegrationOptions: src/tracing/eve/otel-declaration.d.ts#OtelIntegrationOptions
- OtelOptions: src/tracing/eve/otel-declaration.d.ts#OtelOptions
- SpanAttributeDecision: src/tracing/eve/span-export-policy.d.ts#SpanAttributeDecision
- SpanExportAttributeValue: src/tracing/eve/span-export-policy.d.ts#SpanExportAttributeValue
- SpanExportContext: src/tracing/eve/span-export-policy.d.ts#SpanExportContext
- SpanExportDecision: src/tracing/eve/span-export-policy.d.ts#SpanExportDecision
- SpanExportPolicy: src/tracing/eve/span-export-policy.d.ts#SpanExportPolicy
- SpanExporter: src/compiled/@vercel/otel/index.d.ts#SpanExporter
- SpanProcessor: src/compiled/@vercel/otel/index.d.ts#SpanProcessor
- TraceCaptureContext: src/shared/trace-policy.d.ts#TraceCaptureContext
- TraceCapturePolicy: src/shared/trace-policy.d.ts#TraceCapturePolicy
- TracePolicyDecision: src/shared/trace-policy.d.ts#TracePolicyDecision
- agentRuns: src/public/instrumentation/otel.d.ts#agentRuns
- localTraces: src/public/instrumentation/otel.d.ts#localTraces
- otel: src/tracing/eve/otel-declaration.d.ts#otel
- otelIntegration: src/tracing/eve/otel-declaration.d.ts#otelIntegration

## Peer boundaries

## Declaration closure

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
```

### src/compiled/@vercel/otel/index.d.ts

```ts
export interface MetricReader {
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}
export interface SpanExporter {
  export(
    spans: readonly unknown[],
    resultCallback: (result: { code: number; error?: Error }) => void,
  ): void;
  forceFlush?(): Promise<void>;
  shutdown(): Promise<void>;
}
export interface SpanProcessor {
  forceFlush(): Promise<void>;
  onEnd(span: unknown): void;
  onStart(span: unknown, parentContext: unknown): void;
  shutdown(): Promise<void>;
}
```

### src/instrumentation/lifecycle.d.ts

```ts
export declare const INSTRUMENTATION_PRINCIPAL_TYPES: readonly [
  "anonymous",
  "app",
  "local-dev",
  "none",
  "other",
  "runtime",
  "service",
  "unknown",
  "user",
];
export interface InstrumentationCallRequestedEvent {
  readonly capability: Capability;
  readonly frameworkTool: boolean;
  readonly startedAtMs?: number;
  readonly type: "call.requested";
  readonly callId: string;
  readonly idempotencyKey: string;
  readonly input: unknown;
  readonly scope: InstrumentationScope;
  readonly toolName: string;
}
export interface InstrumentationCallSettledEvent {
  readonly type: "call.settled";
  readonly outcome: InstrumentationCallOutcome;
  readonly output?: unknown;
  readonly error?: unknown;
  readonly errorCode?: string;
  readonly usage?: InstrumentationUsage;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly acceptedAtMs?: number;
  readonly completedAtMs?: number;
  readonly durationMs?: number;
  readonly idempotencyKey: string;
  readonly scope: InstrumentationScope;
}
export interface InstrumentationChannelDeliveryInput {
  readonly context?: readonly string[];
  readonly answers?: readonly InstrumentationAnswer[];
  readonly message?: unknown;
  readonly outputSchema?: unknown;
}
export interface InstrumentationChannelDeliveryRef {
  readonly channelAudience?: ChannelAudience;
  readonly channelKind: string;
  readonly channelName: string;
  readonly deliveryId: string;
  readonly requestId?: string;
  readonly requestTraceContext?: InstrumentationTraceContext;
}
export interface InstrumentationDeliveryConsumedEvent extends InstrumentationChannelDeliveryScope {
  readonly type: "delivery.consumed";
  readonly input?: InstrumentationChannelDeliveryInput;
}
export interface InstrumentationDeliverySettledEvent extends DeliverySettledData {
  readonly type: "delivery.settled";
  readonly idempotencyKey: string;
  readonly sessionId: string;
}
export interface InstrumentationInteractionOpenedEvent {
  readonly type: "interaction.opened";
  readonly call?: {
    readonly callId: string;
    readonly name: string;
  };
  readonly idempotencyKey: string;
  readonly interactionId: string;
  readonly kind: InstrumentationInteractionKind;
  readonly request?: InstrumentationInteractionRequest;
  readonly scope: InstrumentationScope;
}
export interface InstrumentationInteractionSettledEvent {
  readonly type: "interaction.settled";
  readonly error?: unknown;
  readonly idempotencyKey: string;
  readonly kind: InstrumentationInteractionKind;
  readonly interactionId: string;
  readonly outcome: InstrumentationInteractionOutcome;
  readonly answer?: InstrumentationAnswer;
  readonly scope: InstrumentationScope;
}
export interface InstrumentationModelCallCompletedEvent {
  readonly type: "model.call.settled";
  readonly outcome: "completed";
  readonly providerMetadata?: Readonly<Record<string, unknown>>;
  readonly content?: readonly InstrumentationContentPart[];
  readonly finishReason: string;
  readonly idempotencyKey: string;
  readonly responseModelId?: string;
  readonly responseId?: string;
  readonly scope: InstrumentationScope;
  readonly usage: InstrumentationUsage;
}
export interface InstrumentationModelCallFailedEvent {
  readonly type: "model.call.settled";
  readonly outcome: "failed";
  readonly error?: unknown;
  readonly idempotencyKey: string;
  readonly scope: InstrumentationScope;
}
export interface InstrumentationModelCallStartedEvent {
  readonly type: "model.call.started";
  readonly idempotencyKey: string;
  readonly input?: InstrumentationModelInput;
  readonly model: InstrumentationModelRef;
  readonly runtimeContext?: Readonly<Record<string, unknown>>;
  readonly scope: InstrumentationScope;
}
export interface InstrumentationModelInput {
  readonly instructions?: unknown;
  readonly messages: readonly unknown[];
  readonly tools?: readonly unknown[];
}
export interface InstrumentationModelRef {
  readonly modelId: string;
  readonly provider: string;
}
export interface InstrumentationModelRetriedEvent {
  readonly type: "model.retried";
  readonly idempotencyKey: string;
  readonly scope: InstrumentationScope;
  readonly error?: unknown;
}
export interface InstrumentationModelSettledEvent {
  readonly type: "model.settled";
  readonly outcome: InstrumentationModelOutcome;
  readonly idempotencyKey: string;
  readonly scope: InstrumentationScope;
  readonly error?: unknown;
}
export interface InstrumentationModelStartedEvent {
  readonly type: "model.started";
  readonly idempotencyKey: string;
  readonly operation: InstrumentationOperationRef;
  readonly runtimeContext?: Readonly<Record<string, unknown>>;
  readonly scope: InstrumentationScope;
}
export interface InstrumentationOperationRef {
  readonly modelId: string;
  readonly operationId: string;
  readonly provider: string;
}
export interface InstrumentationParentLineage {
  readonly callId: string;
  readonly sessionId: string;
  readonly subagentName?: string;
  readonly turnId: string;
}
export interface InstrumentationPrincipalSummary {
  readonly id?: string;
  readonly type: InstrumentationPrincipalType;
}
export interface InstrumentationScope {
  readonly traceSessionId?: string;
  readonly channelAudience?: ChannelAudience;
  readonly runId: string;
  readonly attempt: number;
  readonly functionId?: string;
  readonly rootSessionId: string;
  readonly sessionId: string;
  readonly turnId?: string;
}
export interface InstrumentationSessionEndedEvent {
  readonly type: "session.ended";
  readonly outcome: InstrumentationSessionOutcome;
  readonly error?: unknown;
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly turnId?: string;
}
export interface InstrumentationSessionStartedEvent {
  readonly traceSessionId?: string;
  readonly type: "session.started";
  readonly agentName?: string;
  readonly channelKind?: string;
  readonly channelType?: string;
  readonly channelAudience?: ChannelAudience;
  readonly idempotencyKey: string;
  readonly parentLineage?: InstrumentationParentLineage;
  readonly parentTraceContext?: InstrumentationTraceContext;
  readonly rootSessionId: string;
  readonly scheduleId?: string;
  readonly sessionId: string;
  readonly title?: string;
  readonly traceSeed?: InstrumentationTraceSeed;
}
export interface InstrumentationTraceSeed extends InstrumentationTraceContext {
  readonly decision?: InstrumentationDecision;
}
export interface InstrumentationTurnSettledEvent {
  readonly type: "turn.settled";
  readonly outcome: InstrumentationTurnOutcome;
  readonly error?: unknown;
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly turnId: string;
}
export interface InstrumentationTurnStartedEvent {
  readonly traceSessionId?: string;
  readonly type: "turn.started";
  readonly agentName?: string;
  readonly currentPrincipal?: InstrumentationPrincipalSummary;
  readonly idempotencyKey: string;
  readonly initiatorPrincipal?: InstrumentationPrincipalSummary;
  readonly parentLineage?: InstrumentationParentLineage;
  readonly parentTraceContext?: InstrumentationTraceContext;
  readonly rootSessionId: string;
  readonly sequence: number;
  readonly sessionId: string;
  readonly turnId: string;
}
export interface InstrumentationUsage {
  readonly costUsd?: number;
  readonly inputTokenDetails?: {
    readonly cacheReadTokens?: number;
    readonly cacheWriteTokens?: number;
  };
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}
export type InstrumentationAnswer = ResponseValue;
export type InstrumentationCallOutcome = CallOutcome;
export type InstrumentationContentPart =
  | {
      readonly type: "text";
      readonly text: string;
    }
  | {
      readonly type: "reasoning";
      readonly text: string;
    }
  | {
      readonly type: "tool-call";
      readonly callId: string;
      readonly input: unknown;
      readonly toolName: string;
    }
  | {
      readonly type: "tool-result";
      readonly callId: string;
      readonly input: unknown;
      readonly output: unknown;
      readonly toolName: string;
    }
  | {
      readonly type: "tool-error";
      readonly callId: string;
      readonly error: unknown;
      readonly input: unknown;
      readonly toolName: string;
    };
export type InstrumentationCorrelatedEvent =
  | InstrumentationDeliveryConsumedEvent
  | InstrumentationDeliverySettledEvent
  | InstrumentationInteractionOpenedEvent
  | InstrumentationInteractionSettledEvent
  | memory.InstrumentationMemoryOperationStartedEvent
  | memory.InstrumentationMemoryOperationTerminalEvent
  | InstrumentationModelCallStartedEvent
  | InstrumentationModelCallTerminalEvent
  | InstrumentationCallRequestedEvent
  | InstrumentationCallSettledEvent;
export type InstrumentationEvent<K extends LifecycleEvent["type"] = LifecycleEvent["type"]> =
  Extract<
    LifecycleEvent,
    {
      readonly type: K;
    }
  >;
export type InstrumentationInteractionKind = InteractionRequest["kind"];
export type InstrumentationInteractionOutcome = InteractionOutcome;
export type InstrumentationInteractionRequest = Pick<
  InteractionRequest,
  "allowFreeform" | "display" | "options" | "prompt" | "title"
>;
export type InstrumentationModelCallTerminalEvent =
  InstrumentationModelCallCompletedEvent | InstrumentationModelCallFailedEvent;
export type InstrumentationModelOutcome = ModelOutcome | "cancelled";
export type InstrumentationModelTerminalEvent =
  InstrumentationModelRetriedEvent | InstrumentationModelSettledEvent;
export type InstrumentationPointEvent =
  | InstrumentationModelStartedEvent
  | InstrumentationModelTerminalEvent
  | InstrumentationSessionStartedEvent
  | InstrumentationSessionEndedEvent
  | InstrumentationTurnStartedEvent
  | InstrumentationTurnSettledEvent;
export type InstrumentationPrincipalType = (typeof INSTRUMENTATION_PRINCIPAL_TYPES)[number];
export type InstrumentationSessionOutcome = SessionOutcome;
export type InstrumentationTraceContext = TraceContext;
export type InstrumentationTurnOutcome = TurnOutcome;
interface InstrumentationChannelDeliveryScope {
  readonly traceSessionId?: string;
  readonly agentName?: string;
  readonly delivery?: InstrumentationChannelDeliveryRef;
  readonly deliveryId: string;
  readonly idempotencyKey: string;
  readonly rootSessionId: string;
  readonly sequence?: number;
  readonly sessionId: string;
  readonly traceSeed?: InstrumentationTraceSeed;
  readonly turnId?: string;
}
type LifecycleEvent = InstrumentationCorrelatedEvent | InstrumentationPointEvent;
```

### src/instrumentation/memory.d.ts

```ts
export interface InstrumentationMemoryOperation {
  readonly idempotencyKey: string;
  readonly operationName: InstrumentationMemoryOperationName;
  readonly phase: string;
  readonly slot: string;
  readonly storeId: string;
  readonly turnId?: string;
}
export interface InstrumentationMemoryOperationCompletedEvent extends InstrumentationMemoryOperationEvent {
  readonly type: "memory.operation.settled";
  readonly outcome: "completed";
  readonly recordCount?: number;
  readonly outputRecords?: readonly InstrumentationMemoryRecord[];
}
export interface InstrumentationMemoryOperationEvent extends InstrumentationMemoryOperation {
  readonly traceSessionId?: string;
  readonly rootSessionId: string;
  readonly sessionId: string;
}
export interface InstrumentationMemoryOperationFailedEvent extends InstrumentationMemoryOperationEvent {
  readonly type: "memory.operation.settled";
  readonly outcome: "failed";
  readonly error?: unknown;
}
export interface InstrumentationMemoryOperationStartedEvent extends InstrumentationMemoryOperationEvent {
  readonly type: "memory.operation.started";
}
export interface InstrumentationMemoryRecord {
  readonly content: string;
  readonly id?: string;
}
export type InstrumentationMemoryOperationName = "search_memory" | "upsert_memory";
export type InstrumentationMemoryOperationTerminalEvent =
  InstrumentationMemoryOperationCompletedEvent | InstrumentationMemoryOperationFailedEvent;
```

### src/instrumentation/provider.d.ts

```ts
export declare const PROVIDER: unique symbol;
export interface InstrumentationContext {
  readonly state: InstrumentationState;
}
export interface InstrumentationDefinition {
  readonly tracePolicy?: TraceCapturePolicy;
  readonly events?: InstrumentationEvents;
  readonly setup?: (context: InstrumentationSetupContext) => void | PromiseLike<void>;
  readonly flush?: () => void | PromiseLike<void>;
  readonly shutdown?: () => void | PromiseLike<void>;
}
export interface InstrumentationSetupContext {
  readonly agentName: string;
  readonly environment: ConversationEnvironment;
  readonly evaluation?: {
    readonly runId: string;
  };
  readonly frameworkVersion: string;
}
export interface InstrumentationState {
  get(): JsonValue | undefined;
  set(value: JsonValue | undefined): void;
}
export type InstrumentationEvents = {
  readonly [TType in InstrumentationEvent["type"]]?: InstrumentationHandler<TType>;
};
export type InstrumentationHandler<K extends InstrumentationEvent["type"]> = (
  event: InstrumentationEvent<K>,
  ctx: InstrumentationContext,
) => void | PromiseLike<void>;
export type InstrumentationProvider = InstrumentationDefinition & {
  readonly [PROVIDER]: true;
};
```

### src/protocol/session-events/envelope.d.ts

```ts
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
```

### src/protocol/session-events/families/call.d.ts

```ts
export interface Capability {
  readonly kind: CapabilityKind;
  readonly name: string;
  readonly label?: string;
  readonly remote?: true;
}
export type CallOutcome = "completed" | "failed" | "rejected" | "interrupted" | "abandoned";
export type CapabilityKind = "tool" | "agent" | "skill" | "control";
```

### src/protocol/session-events/families/delivery.d.ts

```ts
export interface DeliverySettledData {
  readonly deliveryId: string;
  readonly outcome: DeliveryOutcome;
  readonly turnId?: string;
  readonly reason?: string;
}
export type DeliveryOutcome =
  "handled" | "awaiting-input" | "applied" | "ignored" | "refused" | "failed";
```

### src/protocol/session-events/families/interaction.d.ts

```ts
export interface InteractionOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly style?: InteractionOptionStyle;
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
export interface SignInChallenge {
  readonly name: string;
  readonly displayName?: string;
  readonly url?: string;
  readonly userCode?: string;
  readonly expiresAt?: string;
  readonly instructions?: string;
  readonly callbackUrl?: string;
  readonly grant?: string;
  readonly principal?: {
    readonly type: string;
    readonly id?: string;
    readonly issuer?: string;
  };
}
export type InteractionDisplay = "confirmation" | "select" | "text";
export type InteractionKind = "approval" | "question" | "sign-in" | "budget";
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
```

### src/protocol/session-events/families/model.d.ts

```ts
export type ModelOutcome = "completed" | "failed" | "interrupted" | "abandoned";
```

### src/protocol/session-events/families/response.d.ts

```ts
export interface ResponseValue {
  readonly optionId?: string;
  readonly text?: string;
}
```

### src/protocol/session-events/families/session.d.ts

```ts
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
}
export type SessionOutcome = "completed" | "failed";
```

### src/protocol/session-events/families/turn.d.ts

```ts
export type TurnOutcome = "completed" | "failed" | "cancelled";
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

### src/public/instrumentation/index.d.ts

```ts
export interface InstrumentationModelStartedInput {
  readonly channel: ChannelInfo;
  readonly modelInput: import("#instrumentation/lifecycle.js").InstrumentationModelInput;
  readonly session: InstrumentationSession;
  readonly run: InstrumentationRun;
  readonly turn?: InstrumentationTurn;
}
export interface InstrumentationRun {
  readonly id: string;
  readonly attempt: number;
}
export interface InstrumentationSession {
  readonly auth: {
    readonly current: SessionAuthContext | null;
    readonly initiator: SessionAuthContext | null;
  };
  readonly id: string;
  readonly parent?: SessionParent;
}
export interface InstrumentationTurn {
  readonly id: string;
  readonly sequence: number;
}
```

### src/public/instrumentation/otel.d.ts

```ts
export declare function agentRuns(options?: ManagedTraceOptions): OtelIntegration;
export declare function localTraces(options?: ManagedTraceOptions): OtelIntegration;
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

### src/shared/instrumentation-decision.d.ts

```ts
export type InstrumentationDecision =
  | {
      readonly action: "drop";
    }
  | {
      readonly action: "record";
      readonly recordInputs: boolean;
      readonly recordOutputs: boolean;
      readonly explicitContentAudience?: ChannelAudience;
    };
```

### src/shared/trace-policy.d.ts

```ts
export type TraceCaptureContext = {
  readonly agentName: string;
} & ConversationContext;
export type TraceCapturePolicy = (trace: TraceCaptureContext) => TracePolicyDecision | boolean;
export type TracePolicyDecision =
  | {
      readonly emit: false;
    }
  | {
      readonly emit: true;
      readonly recordInputs: boolean;
      readonly recordOutputs: boolean;
    };
```

### src/tracing/eve/otel-declaration.d.ts

```ts
declare const OTEL_DECLARATION: unique symbol;
declare const OTEL_INTEGRATION: unique symbol;
export declare function otel(options?: OtelOptions): OtelDeclaration;
export declare function otelIntegration(options?: OtelIntegrationOptions): OtelIntegration;
export interface ManagedTraceOptions {
  readonly exportPolicy?: SpanExportPolicy | readonly SpanExportPolicy[];
}
export interface OtelDeclaration extends InstrumentationProvider {
  readonly [OTEL_DECLARATION]: true;
  readonly options: OtelOptions;
}
export interface OtelIntegration extends InstrumentationProvider {
  readonly [OTEL_INTEGRATION]: true;
  readonly metricReaders: readonly MetricReader[];
  readonly runtimeContext?: (input: InstrumentationModelStartedInput) => JsonObject | undefined;
  readonly spanProcessors: readonly SpanProcessorSetting[];
}
export interface OtelIntegrationOptions extends ManagedTraceOptions {
  readonly spanProcessors?: readonly SpanProcessor[];
  readonly traceExporter?: SpanExporter;
  readonly metricReaders?: readonly MetricReader[];
  readonly runtimeContext?: (input: InstrumentationModelStartedInput) => JsonObject | undefined;
}
export interface OtelOptions {
  readonly functionId?: string;
  readonly traceChannelRequests?: boolean;
  readonly tracePolicy?: TraceCapturePolicy;
  readonly resource?: Readonly<Record<string, unknown>>;
  readonly sampler?: SamplerSetting;
  readonly propagators?: readonly PropagatorSetting[];
  readonly instrumentations?: readonly unknown[];
}
type PropagatorSetting =
  | {
      inject(...args: never[]): void;
      extract(...args: never[]): unknown;
      fields(): string[];
    }
  | "auto"
  | "none"
  | "tracecontext"
  | "baggage";
type SamplerSetting =
  | {
      shouldSample(...args: never[]): unknown;
      toString(): string;
    }
  | "auto"
  | "always_off"
  | "always_on"
  | "parentbased_always_off"
  | "parentbased_always_on"
  | "parentbased_traceidratio"
  | "traceidratio";
type SpanProcessorSetting = SpanProcessor | "auto";
```

### src/tracing/eve/span-export-policy.d.ts

```ts
export interface SpanExportContext {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly audience: ChannelAudience;
  readonly name: string;
  readonly spanId: string;
  readonly traceId: string;
}
export interface SpanExportPolicy {
  readonly span?: (span: SpanExportContext) => SpanExportDecision;
  readonly attribute?: (input: {
    readonly key: string;
    readonly span: SpanExportContext;
    readonly value: unknown;
  }) => SpanAttributeDecision;
}
export type SpanAttributeDecision =
  | {
      readonly emit: boolean;
    }
  | {
      readonly replace: true;
      readonly value: SpanExportAttributeValue;
    };
export type SpanExportAttributeValue =
  string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];
export type SpanExportDecision =
  | {
      readonly emit: boolean;
    }
  | {
      readonly redact: true;
      readonly inputs?: boolean;
      readonly outputs?: boolean;
    };
```
