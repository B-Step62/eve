# eve/sandbox

## Export names

- DefaultSandbox: src/sandbox/providers/default.d.ts#DefaultSandbox
- DefaultSandboxEnvironmentOptions: src/sandbox/providers/default.d.ts#DefaultSandboxEnvironmentOptions
- RuntimeSandboxSession: src/shared/sandbox-session.d.ts#RuntimeSandboxSession
- SandboxCommandResult: src/shared/sandbox-session.d.ts#SandboxCommandResult
- SandboxEnvironment: src/shared/sandbox-environment.d.ts#SandboxEnvironment
- SandboxNetworkOptions: src/shared/sandbox-network-policy.d.ts#SandboxNetworkOptions
- SandboxNetworkPolicy: src/shared/sandbox-network-policy.d.ts#SandboxNetworkPolicy
- SandboxOpenArguments: src/shared/sandbox-environment.d.ts#SandboxOpenArguments
- SandboxProcess: src/shared/sandbox-session.d.ts#SandboxProcess
- SandboxReadBinaryFileOptions: src/shared/sandbox-session.d.ts#SandboxReadBinaryFileOptions
- SandboxReadFileOptions: src/shared/sandbox-session.d.ts#SandboxReadFileOptions
- SandboxReadTextFileOptions: src/shared/sandbox-session.d.ts#SandboxReadTextFileOptions
- SandboxRunOptions: src/shared/sandbox-session.d.ts#SandboxRunOptions
- SandboxSelector: src/shared/sandbox-environment.d.ts#SandboxSelector
- SandboxSelectorContext: src/shared/sandbox-environment.d.ts#SandboxSelectorContext
- SandboxSession: src/shared/sandbox-session.d.ts#SandboxSession
- SandboxSpawnOptions: src/shared/sandbox-session.d.ts#SandboxSpawnOptions
- SandboxWriteBinaryFileOptions: src/shared/sandbox-session.d.ts#SandboxWriteBinaryFileOptions
- SandboxWriteFileOptions: src/shared/sandbox-session.d.ts#SandboxWriteFileOptions
- SandboxWriteTextFileOptions: src/shared/sandbox-session.d.ts#SandboxWriteTextFileOptions
- defineParentSandbox: src/public/definitions/sandbox.d.ts#defineParentSandbox
- defineSandbox: src/public/definitions/sandbox.d.ts#defineSandbox

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

### src/context/keys.d.ts

```ts
export interface SessionAuth {
  readonly current: SessionAuthContext | null;
  readonly initiator: SessionAuthContext | null;
}
```

### src/public/definitions/sandbox.d.ts

```ts
export declare function defineParentSandbox(): SandboxSelector;
export declare function defineSandbox(definition: SandboxSelector): SandboxSelector;
```

### src/public/sandbox/docker-sandbox.d.ts

```ts
export interface DockerSandboxEnvironmentOptions {
  readonly image?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly pullPolicy?: DockerSandboxPullPolicy;
  readonly prepare?: (sandbox: SandboxSession) => Promise<void> | void;
}
export type DockerSandboxPullPolicy = "if-not-present" | "always" | "never";
```

### src/public/sandbox/microsandbox-sandbox.d.ts

```ts
export interface MicrosandboxSandboxCreateOptions {
  readonly image?: string;
  readonly cpus?: number;
  readonly memoryMiB?: number;
  readonly env?: Readonly<Record<string, string>>;
  readonly pullPolicy?: "always" | "if-missing" | "never";
  readonly prepare?: (sandbox: SandboxSession) => Promise<void> | void;
  readonly setup?: {
    readonly autoInstall?: boolean;
    readonly skipVerify?: boolean;
  };
}
```

### src/public/sandbox/vercel-sandbox.d.ts

```ts
export type VercelSandboxCreateOptions = SandboxNetworkOptions & {
  readonly [key: `__${string}`]: unknown;
  readonly token?: string;
  readonly teamId?: string;
  readonly projectId?: string;
  readonly fetch?: typeof fetch;
  readonly ports?: number[];
  readonly timeout?: number;
  readonly resources?: {
    vcpus: number;
  };
  readonly env?: Record<string, string>;
  readonly tags?: Record<string, string>;
  readonly region?: string;
  readonly failoverRegions?: string[];
  readonly snapshotExpiration?: number;
  readonly keepLastSnapshots?: {
    count: number;
    expiration?: number;
    deleteEvicted?: boolean;
  };
} & (
    | {
        image?: string;
        source?:
          | {
              type: "git";
              url: string;
              username?: never;
              password?: never;
              depth?: number;
              revision?: string;
            }
          | {
              type: "git";
              url: string;
              username: string;
              password: string;
              depth?: number;
              revision?: string;
            }
          | {
              type: "tarball";
              url: string;
            };
      }
    | {
        image?: never;
        source: {
          type: "snapshot";
          snapshotId: string;
        };
      }
  );
```

### src/sandbox/providers/default.d.ts

```ts
export declare const DefaultSandbox: {
  name: string;
  environment(options?: DefaultSandboxEnvironmentOptions): SandboxEnvironment<undefined>;
};
export interface DefaultSandboxEnvironmentOptions {
  readonly docker?: DockerSandboxEnvironmentOptions;
  readonly justBash?: {
    readonly autoInstall?: boolean;
    readonly prepare?: (sandbox: SandboxSession) => Promise<void> | void;
  };
  readonly microsandbox?: MicrosandboxSandboxCreateOptions;
  readonly prepare?: (sandbox: SandboxSession) => Promise<void> | void;
  readonly vercel?: VercelSandboxCreateOptions;
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
export type SandboxSelector = (
  context: SandboxSelectorContext,
) => Promise<RuntimeSandboxSession> | RuntimeSandboxSession;
```

### src/shared/sandbox-network-policy.d.ts

```ts
export interface SandboxNetworkOptions {
  readonly networkPolicy?: SandboxNetworkPolicy;
}
export type SandboxNetworkPolicy =
  | "allow-all"
  | "deny-all"
  | {
      allow?: string[] | Record<string, NetworkPolicyRule[]>;
      subnets?: {
        allow?: string[];
        deny?: string[];
      };
    };
type NetworkPolicyKeyValueMatcher = {
  key?: NetworkPolicyMatcher;
  value?: NetworkPolicyMatcher;
};
type NetworkPolicyMatch = {
  path?: NetworkPolicyMatcher;
  method?: string[];
  queryString?: NetworkPolicyKeyValueMatcher[];
  headers?: NetworkPolicyKeyValueMatcher[];
};
type NetworkPolicyMatcher =
  | {
      exact?: string;
    }
  | {
      startsWith?: string;
    }
  | {
      regex?: string;
    };
type NetworkPolicyRule = {
  match?: NetworkPolicyMatch;
} & (
  | {
      transform: NetworkTransformer[];
      forwardURL?: never;
    }
  | {
      transform?: never;
      forwardURL: string;
    }
);
type NetworkTransformer = {
  headers?: Record<string, string>;
};
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
