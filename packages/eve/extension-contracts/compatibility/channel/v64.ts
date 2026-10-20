import { defineChannel, POST } from "#public/channels/index.js";

// Epoch 64 handoffs had no `create()` or receive `history`; epoch 65 adds them, which is additive.
export default defineChannel({
  routes: [
    POST("/handoff", async (_req, ctx) => {
      await ctx.from("handoff").send("Continue.", { auth: null });
      return new Response("ok");
    }),
  ],
  receive(input, { from }) {
    return from(`handoff:${String(input.target.ref)}`).send(input.message, { auth: input.auth });
  },
});
