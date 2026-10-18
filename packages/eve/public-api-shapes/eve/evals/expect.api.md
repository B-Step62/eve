# eve/evals/expect

## Export names

- equals: src/evals/expect/index.d.ts#equals
- includes: src/evals/expect/index.d.ts#includes
- matches: src/evals/expect/index.d.ts#matches
- satisfies: src/evals/expect/index.d.ts#satisfies
- similarity: src/evals/expect/index.d.ts#similarity

## Peer boundaries

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

### src/evals/expect/index.d.ts

```ts
export declare function equals(expected: unknown): Assertion;
export declare function includes(substring: string | RegExp): Assertion;
export declare function matches(schema: StandardSchemaV1): Assertion;
export declare function satisfies<T = unknown>(
  predicate: (value: T) => boolean,
  label: string,
): Assertion;
export declare function similarity(expected: string): Assertion;
```

### src/evals/types.d.ts

```ts
export interface Assertion {
  readonly name: string;
  readonly severity: AssertionSeverity;
  readonly threshold?: number;
  score(value: unknown): number | Promise<number>;
  evaluate?(value: unknown): AssertionEvaluation | Promise<AssertionEvaluation>;
  gate(threshold?: number): Assertion;
  soft(threshold?: number): Assertion;
  atLeast(threshold: number): Assertion;
}
export interface AssertionEvaluation {
  readonly score: number;
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export type AssertionSeverity = "gate" | "soft";
```
