# eve Meeting Agent Template

An [eve](https://eve.dev) agent that joins Zoom, Google Meet, and Microsoft Teams calls through a [Recall.ai](https://recall.ai) meeting bot. It listens to the live transcript and reads the meeting chat, and opens or updates Linear issues when someone asks, such as "eve, open a Linear ticket for this and assign Ben."

## How it works

```
You ── "join https://meet.google.com/..." ──▶ join_meeting tool ──▶ Recall: create bot
                                                                      │
Meeting ── speech + chat ──▶ Recall bot ── signed webhook ──▶ POST /recall/webhook
                                                                      │ one session per bot
                                                                      ▼
                                                                eve agent ──▶ Linear MCP
                                                                      │
Meeting chat ◀── Recall send_chat_message ◀── message.completed ──────┘
```

- **One meeting is one durable eve session**, addressed by the Recall bot ID, so "update that ticket" can refer to an issue opened earlier in the call.
- **Recall does the meeting work.** It joins the call, transcribes it, and relays chat messages to `agent/channels/recall.ts` as webhooks. Everything is ordinary HTTP, so the agent runs on Vercel Functions with no long-lived connection.
- **The agent chooses when to speak.** Every final utterance and chat message reaches the agent. It calls `no_reply` to stay quiet, and anything it does reply goes to the meeting chat.
- **Linear runs as one app credential.** Meetings have no signed-in user, so `agent/connections/linear.ts` connects to [Linear's MCP server](https://linear.app/docs/mcp) with an app-scoped [Vercel Connect](https://vercel.com/docs/connect) connector. Issues it creates show the connector's Linear user as the creator.
- **Approvals happen in chat.** Linear tools run without asking. If you add an approval-gated tool, the channel posts its prompt with numbered options, and a chat reply with the number answers it. Spoken words never answer a prompt, because speech reaches the agent labeled with its speaker.

## Set up

1. Create a [Recall.ai](https://www.recall.ai) account and an API key.
2. Add a [workspace verification secret](https://docs.recall.ai/docs/authenticating-requests-from-recallai) so Recall signs its webhooks.
3. Link a Vercel project, then create a Linear connector from a [Linear API key](https://linear.app/settings/api) and attach it. Consider a dedicated Linear user for the bot, so its issues are easy to tell apart.

```bash
vercel link
echo '[{ "value": "lin_api_..." }]' > /tmp/linear-key.json
vercel connect create linear --connection-method api-key --name linear --data @/tmp/linear-key.json
vercel connect attach <connector-uid>
```

4. Set the environment variables:

```bash
LINEAR_CONNECTOR=<connector-uid> # defaults to "linear"
RECALL_API_KEY=...
RECALL_WORKSPACE_VERIFICATION_SECRET=whsec_...
RECALL_REGION=us-east-1          # your Recall workspace region
RECALL_BOT_NAME=eve              # optional; the name the bot joins with
RECALL_WEBHOOK_URL=https://...   # optional on Vercel production; see below
```

Recall must reach `/recall/webhook` over public HTTPS. On a Vercel production deployment, the agent uses `VERCEL_PROJECT_PRODUCTION_URL`. If Deployment Protection covers production, enable [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) with `vercel project protection enable --protection-bypass` and redeploy; the agent adds the secret to the webhook URL it gives Recall. Set `RECALL_WEBHOOK_URL` for previews or when running locally.

## Deploy

```bash
vercel deploy --prod
```

Then open the terminal UI against the deployment and ask it to join a meeting. eve signs the TUI in with your Vercel account.

```bash
pnpm exec eve remote connect --url https://<your-project>.vercel.app
```

## Run locally

```bash
pnpm install
pnpm dev
```

Expose the dev server with an HTTPS tunnel and set `RECALL_WEBHOOK_URL` to `https://<your-tunnel>/recall/webhook`. Then ask the agent in the eve dev TUI to join a meeting:

```
Join https://meet.google.com/abc-defg-hij
```

Admit the bot when it asks to join. Then try "eve, open a Linear ticket for this and assign Ben", and later "eve, bump that ticket to urgent".

## Limits of this template

- **Everyone in the meeting acts as the bot.** Speaker names come from the meeting platform and prove nothing, so all speech and chat run as one principal, `recall:bot:<id>`. Anyone in the call can use the Linear connector's access, with no approval step. Scope its Linear user to what the bot should do. Add an [approval](https://eve.dev/docs/connections/mcp#gate-by-the-servers-tool-annotations) to the connection if some actions should wait for a chat reply.
- **Every utterance is a model call.** With the `queue` turn policy, utterances that arrive during a turn are batched into the next one, but a long meeting still makes many calls. Filter in the webhook route, for example by the bot's name, if that costs too much.
- **Chat shows one prompt at a time.** The channel posts the first request of each batch.
- **Replies are text.** Google Meet chat limits each message to 500 characters, so longer replies are split.
