# eve/vercel

## Export names

- EveVercelConfig: src/public/vercel/index.d.ts#EveVercelConfig
- EveVercelRouteConfig: src/public/vercel/index.d.ts#EveVercelRouteConfig
- EveVercelServiceConfig: src/public/vercel/index.d.ts#EveVercelServiceConfig
- WithEveOptions: src/public/vercel/index.d.ts#WithEveOptions
- withEve: src/public/vercel/index.d.ts#withEve

## Peer boundaries

## Declaration closure

### src/public/vercel/index.d.ts

```ts
export declare function withEve<TConfig extends EveVercelConfig>(
  config: TConfig,
  options?: WithEveOptions,
): Promise<
  Omit<TConfig, "routes" | "services"> & {
    readonly routes: readonly EveVercelRouteConfig[];
    readonly services: Readonly<Record<string, EveVercelServiceConfig>>;
  }
>;
export interface EveVercelConfig {
  readonly experimentalServices?: unknown;
  readonly experimentalServicesV2?: unknown;
  readonly routes?: readonly EveVercelRouteConfig[];
  readonly services?:
    | Readonly<Record<string, EveVercelServiceConfig>>
    | readonly (EveVercelServiceConfig & {
        readonly name: string;
      })[];
  readonly [key: string]: unknown;
}
export interface EveVercelRouteConfig {
  readonly destination?:
    | string
    | {
        readonly service?: string;
        readonly type?: string;
      };
  readonly handle?: string;
  readonly src?: string;
  readonly transforms?: readonly Record<string, unknown>[];
  readonly [key: string]: unknown;
}
export interface EveVercelServiceConfig {
  readonly buildCommand?: string;
  readonly entrypoint?: string;
  readonly framework?: string;
  readonly mount?:
    | string
    | {
        readonly path?: string;
        readonly subdomain?: string;
      };
  readonly outputDirectory?: string;
  readonly routes?: readonly EveVercelRouteConfig[];
  readonly root?: string;
  readonly type?: string;
  readonly [key: string]: unknown;
}
export interface WithEveOptions {
  readonly root?: string;
}
```
