import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSourceDescriptor, readSource, tagDocument } from "../src/core/source-flags.mjs";
import { compareVersions, parseVersion, versionInRange } from "../src/util/versions.mjs";

test("parses and compares Foundry-style numeric versions", () => {
  assert.deepEqual(parseVersion("v13.351"), [13, 351, 0]);
  assert.equal(compareVersions("5.3.3", "5.3.2"), 1);
  assert.equal(versionInRange("5.3.3", { minimum: "5.3.3", maximum: "5.3.3" }), true);
  assert.equal(versionInRange("5.4.0", { maximum: "5.3.3" }), false);
});

test("normalizes namespaced source metadata", () => {
  const source = normalizeSourceDescriptor({
    providerId: "example-homebrew",
    packId: "example-homebrew.options",
    entryId: "feature-one",
    contentVersion: "1.0.0",
  });
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.sourceUuid, null);
  assert.match(source.importedAt, /^\d{4}-\d{2}-\d{2}T/u);
});

test("rejects source packs outside the provider namespace", () => {
  assert.throws(
    () => normalizeSourceDescriptor({ providerId: "example-homebrew", packId: "other.options", entryId: "x" }),
    /namespaced/u,
  );
});

test("builds an atomic flag update without requiring a document", async () => {
  globalThis.game = { user: { isGM: true } };
  const update = await tagDocument(
    null,
    { providerId: "example-homebrew", packId: "example-homebrew.options", entryId: "x" },
    { update: false },
  );
  assert.equal(update["flags.runyth-rules-core.source"].entryId, "x");
});

test("reads a defensive source copy", () => {
  const document = {
    getFlag: () => ({ providerId: "example-homebrew", packId: "example-homebrew.options", entryId: "x" }),
  };
  const source = readSource(document);
  assert.ok(Object.isFrozen(source));
  assert.equal(source.entryId, "x");
});
