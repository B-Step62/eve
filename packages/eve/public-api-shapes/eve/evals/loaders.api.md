# eve/evals/loaders

## Export names

- loadJson: src/evals/loaders/json.d.ts#loadJson
- loadYaml: src/evals/loaders/yaml.d.ts#loadYaml

## Peer boundaries

## Declaration closure

### src/evals/loaders/json.d.ts

```ts
export declare function loadJson(filePath: string): Promise<unknown>;
```

### src/evals/loaders/yaml.d.ts

```ts
export declare function loadYaml(filePath: string): Promise<Record<string, unknown>>;
```
