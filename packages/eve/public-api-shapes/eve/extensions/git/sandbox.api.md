# eve/extensions/git/sandbox

## Export names

- GitHubConfig: src/extensions/git/extension/lib/github-shell.d.ts#GitHubConfig
- GitHubLeaseRule: src/extensions/git/extension/lib/github-shell.d.ts#GitHubLeaseRule
- GitHubShellInput: src/extensions/git/extension/lib/github-shell.d.ts#GitHubShellInput
- GitHubShellOutput: src/extensions/git/extension/lib/github-shell.d.ts#GitHubShellOutput
- executeGitHubShell: src/extensions/git/extension/lib/github-shell.d.ts#executeGitHubShell
- githubShellApproval: src/extensions/git/extension/lib/github-shell.d.ts#githubShellApproval

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
```

### src/extensions/git/extension/lib/github-shell.d.ts

```ts
export declare function executeGitHubShell(
  input: GitHubShellInput,
  config: GitHubConfig | undefined,
  dependencies: GitHubShellDependencies,
): Promise<GitHubShellOutput>;
export declare function githubShellApproval(input: GitHubShellInput | undefined):
  | "not-applicable"
  | {
      type: "denied";
      reason: string;
    };
export interface GitHubAuthorizeRequest {
  readonly auth: SessionAuthContext | null;
  readonly repository: string;
  readonly token: string;
}
export interface GitHubConfig {
  readonly authorize?: GitHubAuthorize;
  readonly broker: (
    sandbox: SandboxSession,
    rules: Readonly<Record<string, readonly GitHubLeaseRule[]>> | null,
  ) => Promise<void>;
  readonly connector: string;
  readonly org: string;
}
export interface GitHubLeaseRule {
  readonly match?: {
    readonly headers?: readonly {
      readonly key?: {
        readonly exact: string;
      };
      readonly value?: {
        readonly exact?: string;
        readonly regex?: string;
      };
    }[];
  };
  readonly transform: readonly {
    readonly headers: Readonly<Record<string, string>>;
  }[];
}
export interface GitHubPermission {
  readonly access: "write";
  readonly provider: "github";
  readonly repositories: readonly string[];
}
export interface GitHubShellInput {
  readonly command: string;
  readonly description: string;
  readonly permissions: readonly GitHubPermission[];
  readonly workingDirectory?: string;
}
export interface GitHubShellOutput {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
  readonly truncated: boolean;
}
export type GitHubAuthorize = (request: GitHubAuthorizeRequest) => boolean | Promise<boolean>;
interface GitHubShellDependencies {
  readonly auth?: SessionAuthContext | null;
  readonly getConnectToken?: (
    connector: string,
    params: {
      authorizationDetails: {
        type: "github_app_installation";
        org: string;
        repositories: string[];
      }[];
      subject: {
        type: "app";
      };
    },
  ) => Promise<string>;
  readonly getSandbox: () => Promise<SandboxSession>;
  readonly sessionId: string;
}
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
interface WriteOptions<T> {
  path: string;
  content: T;
  signal?: AbortSignal;
}
```
