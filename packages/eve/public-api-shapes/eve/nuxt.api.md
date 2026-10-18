# eve/nuxt

## Export names

- EveNuxtModule: src/public/nuxt/module.d.ts#EveNuxtModule
- EveNuxtModuleOptions: src/public/nuxt/module.d.ts#EveNuxtModuleOptions
- default: src/public/nuxt/module.d.ts#eveNuxtModule

## Peer boundaries

## Declaration closure

### src/public/nuxt/module.d.ts

```ts
declare const eveNuxtModule: EveNuxtModule;
export interface EveNuxtModule {
  (options: EveNuxtModuleOptions, nuxt: object): void;
}
export interface EveNuxtModuleOptions {
  devServerTimeoutMs?: number;
  eveRoot?: string;
  eveBuildCommand?: string;
}
```
