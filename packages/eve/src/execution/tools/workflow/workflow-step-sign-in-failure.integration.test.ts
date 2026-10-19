import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  ConnectionAuthorizationFailedError,
  ConnectionAuthorizationRequiredError,
} from "#connections/errors.js";
import { defineDynamic } from "#dynamic/definition.js";
import { handleConnectionCallbackRequest } from "#execution/connections/callback-route.js";
import { workflowEntry } from "#execution/session/entry.js";
import { markMockModel } from "#internal/mock-model-identity.js";
import { textStreamResult, toolCallStreamResult } from "#internal/testing/approval-resume.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";
import { captureEvents } from "#internal/testing/entry-test-helpers.js";
import { filterEventsByType } from "#internal/testing/events.js";
import { failedSignInWorkflow } from "#internal/testing/workflow-tool-fixtures.js";
import { buildWorkflowToolSerializedContext } from "#internal/testing/workflow-tool-run-harness.js";
import { startSessionOwner } from "#internal/testing/workflow-test-helpers.js";
import { defineAgent } from "#public/definitions/agent.js";
import type { AuthorizationDefinition } from "#shared/connection-types.js";
import { defineTool } from "#tools/definition.js";
import type { WorkflowExecuteToolDefinition } from "#tools/workflow-definition.js";
import { defineWorkflowTool } from "#tools/workflow-definition.js";

// Calls list_issues, then create_issue, then replies.
const script: readonly ({ readonly tool: string } | { readonly text: string })[] = [
  { tool: "list_issues" },
  { tool: "create_issue" },
  { text: "All done." },
];
let scriptIndex = 0;
const scriptedModel = markMockModel(
  new MockLanguageModelV4({
    doStream: async () => {
      const next = script[scriptIndex++] ?? { text: "Done." };
      return "text" in next
        ? textStreamResult(next.text)
        : toolCallStreamResult({
            input: "{}",
            toolCallId: `call-${scriptIndex}`,
            toolName: next.tool,
          });
    },
    modelId: "scripted-model",
    provider: "eve-test",
  }),
);

// The same `oauth/issues` connector as `failedSignInWorkflow`'s step, for an ordinary tool.
const issuesAuth: AuthorizationDefinition<{ nonce: string }> = {
  principalType: "user",
  vercelConnect: { connector: "oauth/issues" },
  async getToken() {
    throw new ConnectionAuthorizationRequiredError("issues");
  },
  async startAuthorization({ callbackUrl }) {
    return {
      challenge: { displayName: "Issues", url: `https://idp.example/authorize?cb=${callbackUrl}` },
      resume: { nonce: "issues-nonce" },
    };
  },
  async completeAuthorization() {
    throw new ConnectionAuthorizationFailedError("issues", {
      message: "Authorization did not complete.",
      reason: "authorization_incomplete",
      retryable: false,
    });
  },
};

type ToolKind = "ordinary" | "workflow step";

function issuesTool(name: string, kind: ToolKind) {
  return {
    loadNamespace: async () => ({
      default:
        kind === "ordinary"
          ? defineTool({
              description: `Run ${name}.`,
              execute: async (_input, ctx) => ({ token: (await ctx.getToken(issuesAuth)).token }),
              inputSchema: {},
            })
          : defineWorkflowTool({
              description: `Run ${name}.`,
              execute: failedSignInWorkflow as WorkflowExecuteToolDefinition["execute"],
              inputSchema: { properties: {}, type: "object" },
            }),
    }),
    logicalPath: `tools/${name}.ts`,
  };
}

describe("workflow step sign-in failure", () => {
  // #4943 for tools that sign in from a workflow step.
  it.each<[ToolKind, ToolKind]>([
    ["workflow step", "workflow step"],
    ["ordinary", "workflow step"],
    ["workflow step", "ordinary"],
  ])(
    "a %s sign-in that fails with retryable: false stops a %s tool on the same grant from prompting",
    async (first, second) => {
      scriptIndex = 0;
      const runtime = await createTestRuntime({
        agent: {
          definition: defineAgent({
            model: defineDynamic({
              events: {
                "step.started": () => ({ model: scriptedModel, modelContextWindowTokens: 200_000 }),
              },
            }),
          }),
          name: "workflow-step-sign-in-failure",
        },
        modules: [issuesTool("list_issues", first), issuesTool("create_issue", second)],
      });

      await runtime.run(async () => {
        const run = await startSessionOwner(workflowEntry, [
          {
            kind: "initial",
            ownerDeploymentId: "dpl_inline",
            input: { message: "List my issues, then create one." },
            serializedContext: {
              ...buildWorkflowToolSerializedContext({
                continuationToken: "http:workflow-step-sign-in-failure",
                requestInput: true,
              }),
              "eve.auth": {
                attributes: {},
                authenticator: "test-idp",
                issuer: "test-idp",
                principalId: "user-1",
                principalType: "user",
              },
            },
          },
        ]);
        const stream = captureEvents(run);

        try {
          const asked = await stream.nextUntil(
            "first sign-in",
            (event) => event.type === "authorization.required",
          );
          const required = filterEventsByType(asked, "authorization.required")[0]!.data;
          await stream.nextUntil("sign-in hold", (event) => event.type === "turn.waiting");

          const url = new URL(required.webhookUrl!);
          url.searchParams.set("code", "oauth-code");
          const token = url.pathname.split("/").map(decodeURIComponent).at(-1)!;
          const response = await handleConnectionCallbackRequest(new Request(url), {
            params: { attemptId: required.attemptId!, name: required.name, token },
          } as never);
          expect(response.status).toBe(200);

          const resumed = await stream.nextUntil(
            "turn after the failed sign-in",
            (event) => event.type === "session.waiting" || event.type === "authorization.required",
          );
          expect(
            filterEventsByType(resumed, "authorization.completed").map(({ data }) => data),
          ).toContainEqual(expect.objectContaining({ outcome: "failed", retryable: false }));
          expect(filterEventsByType(resumed, "authorization.required")).toEqual([]);
          expect(resumed.at(-1)?.type).toBe("session.waiting");
          expect(
            filterEventsByType(resumed, "action.result").map(({ data }) => data.result),
          ).toContainEqual(
            expect.objectContaining({
              isError: true,
              output: expect.stringContaining("already failed in this turn"),
              toolName: "create_issue",
            }),
          );
        } finally {
          stream.dispose();
          await run.cancel();
        }
      });
    },
    60_000,
  );
});
