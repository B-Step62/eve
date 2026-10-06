import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "world-local-layout-bench.mjs",
);

/** Path -> sha256 of every file under `dir`. */
function hashTree(dir) {
  const out = {};
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    out[path.relative(dir, full)] = createHash("sha256")
      .update(fs.readFileSync(full))
      .digest("hex");
  }
  return out;
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "world-local-bench-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const store = path.join(root, "store");
  fs.mkdirSync(path.join(store, "events"), { recursive: true });
  fs.writeFileSync(path.join(store, "events", "wrun_A-evnt_1.json"), '{"runId":"wrun_A"}');
  fs.writeFileSync(path.join(store, "version.txt"), "5.0.1");
  return { root, store };
}

function prepare(src, dst) {
  return spawnSync(process.execPath, [script, "prepare", src, dst, "10"], { encoding: "utf8" });
}

function assertRefused(result, pattern) {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
}

test("prepare refuses the same path and leaves the source intact", async (t) => {
  const { store } = await fixture(t);
  const before = hashTree(store);
  assertRefused(prepare(store, store), /already exists/);
  assert.deepEqual(hashTree(store), before);
});

test("prepare refuses an ancestor of the source", async (t) => {
  const { root, store } = await fixture(t);
  const before = hashTree(root);
  assertRefused(prepare(store, root), /already exists|overlaps/);
  assert.deepEqual(hashTree(root), before);
});

test("prepare refuses a new destination inside the source", async (t) => {
  const { store } = await fixture(t);
  const before = hashTree(store);
  assertRefused(prepare(store, path.join(store, "copy")), /overlaps/);
  assert.deepEqual(hashTree(store), before);
  assert.equal(fs.existsSync(path.join(store, "copy")), false);
});

test("prepare refuses a destination reached through a symlink to the source", async (t) => {
  const { root, store } = await fixture(t);
  const alias = path.join(root, "alias");
  fs.symlinkSync(store, alias);
  const before = hashTree(store);
  assertRefused(prepare(alias, path.join(alias, "copy")), /overlaps/);
  assertRefused(prepare(store, alias), /already exists/);
  assert.deepEqual(hashTree(store), before);
});

test("prepare refuses an existing destination and leaves both intact", async (t) => {
  const { root, store } = await fixture(t);
  const other = path.join(root, "other");
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "keep.txt"), "keep");
  const before = { store: hashTree(store), other: hashTree(other) };
  assertRefused(prepare(store, other), /already exists/);
  assert.deepEqual({ store: hashTree(store), other: hashTree(other) }, before);
});

test(
  "prepare clones into a new destination",
  { skip: process.platform !== "darwin" && "cp -c is macOS-only" },
  async (t) => {
    const { root, store } = await fixture(t);
    const before = hashTree(store);
    const dst = path.join(root, "bench");
    const result = prepare(store, dst);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(hashTree(store), before);
    assert.equal(fs.readdirSync(path.join(dst, "events")).length, 10);
  },
);
