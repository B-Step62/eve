# eve/tools/workflow

## Export names

- WorkflowTool: src/tools/provided/workflow.d.ts#WorkflowTool
- WorkflowToolInput: src/tools/provided/workflow.d.ts#WorkflowToolInput
- WorkflowToolOptions: src/tools/provided/workflow.d.ts#WorkflowToolOptions
- workflow: src/tools/provided/workflow.d.ts#workflow

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

### src/protocol/session-events/envelope.d.ts

```ts
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
```

### src/protocol/session-events/families/delivery.d.ts

```ts
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

### src/protocol/session-events/families/response.d.ts

```ts
export interface Answer extends ResponseValue {
  readonly interactionId: string;
}
export interface ResponseValue {
  readonly optionId?: string;
  readonly text?: string;
}
```

### src/protocol/session-events/families/session.d.ts

```ts
export interface SessionPredecessor {
  readonly sessionId: string;
}
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

### src/public/definitions/connections/events.d.ts

```ts
export interface ConnectionEvent {
  readonly eventId: string;
  readonly name: string;
  readonly timestamp: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly cursor: string | null;
}
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

### src/shared/delivery.d.ts

```ts
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
export interface ApprovalResponder extends SessionAuthContext {
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
}
export interface ApprovedCall {
  readonly responder: ApprovalResponder;
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

### src/tools/provided/workflow.d.ts

```ts
export declare function workflow(options?: WorkflowToolOptions): WorkflowTool;
export interface WorkflowToolInput {
  readonly js: string;
}
export interface WorkflowToolOptions {
  readonly maxSubagents?: number;
}
export type WorkflowTool = WorkflowTaskToolDefinition<WorkflowToolInput, JsonValue>;
```

### src/tools/workflow-definition.d.ts

```ts
declare const WORKFLOW_TOOL_BRAND: unique symbol;
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
export type WorkflowSharedContext = Pick<
  ToolContext,
  "session" | "toolName" | "getToken" | "requireAuth"
> & {
  agent(name: string): AgentSession;
  agents: Readonly<Record<string, WorkflowAgentMetadata>>;
  ask(request: ToolQuestion, options?: ToolAskOptions): PromiseLike<ToolAnswer>;
};
export type WorkflowToolContext = WorkflowSharedContext &
  Pick<ToolContext, "callId"> & {
    readonly abortSignal: AbortSignal;
  };
interface WorkflowToolDefinitionBase<TInput, TOutput> extends PublicToolDefinition<
  TInput,
  TOutput
> {
  readonly [WORKFLOW_TOOL_BRAND]: true;
  approval?: Approval<unknown extends TInput ? Record<string, unknown> : TInput>;
  toModelOutput?: (output: TOutput) => ToolModelOutput | Promise<ToolModelOutput>;
}
```
