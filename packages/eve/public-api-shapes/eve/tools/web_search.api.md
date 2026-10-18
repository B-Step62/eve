# eve/tools/web_search

## Export names

- WebSearchFallbackProvider: src/shared/web-search.d.ts#WebSearchFallbackProvider
- WebSearchProvider: src/shared/web-search.d.ts#WebSearchProvider
- WebSearchToolDefinition: src/tools/provided/web-search.d.ts#WebSearchToolDefinition
- WebSearchToolInput: src/tools/provided/web-search.d.ts#WebSearchToolInput
- webSearch: src/tools/provided/web-search.d.ts#webSearch

## Peer boundaries

## Declaration closure

### src/shared/web-search.d.ts

```ts
export declare const WEB_SEARCH_FALLBACK_PROVIDERS: readonly ["exa", "parallel", "browserbase"];
export declare const WEB_SEARCH_PROVIDERS: readonly ["exa", "parallel", "browserbase", "native"];
export type WebSearchFallbackProvider = (typeof WEB_SEARCH_FALLBACK_PROVIDERS)[number];
export type WebSearchProvider = (typeof WEB_SEARCH_PROVIDERS)[number];
```

### src/tools/provided/web-search.d.ts

```ts
declare const WEB_SEARCH_TOOL_KIND = "eve:web-search-tool";
export declare function webSearch(input: WebSearchToolInput): WebSearchToolDefinition;
export interface WebSearchToolDefinition {
  readonly kind: typeof WEB_SEARCH_TOOL_KIND;
  readonly provider: WebSearchProvider;
  readonly fallback?: WebSearchFallbackProvider;
}
export type WebSearchToolInput =
  | {
      readonly provider: "native";
      readonly fallback?: WebSearchFallbackProvider;
    }
  | {
      readonly provider: WebSearchFallbackProvider;
      readonly fallback?: never;
    };
```
