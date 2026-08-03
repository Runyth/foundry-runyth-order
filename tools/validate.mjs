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
  "styles/runyth-order.css",
  "lang/en.json",
  "schemas/provider-descriptor.schema.json",
  "schemas/source-descriptor.schema.json",
  "schemas/localization-pack.schema.json",
  "types/runyth-order.d.ts",
  "docs/API.md",
  "docs/COMPLEMENTARY_MODULE_GUIDE.md",
  "docs/DND5E_2024_GUIDE.md",
  "docs/MANUAL_TEST_CHECKLIST.md",
  "docs/LOCALIZATION.md",
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
if (manifest.id !== "runyth-order") failures.push("Manifest ID must be runyth-order.");
if (manifest.title !== "Runyth Order") failures.push("Manifest title must be exactly Runyth Order.");
if (manifest.version !== "1.0.4") failures.push("Patch release version must be 1.0.4.");
if (manifest.version !== packageJson.version) failures.push("Manifest and package versions differ.");
if (manifest.compatibility?.minimum !== "13.341") failures.push("Foundry minimum must be 13.341.");
if (manifest.compatibility?.verified !== "13.351") failures.push("Foundry verified target must be 13.351.");
if (manifest.compatibility?.maximum !== "13.351") failures.push("Foundry maximum must be 13.351.");
if (manifest.relationships?.requires?.length) failures.push("The core must not require another module.");
if (manifest.relationships?.systems?.length) failures.push("The core must remain system-neutral.");

const expectedLanguages = [{ lang: "en", name: "English", path: "lang/en.json" }];
if (JSON.stringify(manifest.languages) !== JSON.stringify(expectedLanguages)) {
  failures.push("The core manifest must bundle exactly the canonical English localization dictionary.");
}
const localizationMetadata = manifest.flags?.runyth?.localization;
if (
  localizationMetadata?.schemaVersion !== 1 ||
  localizationMetadata?.baseLanguage !== "en" ||
  localizationMetadata?.namespace !== "RO" ||
  localizationMetadata?.externalLanguagePacks !== true ||
  localizationMetadata?.languageSelection !== "foundry"
) {
  failures.push("Manifest localization metadata does not declare the external Foundry language-pack contract.");
}
try {
  await access(resolve(root, "lang/de.json"));
  failures.push("The core runtime must not bundle lang/de.json; German belongs in an external language pack.");
} catch {
  // Expected: non-English dictionaries are external modules.
}

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
const enKeys = Object.keys(en).sort();
for (const [key, value] of Object.entries(en)) {
  if (!key.startsWith("RO.")) failures.push(`English localization key is outside the RO namespace: ${key}`);
  if (typeof value !== "string" || !value.trim()) failures.push(`English localization value is empty or invalid: ${key}`);
  const placeholders = [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)].map((match) => match[1]);
  if (new Set(placeholders).size !== placeholders.length) failures.push(`English localization repeats an interpolation placeholder: ${key}`);
}

const literalKeys = new Set();
for (const base of ["src", "templates"]) {
  for (const file of await walk(resolve(root, base))) {
    const source = await readFile(file.absolute, "utf8");
    for (const match of source.matchAll(/["'](RO\.[A-Za-z0-9.]+)["']/gu)) literalKeys.add(match[1]);
  }
}
for (const key of literalKeys) if (!(key in en)) failures.push(`Missing localization key: ${key}`);

const typesSource = await readFile(resolve(root, "types/runyth-order.d.ts"), "utf8");
if (!typesSource.includes("export interface RunythOrderApi")) failures.push("RunythOrderApi TypeScript interface is missing.");
if (!typesSource.includes('readonly moduleId: "runyth-order"')) failures.push("TypeScript module ID is not runyth-order.");

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
if (mainSource.includes("registerMigration(")) failures.push("Pre-publication identity finalization must not invent a foundation migration.");

const constantsSource = await readFile(resolve(root, "src/constants.mjs"), "utf8");
if (!constantsSource.includes('MODULE_ID = "runyth-order"')) failures.push("Technical module ID must be runyth-order.");
if (!constantsSource.includes('MODULE_TITLE = "Runyth Order"')) failures.push("Runtime display title is not Runyth Order.");
if (!constantsSource.includes('BASE_LANGUAGE: "en"')) failures.push("Localization base language constant must be English.");
if (!constantsSource.includes('LANGUAGE_SELECTION: "foundry"')) failures.push("Localization must use Foundry language selection.");
if (/SETTINGS\.[A-Z_]*LANGUAGE/u.test(constantsSource)) failures.push("A module-specific language setting is prohibited.");
const settingsSource = await readFile(resolve(root, "src/settings.mjs"), "utf8");
if (/languageSelector|moduleLanguage|languageOverride/u.test(settingsSource)) failures.push("A custom language selector is prohibited.");
const hubTemplateSource = await readFile(resolve(root, "templates/rules-hub.hbs"), "utf8");
if (/data-action=["'](?:set-)?language/u.test(hubTemplateSource)) failures.push("Rules Hub must not contain a language selector.");

const namingSource = await readFile(resolve(root, "src/core/naming-contract.mjs"), "utf8");
for (const code of ["PROVIDER_NAMING_MISMATCH", "MODULE_NAMING_MISMATCH", "NAMING_METADATA_MISSING"]) {
  if (!namingSource.includes(code)) failures.push(`Naming contract code missing: ${code}`);
}

const sourceFlagsSource = await readFile(resolve(root, "src/core/source-flags.mjs"), "utf8");
if (!sourceFlagsSource.includes("document.getFlag(MODULE_ID, SOURCE_FLAG_KEY)") || !sourceFlagsSource.includes("flags.${MODULE_ID}.${SOURCE_FLAG_KEY}")) {
  failures.push("Managed source namespace is not derived from runyth-order.");
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
const localizationSchema = await readJson(resolve(root, "schemas/localization-pack.schema.json"));
if (localizationSchema.properties?.targetModuleId?.const !== "runyth-order") failures.push("Localization schema target module is invalid.");
if (localizationSchema.properties?.baseLanguage?.const !== "en") failures.push("Localization schema base language is invalid.");
if (localizationSchema.properties?.namespace?.const !== "RO") failures.push("Localization schema namespace is invalid.");
const coreDependency = exampleManifest.relationships?.requires?.find((entry) => entry.id === manifest.id);
if (!coreDependency) failures.push("Example provider does not require the core.");
if (coreDependency?.compatibility?.minimum !== "1.0.4" || coreDependency?.compatibility?.maximum !== "1.0.4") {
  failures.push("Example provider must target Runyth Order 1.0.4.");
}
if (exampleManifest.title !== "Runyth Order: Rules Example Homebrew") failures.push("Example provider title does not follow the naming contract.");
if (exampleManifest.flags?.runyth?.canonicalTitle !== exampleManifest.title) failures.push("Example provider manifest naming metadata is invalid.");


const retiredIdentity = ["runyth", "rules", "core"].join("-");
const retiredDisplayName = ["Runyth", "Rules", "Core"].join(" ");
const retiredApiClass = ["Runyth", "Rules", "Core", "Api"].join("");
const retiredRuntimeApiClass = ["Runyth", "Rules", "Api"].join("");
const retiredLocalizationPrefix = `${["R", "R", "C"].join("")}.`;
const retiredCssPrefix = `${["r", "r", "c"].join("")}-`;
for (const file of (await walk(root)).filter((entry) => !entry.path.startsWith("dist/"))) {
  if ([retiredIdentity, retiredCssPrefix].some((token) => file.path.includes(token))) {
    failures.push(`Retired package identity remains in path: ${file.path}`);
  }
  let source;
  try {
    source = await readFile(file.absolute, "utf8");
  } catch {
    continue;
  }
  for (const token of [
    retiredIdentity,
    retiredDisplayName,
    retiredApiClass,
    retiredRuntimeApiClass,
    retiredLocalizationPrefix,
    retiredCssPrefix,
  ]) {
    if (source.includes(token)) failures.push(`${file.path}: retired identity token remains: ${token}`);
  }
}

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
