import { z } from "zod";

const permissionSchema = z.object({
  provider: z.literal("github"),
  repositories: z.array(z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/u)).length(1),
  access: z
    .enum(["read", "write"])
    .describe(
      'Must match the configured token access: "write" by default, or "read" for read-only tokens. Read-only tokens allow reads; GitHub rejects pushes, pull request creation, comments, reviews, and merges.',
    ),
});

export const githubShellInputSchema = z.object({
  command: z.string().trim().min(1).max(20_000),
  permissions: z.array(permissionSchema).length(1),
  description: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("the concrete GitHub-side result expected from this command"),
  workingDirectory: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .optional()
    .describe("sandbox workspace directory; defaults to /workspace"),
});
