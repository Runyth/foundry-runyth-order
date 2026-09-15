// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";
import { ProviderRegistry, ProviderValidationError } from "../src/core/registry.mjs";

function registry(active = ["example-homebrew", "other-homebrew"]) {
  const modules = new Map(active.map((id) => [id, { id, active: true, version: "1.0.0" }]));
  return new ProviderRegistry({ getModule: (id) => modules.get(id) ?? null });
}

function provider(overrides = {}) {
  return {
    id: "example-homebrew",
    moduleId: "example-homebrew",
    title: "Example Homebrew",
    version: "1.0.0",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    systems: [{ id: "dnd5e", minimum: "5.3.3", maximum: "5.3.3" }],
    dependencies: [],
    capabilities: ["content.subclasses", "example-homebrew.custom"],
    packs: [
      {
        id: "options",
        title: "Options",
        version: "1.0.0",
        systemId: "dnd5e",
        contentKinds: ["subclass", "feature"],
        entries: [{ id: "example", title: "Example", kind: "subclass" }],
      },
    ],
    validators: [
      {
        id: "actor",
        title: "Actor",
        scope: "actor",
        run: async () => [],
      },
    ],
    migrations: [
      {
        id: "flags-v1",
        title: "Flags",
        version: "1.0.0",
        run: async () => ({ updated: 0 }),
      },
    ],
    ...overrides,
  };
}

test("registers a complete provider atomically and namespaces child identifiers", () => {
  const subject = registry();
  const registered = subject.registerProvider(provider());
  assert.equal(registered.id, "example-homebrew");
  assert.deepEqual(registered.packIds, ["example-homebrew.options"]);
  assert.deepEqual(registered.validatorIds, ["example-homebrew.actor"]);
  assert.deepEqual(registered.migrationIds, ["example-homebrew.flags-v1"]);
  assert.equal(subject.getPack("example-homebrew.options").entries[0].id, "example");
});

test("rejects inactive provider modules", () => {
  const subject = registry([]);
  assert.throws(() => subject.registerProvider(provider()), (error) => {
    assert.ok(error instanceof ProviderValidationError);
    assert.equal(error.code, "INACTIVE_PROVIDER_MODULE");
    return true;
  });
});

test("rolls back the complete provider when a nested contribution fails", () => {
  const subject = registry();
  const invalid = provider({
    packs: [
      { id: "same", title: "First", contentKinds: [], entries: [] },
      { id: "same", title: "Second", contentKinds: [], entries: [] },
    ],
  });
  assert.throws(() => subject.registerProvider(invalid), /already registered/u);
  assert.equal(subject.getProvider("example-homebrew"), null);
  assert.deepEqual(subject.listPacks(), []);
});

test("rejects unnamespaced custom capabilities", () => {
  const subject = registry();
  assert.throws(
    () => subject.registerProvider(provider({ capabilities: ["custom.unowned"] })),
    (error) => error.code === "UNNAMESPACED_CAPABILITY",
  );
});

test("returns immutable public descriptors and protects registry state", () => {
  const subject = registry();
  subject.registerProvider(provider());
  const descriptor = subject.getProvider("example-homebrew");
  assert.ok(Object.isFrozen(descriptor));
  assert.throws(() => descriptor.packIds.push("bad"), TypeError);
  assert.deepEqual(subject.getProvider("example-homebrew").packIds, ["example-homebrew.options"]);
});

test("discovers capabilities by provider and system", () => {
  const subject = registry();
  subject.registerProvider(provider());
  assert.equal(subject.hasCapability("content.subclasses"), true);
  assert.equal(subject.hasCapability("content.subclasses", { systemId: "dnd5e" }), true);
  assert.equal(subject.hasCapability("content.subclasses", { systemId: "pf2e" }), false);
  assert.equal(subject.hasCapability("content.spells"), false);
});

test("rejects malformed and inverted compatibility ranges", () => {
  const subject = registry();
  assert.throws(
    () => subject.registerProvider(provider({ coreApi: { minimum: "banana" } })),
    (error) => error.code === "INVALID_COMPATIBILITY",
  );
  assert.throws(
    () =>
      subject.registerProvider(
        provider({ coreApi: { minimum: "2.0.0", maximum: "1.0.0" } }),
      ),
    (error) => error.code === "INVALID_COMPATIBILITY",
  );
});

test("rejects duplicate system and dependency declarations", () => {
  const systems = [
    { id: "dnd5e", minimum: "5.3.3", maximum: "5.3.3" },
    { id: "dnd5e", minimum: "5.3.3", maximum: "5.3.3" },
  ];
  assert.throws(
    () => registry().registerProvider(provider({ systems })),
    (error) => error.code === "DUPLICATE_DECLARATION",
  );

  const dependencies = [
    { moduleId: "other-homebrew", required: true },
    { moduleId: "other-homebrew", required: false },
  ];
  assert.throws(
    () => registry().registerProvider(provider({ dependencies })),
    (error) => error.code === "DUPLICATE_DECLARATION",
  );
});

test("rejects non-array nested contribution collections without partial registration", () => {
  const subject = registry();
  assert.throws(
    () => subject.registerProvider(provider({ packs: { id: "invalid" } })),
    (error) => error instanceof ProviderValidationError,
  );
  assert.equal(subject.getProvider("example-homebrew"), null);
});

test("provider registration state is removed on unregister and never leaks into a fresh registry", () => {
  const first = registry();
  first.registerProvider(provider());
  assert.equal(first.listProviders().length, 1);
  assert.equal(first.unregisterProvider("example-homebrew"), true);
  assert.equal(first.listProviders().length, 0);
  assert.deepEqual(first.listPacks(), []);

  const reloaded = registry();
  assert.equal(reloaded.listProviders().length, 0);
  reloaded.registerProvider(provider());
  assert.equal(reloaded.listProviders().length, 1);
});
