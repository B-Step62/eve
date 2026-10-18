# eve/memory/file/vercel

## Export names

- VercelBlobBackendOptions: src/public/memory/file/backends/vercel-blob.d.ts#VercelBlobBackendOptions
- vercelBlob: src/public/memory/file/backends/vercel-blob.d.ts#vercelBlob

## Peer boundaries

## Declaration closure

### src/public/memory/file/backend.d.ts

```ts
export interface MemoryDocument {
  readonly content: string;
  readonly version: string;
}
export interface MemoryDocumentBackend {
  readonly read: (input: MemoryDocumentReadInput) => Promise<MemoryDocument | null>;
  readonly write: (input: MemoryDocumentWriteInput) => Promise<MemoryDocument>;
}
export interface MemoryDocumentReadInput {
  readonly key: string;
  readonly abortSignal: AbortSignal;
}
export interface MemoryDocumentWriteInput extends MemoryDocumentReadInput {
  readonly content: string;
  readonly expectedVersion: string | null;
}
```

### src/public/memory/file/backends/vercel-blob.d.ts

```ts
export declare function vercelBlob(options?: VercelBlobBackendOptions): MemoryDocumentBackend;
export interface VercelBlobBackendOptions {
  readonly token?: string;
  readonly oidcToken?: string;
  readonly storeId?: string;
  readonly prefix?: string;
}
```
