import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDirective, resolveSelection } from "./resolve-authoring-benchmark.mjs";

const context = { caseExists: (name) => name.startsWith("author-") };

test("defaults to one model and the published cases", () => {
  assert.deepEqual(resolveSelection(parseDirective("Fixes a bug."), context), {
    models: ["claude-sonnet-5"],
    cases: "",
    runs: "1",
  });
});

test("reads models, cases, and runs from the PR body", () => {
  const body = [
    "Summary",
    "",
    "authoring-benchmark: models=kimi-k3,openai/gpt-6-sol cases=author-008-restock-agent runs=3",
  ].join("\n");
  assert.deepEqual(resolveSelection(parseDirective(body), context), {
    models: ["kimi-k3", "gpt-6-sol-high"],
    cases: "author-008-restock-agent",
    runs: "3",
  });
});

test("accepts the directive inside an HTML comment", () => {
  assert.deepEqual(parseDirective("<!-- authoring-benchmark: cases=author-001-weather-tool -->"), {
    cases: "author-001-weather-tool",
  });
});

test("expands all to the supported models", () => {
  const { models } = resolveSelection({ models: "all" }, context);
  assert.ok(models.length > 1);
  assert.ok(!models.includes("claude-sonnet-4-6"));
});

test("uses the configured default model", () => {
  assert.deepEqual(resolveSelection({}, { ...context, defaultModel: "kimi-k3" }).models, [
    "kimi-k3",
  ]);
});

test("rejects unknown models, cases, options, and run counts", () => {
  assert.throws(() => resolveSelection({ models: "nope" }, context), /Unknown model/u);
  assert.throws(() => resolveSelection({ cases: "../etc" }, context), /Unknown benchmark case/u);
  assert.throws(() => parseDirective("authoring-benchmark: model=kimi-k3"), /Unrecognized/u);
  assert.throws(() => resolveSelection({ runs: "10" }, context), /runs must be/u);
});
