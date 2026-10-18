# eve/memory/scope

## Export names

- byPrincipal: src/public/memory/scope.d.ts#byPrincipal

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

### src/context/keys.d.ts

```ts
export interface SessionAuth {
  readonly current: SessionAuthContext | null;
  readonly initiator: SessionAuthContext | null;
}
```

### src/public/memory/index.d.ts

```ts
export interface MemoryScopeContext {
  readonly abortSignal: AbortSignal;
  readonly session: {
    readonly id: string;
    readonly auth: SessionAuth;
  };
  readonly channel: ChannelInfo;
}
```

### src/public/memory/scope.d.ts

```ts
export declare function byPrincipal(context: MemoryScopeContext): string | null;
```

### src/shared/channel-info.d.ts

```ts
export interface ChannelInfo<TMetadata = Readonly<Record<string, unknown>>> {
  readonly kind: ChannelKind;
  readonly continuationToken?: string;
  readonly metadata: TMetadata;
}
export type ChannelKind = `channel:${string}` | "http" | "schedule" | "subagent" | "unknown";
```
