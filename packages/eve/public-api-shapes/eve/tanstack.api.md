# eve/tanstack

## Export names

- EveTanStackPluginOptions: src/public/tanstack/index.d.ts#EveTanStackPluginOptions
- eveTanStack: src/public/tanstack/index.d.ts#eveTanStack

## Peer boundaries

- vite/dist/node/index.d.ts#Plugin

## Declaration closure

### src/public/tanstack/index.d.ts

```ts
export declare function eveTanStack(options?: EveTanStackPluginOptions): Plugin;
export interface EveTanStackPluginOptions {
  readonly devServerTimeoutMs?: number;
  readonly eveRoot?: string;
  readonly eveBuildCommand?: string;
}
```
