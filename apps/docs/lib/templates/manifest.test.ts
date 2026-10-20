import { describe, expect, it } from "vitest";

import { templateManifest } from "./manifest";

// A tool or skill name matches a manifest file when it is one of the path's
// segments, ignoring the extension: `agent/tools/get_weather.ts` or
// `agent/skills/search_content/SKILL.md`.
const pathNames = (path: string) => path.replace(/\.(md|ts|tsx)$/, "").split("/");

describe("template previews", () => {
  const withPreview = templateManifest.filter((entry) => entry.preview);

  it.each(withPreview.map((entry) => [entry.slug, entry] as const))(
    "%s only shows tools listed in its files",
    (_slug, entry) => {
      const names = new Set(entry.files.flatMap(pathNames));
      const tools = entry.preview?.messages.flatMap((message) => message.tools ?? []) ?? [];
      expect(tools.filter((tool) => !names.has(tool))).toEqual([]);
    },
  );
});
