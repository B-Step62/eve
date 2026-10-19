# eve/extensions/code

## Export names

- CredentialPolicyBroker: src/extensions/code/extension/extension.d.ts#CredentialPolicyBroker
- default: src/extensions/code/extension/extension.d.ts#_default

## Peer boundaries

- zod/v4/classic/external.d.cts#<module>
- zod/v4/classic/schemas.d.cts#ZodCustom
- zod/v4/classic/schemas.d.cts#ZodDefault
- zod/v4/classic/schemas.d.cts#ZodEnum
- zod/v4/classic/schemas.d.cts#ZodObject
- zod/v4/classic/schemas.d.cts#ZodOptional
- zod/v4/classic/schemas.d.cts#ZodString
- zod/v4/core/index.d.cts#<module>
- zod/v4/core/schemas.d.cts#$strict
- zod/v4/core/schemas.d.cts#$strip

## Declaration closure

### src/compiled/@standard-schema/spec/index.d.ts

```ts
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
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
interface StandardTypedV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
```

### src/extensions/code/extension/extension.d.ts

```ts
declare const _default: import("eve/extension").ExtensionHandle<
  z.ZodObject<
    {
      vercel: z.ZodOptional<
        z.ZodObject<
          {
            connector: z.ZodString;
            delivery: z.ZodDefault<
              z.ZodEnum<{
                command: "command";
                firewall: "firewall";
              }>
            >;
          },
          z.core.$strip
        >
      >;
      broker: z.ZodOptional<z.ZodCustom<CredentialPolicyBroker, CredentialPolicyBroker>>;
      worker: z.ZodOptional<
        z.ZodObject<
          {
            model: z.ZodString;
            reasoning: z.ZodEnum<{
              high: "high";
              low: "low";
              medium: "medium";
              minimal: "minimal";
              none: "none";
              "provider-default": "provider-default";
              xhigh: "xhigh";
            }>;
            openaiReasoningEffort: z.ZodOptional<
              z.ZodEnum<{
                high: "high";
                low: "low";
                max: "max";
                medium: "medium";
                minimal: "minimal";
                none: "none";
                xhigh: "xhigh";
              }>
            >;
          },
          z.core.$strip
        >
      >;
    },
    z.core.$strict
  >
>;
export type CredentialPolicyBroker = (
  sandbox: SandboxSession,
  rules: Record<string, Record<string, string>>,
) => Promise<void>;
```

### src/public/definitions/extension.d.ts

```ts
declare const MOUNTED_EXTENSION: unique symbol;
export interface ExtensionHandle<S extends StandardSchemaV1 = StandardSchemaV1> {
  (values: StandardSchemaV1.InferInput<S>): MountedExtension;
  readonly config: StandardSchemaV1.InferOutput<S>;
  readonly schema: S;
}
export interface MountedExtension {
  readonly [MOUNTED_EXTENSION]: true;
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
