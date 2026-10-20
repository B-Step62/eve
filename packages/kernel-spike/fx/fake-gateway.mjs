// A scripted AI Gateway for fx, in Node: the same wire format as fx's own
// e2e fake gateway (tests/e2e/tmux-helpers.ts). Each model call answers with
// step `i` of the script, where `i` is how many assistant messages the
// request already holds, so a resent request gets the same answer.

import { createServer } from "node:http";

const sse = (events) =>
  `${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")}data: [DONE]\n\n`;

function answer(step) {
  if (step.tool_calls) {
    return sse([
      ...step.tool_calls.map((c) => ({
        type: "tool-call",
        toolCallId: c.id,
        toolName: c.name,
        input: c.input,
      })),
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" } },
    ]);
  }
  return sse([
    { type: "text-delta", id: "answer_1", delta: step.text ?? "" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 3 }, outputTokens: { total: 5 } },
    },
  ]);
}

/** `script(index)` returns the model step for a request with `index` assistant messages. */
export function startFakeGateway(script, model) {
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/coding-agent/v1/models") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: [{ id: model, type: "language", tags: ["tool-use"] }] }));
      return;
    }
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.method !== "POST") {
        res.statusCode = 404;
        res.end();
        return;
      }
      const request = JSON.parse(body);
      const index = (request.prompt ?? []).filter((m) => m.role === "assistant").length;
      requests.push({ index, bytes: body.length, ...(process.env.FX_BENCH_DUMP ? { body } : {}) });
      res.setHeader("content-type", "text/event-stream");
      res.end(answer(script(index)));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        chatUrl: `http://127.0.0.1:${port}/v4/ai/language-model`,
        requests,
        stop: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
