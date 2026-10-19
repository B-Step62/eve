// Compares what the world observes of two versions of the scheduler, case by case: a refactor
// that keeps the scheduler's behavior observes the same. Record each version first, from its own
// checkout, with the scheduler checker:
//
//   EVE_CHECK_SCHEDULER_OBSERVE=/tmp/before pnpm exec vitest run \
//     --config vitest.integration.config.ts src/execution/session/scheduler/checked.integration.test.ts
//   (the same with /tmp/after, from the other checkout)
//   pnpm spec:scheduler-compare /tmp/before /tmp/after
//
// For each case it prints how many observations only one version reached, with the shortest
// trails to the first few: where the two first differ.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const [before, after, shown = "3"] = process.argv.slice(2);
if (before === undefined || after === undefined) {
  console.error("Usage: pnpm spec:scheduler-compare <before-prefix> <after-prefix> [shown]");
  process.exit(2);
}

const read = (path) =>
  new Map(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => line.split("\t")),
  );

const cases = readdirSync(dirname(before))
  .filter((name) => name.startsWith(`${basename(before)}.`))
  .map((name) => name.slice(basename(before).length + 1));
if (cases.length === 0) {
  console.error(`Nothing recorded at ${before}.*`);
  process.exit(2);
}

let differs = false;
for (const name of cases) {
  const theirs = join(dirname(after), `${basename(after)}.${name}`);
  if (!existsSync(theirs)) {
    console.log(`${name}: not recorded at ${after}`);
    differs = true;
    continue;
  }
  const a = read(join(dirname(before), `${basename(before)}.${name}`));
  const b = read(theirs);
  const only = (x, y) =>
    [...x]
      .filter(([seen]) => !y.has(seen))
      .map(([, trail]) => trail)
      .sort((p, q) => p.split(" | ").length - q.split(" | ").length);
  const onlyBefore = only(a, b);
  const onlyAfter = only(b, a);
  if (onlyBefore.length > 0 || onlyAfter.length > 0) differs = true;
  console.log(
    `${name}: ${a.size} and ${b.size} observed; ${onlyBefore.length} only before, ${onlyAfter.length} only after`,
  );
  for (const trail of onlyBefore.slice(0, Number(shown))) console.log(`  before: ${trail}`);
  for (const trail of onlyAfter.slice(0, Number(shown))) console.log(`  after:  ${trail}`);
}
process.exit(differs ? 1 : 0);
