import { describe, expect, it } from "vitest";

import {
  BUILD_DEPLOYMENT_ID_PLACEHOLDER,
  computeBuildDeploymentId,
  replaceBuildDeploymentId,
} from "./build-deployment-id.js";

const file = (relativePath: string, content: string) => ({
  relativePath,
  bytes: Buffer.from(content),
});

describe("build deployment identity", () => {
  it("names one agent on one eve version", () => {
    const base = { agentName: "notes", eveVersion: "1.0.0" };
    const id = computeBuildDeploymentId(base);
    expect(id).toMatch(/^eve_[a-f0-9]{32}$/);
    expect(computeBuildDeploymentId({ ...base })).toBe(id);
    expect(computeBuildDeploymentId({ ...base, eveVersion: "1.0.1" })).not.toBe(id);
    expect(computeBuildDeploymentId({ ...base, agentName: "tasks" })).not.toBe(id);
  });

  it("patches exactly one placeholder without changing offsets or the original bytes", () => {
    const original = file("server/chunk.mjs", `before:${BUILD_DEPLOYMENT_ID_PLACEHOLDER}:after`);
    const id = "eve_0123456789abcdef0123456789abcdef";
    const patched = replaceBuildDeploymentId([original], id);
    expect(patched.relativePath).toBe(original.relativePath);
    expect(Buffer.from(patched.bytes).toString()).toBe(`before:${id}:after`);
    expect(patched.bytes.length).toBe(original.bytes.length);
    expect(original.bytes.toString()).toContain(BUILD_DEPLOYMENT_ID_PLACEHOLDER);
    for (const files of [
      [],
      [file("server/a.mjs", "missing")],
      [original, file("server/b.mjs", BUILD_DEPLOYMENT_ID_PLACEHOLDER)],
      [file("server/a.mjs", BUILD_DEPLOYMENT_ID_PLACEHOLDER.repeat(2))],
    ]) {
      expect(() => replaceBuildDeploymentId(files, id)).toThrow(
        "expected exactly one workflow-world placeholder",
      );
    }
    expect(() => replaceBuildDeploymentId([original], "latest")).toThrow(
      "Invalid build deployment id",
    );
  });
});
