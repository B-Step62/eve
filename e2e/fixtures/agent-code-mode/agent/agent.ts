import { e2eAgentConfig } from "@eve-e2e/config";
import { defineAgent } from "eve";

export default defineAgent({
  ...e2eAgentConfig({
    mock: (request) => {
      const result = request.toolResults.find((result) => result.name === "eve__execute");
      if (result !== undefined) return JSON.stringify(result.output);
      return {
        toolCalls: [
          {
            name: "eve__execute",
            input: {
              source:
                "const before = await tools.count({}); const approved = await tools.gated({}); const after = await tools.count({}); return { before, approved, after };",
            },
          },
        ],
      };
    },
  }),
  codeMode: true,
  defaultTools: false,
});
