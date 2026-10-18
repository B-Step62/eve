# eve

## Export names

- AgentBuildDefinition: src/shared/agent-definition.d.ts#AgentBuildDefinition
- AgentCompactionDefinition: src/shared/agent-definition.d.ts#PublicAgentCompactionDefinition
- AgentDefinition: src/public/definitions/agent.d.ts#AgentDefinition
- AgentExperimentalDefinition: src/shared/agent-definition.d.ts#AgentExperimentalDefinition
- AgentLimitsDefinition: src/shared/agent-definition.d.ts#AgentLimitsDefinition
- AgentModelDefinition: src/shared/agent-definition.d.ts#PublicAgentModelDefinition
- AgentModelOptionsDefinition: src/shared/agent-definition.d.ts#AgentModelOptionsDefinition
- AgentPromptCacheDefinition: src/shared/agent-definition.d.ts#AgentPromptCacheDefinition
- AgentReasoningDefinition: src/shared/agent-definition.d.ts#AgentReasoningDefinition
- AgentStaticModelDefinition: src/shared/agent-definition.d.ts#PublicAgentStaticModelDefinition
- AgentToolExposure: src/shared/agent-definition.d.ts#AgentToolExposure
- AgentWorkflowDefinition: src/shared/agent-definition.d.ts#AgentWorkflowDefinition
- AgentWorkflowRetentionDefinition: src/shared/agent-definition.d.ts#AgentWorkflowRetentionDefinition
- AgentWorkflowWorldDefinition: src/shared/agent-definition.d.ts#AgentWorkflowWorldDefinition
- DefinedAgent: src/public/definitions/agent.d.ts#DefinedAgent
- DynamicLocalSubagentDefinition: src/public/definitions/agent.d.ts#DynamicLocalSubagentDefinition
- DynamicResolveContext: src/dynamic/definition.d.ts#DynamicResolveContext
- DynamicSentinel: src/dynamic/definition.d.ts#DynamicSentinel
- DynamicSubagentDefinition: src/public/definitions/agent.d.ts#DynamicSubagentDefinition
- RemoteAgentDefinition: src/public/definitions/remote-agent.d.ts#RemoteAgentDefinition
- RemoteAgentDefinitionInput: src/public/definitions/remote-agent.d.ts#RemoteAgentDefinitionInput
- RemoteAgentUrl: src/public/definitions/remote-agent.d.ts#RemoteAgentUrl
- WorkspaceAgentDefinition: src/public/definitions/workspace-agent.d.ts#WorkspaceAgentDefinition
- WorkspaceAgentTransport: src/public/definitions/workspace-agent.d.ts#WorkspaceAgentTransport
- defineAgent: src/public/definitions/agent.d.ts#defineAgent
- defineDynamic: src/public/definitions/agent.d.ts#defineDynamic
- defineRemoteAgent: src/public/definitions/remote-agent.d.ts#defineRemoteAgent
- defineWorkspaceAgent: src/public/definitions/workspace-agent.d.ts#defineWorkspaceAgent

## Peer boundaries

- ai/dist/index.d.ts#LanguageModel

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
```

### src/client/types.d.ts

```ts
export type HeadersValue =
  | Readonly<Record<string, string>>
  | (() => Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>);
```

### src/context/keys.d.ts

```ts
export interface SessionAuth {
  readonly current: SessionAuthContext | null;
  readonly initiator: SessionAuthContext | null;
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
```

### src/protocol/session-events/families/call.d.ts

```ts
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
export type CallOutcome = "completed" | "failed" | "rejected" | "interrupted" | "abandoned";
export type CallOwner =
  | {
      readonly runId: string;
    }
  | {
      readonly callId: string;
    };
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
export type ContentCompleted = Envelope<"content.completed", ContentCompletedData>;
export type ContentFact = ContentCompleted;
export type ContentKind = "text" | "reasoning" | "result" | "file" | (string & {});
export type ContentPhase = "narration" | "reply" | (string & {});
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

### src/public/agents/auth.d.ts

```ts
export type OutboundAuthFn = () => Promise<{
  readonly headers: Readonly<Record<string, string>>;
}>;
```

### src/public/definitions/agent.d.ts

```ts
declare const DEFINED_AGENT: unique symbol;
export declare const defineDynamic: DefineDynamicAgent;
export declare function defineAgent<TAgent extends AgentDefinition>(
  definition: ExactDefinition<TAgent, AgentDefinition>,
): DefinedAgent<TAgent>;
export type AgentDefinition = PublicAgentDefinition;
export type DefinedAgent<TAgent extends AgentDefinition = AgentDefinition> = TAgent & {
  readonly [DEFINED_AGENT]: true;
};
export type DynamicLocalSubagentDefinition = Extract<
  AgentDefinition,
  {
    readonly model: PublicAgentStaticModelDefinition;
  }
> & {
  readonly description: string;
};
export type DynamicSubagentDefinition = DynamicLocalSubagentDefinition | RemoteAgentDefinition;
interface DefineDynamicAgent {
  <const TEvents extends DynamicEvents>(
    definition: {
      readonly build?: AgentBuildDefinition;
      readonly events: TEvents;
    } & DynamicSubagentDescriptionConstraint<TEvents>,
  ): DynamicSentinel<DynamicEventResult<TEvents>>;
}
type DynamicEventHandler<TEvents extends DynamicEvents> = Extract<
  NonNullable<TEvents[keyof TEvents]>,
  (...args: never[]) => unknown
>;
type DynamicEventResult<TEvents extends DynamicEvents> = Awaited<
  ReturnType<DynamicEventHandler<TEvents>>
>;
type DynamicSubagentDescriptionConstraint<TEvents extends DynamicEvents> =
  Exclude<
    Extract<DynamicEventResult<TEvents>, DefinedAgent>,
    DynamicLocalSubagentDefinition
  > extends never
    ? unknown
    : {
        readonly "Dynamic subagent definitions require a description": never;
      };
```

### src/public/definitions/exact.d.ts

```ts
export type ExactDefinition<TInput, TShape> = TInput & {
  readonly [TKey in Exclude<keyof TInput, keyof TShape>]: never;
};
```

### src/public/definitions/remote-agent.d.ts

```ts
export declare function defineRemoteAgent(input: RemoteAgentDefinitionInput): RemoteAgentDefinition;
export interface RemoteAgentDefinition {
  readonly auth?: OutboundAuthFn;
  readonly description: string;
  readonly forwardPrincipal?: boolean;
  readonly headers?: HeadersValue;
  readonly kind: "remote";
  readonly path: string;
  readonly tool?: AgentToolExposure;
  readonly url: RemoteAgentUrl;
}
export type RemoteAgentDefinitionInput = Omit<RemoteAgentDefinition, "kind" | "path"> & {
  readonly path?: string;
};
export type RemoteAgentUrl = string | (() => string | Promise<string>);
```

### src/public/definitions/workspace-agent.d.ts

```ts
export declare function defineWorkspaceAgent(
  definition: WorkspaceAgentDefinition,
): RemoteAgentDefinition;
export interface WorkspaceAgentDefinition {
  readonly description?: string;
  readonly forwardPrincipal?: boolean;
  readonly name: string;
  readonly tool?: AgentToolExposure;
  readonly transport?: WorkspaceAgentTransport;
}
export interface WorkspaceAgentTransport {
  readonly auth?: OutboundAuthFn;
  readonly headers?: HeadersValue;
  readonly url: RemoteAgentUrl;
}
```

### src/shared/agent-definition.d.ts

```ts
export declare const AGENT_WORKFLOW_RETENTION_VALUES: readonly [0, "default"];
export interface AgentAnthropicPromptCacheDefinition {
  readonly ttl?: AnthropicPromptCacheTtl;
}
export interface AgentBuildDefinition {
  readonly externalDependencies?: string[];
}
export interface AgentExperimentalDefinition {
  readonly workflow?: AgentWorkflowDefinition;
}
export interface AgentLimitsDefinition {
  readonly sessionTimeoutMs?: number | false;
  readonly maxInputTokensPerSession?: number | false;
  readonly maxOutputTokensPerSession?: number | false;
  readonly maxTokenCostUsdPerSession?: number | false;
}
export interface AgentModelOptionsDefinition {
  readonly providerOptions?: Record<string, JsonObject>;
  readonly promptCache?: AgentPromptCacheDefinition;
}
export interface AgentPromptCacheDefinition {
  readonly anthropic?: AgentAnthropicPromptCacheDefinition;
}
export interface AgentWorkflowDefinition {
  readonly modelCallsPerStep?: number;
  readonly retention?: AgentWorkflowRetentionDefinition;
  readonly world?: AgentWorkflowWorldDefinition;
}
export interface PublicAgentCompactionDefinition {
  readonly modelContextWindowTokens?: number;
  readonly model?: PublicAgentStaticModelDefinition;
  readonly thresholdPercent?: number;
}
export interface PublicAgentModelSelectionDefinition {
  readonly model: PublicAgentStaticModelDefinition;
  readonly reasoning?: AgentReasoningDefinition;
  readonly modelContextWindowTokens?: number;
  readonly modelOptions?: AgentModelOptionsDefinition;
}
export type AgentReasoningDefinition =
  "provider-default" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type AgentToolExposure = boolean | "deferred";
export type AgentWorkflowRetentionDefinition = (typeof AGENT_WORKFLOW_RETENTION_VALUES)[number];
export type AgentWorkflowWorldDefinition = string;
export type AnthropicPromptCacheTtl = "5m" | "1h";
export type PublicAgentDefinition = PublicAgentDefinitionBase &
  (
    | {
        readonly model: PublicAgentStaticModelDefinition;
        readonly modelContextWindowTokens?: number;
        readonly modelOptions?: AgentModelOptionsDefinition;
      }
    | {
        readonly model: PublicAgentDynamicModelDefinition;
        readonly modelContextWindowTokens?: never;
        readonly modelOptions?: never;
      }
  );
export type PublicAgentDynamicModelDefinition = DynamicSentinel<PublicAgentDynamicModelResult>;
export type PublicAgentDynamicModelResult =
  PublicAgentStaticModelDefinition | PublicAgentModelSelectionDefinition;
export type PublicAgentModelDefinition =
  PublicAgentStaticModelDefinition | PublicAgentDynamicModelDefinition;
export type PublicAgentStaticModelDefinition = string | LanguageModel;
type PublicAgentDefinitionBase = {
  readonly description?: string;
  readonly build?: AgentBuildDefinition;
  readonly compaction?: PublicAgentCompactionDefinition;
  readonly defaultTools?: boolean;
  readonly experimental?: AgentExperimentalDefinition;
  readonly reasoning?: AgentReasoningDefinition;
  readonly limits?: AgentLimitsDefinition;
  readonly tool?: AgentToolExposure;
};
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
