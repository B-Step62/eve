# eve/workflow-modules

## Export names

- workflow/FatalError: src/compiled/@workflow/errors/index.d.ts#FatalError
- workflow/api/getHookByToken: src/compiled/@workflow/core/runtime/resume-hook.d.ts#getHookByToken
- workflow/api/getRun: src/compiled/@workflow/core/runtime/run.d.ts#getRun
- workflow/api/resumeHook: src/compiled/@workflow/core/runtime/resume-hook.d.ts#resumeHook
- workflow/api/start: src/compiled/@workflow/core/runtime/start.d.ts#start
- workflow/createHook: src/compiled/@workflow/core/create-hook.d.ts#createHook
- workflow/createWebhook: src/compiled/@workflow/core/create-hook.d.ts#createWebhook
- workflow/getWorkflowMetadata: src/compiled/@workflow/core/step/get-workflow-metadata.d.ts#getWorkflowMetadata
- workflow/sleep: src/compiled/@workflow/core/sleep.d.ts#sleep

## Peer boundaries

- @types/node/crypto.d.ts#CryptoKey
- @types/node/crypto.d.ts#webcrypto
- zod/index.d.cts#"/tmp/eve-api-owned-types/node_modules/.pnpm/zod@4.5.4/node_modules/zod/index"
- zod/v4/classic/coerce.d.cts#ZodCoercedDate
- zod/v4/classic/coerce.d.cts#ZodCoercedNumber
- zod/v4/classic/compat.d.cts#ZodTypeAny
- zod/v4/classic/schemas.d.cts#ZodAny
- zod/v4/classic/schemas.d.cts#ZodArray
- zod/v4/classic/schemas.d.cts#ZodBoolean
- zod/v4/classic/schemas.d.cts#ZodCatch
- zod/v4/classic/schemas.d.cts#ZodCustom
- zod/v4/classic/schemas.d.cts#ZodDefault
- zod/v4/classic/schemas.d.cts#ZodDiscriminatedUnion
- zod/v4/classic/schemas.d.cts#ZodEnum
- zod/v4/classic/schemas.d.cts#ZodIntersection
- zod/v4/classic/schemas.d.cts#ZodLiteral
- zod/v4/classic/schemas.d.cts#ZodNullable
- zod/v4/classic/schemas.d.cts#ZodNumber
- zod/v4/classic/schemas.d.cts#ZodObject
- zod/v4/classic/schemas.d.cts#ZodOptional
- zod/v4/classic/schemas.d.cts#ZodPreprocess
- zod/v4/classic/schemas.d.cts#ZodRecord
- zod/v4/classic/schemas.d.cts#ZodString
- zod/v4/classic/schemas.d.cts#ZodType
- zod/v4/classic/schemas.d.cts#ZodUndefined
- zod/v4/classic/schemas.d.cts#ZodUnion
- zod/v4/classic/schemas.d.cts#ZodUnknown
- zod/v4/core/core.d.cts#$ZodBranded
- zod/v4/core/core.d.cts#output
- zod/v4/core/index.d.cts#"/tmp/eve-api-owned-types/node_modules/.pnpm/zod@4.5.4/node_modules/zod/v4/core/index"
- zod/v4/core/schemas.d.cts#$ZodTypeInternals
- zod/v4/core/schemas.d.cts#$loose
- zod/v4/core/schemas.d.cts#$strip

## Declaration closure

### src/compiled/@workflow/core/_ms.d.ts

```ts
export type StringValue = string;
```

### src/compiled/@workflow/core/_workflow-serde.d.ts

```ts
export declare const WORKFLOW_DESERIALIZE: unique symbol;
export declare const WORKFLOW_SERIALIZE: unique symbol;
```

### src/compiled/@workflow/core/create-hook.d.ts

```ts
export declare function createHook<T = any>(options?: HookOptions): Hook<T>;
export declare function createWebhook(
  options: WebhookOptions & {
    respondWith: "manual";
  },
): Webhook<RequestWithResponse>;
export declare function createWebhook(options?: WebhookOptions): Webhook<Request>;
export interface Hook<T = any> extends AsyncIterable<T>, Thenable<T> {
  token: string;
  getConflict(): Promise<Run<unknown> | null>;
  dispose(): void;
  [Symbol.dispose](): void;
}
export interface HookOptions {
  token?: string;
  experimental_minRetention?: StringValue | Date | number;
  experimental_force?: boolean;
  metadata?: Serializable;
  isWebhook?: boolean;
}
export interface RequestWithResponse extends Request {
  respondWith: (response: Response) => Promise<void>;
}
export interface Webhook<T extends Request> extends Hook<T> {
  url: string;
}
export interface WebhookOptions extends Omit<
  HookOptions,
  "token" | "isWebhook" | "experimental_minRetention" | "experimental_force"
> {
  respondWith?: Response | "manual";
}
interface Thenable<T> {
  then: Promise<T>["then"];
}
```

### src/compiled/@workflow/core/encryption.d.ts

```ts
export type CryptoKey = import("node:crypto").webcrypto.CryptoKey;
```

### src/compiled/@workflow/core/runtime/dynamic-workflow.d.ts

```ts
export interface DynamicWorkflowOptions {
  steps: Record<string, DynamicWorkflowStepReference>;
  exportName?: string;
}
export type DynamicStartOptions = StartOptions & {
  experimental_dynamic: DynamicWorkflowOptions;
};
export type DynamicWorkflowStepReference =
  | {
      readonly stepId: string;
    }
  | ((...args: any[]) => unknown);
```

### src/compiled/@workflow/core/runtime/resume-hook.d.ts

```ts
export declare function getHookByToken(token: string): Promise<Hook>;
export declare function resumeHook<T = any>(
  tokenOrHook: string | ResumableHook,
  payload: T,
  encryptionKeyOverride?: PayloadKey,
): Promise<ResumedHook>;
export interface Hook extends ResumableHook {
  readonly metadata: Promise<unknown>;
}
export type ResumedHook = Hook & {
  resilientResume?: boolean;
};
type ResumableHook = Omit<WorldHook, "metadata">;
```

### src/compiled/@workflow/core/runtime/run.d.ts

```ts
export declare class Run<TResult> {
  #private;
  static [WORKFLOW_SERIALIZE](instance: Run<unknown>): {
    runId: string;
    resilientStart: boolean;
  };
  static [WORKFLOW_DESERIALIZE](data: { runId: string; resilientStart?: boolean }): Run<unknown>;
  runId: string;
  constructor(
    runId: string,
    opts?: {
      resilientStart?: boolean;
    },
  );
  wakeUp(options?: StopSleepOptions): Promise<StopSleepResult>;
  cancel(options?: CancelRunOptions): Promise<void>;
  get exists(): Promise<boolean>;
  get status(): Promise<WorkflowRunStatus>;
  get returnValue(): Promise<TResult>;
  get workflowName(): Promise<string>;
  get createdAt(): Promise<Date>;
  get startedAt(): Promise<Date | undefined>;
  get completedAt(): Promise<Date | undefined>;
  get readable(): WorkflowReadableStream;
  getReadable<R = any>(options?: WorkflowReadableStreamOptions): WorkflowReadableStream<R>;
  get writable(): WritableStream;
  getWritable<W = any>(options?: WorkflowRunWritableStreamOptions): WritableStream<W>;
}
export declare function getRun<TResult>(runId: string): Run<TResult>;
export interface WorkflowReadableStreamOptions {
  namespace?: string;
  startIndex?: number;
  ops?: Promise<any>[];
  global?: Record<string, any>;
}
export interface WorkflowRunWritableStreamOptions {
  namespace?: string;
  ops?: Promise<any>[];
  global?: Record<string, any>;
}
export type WorkflowReadableStream<R = any> = ReadableStream<R> & {
  getTailIndex(): Promise<number>;
};
```

### src/compiled/@workflow/core/runtime/runs.d.ts

```ts
export interface CancelRunOptions {
  cancelReason?: string;
}
export interface StopSleepOptions {
  correlationIds?: string[];
  namespace?: string;
}
export interface StopSleepResult {
  stoppedCount: number;
}
```

### src/compiled/@workflow/core/runtime/start.d.ts

```ts
export declare function start(
  source: string,
  args: unknown[],
  options: DynamicStartOptions,
): Promise<Run<unknown>>;
export declare function start(source: string, options: DynamicStartOptions): Promise<Run<unknown>>;
export declare function start<TArgs extends unknown[], TResult>(
  workflow: WorkflowFunction<TArgs, TResult> | WorkflowMetadata,
  args: TArgs,
  options?: StartOptionsWithoutDeploymentId,
): Promise<Run<TResult>>;
export declare function start<TArgs extends unknown[], TResult>(
  workflow: WorkflowFunction<TArgs, TResult> | WorkflowMetadata,
  args: unknown[],
  options: StartOptionsWithDeploymentId,
): Promise<Run<unknown>>;
export declare function start<TResult>(
  workflow: WorkflowFunction<[], TResult> | WorkflowMetadata,
  options: StartOptionsWithDeploymentId,
): Promise<Run<unknown>>;
export declare function start<TResult>(
  workflow: WorkflowFunction<[], TResult> | WorkflowMetadata,
  options?: StartOptionsWithoutDeploymentId,
): Promise<Run<TResult>>;
export interface StartOptionsBase {
  world?: World;
  specVersion?: number;
  region?: string;
  attributes?: Record<string, string>;
  allowReservedAttributes?: boolean;
  experimental_retention?: RunRetention;
  replayedFromRunId?: string;
  namespace?: string;
}
export interface StartOptionsWithDeploymentId extends StartOptionsBase {
  deploymentId: "latest" | (string & {});
}
export interface StartOptionsWithoutDeploymentId extends StartOptionsBase {
  deploymentId?: undefined;
}
export type StartOptions = StartOptionsWithDeploymentId | StartOptionsWithoutDeploymentId;
export type WorkflowFunction<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;
export type WorkflowMetadata = {
  workflowId: string;
};
```

### src/compiled/@workflow/core/schemas.d.ts

```ts
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | {
      [key: string]: Serializable;
    }
  | ArrayBuffer
  | bigint
  | BigInt64Array
  | BigUint64Array
  | DataView
  | Date
  | DOMException
  | Error
  | Float32Array
  | Float64Array
  | Headers
  | Int8Array
  | Int16Array
  | Int32Array
  | Map<Serializable, Serializable>
  | ReadableStream<Uint8Array>
  | RegExp
  | Response
  | Set<Serializable>
  | URL
  | URLSearchParams
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | WritableStream<Uint8Array>
  | AbortController
  | AbortSignal
  | ((...args: Serializable[]) => Promise<Serializable>);
```

### src/compiled/@workflow/core/sealed-box.d.ts

```ts
export interface RunKeyPair {
  readonly scalar: Uint8Array;
  readonly publicKey: Uint8Array;
}
```

### src/compiled/@workflow/core/serialization/encryption.d.ts

```ts
declare const RUN_KEYS_BRAND: unique symbol;
declare const SEAL_TARGET_BRAND: unique symbol;
export interface RunPayloadKeys {
  readonly [RUN_KEYS_BRAND]: true;
  readonly aes: CryptoKey;
  readonly keyPair: RunKeyPair;
  readonly aad?: Uint8Array;
}
export interface SealTarget {
  readonly [SEAL_TARGET_BRAND]: true;
  readonly recipientPublicKey: Uint8Array;
  readonly aad?: Uint8Array;
}
export type PayloadKey = CryptoKey | SealTarget | RunPayloadKeys;
```

### src/compiled/@workflow/core/sleep.d.ts

```ts
export declare function sleep(date: Date): Promise<void>;
export declare function sleep(duration: StringValue): Promise<void>;
export declare function sleep(durationMs: number): Promise<void>;
```

### src/compiled/@workflow/core/step/get-workflow-metadata.d.ts

```ts
export declare function getWorkflowMetadata(): WorkflowMetadata;
```

### src/compiled/@workflow/core/workflow/get-workflow-metadata.d.ts

```ts
export interface WorkflowMetadata {
  workflowName: string;
  workflowRunId: string;
  workflowStartedAt: Date;
  url: string;
  features: {
    encryption: boolean;
  };
}
```

### src/compiled/@workflow/errors/index.d.ts

```ts
export declare class FatalError extends Error {
  fatal: boolean;
  constructor(message: string);
  static is(value: unknown): value is FatalError;
}
```

### src/compiled/@workflow/world/analytics.d.ts

```ts
export declare const AnalyticsAttributeKeySchema: z.ZodObject<
  {
    key: z.ZodString;
    runCount: z.ZodCoercedNumber<unknown>;
    firstSeenAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    lastSeenAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
  },
  z.core.$strip
>;
export declare const AnalyticsEventSchema: z.ZodObject<
  {
    runId: z.ZodString;
    eventId: z.ZodString;
    eventType: z.ZodEnum<{
      run_created: "run_created";
      run_started: "run_started";
      run_completed: "run_completed";
      run_failed: "run_failed";
      run_cancelled: "run_cancelled";
      attr_set: "attr_set";
      step_created: "step_created";
      step_completed: "step_completed";
      step_failed: "step_failed";
      step_retrying: "step_retrying";
      step_started: "step_started";
      hook_created: "hook_created";
      hook_received: "hook_received";
      hook_disposed: "hook_disposed";
      hook_conflict: "hook_conflict";
      wait_created: "wait_created";
      wait_completed: "wait_completed";
      noop: "noop";
    }>;
    correlationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    entityId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stepName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowName: z.ZodString;
    deploymentId: z.ZodString;
    specVersion: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    runCreatedAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    createdAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    region: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vercelId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requestId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    computeInstanceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    resumeAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    retryAfter: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    errorCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowCoreVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isWebhook: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    isSystem: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    workflowEncryptionEnabled: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
  },
  z.core.$strip
>;
export declare const AnalyticsHookSchema: z.ZodObject<
  {
    runId: z.ZodString;
    hookId: z.ZodString;
    status: z.ZodEnum<{
      created: "created";
      received: "received";
      disposed: "disposed";
      conflict: "conflict";
    }>;
    createdAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    updatedAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    receivedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    disposedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    isWebhook: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    isSystem: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    workflowCoreVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowEncryptionEnabled: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
  },
  z.core.$strip
>;
export declare const AnalyticsRunSchema: z.ZodObject<
  {
    runId: z.ZodString;
    status: z.ZodEnum<{
      pending: "pending";
      running: "running";
      completed: "completed";
      failed: "failed";
      cancelled: "cancelled";
    }>;
    deploymentId: z.ZodString;
    workflowName: z.ZodString;
    specVersion: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    createdAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    updatedAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    startedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    completedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    errorCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowCoreVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowEncryptionEnabled: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
  },
  z.core.$strip
>;
export declare const AnalyticsStepSchema: z.ZodObject<
  {
    runId: z.ZodString;
    stepId: z.ZodString;
    stepName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<{
      pending: "pending";
      running: "running";
      completed: "completed";
      failed: "failed";
      cancelled: "cancelled";
    }>;
    attempt: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    updatedAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    startedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    completedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    retryAfter: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    errorCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowCoreVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowEncryptionEnabled: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    computeInstanceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  },
  z.core.$strip
>;
export declare const AnalyticsWaitSchema: z.ZodObject<
  {
    runId: z.ZodString;
    waitId: z.ZodString;
    status: z.ZodEnum<{
      completed: "completed";
      waiting: "waiting";
    }>;
    resumeAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    createdAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    updatedAt: z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>;
    completedAt: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodCoercedDate<unknown>, unknown>>>;
    workflowCoreVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workflowEncryptionEnabled: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
  },
  z.core.$strip
>;
export interface Analytics {
  runs: {
    get(runId: string): Promise<AnalyticsRun>;
    list(params?: AnalyticsListRunsParams): Promise<PaginatedResponse<AnalyticsRun>>;
  };
  attributes: {
    list(params?: AnalyticsListAttributesParams): Promise<PaginatedResponse<AnalyticsAttributeKey>>;
  };
  steps: {
    get(runId: string, stepId: string): Promise<AnalyticsStep>;
    list(params: AnalyticsListRunScopedParams): Promise<PaginatedResponse<AnalyticsStep>>;
  };
  events: {
    get(runId: string, eventId: string): Promise<AnalyticsEvent>;
    getMany(runId: string, eventIds: readonly string[]): Promise<AnalyticsEvent[]>;
    list(params: AnalyticsListEventsParams): Promise<PaginatedResponse<AnalyticsEvent>>;
    listByCorrelationId(
      params: AnalyticsListEventsByCorrelationIdParams,
    ): Promise<PaginatedResponse<AnalyticsEvent>>;
  };
  hooks: {
    get(
      hookId: string,
      params?: {
        runId?: string;
      },
    ): Promise<AnalyticsHook>;
    list(params: AnalyticsListHooksParams): Promise<PaginatedResponse<AnalyticsHook>>;
  };
  waits: {
    get(runId: string, waitId: string): Promise<AnalyticsWait>;
    list(params: AnalyticsListWaitsParams): Promise<PaginatedResponse<AnalyticsWait>>;
  };
}
export interface AnalyticsListAttributesParams {
  workflowName?: string;
  startTime?: string;
  endTime?: string;
  pagination?: PaginationOptions;
}
export interface AnalyticsListEventsByCorrelationIdParams {
  correlationId: string;
  runId: string;
  pagination?: PaginationOptions;
}
export interface AnalyticsListEventsParams extends AnalyticsListRunScopedParams {
  eventType?: AnalyticsEvent["eventType"];
  correlationId?: string;
}
export interface AnalyticsListHooksParams {
  runId: string;
  pagination?: PaginationOptions;
}
export interface AnalyticsListRunScopedParams {
  runId: string;
  pagination?: PaginationOptions;
}
export interface AnalyticsListRunsParams {
  workflowName?: string;
  status?: AnalyticsRun["status"];
  startTime?: string;
  endTime?: string;
  attributes?: Record<string, string>;
  pagination?: PaginationOptions;
}
export interface AnalyticsListWaitsParams extends AnalyticsListRunScopedParams {
  status?: AnalyticsWait["status"];
}
export type AnalyticsAttributeKey = z.infer<typeof AnalyticsAttributeKeySchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type AnalyticsHook = z.infer<typeof AnalyticsHookSchema>;
export type AnalyticsRun = z.infer<typeof AnalyticsRunSchema>;
export type AnalyticsStep = z.infer<typeof AnalyticsStepSchema>;
export type AnalyticsWait = z.infer<typeof AnalyticsWaitSchema>;
```

### src/compiled/@workflow/world/attributes-validation.d.ts

```ts
export interface AttributeChange {
  key: string;
  value: string | null;
}
export type RunRetention = 0 | "default";
```

### src/compiled/@workflow/world/attributes.d.ts

```ts
export interface ExperimentalSetAttributesResult {
  attributes: Record<string, string>;
}
```

### src/compiled/@workflow/world/events.d.ts

```ts
declare const RunCreatedEventSchema: z.ZodObject<
  {
    correlationId: z.ZodOptional<z.ZodString>;
    specVersion: z.ZodOptional<z.ZodNumber>;
    eventType: z.ZodLiteral<"run_created">;
    eventData: z.ZodObject<
      {
        deploymentId: z.ZodString;
        workflowName: z.ZodString;
        input: z.ZodUnion<
          readonly [
            z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
          ]
        >;
        executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
        dynamicWorkflowCode: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        dynamicWorkflowCodeRef: z.ZodOptional<z.ZodString>;
        encryptionPublicKey: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
export declare const CreateEventSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        correlationId: z.ZodOptional<z.ZodString>;
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"run_created">;
        eventData: z.ZodObject<
          {
            deploymentId: z.ZodString;
            workflowName: z.ZodString;
            input: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
            executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
            dynamicWorkflowCode: z.ZodOptional<
              z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >
            >;
            dynamicWorkflowCodeRef: z.ZodOptional<z.ZodString>;
            encryptionPublicKey: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        correlationId: z.ZodOptional<z.ZodString>;
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"run_started">;
        eventData: z.ZodOptional<
          z.ZodObject<
            {
              input: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
              deploymentId: z.ZodOptional<z.ZodString>;
              workflowName: z.ZodOptional<z.ZodString>;
              executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
              attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
              allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
              encryptionPublicKey: z.ZodOptional<z.ZodString>;
              dynamicWorkflowCode: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
              dynamicWorkflowCodeRef: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        correlationId: z.ZodOptional<z.ZodString>;
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"run_completed">;
        eventData: z.ZodObject<
          {
            output: z.ZodOptional<
              z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >
            >;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        correlationId: z.ZodOptional<z.ZodString>;
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"run_failed">;
        eventData: z.ZodObject<
          {
            error: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
            errorCode: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        correlationId: z.ZodOptional<z.ZodString>;
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"run_cancelled">;
        eventData: z.ZodOptional<
          z.ZodObject<
            {
              cancelReason: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"attr_set">;
        correlationId: z.ZodOptional<z.ZodString>;
        eventData: z.ZodObject<
          {
            changes: z.ZodArray<
              z.ZodObject<
                {
                  key: z.ZodString;
                  value: z.ZodNullable<z.ZodString>;
                },
                z.core.$strip
              >
            >;
            writer: z.ZodDiscriminatedUnion<
              [
                z.ZodObject<
                  {
                    type: z.ZodLiteral<"workflow">;
                  },
                  z.core.$strip
                >,
                z.ZodObject<
                  {
                    type: z.ZodLiteral<"step">;
                    stepId: z.ZodString;
                    attempt: z.ZodNumber;
                  },
                  z.core.$strip
                >,
              ],
              "type"
            >;
            allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"step_created">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            stepName: z.ZodString;
            workflowName: z.ZodOptional<z.ZodString>;
            input: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"step_completed">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            ttfs: z.ZodOptional<z.ZodNumber>;
            stso: z.ZodOptional<z.ZodNumber>;
            stepCount: z.ZodOptional<z.ZodNumber>;
            eventCount: z.ZodOptional<z.ZodNumber>;
            rsfs: z.ZodOptional<z.ZodNumber>;
            finalSchedulingReplay: z.ZodOptional<z.ZodNumber>;
            optimizations: z.ZodOptional<z.ZodArray<z.ZodString>>;
            stepName: z.ZodOptional<z.ZodString>;
            workflowName: z.ZodOptional<z.ZodString>;
            result: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"step_failed">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            ttfs: z.ZodOptional<z.ZodNumber>;
            stso: z.ZodOptional<z.ZodNumber>;
            stepCount: z.ZodOptional<z.ZodNumber>;
            eventCount: z.ZodOptional<z.ZodNumber>;
            rsfs: z.ZodOptional<z.ZodNumber>;
            finalSchedulingReplay: z.ZodOptional<z.ZodNumber>;
            optimizations: z.ZodOptional<z.ZodArray<z.ZodString>>;
            stepName: z.ZodOptional<z.ZodString>;
            error: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"step_retrying">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            stepName: z.ZodOptional<z.ZodString>;
            error: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
            retryAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"step_started">;
        correlationId: z.ZodString;
        eventData: z.ZodOptional<
          z.ZodObject<
            {
              stepName: z.ZodOptional<z.ZodString>;
              attempt: z.ZodOptional<z.ZodNumber>;
              workflowName: z.ZodOptional<z.ZodString>;
              input: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
              ownerMessageId: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"hook_created">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            token: z.ZodString;
            tokenRetentionUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            metadata: z.ZodOptional<
              z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >
            >;
            isWebhook: z.ZodOptional<z.ZodBoolean>;
            isSystem: z.ZodOptional<z.ZodBoolean>;
            force: z.ZodOptional<z.ZodBoolean>;
            forceClaimedFrom: z.ZodOptional<
              z.ZodObject<
                {
                  runId: z.ZodString;
                  hookId: z.ZodString;
                  workflowName: z.ZodOptional<z.ZodString>;
                  deploymentId: z.ZodOptional<z.ZodString>;
                  runSpecVersion: z.ZodOptional<z.ZodNumber>;
                },
                z.core.$strip
              >
            >;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"hook_received">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            token: z.ZodOptional<z.ZodString>;
            payload: z.ZodUnion<
              readonly [
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              ]
            >;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"hook_disposed">;
        correlationId: z.ZodString;
        eventData: z.ZodOptional<
          z.ZodObject<
            {
              token: z.ZodOptional<z.ZodString>;
              forceClaimedBy: z.ZodOptional<
                z.ZodObject<
                  {
                    runId: z.ZodString;
                    hookId: z.ZodString;
                  },
                  z.core.$strip
                >
              >;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"wait_created">;
        correlationId: z.ZodString;
        eventData: z.ZodObject<
          {
            resumeAt: z.ZodCoercedDate<unknown>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        specVersion: z.ZodOptional<z.ZodNumber>;
        eventType: z.ZodLiteral<"wait_completed">;
        correlationId: z.ZodString;
        eventData: z.ZodOptional<
          z.ZodObject<
            {
              resumeAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
  ],
  "eventType"
>;
export declare const EventSchema: z.ZodIntersection<
  z.ZodDiscriminatedUnion<
    [
      z.ZodObject<
        {
          correlationId: z.ZodOptional<z.ZodString>;
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"run_created">;
          eventData: z.ZodObject<
            {
              deploymentId: z.ZodString;
              workflowName: z.ZodString;
              input: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
              executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
              attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
              allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
              dynamicWorkflowCode: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
              dynamicWorkflowCodeRef: z.ZodOptional<z.ZodString>;
              encryptionPublicKey: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          correlationId: z.ZodOptional<z.ZodString>;
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"run_started">;
          eventData: z.ZodOptional<
            z.ZodObject<
              {
                input: z.ZodOptional<
                  z.ZodUnion<
                    readonly [
                      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    ]
                  >
                >;
                deploymentId: z.ZodOptional<z.ZodString>;
                workflowName: z.ZodOptional<z.ZodString>;
                executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
                encryptionPublicKey: z.ZodOptional<z.ZodString>;
                dynamicWorkflowCode: z.ZodOptional<
                  z.ZodUnion<
                    readonly [
                      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    ]
                  >
                >;
                dynamicWorkflowCodeRef: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          correlationId: z.ZodOptional<z.ZodString>;
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"run_completed">;
          eventData: z.ZodObject<
            {
              output: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          correlationId: z.ZodOptional<z.ZodString>;
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"run_failed">;
          eventData: z.ZodObject<
            {
              error: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
              errorCode: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          correlationId: z.ZodOptional<z.ZodString>;
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"run_cancelled">;
          eventData: z.ZodOptional<
            z.ZodObject<
              {
                cancelReason: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"attr_set">;
          correlationId: z.ZodOptional<z.ZodString>;
          eventData: z.ZodObject<
            {
              changes: z.ZodArray<
                z.ZodObject<
                  {
                    key: z.ZodString;
                    value: z.ZodNullable<z.ZodString>;
                  },
                  z.core.$strip
                >
              >;
              writer: z.ZodDiscriminatedUnion<
                [
                  z.ZodObject<
                    {
                      type: z.ZodLiteral<"workflow">;
                    },
                    z.core.$strip
                  >,
                  z.ZodObject<
                    {
                      type: z.ZodLiteral<"step">;
                      stepId: z.ZodString;
                      attempt: z.ZodNumber;
                    },
                    z.core.$strip
                  >,
                ],
                "type"
              >;
              allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"step_created">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              stepName: z.ZodString;
              workflowName: z.ZodOptional<z.ZodString>;
              input: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"step_completed">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              ttfs: z.ZodOptional<z.ZodNumber>;
              stso: z.ZodOptional<z.ZodNumber>;
              stepCount: z.ZodOptional<z.ZodNumber>;
              eventCount: z.ZodOptional<z.ZodNumber>;
              rsfs: z.ZodOptional<z.ZodNumber>;
              finalSchedulingReplay: z.ZodOptional<z.ZodNumber>;
              optimizations: z.ZodOptional<z.ZodArray<z.ZodString>>;
              stepName: z.ZodOptional<z.ZodString>;
              workflowName: z.ZodOptional<z.ZodString>;
              result: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"step_failed">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              ttfs: z.ZodOptional<z.ZodNumber>;
              stso: z.ZodOptional<z.ZodNumber>;
              stepCount: z.ZodOptional<z.ZodNumber>;
              eventCount: z.ZodOptional<z.ZodNumber>;
              rsfs: z.ZodOptional<z.ZodNumber>;
              finalSchedulingReplay: z.ZodOptional<z.ZodNumber>;
              optimizations: z.ZodOptional<z.ZodArray<z.ZodString>>;
              stepName: z.ZodOptional<z.ZodString>;
              error: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"step_retrying">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              stepName: z.ZodOptional<z.ZodString>;
              error: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
              retryAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"step_started">;
          correlationId: z.ZodString;
          eventData: z.ZodOptional<
            z.ZodObject<
              {
                stepName: z.ZodOptional<z.ZodString>;
                attempt: z.ZodOptional<z.ZodNumber>;
                workflowName: z.ZodOptional<z.ZodString>;
                input: z.ZodOptional<
                  z.ZodUnion<
                    readonly [
                      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    ]
                  >
                >;
                ownerMessageId: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"hook_created">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              token: z.ZodString;
              tokenRetentionUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
              metadata: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
              isWebhook: z.ZodOptional<z.ZodBoolean>;
              isSystem: z.ZodOptional<z.ZodBoolean>;
              force: z.ZodOptional<z.ZodBoolean>;
              forceClaimedFrom: z.ZodOptional<
                z.ZodObject<
                  {
                    runId: z.ZodString;
                    hookId: z.ZodString;
                    workflowName: z.ZodOptional<z.ZodString>;
                    deploymentId: z.ZodOptional<z.ZodString>;
                    runSpecVersion: z.ZodOptional<z.ZodNumber>;
                  },
                  z.core.$strip
                >
              >;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"hook_received">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              token: z.ZodOptional<z.ZodString>;
              payload: z.ZodUnion<
                readonly [
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                ]
              >;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"hook_disposed">;
          correlationId: z.ZodString;
          eventData: z.ZodOptional<
            z.ZodObject<
              {
                token: z.ZodOptional<z.ZodString>;
                forceClaimedBy: z.ZodOptional<
                  z.ZodObject<
                    {
                      runId: z.ZodString;
                      hookId: z.ZodString;
                    },
                    z.core.$strip
                  >
                >;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"hook_conflict">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              token: z.ZodString;
              conflictingRunId: z.ZodOptional<z.ZodString>;
              forceRefusedReason: z.ZodOptional<z.ZodLiteral<"victim-spec-version">>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"wait_created">;
          correlationId: z.ZodString;
          eventData: z.ZodObject<
            {
              resumeAt: z.ZodCoercedDate<unknown>;
            },
            z.core.$strip
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"wait_completed">;
          correlationId: z.ZodString;
          eventData: z.ZodOptional<
            z.ZodObject<
              {
                resumeAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >,
      z.ZodObject<
        {
          correlationId: z.ZodOptional<z.ZodString>;
          specVersion: z.ZodOptional<z.ZodNumber>;
          eventType: z.ZodLiteral<"noop">;
          eventData: z.ZodOptional<
            z.ZodObject<
              {
                sealed: z.ZodOptional<z.ZodBoolean>;
              },
              z.core.$loose
            >
          >;
        },
        z.core.$strip
      >,
    ],
    "eventType"
  >,
  z.ZodObject<
    {
      runId: z.ZodString;
      eventId: z.ZodString;
      createdAt: z.ZodCoercedDate<unknown>;
      occurredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
      specVersion: z.ZodOptional<z.ZodNumber>;
      resumeId: z.ZodOptional<z.ZodString>;
    },
    z.core.$strip
  >
>;
export declare const EventTypeSchema: z.ZodEnum<{
  run_created: "run_created";
  run_started: "run_started";
  run_completed: "run_completed";
  run_failed: "run_failed";
  run_cancelled: "run_cancelled";
  attr_set: "attr_set";
  step_created: "step_created";
  step_completed: "step_completed";
  step_failed: "step_failed";
  step_retrying: "step_retrying";
  step_started: "step_started";
  hook_created: "hook_created";
  hook_received: "hook_received";
  hook_disposed: "hook_disposed";
  hook_conflict: "hook_conflict";
  wait_created: "wait_created";
  wait_completed: "wait_completed";
  noop: "noop";
}>;
export interface BatchEventRequest {
  event: CreateEventRequest;
  occurredAt?: Date;
  computeInstanceId?: string;
}
export interface CreateEventBatchParams {
  resolveData?: ResolveData;
  requestId?: string;
}
export interface CreateEventParams {
  v1Compat?: boolean;
  resolveData?: EventsResolveData;
  resumeId?: string;
  resumePayloadDigest?: string;
  viaStepDispatch?: boolean;
  afterStepBody?: true;
  requestId?: string;
  computeInstanceId?: string;
  eventCount?: number;
  occurredAt?: Date;
  replayDivergenceCount?: number;
  sinceCursor?: string;
  skipPreload?: true;
  preloadEvents?: true;
  replayEventObserver?: (event: Event) => void;
}
export interface EventBatchResult {
  results: BatchEventItemResult[];
}
export interface GetEventParams {
  resolveData?: ResolveData;
}
export interface ListEventsByCorrelationIdParams {
  correlationId: string;
  runId: string;
  pagination?: PaginationOptions;
  resolveData?: ResolveData;
}
export interface ListEventsParams {
  runId: string;
  pagination?: PaginationOptions;
  resolveData?: EventsResolveData;
}
export type AnyEventRequest = z.infer<typeof CreateEventSchema>;
export type BatchEventItemResult =
  | {
      status: 200;
      error?: undefined;
      message?: undefined;
      event: Event;
      run?: WorkflowRun;
      step?: Step;
      wait?: Wait;
    }
  | {
      status: number;
      error: string;
      message: string;
      event?: undefined;
      run?: undefined;
      step?: undefined;
      wait?: undefined;
    };
export type CreateEventRequest = Exclude<AnyEventRequest, RunCreatedEventRequest>;
export type Event = z.infer<typeof EventSchema>;
export type EventResult<T extends EventType = EventType> = {
  event?: Event;
  run?: WorkflowRun;
  step?: Step;
  hook?: Hook;
  wait?: Wait;
  stepCreated?: true;
  maxEvents?: number;
} & (
  | {
      events: Event[];
      cursor: string | null;
      hasMore: boolean;
    }
  | {
      events?: undefined;
      cursor?: undefined;
      hasMore?: undefined;
    }
) &
  (T extends "run_created"
    ? {
        run: WorkflowRun;
      }
    : T extends "run_started"
      ? {
          run: StartedWorkflowRun;
        }
      : T extends "step_started"
        ? {
            step: StartedStep;
          }
        : unknown);
export type EventType = z.infer<typeof EventTypeSchema>;
export type RunCreatedEventRequest = z.infer<typeof RunCreatedEventSchema>;
```

### src/compiled/@workflow/world/hooks.d.ts

```ts
export declare const HookSchema: z.ZodObject<
  {
    runId: z.ZodString;
    hookId: z.ZodString;
    token: z.ZodString;
    ownerId: z.ZodString;
    projectId: z.ZodString;
    environment: z.ZodString;
    metadata: z.ZodOptional<
      z.ZodUnion<
        readonly [
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
        ]
      >
    >;
    createdAt: z.ZodCoercedDate<unknown>;
    specVersion: z.ZodOptional<z.ZodNumber>;
    isWebhook: z.ZodOptional<z.ZodBoolean>;
    isSystem: z.ZodOptional<z.ZodBoolean>;
    tokenRetentionUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    resumeContext: z.ZodOptional<
      z.ZodObject<
        {
          deploymentId: z.ZodString;
          workflowName: z.ZodString;
          runSpecVersion: z.ZodOptional<z.ZodNumber>;
          workflowCoreVersion: z.ZodOptional<z.ZodString>;
          nodeVersion: z.ZodOptional<z.ZodString>;
          traceCarrier: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
          encryptionPublicKey: z.ZodOptional<z.ZodString>;
          hookResumeInputVersion: z.ZodOptional<z.ZodNumber>;
        },
        z.core.$strip
      >
    >;
    resumeCapabilities: z.ZodOptional<
      z.ZodObject<
        {
          hookResumeDedupVersion: z.ZodNumber;
        },
        z.core.$strip
      >
    >;
    claimedFrom: z.ZodOptional<
      z.ZodObject<
        {
          runId: z.ZodString;
          hookId: z.ZodString;
          workflowName: z.ZodOptional<z.ZodString>;
          deploymentId: z.ZodOptional<z.ZodString>;
          runSpecVersion: z.ZodOptional<z.ZodNumber>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export interface GetHookParams {
  resolveData?: ResolveData;
}
export interface ListHooksParams {
  runId?: string;
  pagination?: PaginationOptions;
  resolveData?: ResolveData;
}
export type Hook = z.infer<typeof HookSchema>;
```

### src/compiled/@workflow/world/interfaces.d.ts

```ts
export interface CreateStreamWriteSessionOptions {
  writerId: `wrtr_${string}`;
}
export interface Storage {
  runs: {
    get(
      id: string,
      params: GetWorkflowRunParams & {
        resolveData: "none";
      },
    ): Promise<WorkflowRunWithoutData>;
    get(
      id: string,
      params?: GetWorkflowRunParams & {
        resolveData?: "all";
      },
    ): Promise<WorkflowRun>;
    get(id: string, params?: GetWorkflowRunParams): Promise<WorkflowRun | WorkflowRunWithoutData>;
    waitForTerminalStatus?: {
      (
        id: string,
        params: WaitForTerminalRunStatusParams & {
          resolveData: "none";
        },
      ): Promise<WorkflowRunWithoutData>;
      (
        id: string,
        params?: WaitForTerminalRunStatusParams & {
          resolveData?: "all";
        },
      ): Promise<WorkflowRun>;
      (
        id: string,
        params?: WaitForTerminalRunStatusParams,
      ): Promise<WorkflowRun | WorkflowRunWithoutData>;
    };
    getMany?: {
      (
        ids: readonly string[],
        params: GetWorkflowRunParams & {
          resolveData: "none";
        },
      ): Promise<(WorkflowRunWithoutData | null)[]>;
      (
        ids: readonly string[],
        params?: GetWorkflowRunParams & {
          resolveData?: "all";
        },
      ): Promise<(WorkflowRun | null)[]>;
      (
        ids: readonly string[],
        params?: GetWorkflowRunParams,
      ): Promise<(WorkflowRun | WorkflowRunWithoutData | null)[]>;
    };
    list(
      params: ListWorkflowRunsParams & {
        resolveData: "none";
      },
    ): Promise<PaginatedResponse<WorkflowRunWithoutData>>;
    list(
      params?: ListWorkflowRunsParams & {
        resolveData?: "all";
      },
    ): Promise<PaginatedResponse<WorkflowRun>>;
    list(
      params?: ListWorkflowRunsParams,
    ): Promise<PaginatedResponse<WorkflowRun | WorkflowRunWithoutData>>;
    experimentalSetAttributes?(
      runId: string,
      changes: AttributeChange[],
      options?: {
        allowReservedAttributes?: boolean;
      },
    ): Promise<ExperimentalSetAttributesResult>;
    cancelMany?(request: BulkCancelWorkflowRunsRequest): Promise<BulkCancelWorkflowRunsResult>;
  };
  steps: {
    get(
      runId: string,
      stepId: string,
      params: GetStepParams & {
        resolveData: "none";
      },
    ): Promise<StepWithoutData>;
    get(
      runId: string,
      stepId: string,
      params?: GetStepParams & {
        resolveData?: "all";
      },
    ): Promise<Step>;
    get(runId: string, stepId: string, params?: GetStepParams): Promise<Step | StepWithoutData>;
    list(
      params: ListWorkflowRunStepsParams & {
        resolveData: "none";
      },
    ): Promise<PaginatedResponse<StepWithoutData>>;
    list(
      params: ListWorkflowRunStepsParams & {
        resolveData?: "all";
      },
    ): Promise<PaginatedResponse<Step>>;
    list(params: ListWorkflowRunStepsParams): Promise<PaginatedResponse<Step | StepWithoutData>>;
  };
  events: {
    create<T extends RunCreatedEventRequest>(
      runId: string | null,
      data: T,
      params?: CreateEventParams,
    ): Promise<EventResult<T["eventType"]>>;
    create<T extends CreateEventRequest>(
      runId: string,
      data: T,
      params?: CreateEventParams,
    ): Promise<EventResult<T["eventType"]>>;
    createBatch?(
      runId: string,
      events: BatchEventRequest[],
      params?: CreateEventBatchParams,
    ): Promise<EventBatchResult>;
    get(runId: string, eventId: string, params?: GetEventParams): Promise<Event>;
    list(params: ListEventsParams): Promise<PaginatedResponse<Event>>;
    listByCorrelationId(params: ListEventsByCorrelationIdParams): Promise<PaginatedResponse<Event>>;
  };
  hooks: {
    get(hookId: string, params?: GetHookParams): Promise<Hook>;
    getByToken(token: string, params?: GetHookParams): Promise<Hook>;
    list(params: ListHooksParams): Promise<PaginatedResponse<Hook>>;
  };
  experimental_snapshots?: {
    save(runId: string, data: Uint8Array, metadata: SnapshotMetadata): Promise<void>;
    load(runId: string): Promise<{
      data: Uint8Array;
      metadata: SnapshotMetadata;
    } | null>;
    delete(runId: string): Promise<void>;
  };
}
export interface StreamWriteSession {
  write(chunkSeq: number, chunks: (string | Uint8Array)[]): Promise<void>;
  close(): Promise<void>;
  release?(): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
export interface Streamer {
  streamFlushIntervalMs?: number;
  streams: {
    createWriteSession?(
      runId: string,
      name: string,
      options: CreateStreamWriteSessionOptions,
    ): StreamWriteSession;
    write(runId: string, name: string, chunk: string | Uint8Array): Promise<void>;
    writeMulti?(runId: string, name: string, chunks: (string | Uint8Array)[]): Promise<void>;
    close(runId: string, name: string): Promise<void>;
    get(runId: string, name: string, startIndex?: number): Promise<ReadableStream<Uint8Array>>;
    list(runId: string): Promise<string[]>;
    getChunks(
      runId: string,
      name: string,
      options?: GetChunksOptions,
    ): Promise<StreamChunksResponse>;
    getInfo(runId: string, name: string): Promise<StreamInfoResponse>;
  };
}
export interface Telemetry {
  recordStepExecution?(stepId: string): void;
}
export interface World extends Queue, Streamer, Storage {
  analytics?: Analytics;
  specVersion: number;
  capabilities?: WorldCapabilities;
  validateRunExecutionContext?(value: Record<string, unknown>): void;
  getRuntimeDeadline?(): Promise<Date | undefined>;
  start?(): Promise<void>;
  close?(): Promise<void>;
  resolveLatestDeploymentId?(): Promise<string>;
  getEncryptionKeyForRun?(run: WorkflowRun): Promise<Uint8Array | undefined>;
  getEncryptionKeyForRun?(
    runId: string,
    context?: Record<string, unknown>,
  ): Promise<Uint8Array | undefined>;
  createRunId?(options?: Readonly<Record<string, unknown>>): string;
  uploadDynamicWorkflowCode?(
    runId: string,
    params: {
      workflowName: string;
      code: Uint8Array;
    },
  ): Promise<string>;
  getEnvironment?(): string | undefined;
  describeRun?(
    run: Readonly<Record<string, unknown>>,
  ): Record<string, string | null> | null | Promise<Record<string, string | null> | null>;
  telemetry?: Telemetry;
}
export interface WorldCapabilities {
  invoke?: boolean;
  hookRetention?: {
    active: boolean;
  };
  maxConcurrency?: boolean;
  hookResumeDedup?: boolean;
  hookForceClaim?: boolean;
  deploymentAffinity?: boolean;
  dynamicWorkflowCode?: boolean;
}
```

### src/compiled/@workflow/world/queue.d.ts

```ts
export declare const MessageId: z.core.$ZodBranded<z.ZodString, "MessageId", "out">;
export declare const QueuePayloadSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        __healthCheck: z.ZodLiteral<true>;
        correlationId: z.ZodString;
        runId: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        runId: z.ZodString;
        invoke: z.ZodOptional<z.ZodLiteral<true>>;
        requestId: z.ZodOptional<z.ZodString>;
        input: z.ZodOptional<z.ZodUnknown>;
        traceCarrier: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        requestedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        replayDivergence: z.ZodOptional<
          z.ZodObject<
            {
              eventId: z.ZodString;
              count: z.ZodNumber;
              eventIds: z.ZodCatch<z.ZodOptional<z.ZodArray<z.ZodString>>>;
            },
            z.core.$strip
          >
        >;
        preconditionReinvocations: z.ZodOptional<z.ZodNumber>;
        serverErrorRetryCount: z.ZodOptional<z.ZodNumber>;
        deploymentMismatchRetryCount: z.ZodOptional<z.ZodNumber>;
        waitContinuation: z.ZodCatch<
          z.ZodOptional<
            z.ZodObject<
              {
                correlationId: z.ZodString;
                attempt: z.ZodNumber;
              },
              z.core.$strip
            >
          >
        >;
        stepId: z.ZodOptional<z.ZodString>;
        stepName: z.ZodOptional<z.ZodString>;
        runInput: z.ZodOptional<
          z.ZodObject<
            {
              input: z.ZodUnknown;
              deploymentId: z.ZodString;
              workflowName: z.ZodString;
              specVersion: z.ZodNumber;
              executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
              dynamicWorkflowCode: z.ZodOptional<
                z.ZodUnion<
                  readonly [
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                    z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
                  ]
                >
              >;
              dynamicWorkflowCodeRef: z.ZodOptional<z.ZodString>;
              attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
              allowReservedAttributes: z.ZodOptional<z.ZodLiteral<true>>;
              environment: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        hookInput: z.ZodOptional<
          z.ZodObject<
            {
              resumeId: z.ZodString;
              hookId: z.ZodString;
              token: z.ZodString;
              payload: z.ZodUnknown;
              payloadDigest: z.ZodString;
              deploymentId: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        stepInput: z.ZodOptional<
          z.ZodObject<
            {
              input: z.ZodCustom<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>>;
            },
            z.core.$strip
          >
        >;
        runContext: z.ZodOptional<
          z.ZodObject<
            {
              deploymentId: z.ZodString;
              specVersion: z.ZodNumber;
              startedAt: z.ZodOptional<z.ZodNumber>;
              rootRunId: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        hookResumeTiming: z.ZodCatch<
          z.ZodOptional<
            z.ZodObject<
              {
                resumeRequestedAtMs: z.ZodNumber;
                queuePublishRequestedAtMs: z.ZodNumber;
                strategy: z.ZodOptional<z.ZodString>;
                consumerStartedAtMs: z.ZodOptional<z.ZodNumber>;
                replayStartedAtMs: z.ZodOptional<z.ZodNumber>;
                nextStepEncounteredAtMs: z.ZodOptional<z.ZodNumber>;
                setupSource: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >
        >;
      },
      z.core.$strip
    >,
  ]
>;
export declare const QueuePrefix: z.ZodString;
export declare const ValidQueueName: z.ZodString;
export interface InvokeOptions {
  idempotencyKey?: string;
  timeoutMs?: number;
}
export interface Queue {
  getDeploymentId(): Promise<string>;
  invoke?(runId: string, payload: unknown, options?: InvokeOptions): Promise<unknown>;
  isDeploymentUnavailableError?(error: unknown): boolean;
  queue(
    queueName: ValidQueueName,
    message: QueuePayload,
    opts?: QueueOptions,
  ): Promise<{
    messageId: MessageId | null;
  }>;
  queueBatch?(
    queueName: ValidQueueName,
    messages: readonly {
      message: QueuePayload;
      opts?: QueueOptions;
    }[],
  ): Promise<QueueBatchResult[]>;
  createQueueHandler(
    queueNamePrefix: QueuePrefix,
    handler: (
      message: unknown,
      meta: {
        attempt: number;
        queueName: ValidQueueName;
        messageId: MessageId;
        requestId?: string;
      },
    ) => Promise<unknown>,
  ): (req: Request) => Promise<Response>;
}
export interface QueueOptions {
  deploymentId?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  delaySeconds?: number;
  specVersion?: number;
  region?: string;
}
export type MessageId = z.infer<typeof MessageId>;
export type QueueBatchResult =
  | {
      messageId: MessageId | null;
      error?: undefined;
    }
  | {
      messageId: null;
      error: string;
      retryable: boolean;
    };
export type QueuePayload = z.infer<typeof QueuePayloadSchema>;
export type QueuePrefix = z.infer<typeof QueuePrefix>;
export type ValidQueueName = z.infer<typeof ValidQueueName>;
```

### src/compiled/@workflow/world/runs.d.ts

```ts
export declare const BulkCancelWorkflowRunsRequestSchema: z.ZodObject<
  {
    runIds: z.ZodArray<z.ZodString>;
    cancelReason: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export declare const BulkCancelWorkflowRunsResultSchema: z.ZodObject<
  {
    summary: z.ZodObject<
      {
        requested: z.ZodNumber;
        cancelled: z.ZodNumber;
        alreadyCancelled: z.ZodNumber;
        notCancellable: z.ZodNumber;
        notFound: z.ZodNumber;
        failed: z.ZodNumber;
      },
      z.core.$strip
    >;
    results: z.ZodArray<
      z.ZodDiscriminatedUnion<
        [
          z.ZodObject<
            {
              runId: z.ZodString;
              outcome: z.ZodLiteral<"cancelled">;
            },
            z.core.$strip
          >,
          z.ZodObject<
            {
              runId: z.ZodString;
              outcome: z.ZodLiteral<"already_cancelled">;
            },
            z.core.$strip
          >,
          z.ZodObject<
            {
              runId: z.ZodString;
              outcome: z.ZodLiteral<"not_cancellable">;
              status: z.ZodString;
            },
            z.core.$strip
          >,
          z.ZodObject<
            {
              runId: z.ZodString;
              outcome: z.ZodLiteral<"not_found">;
            },
            z.core.$strip
          >,
          z.ZodObject<
            {
              runId: z.ZodString;
              outcome: z.ZodLiteral<"failed">;
              code: z.ZodString;
              retryable: z.ZodBoolean;
            },
            z.core.$strip
          >,
        ],
        "outcome"
      >
    >;
  },
  z.core.$strip
>;
export declare const WorkflowRunSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        runId: z.ZodString;
        deploymentId: z.ZodString;
        workflowName: z.ZodString;
        specVersion: z.ZodOptional<z.ZodNumber>;
        executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        input: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        dynamicWorkflowCode: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        errorCode: z.ZodOptional<z.ZodString>;
        attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        encryptionPublicKey: z.ZodOptional<z.ZodString>;
        expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
        status: z.ZodEnum<{
          pending: "pending";
          running: "running";
        }>;
        output: z.ZodOptional<z.ZodUndefined>;
        error: z.ZodOptional<z.ZodUndefined>;
        completedAt: z.ZodOptional<z.ZodUndefined>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        runId: z.ZodString;
        deploymentId: z.ZodString;
        workflowName: z.ZodString;
        specVersion: z.ZodOptional<z.ZodNumber>;
        executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        input: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        dynamicWorkflowCode: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        errorCode: z.ZodOptional<z.ZodString>;
        attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        encryptionPublicKey: z.ZodOptional<z.ZodString>;
        expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
        status: z.ZodLiteral<"cancelled">;
        output: z.ZodOptional<z.ZodUndefined>;
        error: z.ZodOptional<z.ZodUndefined>;
        completedAt: z.ZodCoercedDate<unknown>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        runId: z.ZodString;
        deploymentId: z.ZodString;
        workflowName: z.ZodString;
        specVersion: z.ZodOptional<z.ZodNumber>;
        executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        input: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        dynamicWorkflowCode: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        errorCode: z.ZodOptional<z.ZodString>;
        attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        encryptionPublicKey: z.ZodOptional<z.ZodString>;
        expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
        status: z.ZodLiteral<"completed">;
        output: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        error: z.ZodOptional<z.ZodUndefined>;
        completedAt: z.ZodCoercedDate<unknown>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        runId: z.ZodString;
        deploymentId: z.ZodString;
        workflowName: z.ZodString;
        specVersion: z.ZodOptional<z.ZodNumber>;
        executionContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        input: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        dynamicWorkflowCode: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        errorCode: z.ZodOptional<z.ZodString>;
        attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        encryptionPublicKey: z.ZodOptional<z.ZodString>;
        expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
        status: z.ZodLiteral<"failed">;
        output: z.ZodOptional<z.ZodUndefined>;
        error: z.ZodOptional<
          z.ZodUnion<
            readonly [
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
              z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
            ]
          >
        >;
        completedAt: z.ZodCoercedDate<unknown>;
      },
      z.core.$strip
    >,
  ],
  "status"
>;
export declare const WorkflowRunStatusSchema: z.ZodEnum<{
  pending: "pending";
  running: "running";
  completed: "completed";
  failed: "failed";
  cancelled: "cancelled";
}>;
export interface GetWorkflowRunParams {
  resolveData?: ResolveData;
}
export interface ListWorkflowRunsParams {
  workflowName?: string;
  status?: WorkflowRunStatus | WorkflowRunStatus[];
  pagination?: PaginationOptions;
  resolveData?: ResolveData;
}
export interface WaitForTerminalRunStatusParams extends GetWorkflowRunParams {
  timeoutMs?: number;
  signal?: AbortSignal;
}
export type BulkCancelWorkflowRunsRequest = z.infer<typeof BulkCancelWorkflowRunsRequestSchema>;
export type BulkCancelWorkflowRunsResult = z.infer<typeof BulkCancelWorkflowRunsResultSchema>;
export type StartedWorkflowRun = WorkflowRun & {
  startedAt: Date;
};
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;
export type WorkflowRunWithoutData = Omit<
  WorkflowRun,
  "input" | "output" | "dynamicWorkflowCode"
> & {
  input: undefined;
  output: undefined;
  dynamicWorkflowCode?: undefined;
};
```

### src/compiled/@workflow/world/shared.d.ts

```ts
export declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(
  dataSchema: T,
) => z.ZodObject<
  {
    data: z.ZodArray<T>;
    cursor: z.ZodNullable<z.ZodString>;
    hasMore: z.ZodBoolean;
    pageInfo: z.ZodOptional<
      z.ZodObject<
        {
          currentLookbackDays: z.ZodNumber;
          maxLookbackDays: z.ZodNumber;
          currentWindowStart: z.ZodCoercedDate<unknown>;
          maxWindowStart: z.ZodCoercedDate<unknown>;
          upgradeAvailable: z.ZodBoolean;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export interface GetChunksOptions {
  limit?: number;
  cursor?: string;
}
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  sortOrder?: "asc" | "desc";
}
export interface StreamChunk {
  index: number;
  data: Uint8Array;
}
export interface StreamChunksResponse {
  data: StreamChunk[];
  cursor: string | null;
  hasMore: boolean;
  done: boolean;
}
export interface StreamInfoResponse {
  tailIndex: number;
  done: boolean;
}
export type EventsResolveData = ResolveData | "skip-step-inputs";
export type PaginatedResponse<T> = z.infer<
  ReturnType<typeof PaginatedResponseSchema<z.ZodType<T>>>
>;
export type ResolveData = "none" | "all";
```

### src/compiled/@workflow/world/snapshots.d.ts

```ts
export declare const SnapshotMetadataSchema: z.ZodObject<
  {
    eventsCursor: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
    eventCount: z.ZodOptional<z.ZodNumber>;
    rngDraws: z.ZodOptional<z.ZodNumber>;
    serdeRootPtr: z.ZodOptional<z.ZodNumber>;
    lastUlid: z.ZodOptional<z.ZodString>;
    engineVersion: z.ZodOptional<z.ZodString>;
    clockMs: z.ZodOptional<z.ZodNumber>;
    formatVersion: z.ZodOptional<z.ZodNumber>;
  },
  z.core.$strip
>;
export type SnapshotMetadata = z.infer<typeof SnapshotMetadataSchema>;
```

### src/compiled/@workflow/world/steps.d.ts

```ts
export declare const StepSchema: z.ZodObject<
  {
    runId: z.ZodString;
    stepId: z.ZodString;
    stepName: z.ZodString;
    status: z.ZodEnum<{
      pending: "pending";
      running: "running";
      completed: "completed";
      failed: "failed";
      cancelled: "cancelled";
    }>;
    input: z.ZodOptional<
      z.ZodUnion<
        readonly [
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
        ]
      >
    >;
    output: z.ZodOptional<
      z.ZodUnion<
        readonly [
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
        ]
      >
    >;
    error: z.ZodOptional<
      z.ZodUnion<
        readonly [
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
          z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>,
        ]
      >
    >;
    attempt: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    retryAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    specVersion: z.ZodOptional<z.ZodNumber>;
  },
  z.core.$strip
>;
export interface GetStepParams {
  resolveData?: ResolveData;
}
export interface ListWorkflowRunStepsParams {
  runId: string;
  pagination?: PaginationOptions;
  resolveData?: ResolveData;
}
export type StartedStep = Step & {
  startedAt: Date;
};
export type Step = z.infer<typeof StepSchema>;
export type StepWithoutData = Omit<Step, "input" | "output"> & {
  input: undefined;
  output: undefined;
};
```

### src/compiled/@workflow/world/waits.d.ts

```ts
export declare const WaitSchema: z.ZodObject<
  {
    waitId: z.ZodString;
    runId: z.ZodString;
    status: z.ZodEnum<{
      completed: "completed";
      waiting: "waiting";
    }>;
    resumeAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    specVersion: z.ZodOptional<z.ZodNumber>;
  },
  z.core.$strip
>;
export type Wait = z.infer<typeof WaitSchema>;
```
