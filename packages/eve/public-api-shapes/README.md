# Public declaration shapes

These reports record each typed public entry's declaration closure, including types behind aliases, plus explicit peer boundaries. `eve/workflow-modules` reports its ambient module exports. Internal entries are excluded. Function bodies and JSDoc are not API signatures and do not appear.

Run `node scripts/public-api-shapes.mjs --write` after reviewing an API change. `pnpm guard:invariants` checks the reports alongside named export snapshots and extension capability contracts. The checker emits a fresh declaration tree and resolves self-imports there; it does not use stale workspace declarations.

`../public-api-reachability.json` records intentional or unresolved named-type findings:

- `unexported`: reachable eve-owned named declarations with no public export home, across all entries. Generic parameters and member-local names are excluded.
- `orphaned`: exported types not reached from that entry's exported values. Standalone annotation types and disabled markers can be intentional.
- `any`: exported types/values that are `any`, or have an immediately visible `any` field. This is not a recursive proof about every nested generic instantiation.

The initial allowlists are audit evidence, not deletion instructions or a claim that every unexported name is an authoring type. Brands, helpers, and deliberately retained standalone types remain. Export a type an app needs to annotate before considering an exception. Updates can remove findings automatically, but never add exceptions automatically.

This declaration graph check is not a packed-consumer check. Workspace peers resolve during shape generation; isolated consumer tests must independently catch undeclared dependencies, malformed vendored declarations, and optional integration requirements.
