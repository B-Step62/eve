import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { templateManifest } from "./manifest";

// A tool or skill name matches a manifest file when it is one of the path's
// segments, ignoring the extension: `agent/tools/get_weather.ts` or
// `agent/skills/search_content/SKILL.md`.
const pathNames = (path: string) => path.replace(/\.(md|ts|tsx)$/, "").split("/");

describe("template previews", () => {
  it.each(
    templateManifest
      .filter((entry) => !entry.unlisted)
      .map((entry) => [entry.slug, entry.tagline] as const),
  )("%s has a one-line tagline", (_slug, tagline) => {
    expect(tagline?.length).toBeGreaterThan(0);
    expect(tagline?.length).toBeLessThanOrEqual(40);
  });

  const withPreview = templateManifest.filter((entry) => entry.preview);

  it.each(withPreview.map((entry) => [entry.slug, entry] as const))(
    "%s only shows tools listed in its files",
    (_slug, entry) => {
      const names = new Set(entry.files.flatMap(pathNames));
      const tools = entry.preview?.messages.flatMap((message) => message.tools ?? []) ?? [];
      expect(tools.filter((tool) => !names.has(tool))).toEqual([]);
    },
  );

  it.each(
    withPreview
      .filter((entry) => entry.preview?.icon)
      .map((entry) => [entry.slug, entry.preview?.icon ?? ""] as const),
  )("%s icon exists in public/", (_slug, icon) => {
    expect(existsSync(fileURLToPath(new URL(`../../public${icon}`, import.meta.url)))).toBe(true);
  });

  it.each(
    withPreview
      .filter((entry) => entry.preview?.surface !== "slack")
      .map((entry) => [entry.slug, entry] as const),
  )("%s has no Slack-only formatting", (_slug, entry) => {
    const texts = entry.preview?.messages.map((message) => message.text) ?? [];
    expect(texts.filter((text) => /`|\]\(/.test(text))).toEqual([]);
    expect(entry.preview?.messages.filter((message) => message.attachment)).toEqual([]);
  });

  it.each(
    withPreview
      .filter((entry) =>
        entry.preview?.messages.some((message) => message.attachment?.type === "tasks"),
      )
      .map((entry) => [entry.slug, entry] as const),
  )("%s only shows a task card when it has subagents", (_slug, entry) => {
    expect(entry.files.some((path) => path.startsWith("agent/subagents/"))).toBe(true);
  });
});
