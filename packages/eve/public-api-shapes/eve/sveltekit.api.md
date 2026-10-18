# eve/sveltekit

## Export names

- EveSvelteKitPluginOptions: src/public/sveltekit/index.d.ts#EveSvelteKitPluginOptions
- eveSvelteKit: src/public/sveltekit/index.d.ts#eveSvelteKit

## Peer boundaries

- vite/dist/node/index.d.ts#Plugin

## Declaration closure

### src/public/sveltekit/index.d.ts

```ts
export declare function eveSvelteKit(options?: EveSvelteKitPluginOptions): Plugin;
export interface EveSvelteKitPluginOptions {
  readonly eveRoot?: string;
  readonly eveBuildCommand?: string;
}
```
