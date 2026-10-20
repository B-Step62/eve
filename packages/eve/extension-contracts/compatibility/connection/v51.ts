import { defineMcpClientConnection } from "#public/connections/index.js";

// Existing event callbacks use runtime-owned session handles without preparation.
export default defineMcpClientConnection({
  description: "Read issues from the tracker.",
  url: "https://tracker.example.com/mcp",
  auth: {
    principalType: "app",
    getToken: async () => ({ token: "service-credential" }),
    vercelConnect: { connector: "oauth/issues" },
  },
  experimental_events: {
    async onEvent({ event, origin, auth, attachSession }) {
      await attachSession(origin.sessionId).send(`Review tracker event ${event.name}.`, {
        auth,
        turnPolicy: "queue",
      });
    },
  },
});
