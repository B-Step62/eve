# eve/sessions

## Export names

- Delivery: src/shared/delivery.d.ts#Delivery
- DeliveryReadOptions: src/shared/delivery.d.ts#DeliveryReadOptions
- DeliveryResult: src/shared/delivery.d.ts#DeliveryResult
- Session: src/channel/session.d.ts#Session
- SessionNotActiveError: src/channel/session-not-active-error.d.ts#SessionNotActiveError
- SessionReader: src/shared/session.d.ts#SessionReader
- SessionRespondOptions: src/channel/session.d.ts#SessionRespondOptions
- SessionSendOptions: src/channel/session.d.ts#SessionSendOptions
- SessionStreamOptions: src/shared/session.d.ts#SessionStreamOptions

## Peer boundaries

## Declaration closure

### src/channel/session-not-active-error.d.ts

```ts
export declare class SessionNotActiveError extends Error {
  readonly code = "EVE_SESSION_NOT_ACTIVE";
  readonly retryable: boolean;
  constructor(options?: { readonly retryable?: boolean });
  static is(error: unknown): error is SessionNotActiveError;
}
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
  readonly history?: readonly SessionHistoryMessage[];
  readonly title?: string;
  readonly turnPolicy?: TurnPolicy;
};
interface SessionDeliveryOptions {
  readonly idempotencyKey?: string;
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
  readonly history?: readonly ImportedMessage[];
}
export interface DeliverySettledData {
  readonly deliveryId: string;
  readonly outcome: DeliveryOutcome;
  readonly turnId?: string;
  readonly reason?: string;
}
export interface ImportedMessage {
  readonly id?: string;
  readonly role: "user" | "assistant";
  readonly text: string;
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
  readonly grant?: string;
  readonly principal?: {
    readonly type: string;
    readonly id?: string;
    readonly issuer?: string;
  };
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

### src/shared/session-history.d.ts

```ts
export interface SessionHistoryMessage {
  readonly id?: string;
  readonly role: "user" | "assistant";
  readonly text: string;
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
