import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { resolveInstalledPackageInfo } from "#internal/application/package.js";
import {
  BUILD_DEPLOYMENT_ID_PLACEHOLDER,
  computeBuildDeploymentId,
  replaceBuildDeploymentId,
  type BuildDeploymentFile,
} from "#internal/nitro/host/build-deployment-id.js";

/** The World plugin is always bundled into an eve server chunk, never a traced dependency. */
function mayContainPlaceholder(relativePath: string): boolean {
  return (
    relativePath.startsWith("server/") &&
    relativePath.endsWith(".mjs") &&
    !relativePath.split("/").includes("node_modules")
  );
}

/** Installs the agent's deployment id in the staged World plugin and returns it. */
export async function stageBuildDeploymentId(input: {
  readonly agentName: string;
  readonly outputDirectory: string;
}): Promise<string> {
  const deploymentId = computeBuildDeploymentId({
    agentName: input.agentName,
    eveVersion: resolveInstalledPackageInfo().version,
  });
  const placeholder = Buffer.from(BUILD_DEPLOYMENT_ID_PLACEHOLDER);
  const candidates: BuildDeploymentFile[] = [];
  for (const entry of await listServerFiles(input.outputDirectory)) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    const absolutePath = join(entry.parentPath, entry.name);
    const relativePath = relative(input.outputDirectory, absolutePath).split(sep).join("/");
    if (!mayContainPlaceholder(relativePath)) continue;
    const bytes = await readFile(absolutePath);
    if (bytes.includes(placeholder)) candidates.push({ relativePath, bytes });
  }
  const replacement = replaceBuildDeploymentId(candidates, deploymentId);
  await writeFile(join(input.outputDirectory, replacement.relativePath), replacement.bytes);
  return deploymentId;
}

async function listServerFiles(outputDirectory: string) {
  try {
    return await readdir(join(outputDirectory, "server"), { recursive: true, withFileTypes: true });
  } catch (error) {
    // Without a server directory there is no placeholder, which the caller reports.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
