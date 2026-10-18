# eve/local-dev

## Export names

- LocalDevCapability: src/runtime/local-dev-capability.d.ts#LocalDevCapability
- getLocalDevCapability: src/runtime/local-dev-capability.d.ts#getLocalDevCapability

## Peer boundaries

## Declaration closure

### src/runtime/local-dev-capability.d.ts

```ts
export declare function getLocalDevCapability(
  environment?: Readonly<Record<string, string | undefined>>,
): LocalDevCapability | undefined;
export interface LocalDevCapability {
  readonly appRoot: string;
  readonly interactiveClient: boolean;
  withSuspendedSource<T>(task: () => Promise<T>): Promise<T>;
}
```
