import { defineEval } from "eve/evals";

export default defineEval({
  description: "code_mode executes in a child Workflow run and resumes the parent turn.",
  async test(t) {
    await t.send("Run the code-mode fixture.");
    t.succeeded();
    t.calledTool("code_mode", { count: 1 });
    t.messageIncludes("CODEMODE-RUN-COMPLETE");
  },
});
