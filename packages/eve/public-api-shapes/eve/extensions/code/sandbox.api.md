# eve/extensions/code/sandbox

## Export names

- BrokeredCredentialOptions: src/extensions/code/extension/lib/credentials.d.ts#BrokeredCredentialOptions
- authenticateGitHub: src/extensions/code/extension/lib/credentials.d.ts#authenticateGitHub
- authenticateVercel: src/extensions/code/extension/lib/credentials.d.ts#authenticateVercel
- installCodeTooling: src/extensions/code/extension/lib/sandbox.d.ts#installCodeTooling

## Peer boundaries

## Declaration closure

### src/extensions/code/extension/lib/credentials.d.ts

```ts
export declare function authenticateGitHub(
  sandbox: SandboxSession,
  options: BrokeredCredentialOptions,
): Promise<void>;
export declare function authenticateVercel(
  sandbox: SandboxSession,
  options: BrokeredCredentialOptions,
): Promise<void>;
export interface BrokeredCredentialOptions {
  readonly token: string;
  readonly delivery?: "firewall" | "command";
  readonly broker?: (
    sandbox: SandboxSession,
    rules: Record<string, Record<string, string>>,
  ) => Promise<void>;
}
```

### src/extensions/code/extension/lib/sandbox.d.ts

```ts
export declare function installCodeTooling(
  sandbox: ToolingSandbox,
  options?: {
    readonly vercel?: boolean;
  },
): Promise<void>;
type ToolingSandbox = Pick<SandboxSession, "resolvePath" | "run" | "writeTextFile">;
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
