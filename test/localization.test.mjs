// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)].map((match) => match[1]).sort();
}

test("bundles only the canonical English Foundry localization dictionary", async () => {
  const manifest = await readJson("../module.json");
  assert.deepEqual(manifest.languages, [
    {
      lang: "en",
      name: "English",
      path: "lang/en.json",
    },
  ]);
  await assert.rejects(access(new URL("../lang/de.json", import.meta.url)));
});

test("declares the external language-pack contract without custom language state", async () => {
  const manifest = await readJson("../module.json");
  const localization = manifest.flags?.runyth?.localization;
  assert.deepEqual(localization, {
    schemaVersion: 1,
    baseLanguage: "en",
    namespace: "RO",
    externalLanguagePacks: true,
    languageSelection: "foundry",
  });

  const constants = await readFile(new URL("../src/constants.mjs", import.meta.url), "utf8");
  const settings = await readFile(new URL("../src/settings.mjs", import.meta.url), "utf8");
  const template = await readFile(new URL("../templates/rules-hub.hbs", import.meta.url), "utf8");
  assert.doesNotMatch(constants, /SETTINGS\.[A-Z_]*LANGUAGE/u);
  assert.doesNotMatch(settings, /languageSelector|moduleLanguage|languageOverride/u);
  assert.doesNotMatch(template, /data-action=["'](?:set-)?language/u);
});

test("canonical English localization is complete, namespaced, and non-empty", async () => {
  const en = await readJson("../lang/en.json");
  const sourceFiles = [
    "../src/main.mjs",
    "../src/settings.mjs",
    "../src/ui/launchers.mjs",
    "../src/ui/rules-hub.mjs",
    "../templates/rules-hub.hbs",
  ];
  const referenced = new Set();
  for (const path of sourceFiles) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const match of source.matchAll(/["'](RO\.[A-Za-z0-9.]+)["']/gu)) referenced.add(match[1]);
  }

  assert.ok(Object.keys(en).length > 0);
  for (const [key, value] of Object.entries(en)) {
    assert.match(key, /^RO\./u);
    assert.equal(typeof value, "string");
    assert.notEqual(value.trim(), "");
    assert.deepEqual(placeholders(value), [...new Set(placeholders(value))].sort());
  }
  for (const key of referenced) assert.ok(key in en, `Missing English localization key ${key}`);
});

test("localization-pack schema fixes the target, base language, and namespace", async () => {
  const schema = await readJson("../schemas/localization-pack.schema.json");
  assert.equal(schema.properties.targetModuleId.const, "runyth-order");
  assert.equal(schema.properties.baseLanguage.const, "en");
  assert.equal(schema.properties.namespace.const, "RO");
  assert.ok(schema.required.includes("targetModuleVersion"));
  assert.ok(schema.required.includes("language"));
});
