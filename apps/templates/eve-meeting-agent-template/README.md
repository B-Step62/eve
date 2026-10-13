# eve Meeting Agent Template

An [eve](https://eve.dev) agent that joins Zoom, Google Meet, and Microsoft Teams calls through a [Recall.ai](https://recall.ai) meeting bot. It listens to the live transcript and reads the meeting chat, and opens or updates Linear issues when someone asks, such as "eve, open a Linear ticket for this and assign Bob."

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
- **The agent chooses when to speak.** Every final utterance, chat message, and join reaches the agent. It calls `no_reply` to stay quiet. Anything it says goes to the meeting chat, including a short "On it" line as it starts on a request.
- **It gets ready before the first ask.** The first join starts the session, and the agent spends that turn loading Linear's tools, teams, and users. A first request can then be one `linear__save_issue` call.
- **Linear runs as one app credential.** Meetings have no signed-in user, so `agent/connections/linear.ts` connects to [Linear's MCP server](https://linear.app/docs/mcp) with an app-scoped [Vercel Connect](https://vercel.com/docs/connect) connector. Issues it creates show the connector's Linear user as the creator.

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

Admit the bot when it asks to join. Then try "eve, open a Linear ticket for this and assign Bob", and later "eve, bump that ticket to urgent". Remove the bot from the call when you're done. The bot's name, `eve`, is `BOT_NAME` in `agent/lib/recall.ts`.

## Limits of this template

- **Everyone in the meeting acts as the bot.** Speaker names come from the meeting platform and prove nothing, so all speech and chat run as one principal, `recall:bot:<id>`. Anyone in the call can use the Linear connector's access, so scope its Linear user to what the bot should do.
- **Every utterance is a model call.** With the `queue` turn policy, utterances that arrive during a turn are batched into the next one, but a long meeting still makes many calls. Filter in the webhook route, for example by the bot's name, if that costs too much.
- **Replies are text.** Google Meet chat limits each message to 500 characters, so longer replies are split.
