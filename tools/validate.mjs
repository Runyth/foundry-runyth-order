import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, walk } from "./lib/files.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const requiredFiles = [
  "module.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "src/main.mjs",
  "src/api.mjs",
  "src/core/registry.mjs",
  "src/core/naming-contract.mjs",
  "src/core/audit-service.mjs",
  "src/core/diagnostics-service.mjs",
  "src/core/migration-service.mjs",
  "src/core/source-flags.mjs",
  "src/ui/rules-hub.mjs",
  "src/ui/window-position.mjs",
  "templates/rules-hub.hbs",
  "styles/runyth-rules-core.css",
  "lang/en.json",
  "lang/de.json",
  "schemas/provider-descriptor.schema.json",
  "schemas/source-descriptor.schema.json",
  "docs/API.md",
  "docs/COMPLEMENTARY_MODULE_GUIDE.md",
  "docs/DND5E_2024_GUIDE.md",
  "docs/MANUAL_TEST_CHECKLIST.md",
  "docs/NAMING_CONTRACT.md",
  "examples/runyth-order-rules-example-homebrew/module.json",
  "examples/runyth-order-rules-example-homebrew/scripts/main.mjs"
];

for (const path of requiredFiles) {
  try {
    await access(resolve(root, path));
  } catch {
    failures.push(`Missing required file: ${path}`);
  }
}

const manifest = await readJson(resolve(root, "module.json"));
const packageJson = await readJson(resolve(root, "package.json"));
if (manifest.id !== "runyth-rules-core") failures.push("Manifest ID must be runyth-rules-core.");
if (manifest.title !== "Runyth Order") failures.push("Manifest title must be exactly Runyth Order.");
if (manifest.version !== "1.0.2") failures.push("Patch release version must be 1.0.2.");
if (manifest.version !== packageJson.version) failures.push("Manifest and package versions differ.");
if (manifest.compatibility?.minimum !== "13.341") failures.push("Foundry minimum must be 13.341.");
if (manifest.compatibility?.verified !== "13.351") failures.push("Foundry verified target must be 13.351.");
if (manifest.compatibility?.maximum !== "13.351") failures.push("Foundry maximum must be 13.351.");
if (manifest.relationships?.requires?.length) failures.push("The core must not require another module.");
if (manifest.relationships?.systems?.length) failures.push("The core must remain system-neutral.");

for (const path of [...(manifest.esmodules ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map((entry) => entry.path)]) {
  try {
    await access(resolve(root, path));
  } catch {
    failures.push(`Manifest path does not exist: ${path}`);
  }
}

const jsonFiles = (await walk(root)).filter((file) => extname(file.path) === ".json" && !file.path.startsWith("dist/"));
for (const file of jsonFiles) {
  try {
    JSON.parse(await readFile(file.absolute, "utf8"));
  } catch (error) {
    failures.push(`${file.path}: invalid JSON: ${error.message}`);
  }
}

const en = await readJson(resolve(root, "lang/en.json"));
const de = await readJson(resolve(root, "lang/de.json"));
const enKeys = Object.keys(en).sort();
const deKeys = Object.keys(de).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(deKeys)) failures.push("English and German localization keys differ.");

const literalKeys = new Set();
for (const base of ["src", "templates"]) {
  for (const file of await walk(resolve(root, base))) {
    const source = await readFile(file.absolute, "utf8");
    for (const match of source.matchAll(/["'](RRC\.[A-Za-z0-9.]+)["']/gu)) literalKeys.add(match[1]);
  }
}
for (const key of literalKeys) if (!(key in en)) failures.push(`Missing localization key: ${key}`);

const apiSource = await readFile(resolve(root, "src/api.mjs"), "utf8");
for (const method of [
  "whenReady", "registerProvider", "registerPack", "registerActorValidator", "registerMigration",
  "unregisterProvider", "listProviders", "getProvider", "listNamingFindings", "listPacks", "getPack", "hasCapability",
  "snapshot", "resolveContent", "auditActor", "runDiagnostics", "listPendingMigrations",
  "runMigration", "runPendingMigrations", "normalizeSource", "readSource", "tagDocument", "openHub"
]) {
  if (!apiSource.includes(`${method}(`)) failures.push(`Public API method missing: ${method}`);
}


const launcherSource = await readFile(resolve(root, "src/ui/launchers.mjs"), "utf8");
if (!launcherSource.includes("controls?.tokens")) failures.push("Scene Controls launcher does not use the Foundry V13 token control record.");
if (!launcherSource.includes("onChange:")) failures.push("Scene Controls launcher is missing the Foundry V13 onChange callback.");
if (/\bonClick\s*:/u.test(launcherSource)) failures.push("Scene Controls launcher still contains the Foundry V12 onClick callback.");
if (!launcherSource.includes("order,")) failures.push("Scene Controls launcher is missing explicit tool ordering.");

const rulesHubSource = await readFile(resolve(root, "src/ui/rules-hub.mjs"), "utf8");
if (!rulesHubSource.includes("if (!this.rendered) return;")) failures.push("Rules Hub does not guard against reopening after close.");
if (!rulesHubSource.includes("sanitizeHubPosition")) failures.push("Rules Hub does not sanitize saved window geometry.");

const mainSource = await readFile(resolve(root, "src/main.mjs"), "utf8");
if (!mainSource.includes("Hooks.once(\"init\"")) failures.push("Core API must initialize on init.");
if (!mainSource.includes("module.api = api")) failures.push("Core API is not exposed on the module record.");
if (!mainSource.includes("foundry.applications.instances.get")) failures.push("Rules Hub launchers do not reuse the public ApplicationV2 instance registry.");
if (!mainSource.includes("ApplicationV2") && !(await readFile(resolve(root, "src/ui/rules-hub.mjs"), "utf8")).includes("ApplicationV2")) failures.push("ApplicationV2 UI is missing.");
if (mainSource.includes("registerMigration(")) failures.push("Display-only rename must not register a core data migration.");

const constantsSource = await readFile(resolve(root, "src/constants.mjs"), "utf8");
if (!constantsSource.includes('MODULE_ID = "runyth-rules-core"')) failures.push("Technical module ID changed unexpectedly.");
if (!constantsSource.includes('MODULE_TITLE = "Runyth Order"')) failures.push("Runtime display title is not Runyth Order.");

const namingSource = await readFile(resolve(root, "src/core/naming-contract.mjs"), "utf8");
for (const code of ["PROVIDER_NAMING_MISMATCH", "MODULE_NAMING_MISMATCH", "NAMING_METADATA_MISSING"]) {
  if (!namingSource.includes(code)) failures.push(`Naming contract code missing: ${code}`);
}

const sourceFlagsSource = await readFile(resolve(root, "src/core/source-flags.mjs"), "utf8");
if (!sourceFlagsSource.includes("document.getFlag(MODULE_ID, SOURCE_FLAG_KEY)") || !sourceFlagsSource.includes("flags.${MODULE_ID}.${SOURCE_FLAG_KEY}")) {
  failures.push("Managed source namespace is no longer derived from runyth-rules-core.");
}

for (const file of (await walk(resolve(root, "src"))).filter((entry) => extname(entry.path) === ".mjs")) {
  const source = await readFile(file.absolute, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/gu)) {
    const importPath = resolve(dirname(file.absolute), match[1]);
    try {
      await access(importPath);
    } catch {
      failures.push(`${file.path}: unresolved import ${match[1]}`);
    }
  }
}

const exampleManifest = await readJson(resolve(root, "examples/runyth-order-rules-example-homebrew/module.json"));
const coreDependency = exampleManifest.relationships?.requires?.find((entry) => entry.id === manifest.id);
if (!coreDependency) failures.push("Example provider does not require the core.");
if (exampleManifest.title !== "Runyth Order: Rules Example Homebrew") failures.push("Example provider title does not follow the naming contract.");
if (exampleManifest.flags?.runyth?.canonicalTitle !== exampleManifest.title) failures.push("Example provider manifest naming metadata is invalid.");

const qualityWorkflow = await readFile(resolve(root, ".github/workflows/quality.yml"), "utf8");
if (!qualityWorkflow.includes("- master")) failures.push("Quality workflow must use master as the default branch.");
if (qualityWorkflow.includes("- main")) failures.push("Quality workflow still references main.");

for (const file of (await walk(resolve(root, "examples/runyth-order-rules-example-homebrew"))).filter((entry) => extname(entry.path) === ".mjs")) {
  const syntax = spawnSync(process.execPath, ["--check", file.absolute], { encoding: "utf8" });
  if (syntax.status !== 0) failures.push(`${file.path}: ${syntax.stderr.trim()}`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Validation passed: ${requiredFiles.length} required files, ${jsonFiles.length} JSON files, ${enKeys.length} localization keys.`);
}
