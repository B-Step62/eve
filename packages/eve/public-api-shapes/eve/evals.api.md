# eve/evals

## Export names

- Assertion: src/evals/types.d.ts#Assertion
- AssertionEvaluation: src/evals/types.d.ts#AssertionEvaluation
- AssertionHandle: src/evals/types.d.ts#AssertionHandle
- AssertionResult: src/evals/types.d.ts#AssertionResult
- AssertionSeverity: src/evals/types.d.ts#AssertionSeverity
- EveEval: src/evals/types.d.ts#EveEval
- EveEvalActionStatus: src/evals/types.d.ts#EveEvalActionStatus
- EveEvalAgentSession: src/evals/types.d.ts#EveEvalAgentSession
- EveEvalAssertions: src/evals/types.d.ts#EveEvalAssertions
- EveEvalConfig: src/evals/types.d.ts#EveEvalConfig
- EveEvalConfigContext: src/evals/types.d.ts#EveEvalConfigContext
- EveEvalConfigInput: src/evals/types.d.ts#EveEvalConfigInput
- EveEvalContext: src/evals/types.d.ts#EveEvalContext
- EveEvalCountMatcher: src/evals/match.d.ts#EveEvalCountMatcher
- EveEvalDefinition: src/evals/types.d.ts#EveEvalDefinition
- EveEvalDerivedFacts: src/evals/types.d.ts#EveEvalDerivedFacts
- EveEvalEventMatch: src/evals/match.d.ts#EveEvalEventMatch
- EveEvalInput: src/evals/types.d.ts#EveEvalInput
- EveEvalInteractionMatchOptions: src/evals/match.d.ts#EveEvalInteractionMatchOptions
- EveEvalJudgeConfig: src/evals/types.d.ts#EveEvalJudgeConfig
- EveEvalLiveTurn: src/evals/types.d.ts#EveEvalLiveTurn
- EveEvalResult: src/evals/types.d.ts#EveEvalResult
- EveEvalRunSummary: src/evals/types.d.ts#EveEvalRunSummary
- EveEvalScheduleDispatchResult: src/evals/types.d.ts#EveEvalScheduleDispatchResult
- EveEvalSession: src/evals/types.d.ts#EveEvalSession
- EveEvalSessionResult: src/evals/types.d.ts#EveEvalSessionResult
- EveEvalSkillLoad: src/evals/types.d.ts#EveEvalSkillLoad
- EveEvalSkillLoadMatchOptions: src/evals/match.d.ts#EveEvalSkillLoadMatchOptions
- EveEvalStreamEvent: src/evals/types.d.ts#EveEvalStreamEvent
- EveEvalSubagentCall: src/evals/types.d.ts#EveEvalSubagentCall
- EveEvalSubagentCallMatchOptions: src/evals/match.d.ts#EveEvalSubagentCallMatchOptions
- EveEvalTarget: src/evals/types.d.ts#EveEvalTarget
- EveEvalTargetCapabilities: src/evals/types.d.ts#EveEvalTargetCapabilities
- EveEvalTargetHandle: src/evals/types.d.ts#EveEvalTargetHandle
- EveEvalTaskResult: src/evals/types.d.ts#EveEvalTaskResult
- EveEvalToolCall: src/evals/types.d.ts#EveEvalToolCall
- EveEvalToolCallMatchOptions: src/evals/match.d.ts#EveEvalToolCallMatchOptions
- EveEvalTraceContext: src/evals/types.d.ts#EveEvalTraceContext
- EveEvalTurn: src/evals/types.d.ts#EveEvalTurn
- EveEvalTurnFailedError: src/evals/session.d.ts#EveEvalTurnFailedError
- EveEvalValueMatcher: src/evals/match.d.ts#EveEvalValueMatcher
- EveEvalVerdict: src/evals/types.d.ts#EveEvalVerdict
- EveEvalWaitForEventOptions: src/evals/types.d.ts#EveEvalWaitForEventOptions
- EveEvalWatchOptions: src/evals/types.d.ts#EveEvalWatchOptions
- JudgeBatch: src/evals/types.d.ts#JudgeBatch
- JudgeContext: src/evals/types.d.ts#JudgeContext
- JudgeInput: src/evals/types.d.ts#JudgeInput
- JudgeOpts: src/evals/types.d.ts#JudgeOpts
- JudgeQuestion: src/evals/types.d.ts#JudgeQuestion
- MockModelMessage: src/evals/mock-model.d.ts#MockModelMessage
- MockModelOptions: src/evals/mock-model.d.ts#MockModelOptions
- MockModelRequest: src/evals/mock-model.d.ts#MockModelRequest
- MockModelResponder: src/evals/mock-model.d.ts#MockModelResponder
- MockModelResponse: src/evals/mock-model.d.ts#MockModelResponse
- MockModelTool: src/evals/mock-model.d.ts#MockModelTool
- MockModelToolCall: src/evals/mock-model.d.ts#MockModelToolCall
- MockModelToolResult: src/evals/mock-model.d.ts#MockModelToolResult
- MockModelUsage: src/evals/mock-model.d.ts#MockModelUsage
- ScoreInput: src/evals/types.d.ts#ScoreInput
- ToolStub: src/tool-stubs/types.d.ts#ToolStub
- ToolStubOutcome: src/tool-stubs/types.d.ts#ToolStubOutcome
- defineEval: src/evals/define-eval.d.ts#defineEval
- defineEvalConfig: src/evals/define-eval-config.d.ts#defineEvalConfig
- mockModel: src/evals/mock-model.d.ts#mockModel

## Peer boundaries

- ai/dist/index.d.ts#LanguageModel
- zod/index.d.cts#"/tmp/eve-api-owned-types/node_modules/.pnpm/zod@4.5.4/node_modules/zod/index"
- zod/v4/classic/schemas.d.cts#ZodNumber
- zod/v4/classic/schemas.d.cts#ZodObject
- zod/v4/classic/schemas.d.cts#ZodOptional
- zod/v4/core/core.d.cts#output
- zod/v4/core/index.d.cts#"/tmp/eve-api-owned-types/node_modules/.pnpm/zod@4.5.4/node_modules/zod/v4/core/index"
- zod/v4/core/schemas.d.cts#$strip

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

### src/channel/types.d.ts

```ts
export type TurnPolicy = "steer" | "queue";
```

### src/client/agent-session.d.ts

```ts
export declare class ClientAgentSession implements SessionReader {
  #private;
  readonly name: string;
  readonly id: string;
  readonly taskId: string | undefined;
  constructor(context: ClientSessionContext, opened: ChildOpened);
  stream(options?: SessionStreamOptions): AsyncGenerator<SessionStreamEvent>;
  follow(options?: SessionStreamOptions): AsyncIterable<FollowedEvent>;
}
```

### src/client/open-stream.d.ts

```ts
export interface FollowedEvent {
  readonly event: SessionStreamEvent;
  readonly cursor: number;
}
```

### src/client/session.d.ts

```ts
export interface ClientSessionContext {
  readonly host: string;
  readonly redirect?: ClientRedirectPolicy;
  resolveHeaders(perRequest?: Readonly<Record<string, string>>): Promise<Headers>;
}
```

### src/client/types.d.ts

```ts
export interface ClientSessionState {
  readonly sessionId: string;
  readonly streamIndex: number;
}
export interface CreateSessionOptions {
  readonly stubs?: readonly ToolStub[];
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
}
export interface ResolvedStreamReconnectPolicy {
  readonly streamOpenReconnectPolicy?: StreamReconnectRetryPolicy;
  readonly retryableErrorStatuses?: readonly number[];
}
export interface SendTurnInput<TOutput = unknown> extends SendTurnOptions<TOutput> {
  readonly message: MessageContent;
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
export type ClientRedirectPolicy = NonNullable<RequestInit["redirect"]>;
export type RespondTurnOptions<TOutput = unknown> = Omit<SendTurnOptions<TOutput>, "turnPolicy">;
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

### src/evals/define-eval-config.d.ts

```ts
export declare function defineEvalConfig<TContext = undefined>(
  input: EveEvalConfigInput<TContext>,
): EveEvalConfig<TContext>;
```

### src/evals/define-eval.d.ts

```ts
export declare function defineEval<TConfig extends EveEvalConfig = EveEvalConfig>(
  input: EveEvalInput<EveEvalConfigContext<TConfig>>,
): EveEvalDefinition<EveEvalConfigContext<TConfig>>;
```

### src/evals/match.d.ts

```ts
export interface EveEvalInteractionMatchOptions {
  readonly display?: EveEvalValueMatcher<Interaction["request"]["display"]>;
  readonly input?: EveEvalValueMatcher<JsonObject>;
  readonly optionIds?: EveEvalValueMatcher<readonly string[]>;
  readonly prompt?: EveEvalValueMatcher<string>;
  readonly kind?: Interaction["request"]["kind"];
  readonly toolName?: string;
}
export interface EveEvalSubagentCallMatchOptions {
  readonly callId?: EveEvalValueMatcher<string | undefined>;
  readonly childSessionId?: EveEvalValueMatcher<string | undefined>;
  readonly output?: EveEvalValueMatcher;
  readonly status?: EveEvalSubagentCall["status"];
  readonly count?: EveEvalCountMatcher;
}
export interface EveEvalToolCallMatchOptions {
  readonly input?: EveEvalValueMatcher<JsonObject>;
  readonly output?: EveEvalValueMatcher;
  readonly status?: EveEvalToolCall["status"];
  readonly count?: EveEvalCountMatcher;
}
export type EveEvalCountMatcher = number | ((count: number) => boolean);
export type EveEvalEventMatch<
  TType extends SessionStreamEvent["type"] = SessionStreamEvent["type"],
> = TType extends SessionStreamEvent["type"]
  ? {
      readonly type: TType;
      readonly data?: EveEvalDeepMatcher<
        Extract<
          SessionStreamEvent,
          {
            type: TType;
          }
        > extends {
          data: infer TData;
        }
          ? TData
          : never
      >;
      readonly scope?: EveEvalDeepMatcher<Scope>;
      readonly count?: EveEvalCountMatcher;
    }
  : never;
export type EveEvalSkillLoadMatchOptions = Omit<EveEvalToolCallMatchOptions, "input">;
export type EveEvalValueMatcher<T = JsonValue | undefined> = EveEvalDeepMatcher<T>;
type EveEvalDeepMatcher<T> =
  | RegExp
  | ((value: T) => boolean)
  | (T extends readonly (infer TEntry)[]
      ? readonly EveEvalDeepMatcher<TEntry>[]
      : T extends object
        ? {
            readonly [K in keyof T]?: EveEvalDeepMatcher<T[K]>;
          }
        : T);
```

### src/evals/mock-model.d.ts

```ts
export declare function mockModel(
  input?: MockModelOptions | MockModelResponder | string,
): LanguageModel;
export interface MockModelMessage {
  readonly role: "assistant" | "system" | "tool" | "user";
  readonly text: string;
}
export interface MockModelOptions {
  readonly modelId?: string;
  readonly provider?: string;
  readonly respond?: MockModelResponder | string;
}
export interface MockModelRequest {
  readonly messages: readonly MockModelMessage[];
  readonly userMessages: readonly string[];
  readonly lastUserMessage: string | null;
  readonly userMessageCount: number;
  readonly tools: readonly MockModelTool[];
  readonly toolResults: readonly MockModelToolResult[];
}
export interface MockModelResponse {
  readonly text?: string;
  readonly toolCalls?: readonly MockModelToolCall[];
  readonly usage?: MockModelUsage;
}
export interface MockModelTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: unknown;
}
export interface MockModelToolCall {
  readonly name: string;
  readonly input?: unknown;
  readonly id?: string;
}
export interface MockModelToolResult {
  readonly id: string;
  readonly name: string;
  readonly output: unknown;
  readonly isError: boolean;
}
export interface MockModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}
export type MockModelResponder = (
  request: MockModelRequest,
) => MockModelResponse | Promise<MockModelResponse | string> | string;
```

### src/evals/runner/reporters/types.d.ts

```ts
export interface EvalReporter {
  onRunStart(evaluations: readonly EveEval[], target: EveEvalTarget): void | Promise<void>;
  onEvalStart?(event: EveEvalStartEvent): void | Promise<void>;
  onSessionStart?(event: EveEvalSessionStartEvent): void | Promise<void>;
  onEvalComplete(result: EveEvalResult, context?: EveEvalCompleteContext): void | Promise<void>;
  onRunComplete(summary: EveEvalRunSummary): void | Promise<void>;
}
export interface EveEvalCompleteContext {
  readonly evaluation: EveEval;
  readonly target: EveEvalTarget;
  readonly traceContexts: readonly EveEvalTraceContext[];
}
export interface EveEvalSessionStartEvent extends EveEvalStartEvent {
  readonly primary: boolean;
  readonly sessionId: string;
  readonly traceContext: TraceContext;
}
export interface EveEvalStartEvent {
  readonly evaluation: EveEval;
  readonly startedAt: string;
  readonly target: EveEvalTarget;
}
```

### src/evals/session.d.ts

```ts
export declare class EveEvalTurnFailedError extends Error {
  readonly event: SessionStreamEvent | undefined;
  readonly turn: EveEvalTurn;
  constructor(turn: EveEvalTurn);
}
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
export interface AssertionHandle {
  gate(threshold?: number): this;
  soft(threshold?: number): this;
  atLeast(threshold: number): this;
  label(label: string): this;
}
export interface AssertionResult {
  readonly name: string;
  readonly key?: string;
  readonly score?: number;
  readonly severity: AssertionSeverity;
  readonly threshold?: number;
  readonly passed?: boolean;
  readonly errored: boolean;
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface EveEvalAssertions {
  succeeded(): AssertionHandle;
  awaitingInput(): AssertionHandle;
  messageIncludes(token: string | RegExp): AssertionHandle;
  calledTool(name: string, options?: EveEvalToolCallMatchOptions): AssertionHandle;
  calledSkill(skill: string, options?: EveEvalSkillLoadMatchOptions): AssertionHandle;
  notCalledTool(name: string): AssertionHandle;
  toolOrder(names: readonly string[]): AssertionHandle;
  usedNoTools(): AssertionHandle;
  maxToolCalls(max: number): AssertionHandle;
  calledAgent(name: string, options?: EveEvalSubagentCallMatchOptions): AssertionHandle;
  noFailedCalls(): AssertionHandle;
  event<TType extends SessionStreamEvent["type"]>(
    type: TType,
    options?: Omit<
      Extract<
        EveEvalEventMatch,
        {
          type: TType;
        }
      >,
      "type"
    >,
  ): AssertionHandle;
  notEvent<TType extends SessionStreamEvent["type"]>(
    type: TType,
    options?: Omit<
      Extract<
        EveEvalEventMatch,
        {
          type: TType;
        }
      >,
      "type" | "count"
    >,
  ): AssertionHandle;
  eventOrder(matchers: readonly EveEvalEventMatch[]): AssertionHandle;
  eventsSatisfy(
    label: string,
    predicate: (events: readonly SessionStreamEvent[]) => boolean,
  ): AssertionHandle;
}
export interface EveEvalConfigInput<TContext = unknown> {
  readonly setup?: () => TContext | Promise<TContext>;
  teardown?(context: TContext | undefined): void | Promise<void>;
  readonly judge?: EveEvalJudgeConfig;
  readonly reporters?: readonly EvalReporter[];
  readonly maxConcurrency?: number;
  readonly timeoutMs?: number;
}
export interface EveEvalContext<TContext = unknown> extends EveEvalAssertions {
  readonly context: TContext;
  readonly abortSignal: AbortSignal;
  readonly target: EveEvalTargetHandle;
  log(message: string): void;
  sleep(ms?: number): Promise<void>;
  session(options?: CreateSessionOptions): Promise<EveEvalSession>;
  send(message: SendTurnInput["message"], options?: SendTurnOptions): Promise<EveEvalTurn>;
  check(value: unknown, assertion: Assertion): AssertionHandle;
  score(evaluation: ScoreInput): AssertionHandle;
  require<T>(value: T, assertion: Assertion): Promise<T>;
  skip(reason: string): never;
  readonly judge: JudgeContext;
}
export interface EveEvalDerivedFacts {
  readonly toolCalls: readonly EveEvalToolCall[];
  readonly toolCallCount: number;
  readonly skillLoads: readonly EveEvalSkillLoad[];
  readonly subagentCalls: readonly EveEvalSubagentCall[];
  readonly subagentCallCount: number;
  readonly interactions: readonly Interaction[];
  readonly parked: boolean;
  readonly messageCount: number;
  readonly reasoningBlockCount: number;
  readonly models: readonly string[];
  readonly usage?: TokenUsage;
  readonly failureCode?: string;
}
export interface EveEvalInput<TContext = unknown> extends EveEvalBase {
  test(t: EveEvalContext<TContext>): void | Promise<void>;
}
export interface EveEvalJudgeConfig {
  readonly model?: DecisionModel;
  readonly modelOptions?: Pick<AgentModelOptionsDefinition, "providerOptions">;
}
export interface EveEvalLiveTurn {
  readonly view: SessionView;
  readonly events: readonly SessionStreamEvent[];
  readonly session: EveEvalSession;
  readonly sessionId: string;
  cancel(): Promise<Delivery>;
  result(): Promise<EveEvalTurn>;
  waitForEvent<TType extends SessionStreamEvent["type"]>(
    type: TType,
    options?: EveEvalWaitForEventOptions<TType>,
  ): Promise<EveEvalStreamEvent<TType>>;
  waitForToolCall(
    name: string,
    options?: Omit<EveEvalToolCallMatchOptions, "count">,
  ): Promise<EveEvalToolCall>;
}
export interface EveEvalOutputAssertions {
  outputEquals(value: unknown): AssertionHandle;
  outputMatches(schema: StandardSchemaV1): AssertionHandle;
}
export interface EveEvalResult {
  readonly id: string;
  readonly result: EveEvalTaskResult;
  readonly assertions: readonly AssertionResult[];
  readonly verdict: EveEvalVerdict;
  readonly error?: string;
  readonly skipReason?: string;
  readonly startedAt: string;
  readonly completedAt: string;
}
export interface EveEvalRunSummary {
  readonly target: EveEvalTarget;
  readonly results: readonly EveEvalResult[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly passed: number;
  readonly failed: number;
  readonly scored: number;
  readonly skipped: number;
  readonly errored: number;
}
export interface EveEvalScheduleDispatchResult {
  readonly scheduleId: string;
  readonly sessionIds: readonly string[];
}
export interface EveEvalSession
  extends EveEvalSessionDriver, EveEvalAssertions, EveEvalOutputAssertions {
  readonly view: SessionView;
}
export interface EveEvalSessionResult {
  readonly view: SessionView;
  readonly derived: EveEvalDerivedFacts;
  readonly events: readonly SessionStreamEvent[];
  readonly primary: boolean;
  readonly sessionId?: string;
  readonly state: ClientSessionState | undefined;
  readonly traceContexts: readonly TraceContext[];
}
export interface EveEvalSkillLoad {
  readonly skill: string;
  readonly output: JsonValue | undefined;
  readonly status: EveEvalActionStatus;
  readonly turnIndex: number;
  readonly sessionId?: string;
}
export interface EveEvalSubagentCall {
  readonly callId?: string;
  readonly childSessionId?: string;
  readonly name: string;
  readonly output?: JsonValue;
  readonly status: EveEvalActionStatus;
  readonly turnIndex: number;
  readonly sessionId?: string;
}
export interface EveEvalTarget {
  readonly kind: "local" | "remote";
  readonly url: string;
  readonly capabilities: EveEvalTargetCapabilities;
}
export interface EveEvalTargetCapabilities {
  readonly devRoutes: boolean;
}
export interface EveEvalTargetHandle extends EveEvalTarget {
  dispatchSchedule(scheduleId: string): Promise<EveEvalScheduleDispatchResult>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  attach(
    sessionId: string,
    opts?: {
      readonly startIndex?: number;
    },
  ): EveEvalSession;
}
export interface EveEvalTaskResult {
  readonly view?: SessionView;
  readonly sessionEnded: boolean;
  readonly data: unknown;
  readonly reply: string | undefined;
  readonly sessionId?: string;
  readonly status: RequestStatus;
  readonly events: readonly SessionStreamEvent[];
  readonly logs?: readonly string[];
  readonly derived: EveEvalDerivedFacts;
  readonly sessions?: readonly EveEvalSessionResult[];
  readonly runtimeIdentity?: RuntimeIdentity;
  readonly traceContexts: readonly EveEvalTraceContext[];
}
export interface EveEvalToolCall {
  readonly callId: string;
  readonly name: string;
  readonly input: JsonObject;
  readonly output: JsonValue | undefined;
  readonly status: EveEvalActionStatus;
  readonly turnIndex: number;
  readonly sessionId?: string;
}
export interface EveEvalTraceContext extends TraceContext {
  readonly primary: boolean;
  readonly sessionId: string;
}
export interface EveEvalTurn extends EveEvalAssertions, EveEvalOutputAssertions {
  readonly view: SessionView;
  readonly sessionEnded: boolean;
  readonly data: unknown;
  readonly events: readonly SessionStreamEvent[];
  readonly interactions: readonly Interaction[];
  readonly reply: string | undefined;
  readonly session: EveEvalSession;
  readonly sessionId: string;
  readonly status: RequestStatus;
  readonly toolCalls: readonly EveEvalToolCall[];
  requireToolCall(
    name: string,
    options?: Omit<EveEvalToolCallMatchOptions, "count">,
  ): EveEvalToolCall;
  expectOk(): this;
}
export interface EveEvalWatchOptions {
  readonly startIndex?: number;
  readonly until?: (event: SessionStreamEvent) => boolean;
}
export interface JudgeBatch<Questions extends Record<string, JudgeQuestion>> {
  readonly state?: JudgeInput;
  readonly questions: Questions & {
    readonly [Key in keyof Questions]: JudgeQuestionConstraint<Questions[Key]>;
  };
}
export interface JudgeContext {
  (criteria: string, opts?: JudgeOpts): AssertionHandle;
  <const Q extends JudgeQuestion>(
    question: Q & JudgeQuestionConstraint<Q>,
    opts?: JudgeOpts,
  ): AssertionHandle;
  <const Questions extends Record<string, JudgeQuestion>>(
    batch: JudgeBatch<Questions>,
    opts?: EveEvalJudgeConfig,
  ): {
    readonly [Key in keyof Questions]: AssertionHandle;
  };
}
export interface JudgeOpts extends EveEvalJudgeConfig {
  readonly on?: JsonValue;
}
export type AssertionSeverity = "gate" | "soft";
export type EveEval = EveEvalDefinition & {
  readonly id: string;
};
export type EveEvalActionStatus =
  "pending" | "completed" | "failed" | "rejected" | "interrupted" | "abandoned";
export type EveEvalAgentSession = Pick<ClientAgentSession, "name" | "id" | "stream" | "taskId">;
export type EveEvalConfig<TContext = unknown> = EveEvalConfigInput<TContext> & {
  readonly _tag: "EveEvalConfig";
};
export type EveEvalConfigContext<TConfig extends EveEvalConfig> = Awaited<
  ReturnType<NonNullable<TConfig["setup"]>>
>;
export type EveEvalDefinition<TContext = unknown> = EveEvalInput<TContext> & {
  readonly _tag: "EveEval";
};
export type EveEvalStreamEvent<
  TType extends SessionStreamEvent["type"] = SessionStreamEvent["type"],
> = Extract<
  SessionStreamEvent,
  {
    type: TType;
  }
>;
export type EveEvalVerdict = "passed" | "failed" | "scored" | "skipped";
export type EveEvalWaitForEventOptions<TType extends SessionStreamEvent["type"]> = Omit<
  Extract<
    EveEvalEventMatch,
    {
      type: TType;
    }
  >,
  "count" | "type"
>;
export type JudgeInput = string | JsonObject | readonly JsonValue[];
export type JudgeQuestion =
  | {
      readonly type: "boolean";
      readonly instructions: JudgeInput;
      readonly criteria?: {
        readonly true?: JudgeInput | null;
        readonly false?: JudgeInput | null;
      };
    }
  | {
      readonly type: "score";
      readonly instructions: JudgeInput;
      readonly criteria: readonly (JudgeInput | null)[];
    }
  | {
      readonly type: "choice";
      readonly instructions: JudgeInput;
      readonly criteria: Readonly<Record<string, JudgeInput | null>>;
      readonly expected: string;
    };
export type JudgeQuestionConstraint<Q extends JudgeQuestion> = Q extends {
  type: "choice";
}
  ? {
      readonly expected: NoInfer<Extract<keyof Q["criteria"], string>>;
    }
  : unknown;
export type ScoreInput = number | AssertionEvaluation | Promise<number | AssertionEvaluation>;
interface EveEvalBase {
  readonly description?: string;
  readonly judge?: EveEvalJudgeConfig;
  readonly timeoutMs?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly reporters?: readonly EvalReporter[];
}
interface EveEvalSessionDriver {
  readonly events: readonly SessionStreamEvent[];
  readonly transcript: string;
  readonly pendingInteractions: readonly Interaction[];
  readonly state: ClientSessionState;
  readonly id: string;
  nextTurn(options?: EveEvalWatchOptions): Promise<EveEvalTurn>;
  watch(options?: EveEvalWatchOptions): EveEvalLiveTurn;
  cancel(): Promise<Delivery>;
  compact(): Promise<EveEvalTurn>;
  requireInteraction(filter?: EveEvalInteractionMatchOptions): Interaction;
  respond(responses: readonly Answer[], options?: RespondTurnOptions): Promise<EveEvalTurn>;
  startRespond(
    responses: readonly Answer[],
    options?: RespondTurnOptions,
  ): Promise<EveEvalLiveTurn>;
  respondAll(optionId: string): Promise<EveEvalTurn>;
  send(message: SendTurnInput["message"], options?: SendTurnOptions): Promise<EveEvalTurn>;
  start(message: string, options?: SendTurnOptions): Promise<EveEvalLiveTurn>;
  sendFile(text: string, filePath: string, mediaType?: string): Promise<EveEvalTurn>;
  agent(opened: ChildOpened): EveEvalAgentSession;
}
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

### src/protocol/session-projection/request-status.d.ts

```ts
export type RequestStatus = "working" | "awaiting-input" | "completed" | "failed" | "cancelled";
```

### src/protocol/session-projection/tables.d.ts

```ts
export interface CallRow extends Introduced, Ended {
  readonly callId: string;
  readonly owner: CallOwner;
  readonly capability: Capability;
  readonly input?: JsonValue;
  readonly inputRef?: ValueReference;
  readonly inputError?: ErrorInfo;
  readonly status: "requested" | "running" | "settled";
  readonly clearedBy?: ClearedBy;
  readonly taskId?: string;
  readonly outcome?: CallOutcome;
  readonly output?: JsonValue;
  readonly outputRef?: ValueReference;
  readonly outputOf?: {
    readonly callId: string;
  };
  readonly error?: ErrorInfo;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly label?: string;
  readonly usage?: Usage;
}
export interface ChangeRow extends Introduced, Ended {
  readonly changeId: string;
  readonly kind: ContextKind;
  readonly turnId?: string;
  readonly cause?: Cause;
  readonly trigger?: {
    readonly inputTokens: number;
  };
  readonly status: "running" | "settled";
  readonly outcome?: ContextOutcome;
  readonly selects?: null | {
    readonly turnId: string;
  };
  readonly error?: ErrorInfo;
}
export interface ChildRow extends Introduced, ChildOpenedData {}
export interface DeliveryRow extends Introduced, Ended {
  readonly deliveryId: string;
  readonly principal?: Principal;
  readonly source?: DeliverySource;
  readonly clientContext?: JsonValue;
  readonly status: "admitted" | "consumed" | "settled";
  readonly turnId?: string;
  readonly consumedAt?: number;
  readonly parts?: readonly UserPart[];
  readonly outcome?: DeliveryOutcome;
  readonly reason?: string;
}
export interface Ended {
  readonly closedAt?: number;
  readonly endedAt?: string;
}
export interface InteractionRow extends Introduced, Ended {
  readonly interactionId: string;
  readonly subject: InteractionOpenedData["subject"];
  readonly request: InteractionOpenedData["request"];
  readonly origin?: InteractionOpenedData["origin"];
  readonly audience?: InteractionOpenedData["audience"];
  readonly status: "open" | "settled";
  readonly outcome?: InteractionOutcome;
  readonly reason?: string;
  readonly cause?: Cause;
  readonly response?: {
    readonly [key: string]: JsonValue;
  };
}
export interface Introduced {
  readonly introducedAt: number;
  readonly startedAt: string;
}
export interface PartRow extends Introduced {
  readonly partId: string;
  readonly runId: string;
  readonly kind: ContentKind;
  readonly phase: ContentPhase;
  readonly value?: JsonValue;
  readonly valueRef?: ValueReference;
  readonly interrupted?: true;
  readonly mediaType?: string;
  readonly fallbackText?: string;
}
export interface ResponseRow extends Introduced, Ended {
  readonly responseId: string;
  readonly interactionId: string;
  readonly deliveryId: string;
  readonly value?: ResponseValue;
  readonly status: "submitted" | "admitted" | "settled";
  readonly outcome?: ResponseOutcome;
  readonly reason?: string;
}
export interface RunRow extends Introduced, Ended {
  readonly runId: string;
  readonly owner: ModelOwner;
  readonly status: "requested" | "running" | "settled";
  readonly step?: number;
  readonly modelId?: string;
  readonly attempt?: number;
  readonly outcome?: ModelOutcome;
  readonly finishReason?: string;
  readonly generationId?: string;
  readonly error?: ErrorInfo;
  readonly usage?: Usage;
}
export interface SessionRow extends Ended {
  readonly status: "new" | "open" | "ended";
  readonly startedAt?: string;
  readonly parent?: {
    readonly sessionId: string;
    readonly callId: string;
  };
  readonly runtime?: RuntimeIdentity;
  readonly outcome?: SessionOutcome;
  readonly cause?: Cause;
  readonly error?: ErrorInfo;
  readonly turnCount: number;
  readonly latestTurnId?: string;
}
export interface SessionView {
  readonly position: number;
  readonly session: SessionRow;
  readonly deliveries: Table<DeliveryRow>;
  readonly turns: Table<TurnRow>;
  readonly runs: Table<RunRow>;
  readonly parts: Table<PartRow>;
  readonly calls: Table<CallRow>;
  readonly tasks: Table<TaskRow>;
  readonly interactions: Table<InteractionRow>;
  readonly responses: Table<ResponseRow>;
  readonly children: Table<ChildRow>;
  readonly changes: Table<ChangeRow>;
  readonly usage: UsageTotals;
  readonly selection?: null | {
    readonly turnId: string;
  };
}
export interface TaskRow extends Introduced, Ended {
  readonly taskId: string;
  readonly startedBy: {
    readonly callId: string;
  };
  readonly kind: string;
  readonly name: string;
  readonly status: "running" | "ended";
  readonly outcome?: TaskOutcome;
  readonly reason?: string;
  readonly error?: ErrorInfo;
}
export interface TurnRow extends Introduced, Ended {
  readonly turnId: string;
  readonly cause: Cause;
  readonly follows: string | null;
  readonly status: "running" | "settled";
  readonly runs?: number;
  readonly reply?: readonly string[];
  readonly outcome?: TurnOutcome;
  readonly error?: ErrorInfo;
  readonly endedBy?: Cause;
}
export interface UsageTotals {
  readonly total: Usage;
  readonly byKind: {
    readonly [kind: string]: Usage;
  };
}
type Table<TRow> = {
  readonly [id: string]: TRow;
};
```

### src/protocol/session-reader.d.ts

```ts
export interface AskedCall {
  readonly callId: string;
  readonly name: string;
  readonly input?: JsonValue;
}
export interface Interaction extends InteractionPlace {
  readonly interactionId: string;
  readonly request: Omit<InteractionRequest, "signIn"> & {
    readonly signIn?: Omit<SignInChallenge, "callbackUrl">;
  };
  readonly call?: AskedCall;
  readonly status: "open" | "settled";
  readonly outcome?: InteractionOutcome;
  readonly reason?: string;
  readonly answer?: Answer;
}
export interface InteractionPlace {
  readonly turnId: string;
  readonly stepIndex: number;
  readonly taskId?: string;
}
```

### src/shared/agent-definition.d.ts

```ts
export interface AgentAnthropicPromptCacheDefinition {
  readonly ttl?: AnthropicPromptCacheTtl;
}
export interface AgentModelOptionsDefinition {
  readonly providerOptions?: Record<string, JsonObject>;
  readonly promptCache?: AgentPromptCacheDefinition;
}
export interface AgentPromptCacheDefinition {
  readonly anthropic?: AgentAnthropicPromptCacheDefinition;
}
export type AnthropicPromptCacheTtl = "5m" | "1h";
```

### src/shared/delivery.d.ts

```ts
export interface Delivery<TOutput = unknown> extends AsyncIterable<SessionStreamEvent> {
  readonly sessionId: string;
  readonly deliveryId: string;
  result(): Promise<DeliveryResult<TOutput>>;
}
export interface DeliveryResult<TOutput = unknown> {
  readonly deliveryId: string;
  readonly sessionId: string;
  readonly status: RequestStatus;
  readonly sessionEnded: boolean;
  readonly reply: string | undefined;
  readonly data: TOutput | undefined;
  readonly events: SessionStreamEvent[];
  readonly interactions: readonly Interaction[];
}
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

### src/shared/token-usage.d.ts

```ts
export declare const tokenUsageWithCostSchema: z.ZodObject<
  {
    cacheReadTokens: z.ZodNumber;
    cacheWriteTokens: z.ZodNumber;
    inputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
    costUsd: z.ZodOptional<z.ZodNumber>;
  },
  z.core.$strip
>;
export type TokenUsage = z.infer<typeof tokenUsageWithCostSchema>;
```

### src/tool-stubs/types.d.ts

```ts
export type ToolStub = {
  readonly id: string;
  readonly tool: string;
  readonly match?: Readonly<Record<string, JsonObject | boolean>>;
} & (
  | {
      readonly outcome: ToolStubOutcome;
      readonly outcomes?: never;
    }
  | {
      readonly outcome?: never;
      readonly outcomes: readonly [ToolStubOutcome, ...ToolStubOutcome[]];
    }
);
export type ToolStubOutcome =
  | {
      readonly response: JsonValue;
      readonly throw?: never;
    }
  | {
      readonly response?: never;
      readonly throw: {
        readonly message: string;
        readonly name?: string;
      };
    };
```
