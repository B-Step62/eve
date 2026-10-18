# eve/agents/auth

## Export names

- OutboundAuthFn: src/public/agents/auth.d.ts#OutboundAuthFn
- VercelOidcOptions: src/public/agents/auth.d.ts#VercelOidcOptions
- bearer: src/public/agents/auth.d.ts#bearer
- httpBasic: src/public/agents/auth.d.ts#httpBasic
- vercelOidc: src/public/agents/auth.d.ts#vercelOidc

## Peer boundaries

## Declaration closure

### src/client/types.d.ts

```ts
export type TokenValue = string | (() => string | Promise<string>);
```

### src/public/agents/auth.d.ts

```ts
export declare function bearer(token: TokenValue): OutboundAuthFn;
export declare function httpBasic(input: {
  readonly password: TokenValue;
  readonly username: string;
}): OutboundAuthFn;
export declare function vercelOidc(options?: VercelOidcOptions): OutboundAuthFn;
export interface VercelOidcOptions {
  readonly expirationBufferMs?: number;
  readonly project?: string;
  readonly team?: string;
}
export type OutboundAuthFn = () => Promise<{
  readonly headers: Readonly<Record<string, string>>;
}>;
```
