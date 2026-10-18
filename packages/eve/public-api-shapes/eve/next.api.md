# eve/next

## Export names

- WithEveAgentOptions: src/public/next/index.d.ts#WithEveAgentOptions
- WithEveAgentsConfig: src/public/next/index.d.ts#WithEveAgentsConfig
- WithEveConfigFunction: src/public/next/index.d.ts#WithEveConfigFunction
- WithEveConfigInput: src/public/next/index.d.ts#WithEveConfigInput
- WithEveOptions: src/public/next/index.d.ts#WithEveOptions
- withEve: src/public/next/index.d.ts#withEve

## Peer boundaries

## Declaration closure

### src/public/next/index.d.ts

```ts
export declare function withEve<TConfig extends object>(
  configOrFunction: WithEveConfigInput<TConfig>,
  options?: WithEveOptions,
): WithEveConfigFunction<TConfig>;
export interface WithEveAgentOptions {
  readonly root: string;
  readonly buildCommand?: string;
  readonly servicePrefix?: string;
}
export interface WithEveOptions {
  readonly devServerTimeoutMs?: number;
  readonly eveRoot?: string;
  readonly agents?: WithEveAgentsConfig;
  readonly eveBuildCommand?: string;
  readonly servicePrefix?: string;
}
export type WithEveAgentsConfig = Record<string, string | WithEveAgentOptions>;
export type WithEveConfigFunction<TConfig extends object = object> = (
  phase: string,
  context: {
    readonly defaultConfig: TConfig;
  },
) => TConfig | Promise<TConfig>;
export type WithEveConfigInput<TConfig extends object = object> =
  WithEveConfigFunction<TConfig> | TConfig;
```
