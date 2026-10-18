# eve/extensions/self-modification/local

## Export names

- SelfModificationExtensionConfig: src/self-modification/config.d.ts#SelfModificationExtensionConfig
- default: src/self-modification/extension/extension.d.ts#_default

## Peer boundaries

- ai/dist/index.d.ts#LanguageModel

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

### src/self-modification/config.d.ts

```ts
export interface SelfModificationConfig {
  readonly local?: {
    readonly enabled?: boolean;
  };
}
export interface SelfModificationExtensionConfig extends SelfModificationConfig {
  readonly model?: AgentStaticModelDefinition;
  readonly reasoning?: AgentReasoningDefinition;
}
```

### src/self-modification/extension/extension.d.ts

```ts
declare const _default: import("eve/extension").ExtensionHandle<
  StandardSchemaV1<SelfModificationExtensionConfig, SelfModificationExtensionConfig>
>;
```

### src/shared/agent-definition.d.ts

```ts
export type AgentReasoningDefinition =
  "provider-default" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type PublicAgentStaticModelDefinition = string | LanguageModel;
```
