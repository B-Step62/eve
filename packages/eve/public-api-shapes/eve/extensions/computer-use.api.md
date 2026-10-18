# eve/extensions/computer-use

## Export names

- default: src/computer-use/extension/extension.d.ts#_default

## Peer boundaries

## Declaration closure

### src/computer-use/extension/extension.d.ts

```ts
declare const _default: import("eve/extension").NoConfigExtensionHandle;
```

### src/public/definitions/extension.d.ts

```ts
declare const MOUNTED_EXTENSION: unique symbol;
export interface MountedExtension {
  readonly [MOUNTED_EXTENSION]: true;
}
export interface NoConfigExtensionHandle {
  (): MountedExtension;
  readonly config: Record<string, never>;
  readonly schema: undefined;
}
```
