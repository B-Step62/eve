# eve/experimental/schedules/testing

## Export names

- InMemoryScheduleProviderOptions: src/public/schedules/providers/in-memory.d.ts#InMemoryScheduleProviderOptions
- inMemoryScheduleProvider: src/public/schedules/providers/in-memory.d.ts#inMemoryScheduleProvider

## Peer boundaries

## Declaration closure

### src/public/schedules/provider-types.d.ts

```ts
export interface ScheduleDelivery<TPayload = unknown> {
  readonly payload: TPayload;
  readonly occurrence: ScheduleOccurrence;
}
export interface ScheduleDeliveryTarget {
  readonly key: string;
  readonly deliver?: (delivery: ScheduleDelivery<any>) => Promise<void>;
}
export interface ScheduleProviderContext {
  readonly abortSignal: AbortSignal;
  readonly collection: string;
  readonly namespace: string;
  readonly operationId: string;
  readonly target: ScheduleDeliveryTarget;
}
```

### src/public/schedules/providers/in-memory.d.ts

```ts
export declare function inMemoryScheduleProvider(
  options?: InMemoryScheduleProviderOptions,
): ScheduleProvider;
export interface InMemoryScheduleProviderOptions {
  readonly now?: () => Date;
}
```

### src/public/schedules/subscription.d.ts

```ts
export interface ScheduleCreate<TPayload> {
  readonly expression: ScheduleExpression;
  readonly payload: TPayload;
  readonly name: string;
}
export interface ScheduleList {
  readonly cursor?: string;
  readonly limit?: number;
}
export interface ScheduleOccurrence {
  readonly executionId: string;
  readonly name: string;
  readonly scheduleId: string;
  readonly scheduledAt: string;
}
export interface SchedulePage {
  readonly cursor: string | null;
  readonly data: readonly ScheduleRecord[];
}
export interface SchedulePatch<TPayload> {
  readonly expression?: ScheduleExpression;
  readonly payload?: TPayload;
}
export interface ScheduleProvider {
  readonly kind: string;
  create<TPayload>(
    context: ScheduleProviderContext,
    schedule: ScheduleCreate<TPayload>,
  ): Promise<ScheduleRecord>;
  list(context: ScheduleProviderContext, query: ScheduleList): Promise<SchedulePage>;
  get(context: ScheduleProviderContext, name: string): Promise<ScheduleRecord | null>;
  update<TPayload>(
    context: ScheduleProviderContext,
    name: string,
    patch: SchedulePatch<TPayload>,
  ): Promise<ScheduleRecord>;
  enable(context: ScheduleProviderContext, name: string): Promise<ScheduleRecord>;
  disable(context: ScheduleProviderContext, name: string): Promise<ScheduleRecord>;
  invoke(context: ScheduleProviderContext, name: string): Promise<void>;
  delete(context: ScheduleProviderContext, name: string): Promise<boolean>;
}
export interface ScheduleRecord {
  readonly displayName?: string;
  readonly createdAt: number;
  readonly expression: ScheduleExpression;
  readonly name: string;
  readonly scheduleId: string;
  readonly state: ScheduleState;
  readonly updatedAt: number;
}
export type ScheduleExpression =
  | {
      readonly type: "cron";
      readonly cron: string;
      readonly timezone?: string;
      readonly jitter?: number;
    }
  | {
      readonly type: "single";
      readonly at: string;
      readonly timezone?: string;
    };
export type ScheduleState = "active" | "inactive" | "completed";
```
