# eve/instrumentation

## Export names

- InstrumentationContext: src/instrumentation/provider.d.ts#InstrumentationContext
- InstrumentationDefinition: src/instrumentation/provider.d.ts#InstrumentationDefinition
- InstrumentationDisabled: src/instrumentation/provider.d.ts#InstrumentationDisabled
- InstrumentationEvent: src/instrumentation/lifecycle.d.ts#InstrumentationEvent
- InstrumentationEvents: src/instrumentation/provider.d.ts#InstrumentationEvents
- InstrumentationHandler: src/instrumentation/provider.d.ts#InstrumentationHandler
- InstrumentationModelInput: src/instrumentation/lifecycle.d.ts#InstrumentationModelInput
- InstrumentationModelStartedInput: src/public/instrumentation/index.d.ts#InstrumentationModelStartedInput
- InstrumentationParentLineage: src/instrumentation/lifecycle.d.ts#InstrumentationParentLineage
- InstrumentationProvider: src/instrumentation/provider.d.ts#InstrumentationProvider
- InstrumentationRun: src/public/instrumentation/index.d.ts#InstrumentationRun
- InstrumentationRuntimeContext: src/public/instrumentation/index.d.ts#InstrumentationRuntimeContext
- InstrumentationScope: src/instrumentation/lifecycle.d.ts#InstrumentationScope
- InstrumentationSession: src/public/instrumentation/index.d.ts#InstrumentationSession
- InstrumentationSetupContext: src/instrumentation/provider.d.ts#InstrumentationSetupContext
- InstrumentationState: src/instrumentation/provider.d.ts#InstrumentationState
- InstrumentationTurn: src/public/instrumentation/index.d.ts#InstrumentationTurn
- InstrumentationUsage: src/instrumentation/lifecycle.d.ts#InstrumentationUsage
- TraceCaptureContext: src/shared/trace-policy.d.ts#TraceCaptureContext
- TraceCapturePolicy: src/shared/trace-policy.d.ts#TraceCapturePolicy
- TracePolicyDecision: src/shared/trace-policy.d.ts#TracePolicyDecision
- defineInstrumentation: src/instrumentation/provider.d.ts#defineInstrumentation
- disableInstrumentation: src/instrumentation/provider.d.ts#disableInstrumentation
- isInstrumentationDisabled: src/instrumentation/provider.d.ts#isInstrumentationDisabled

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
  readonly outcome: ModelOutcome;
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
export declare const DISABLED: unique symbol;
export declare const PROVIDER: unique symbol;
export declare function defineInstrumentation(
  definition: InstrumentationDefinition,
): InstrumentationProvider;
export declare function disableInstrumentation(): InstrumentationDisabled;
export declare function isInstrumentationDisabled(value: unknown): value is InstrumentationDisabled;
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
export interface InstrumentationDisabled {
  readonly [DISABLED]: true;
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
export type InstrumentationRuntimeContext = JsonObject;
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
