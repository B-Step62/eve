import { createHash } from "node:crypto";

import { BUILD_DEPLOYMENT_ID_PATTERN } from "#execution/install-workflow-deployment-id.js";
import { deriveEveWorkflowQueueNamespace } from "#internal/workflow/queue-namespace.js";

export const BUILD_DEPLOYMENT_ID_PLACEHOLDER = "eve_BUILD_DEPLOYMENT_ID_PLACEHOLDER_";

export interface BuildDeploymentFile {
  readonly relativePath: string;
  readonly bytes: Uint8Array;
}

/**
 * Names the builds that can replay each other's runs: one agent on one eve
 * version, which pins the Workflow runtime and every framework step id. App
 * changes under the same eve version keep the id, so operators drain only on
 * eve upgrades and replace the fleet for every other deploy.
 */
export function computeBuildDeploymentId(input: {
  readonly agentName: string;
  readonly eveVersion: string;
}): string {
  const hash = createHash("sha256");
  for (const part of [
    "eve-deployment-v1",
    input.eveVersion,
    deriveEveWorkflowQueueNamespace(input.agentName),
  ]) {
    hash.update(`${Buffer.byteLength(part)}:`).update(part);
  }
  return `eve_${hash.digest("hex").slice(0, 32)}`;
}

export function replaceBuildDeploymentId(
  files: readonly BuildDeploymentFile[],
  deploymentId: string,
): BuildDeploymentFile {
  const placeholder = Buffer.from(BUILD_DEPLOYMENT_ID_PLACEHOLDER);
  const replacement = Buffer.from(deploymentId);
  if (
    !BUILD_DEPLOYMENT_ID_PATTERN.test(deploymentId) ||
    replacement.length !== placeholder.length
  ) {
    throw new Error(
      "Invalid build deployment id: expected eve_ followed by 32 lowercase hex characters.",
    );
  }
  let match: { file: BuildDeploymentFile; offset: number } | undefined;
  let count = 0;
  for (const file of files) {
    const bytes = Buffer.from(file.bytes);
    for (
      let offset = bytes.indexOf(placeholder);
      offset !== -1;
      offset = bytes.indexOf(placeholder, offset + placeholder.length)
    ) {
      count++;
      match = { file, offset };
    }
  }
  if (count !== 1 || match === undefined) {
    throw new Error(
      `Cannot install build deployment id: expected exactly one workflow-world placeholder in server/**/*.mjs outside node_modules, found ${count}. This is an eve bug; please report it.`,
    );
  }
  const bytes = Buffer.from(match.file.bytes);
  replacement.copy(bytes, match.offset);
  return { relativePath: match.file.relativePath, bytes };
}
