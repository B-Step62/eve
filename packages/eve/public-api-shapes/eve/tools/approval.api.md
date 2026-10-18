# eve/tools/approval

## Export names

- Approval: src/approval/definition.d.ts#Approval
- ApprovalConfiguration: src/approval/definition.d.ts#ApprovalConfiguration
- ApprovalContext: src/approval/definition.d.ts#ApprovalContext
- ApprovalPolicy: src/approval/definition.d.ts#ApprovalPolicy
- ApprovalPrompt: src/approval/definition.d.ts#ApprovalPrompt
- ApprovalPromptContext: src/approval/definition.d.ts#ApprovalPromptContext
- ApprovalRequest: src/approval/definition.d.ts#ApprovalRequest
- ApprovalResponse: src/approval/definition.d.ts#ApprovalResponse
- ApprovalResponseAuth: src/approval/definition.d.ts#ApprovalResponseAuth
- ApprovalResponseContext: src/approval/definition.d.ts#ApprovalResponseContext
- ApprovalResponseDecision: src/approval/definition.d.ts#ApprovalResponseDecision
- ApprovalResponsePolicy: src/approval/definition.d.ts#ApprovalResponsePolicy
- ApprovalResponseSession: src/approval/definition.d.ts#ApprovalResponseSession
- ApprovalStatus: src/approval/definition.d.ts#ApprovalStatus
- AutoApprovalOptions: src/tools/approval/policies.d.ts#AutoApprovalOptions
- ConnectionToolAnnotations: src/approval/definition.d.ts#ConnectionToolAnnotations
- always: src/tools/approval/policies.d.ts#always
- auto: src/tools/approval/policies.d.ts#auto
- never: src/tools/approval/policies.d.ts#never
- once: src/tools/approval/policies.d.ts#once

## Peer boundaries

## Declaration closure

### src/ai/decision-types.d.ts

```ts
export type DecisionModel =
  | string
  | ({
      readonly provider: string;
      readonly modelId: string;
      readonly specificationVersion: string;
    } & (
      | {
          readonly doDecide: (...args: never[]) => unknown;
        }
      | {
          readonly doEvaluate: (...args: never[]) => unknown;
        }
    ));
```

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

### src/tools/approval/policies.d.ts

```ts
export declare function always<TInput = unknown>(): ApprovalPolicy<TInput>;
export declare function auto<TInput = unknown>(
  options?: AutoApprovalOptions,
): ApprovalPolicy<TInput>;
export declare function never<TInput = unknown>(): ApprovalPolicy<TInput>;
export declare function once<TInput = unknown>(options?: {
  readonly key?: (input: TInput) => string;
}): ApprovalPolicy<TInput>;
export interface AutoApprovalOptions {
  readonly model?: DecisionModel;
  readonly instructions?: string;
  readonly criteria?: {
    readonly clear?: string;
    readonly caution?: string;
  };
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
