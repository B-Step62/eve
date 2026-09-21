# Integrated web chat port

This checkout combines the fourteen improvements from the e0 webapp into the generic eve Web Chat source. It is a working integration for later decomposition, not fourteen individually accepted visual changes.

## Run and validate

From the repository root, install with pnpm, build eve, then run `pnpm --filter @eve-internal/web-chat test` and `pnpm --filter @eve-internal/web-chat typecheck`. The workspace package exists to check the actual registry source; its package file and tests are excluded from generated apps.

The registry and scaffold consume the same source. After edits, run `pnpm --filter eve generate:web-template` and `pnpm --filter eve check:web-template`. The scaffold additionally overlays `../web-sign-in-with-vercel` when Sign in with Vercel is selected.

For a deterministic local preview, run `node scripts/preview-web-chat.mjs` from the repository root, install dependencies in `.web-preview`, and run `pnpm --dir .web-preview dev --port 4312`. This generates a real eve app with mock model responses and a researcher subagent, without calling a model provider. Add `--authenticated` to generate `.web-preview-auth` with the production authentication overlay instead.

## Production history

Local development continues reading the local eve workflow history. Production uses a Postgres metadata/ownership index; eve remains the transcript store. Set `SESSION_DATABASE_URL` to a Neon-compatible Postgres connection URL and `SESSION_INDEX_SCOPE` to a stable deployment scope (separate preview and production). Run `node scripts/migrate-session-index.mjs` before serving requests. Supply these variables to both the Next.js and eve services.

The Sign in with Vercel scaffold verifies the Better Auth session and stores the verified Vercel provider subject in its encrypted session cookie. History ownership uses that stable subject, not email or the transient Better Auth record ID. Existing cookies without that subject require signing in again. The base scaffold has no production browser identity adapter and fails closed for history until one is supplied. Deployment OIDC still authenticates existing TUI/service callers; it does not identify a browser user.

Session creation records ownership before returning its ID. A hook updates title and activity. All browser session controls require the owner; child reads additionally require an exact durable parent/call/child binding. Cookie-authenticated mutations reject cross-origin requests. The metadata writes and eve's stream are not one transaction: a database failure can leave an unlisted session, and a missed hook update needs reconciliation. This port does not claim transactional indexing or a deployed two-user OAuth test.

## Decomposition map

| Group                       | Main source                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| Readable messages and code  | `components/ai-elements/message.tsx`, `app/globals.css`                          |
| Copy tool details           | `components/ai-elements/tool.tsx`, `app/_components/agent-message.tsx`           |
| Predictable disclosures     | `components/ai-elements/reasoning.tsx`, `tool.tsx`, `app/globals.css`            |
| Compact conversation layout | `app/_components/agent-chat.tsx`, message and prompt components                  |
| Reliable scrolling          | `components/ai-elements/conversation.tsx`, `agent-chat.tsx`                      |
| Repeated messages           | `lib/chat-message-reducer.ts`                                                    |
| Parent activity             | `lib/chat-turn-state.ts`, `agent-chat.tsx`                                       |
| Session history             | `lib/session-history.ts`, local readers, `session-sidebar.tsx`, workspace layout |
| Session switching           | `lib/chat-session-cache.ts`, `chat-workspace.tsx`                                |
| Connectivity                | `lib/server-status.ts`, status provider, sidebar and composer                    |
| Draft persistence           | `lib/composer-draft.ts`, `lib/draft-files.ts`, persistent editor                 |
| Subagent inspection         | pane/cache/storage modules and workspace pane registry                           |
| Subagent progress           | `lib/subagent-progress.ts`, status components, shimmer                           |
| Production ownership        | session store/access, API route, authenticated overlay and hook                  |

Keep this combined checkout as the integration reference when extracting smaller changes. Visual acceptance still requires full-layout before/after captures, including focused and unfocused composer states. Runtime restart/sandbox failures are separate from these UI changes.
