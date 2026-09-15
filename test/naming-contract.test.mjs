// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DiagnosticsService } from "../src/core/diagnostics-service.mjs";
import { ProviderRegistry } from "../src/core/registry.mjs";

const naming = Object.freeze({
  orderName: "Runyth Order",
  moduleKind: "Class",
  contentName: "Example Vanguard",
  canonicalTitle: "Runyth Order: Class Example Vanguard",
});

function moduleRecord({
  id = "runyth-order-class-example-vanguard",
  title = naming.canonicalTitle,
  flags = { runyth: naming },
} = {}) {
  return { id, title, active: true, version: "1.0.0", flags };
}

function provider(overrides = {}) {
  return {
    id: "runyth-order-class-example-vanguard",
    moduleId: "runyth-order-class-example-vanguard",
    title: naming.canonicalTitle,
    version: "1.0.0",
    naming,
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    capabilities: ["content.subclasses"],
    ...overrides,
  };
}

function registryWith(module, warnings = []) {
  const modules = new Map([[module.id, module]]);
  return {
    modules,
    registry: new ProviderRegistry({
      getModule: (id) => modules.get(id) ?? null,
      warn: (message, data) => warnings.push({ message, data }),
    }),
  };
}

function diagnosticsFor(registry, modules) {
  return new DiagnosticsService({
    registry,
    migrationService: { listPending: async () => [] },
    getModule: (id) => modules.get(id) ?? null,
    getPack: () => null,
    getSystem: () => ({ id: "dnd5e", title: "D&D 5e", version: "5.3.3" }),
    getCoreVersion: () => "13.351",
  });
}

test("uses the canonical Runyth Order package identity throughout the public contract", async () => {
  const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const main = await readFile(new URL("../src/main.mjs", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/api.mjs", import.meta.url), "utf8");
  const constants = await readFile(new URL("../src/constants.mjs", import.meta.url), "utf8");
  const sourceFlags = await readFile(new URL("../src/core/source-flags.mjs", import.meta.url), "utf8");
  const exampleManifest = JSON.parse(
    await readFile(new URL("../examples/runyth-order-rules-example-homebrew/module.json", import.meta.url), "utf8"),
  );

  assert.equal(manifest.title, "Runyth Order");
  assert.equal(manifest.id, "runyth-order");
  assert.equal(packageJson.name, "runyth-order");
  assert.deepEqual(manifest.styles, ["styles/runyth-order.css"]);
  assert.match(main, /game\.modules\.get\(MODULE_ID\)/u);
  assert.match(main, /new RunythOrderApi\(/u);
  assert.match(api, /export class RunythOrderApi/u);
  assert.match(constants, /MODULE_ID = "runyth-order"/u);
  assert.match(constants, /`\$\{MODULE_ID\}\.apiReady`/u);
  assert.match(sourceFlags, /document\.getFlag\(MODULE_ID, SOURCE_FLAG_KEY\)/u);
  assert.ok(
    exampleManifest.relationships.requires.some((dependency) => dependency.id === "runyth-order"),
  );
  assert.doesNotMatch(main, /registerMigration\(/u);
});

test("uses only the RO localization and ro- CSS namespaces", async () => {
  const en = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
  const template = await readFile(new URL("../templates/rules-hub.hbs", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles/runyth-order.css", import.meta.url), "utf8");

  assert.ok(Object.keys(en).every((key) => key.startsWith("RO.")));
  assert.match(template, /ro-shell/u);
  assert.match(css, /\.runyth-order/u);
  assert.match(css, /--ro-bg/u);
});

test("conforming provider and module titles register without naming warnings", () => {
  const warnings = [];
  const { registry } = registryWith(moduleRecord(), warnings);
  const registered = registry.registerProvider(provider());
  assert.equal(registered.id, provider().id);
  assert.equal(registry.listProviders().length, 1);
  assert.deepEqual(registry.listNamingFindings(), []);
  assert.deepEqual(warnings, []);
});

test("provider-title mismatch is non-blocking and emitted once for the world load", () => {
  const warnings = [];
  const { registry } = registryWith(moduleRecord(), warnings);
  const mismatched = provider({ title: "The Old Vanguard" });
  registry.registerProvider(mismatched);
  assert.equal(registry.listProviders().length, 1);
  assert.deepEqual(registry.listNamingFindings().map((finding) => finding.code), [
    "PROVIDER_NAMING_MISMATCH",
  ]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].data.actualProviderTitle, "The Old Vanguard");
  assert.equal(warnings[0].data.actualModuleTitle, naming.canonicalTitle);
  assert.equal(warnings[0].data.expectedTitle, naming.canonicalTitle);
  assert.equal(warnings[0].data.requiredPattern, "Runyth Order: <Category> <Content Name>");

  registry.unregisterProvider(mismatched.id);
  registry.registerProvider(mismatched);
  assert.equal(warnings.length, 1);
});

test("module-title mismatch is reported separately without rejecting the provider", () => {
  const warnings = [];
  const { registry } = registryWith(moduleRecord({ title: "Wrong Module" }), warnings);
  registry.registerProvider(provider());
  assert.equal(registry.listProviders().length, 1);
  assert.deepEqual(registry.listNamingFindings().map((finding) => finding.code), [
    "MODULE_NAMING_MISMATCH",
  ]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].data.actualModuleTitle, "Wrong Module");
});

test("both title mismatches remain deduplicated across diagnostics runs", async () => {
  const warnings = [];
  const { registry, modules } = registryWith(moduleRecord({ title: "Wrong Module" }), warnings);
  registry.registerProvider(provider({ title: "Wrong Provider" }));
  assert.equal(warnings.length, 2);

  const diagnostics = diagnosticsFor(registry, modules);
  const first = await diagnostics.run();
  const second = await diagnostics.run();
  assert.equal(warnings.length, 2);
  assert.equal(first.findings.filter((finding) => finding.code.endsWith("NAMING_MISMATCH")).length, 2);
  assert.equal(second.findings.filter((finding) => finding.code.endsWith("NAMING_MISMATCH")).length, 2);
  assert.ok(first.findings.every((finding) => !finding.code.endsWith("NAMING_MISMATCH") || finding.messageKey));
});

test("explicit metadata handles multiword categories and content names", () => {
  const multiword = {
    orderName: "Runyth Order",
    moduleKind: "Character Options",
    contentName: "Silent Blade Schools",
    canonicalTitle: "Runyth Order: Character Options Silent Blade Schools",
  };
  const module = moduleRecord({
    id: "runyth-order-character-options-silent-blade-schools",
    title: multiword.canonicalTitle,
    flags: { runyth: multiword },
  });
  const { registry } = registryWith(module);
  registry.registerProvider(
    provider({
      id: module.id,
      moduleId: module.id,
      title: multiword.canonicalTitle,
      naming: multiword,
      capabilities: [`${module.id}.example`],
    }),
  );
  assert.deepEqual(registry.listNamingFindings(), []);
});

test("legacy providers without metadata remain compatible and are not guessed", () => {
  const warnings = [];
  const module = moduleRecord({ id: "legacy-homebrew", title: "Legacy Homebrew", flags: {} });
  const { registry } = registryWith(module, warnings);
  registry.registerProvider(
    provider({
      id: "legacy-homebrew",
      moduleId: "legacy-homebrew",
      title: "Legacy Homebrew",
      naming: undefined,
      capabilities: [],
    }),
  );
  assert.equal(registry.listProviders().length, 1);
  assert.deepEqual(registry.listNamingFindings().map((finding) => finding.code), [
    "NAMING_METADATA_MISSING",
  ]);
  assert.deepEqual(warnings, []);
});

test("the core module itself is excluded from complementary naming checks", () => {
  const warnings = [];
  const module = moduleRecord({ id: "runyth-order", title: "Runyth Order", flags: {} });
  const { registry } = registryWith(module, warnings);
  registry.registerProvider(
    provider({
      id: "runyth-order",
      moduleId: "runyth-order",
      title: "Runyth Order",
      naming: undefined,
      capabilities: [],
    }),
  );
  assert.deepEqual(registry.listNamingFindings(), []);
  assert.deepEqual(warnings, []);
});

test("invalid provider naming metadata remains a descriptor validation error", () => {
  const { registry } = registryWith(moduleRecord());
  assert.throws(
    () =>
      registry.registerProvider(
        provider({ naming: { ...naming, canonicalTitle: "Runyth Order: Wrong" } }),
      ),
    (error) => error.code === "INVALID_NAMING_METADATA",
  );
  assert.equal(registry.listProviders().length, 0);
});
