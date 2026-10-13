import type { Announcement } from "#harness/announcements.js";
import type { HarnessToolDefinition } from "#harness/execute-tool.js";
import { CALL_TOOL_NAME, SEARCH_TOOL_NAME } from "#protocol/catalog-tools.js";

import { compareCodeUnits } from "./rank.js";
import type { StepCatalog } from "./step-catalog.js";

const ANNOUNCEMENT_KEY = "dynamic-tools";
const MAX_LISTED_TOOLS = 20;

/**
 * Announces the deferred tools and agents a dynamic resolver adds mid-session,
 * by name and description, since the catalog listing names no deferred entry.
 * The first step records a silent baseline: entries present then stay out of
 * context like any deferred entry, and `eve__search` finds them. The recorded
 * value is every name seen so far, so an entry going away changes nothing and
 * only a name the model hasn't seen appends a message. `announced` holds the
 * values announced so far.
 */
export function dynamicToolAnnouncements(
  catalog: Pick<StepCatalog, "deferred" | "describe" | "dynamic">,
  announced: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, Announcement>> {
  const recorded = announced?.[ANNOUNCEMENT_KEY];
  const present = [...catalog.deferred.values()]
    .filter(({ name }) => catalog.dynamic.has(name))
    .sort((a, b) => compareCodeUnits(a.name, b.name));
  // Nothing to add to a baseline that is already recorded.
  if (present.length === 0 && recorded !== undefined) return {};
  const names = new Set([...recordedNames(recorded), ...present.map(({ name }) => name)]);
  return {
    [ANNOUNCEMENT_KEY]: {
      value: JSON.stringify([...names].sort(compareCodeUnits)),
      render: (previous) => {
        if (previous === undefined) return undefined;
        const known = new Set(recordedNames(previous));
        const added = present.filter(({ name }) => !known.has(name));
        return added.length === 0 ? undefined : renderAdded(added, catalog.describe);
      },
    },
  };
}

function renderAdded(
  added: readonly HarnessToolDefinition[],
  describe: (definition: HarnessToolDefinition) => string,
): string {
  const listed = added.slice(0, MAX_LISTED_TOOLS);
  const more = added.length - listed.length;
  return [
    `New tools were added to your catalog. Call them with ${CALL_TOOL_NAME}({ name, input }).`,
    ...listed.map((definition) => {
      const description = describe(definition);
      return description.length === 0
        ? `- ${definition.name}`
        : `- ${definition.name}: ${description}`;
    }),
    ...(more > 0 ? [`- and ${more} more; find them with ${SEARCH_TOOL_NAME}.`] : []),
  ].join("\n");
}

/** The recorded names; a value that isn't a JSON list of names counts as none. */
function recordedNames(value: string | undefined): readonly string[] {
  if (value === undefined) return [];
  try {
    const names: unknown = JSON.parse(value);
    return Array.isArray(names)
      ? names.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    return [];
  }
}
