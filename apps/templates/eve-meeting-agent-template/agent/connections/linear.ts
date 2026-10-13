import { defineMcpClientConnection } from "eve/connections";

// Meeting sessions have no signed-in user, so the agent acts in Linear with
// one workspace API key. Linear's MCP server accepts API keys as bearer tokens.
export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description:
    "Linear workspace: find teams and people, and search, create, update, and comment on issues.",
  auth: {
    credentialOwner: "app",
    async getToken() {
      const token = process.env.LINEAR_API_KEY;
      if (!token) throw new Error("LINEAR_API_KEY is not set.");
      return { token };
    },
  },
  // Anyone in the meeting can reach these tools, so a destructive call waits
  // for a numbered reply in the meeting chat.
  approval: ({ toolAnnotations }) =>
    toolAnnotations?.destructiveHint === true ? "user-approval" : "not-applicable",
});
