import { prSkillDescription, prSkillMarkdown } from "eve/extensions/git/sandbox";
import { defineDynamic, defineSkill } from "eve/skills";

import { deprecatedGitHubAccess, deprecatedGitHubConfigured } from "../lib/github-compat.ts";

/** @deprecated Mount `eve/extensions/git`, which contributes the same skill as `git__pr`. */
export default defineDynamic({
  events: {
    "session.started": () =>
      deprecatedGitHubConfigured()
        ? defineSkill({
            description: prSkillDescription(true, deprecatedGitHubAccess()),
            markdown: prSkillMarkdown(true, deprecatedGitHubAccess()),
          })
        : null,
  },
});
