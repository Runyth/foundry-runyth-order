import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emitRuntimeGraph, verifyRuntimeGraph } from "./runtime-graph.mjs";
import { createZip } from "./lib/zip.mjs";
import { readJson } from "./lib/files.mjs";
import { stageSource, git } from "./stage-source.mjs";

const root = resolve(import.meta.dirname, "..");

function artifactNames(manifest) {
  const version = manifest.version;
  const moduleId = manifest.id;
  return {
    install: `${moduleId}-v${version}.zip`,
    source: `${moduleId}-source-v${version}.zip`,
    checksums: `${moduleId}-v${version}-SHA256SUMS.txt`,
    report: `${moduleId}-v${version}-build-report.json`,
    installRoot: moduleId,
    sourceRoot: `${moduleId}-source-v${version}`,
    all: (names = {}) => [names.install, names.source, names.checksums, names.report],
  };
}

void artifactNames;

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function assertBuildInputs(root, manifest, revision) {
  if (process.env.RUNYTH_PUBLIC_RELEASE && !revision.releaseTag) {
    throw new Error("Public release builds must resolve an explicit release tag (RUNYTH_RELEASE_REF).");
  }
  if (revision.releaseTag && revision.revisionSource !== revision.releaseTag) {
    throw new Error(`Staging resolved ${revision.revisionSource}, not the requested release tag.`);
  }
  const status = git(root, ["status", "--porcelain", "--untracked-files=no"]).stdout.toString("utf8").trim();
  if (status && !process.env.RUNYTH_ALLOW_UNCOMMITTED) {
    throw new Error(
      "Uncommitted tracked changes are present; the publication revision must be committed (or set RUNYTH_ALLOW_UNCOMMITTED=1 for a local developer build).\n" +
      status.split("\n").slice(0, 10).join("\n"),
    );
  }
  if (revision.releaseTag) {
    const expectedTag = `refs/tags/v${manifest.version}`;
    if (revision.releaseTag !== expectedTag) {
      throw new Error(`Release revision ${revision.releaseTag} does not match manifest version ${manifest.version} (${expectedTag}).`);
    }
  }
}

export async function packageModule(sourceRoot, manifest, { stagingReport }) {
  const names = {
    install: `${manifest.id}-v${manifest.version}.zip`,
    source: `${manifest.id}-source-v${manifest.version}.zip`,
    checksums: `${manifest.id}-v${manifest.version}-SHA256SUMS.txt`,
    report: `${manifest.id}-v${manifest.version}-build-report.json`,
    installRoot: manifest.id,
    sourceRoot: `${manifest.id}-source-v${manifest.version}`,
  };
  const version = manifest.version;
  const moduleId = manifest.id;
  const dist = resolve(sourceRoot, "dist");
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  await emitRuntimeGraph(sourceRoot, { version, moduleId, moduleTitle: manifest.title });
  const runtimeVerification = await verifyRuntimeGraph(sourceRoot, { version, moduleId });
  if (runtimeVerification.failures.length) {
    throw new Error(`Staged runtime graph verification failed:\n${runtimeVerification.failures.join("\n")}`);
  }

  const walkResult = await walkSource(sourceRoot);
  const installPrefixes = [`runtime/v${version}/`, "styles/", "templates/", "lang/"];
  const installFiles = walkResult.files.filter((file) => {
    if (isExcludedSourcePath(file.path)) return false;
    if (["module.json", "README.md", "CHANGELOG.md", "LICENSE"].includes(file.path)) return true;
    return installPrefixes.some((prefix) => file.path.startsWith(prefix));
  });
  const sourceFiles = walkResult.files.filter((file) => {
    if (file.path === "dist" || file.path.startsWith("dist/")) return false;
    if (file.path === "node_modules" || file.path.startsWith("node_modules/")) return false;
    if (file.path.endsWith(".log") || file.path === ".DS_Store") return false;
    return true;
  });
  if (walkResult.failures.length) {
    throw new Error(`Source walk failures: ${walkResult.failures.join("; ")}`);
  }
  void moduleId;

  installFiles.sort((left, right) => left.path.localeCompare(right.path));
  sourceFiles.sort((left, right) => left.path.localeCompare(right.path));

  await createZip(
    resolve(dist, names.install),
    installFiles.map((file) => ({ path: file.absolute, name: `${names.installRoot}/${file.path}` })),
  );
  await createZip(
    resolve(dist, names.source),
    sourceFiles.map((file) => ({ path: file.absolute, name: `${names.sourceRoot}/${file.path}` })),
  );

  const moduleChecksum = await sha256(resolve(sourceRoot, "module.json"));
  const installChecksum = await sha256(resolve(dist, names.install));
  const sourceChecksum = await sha256(resolve(dist, names.source));
  const checksumLines = [
    `${installChecksum}  ${names.install}`,
    `${sourceChecksum}  ${names.source}`,
    `${moduleChecksum}  module.json`,
  ].join("\n") + "\n";
  await writeFile(resolve(dist, names.checksums), checksumLines);
  names.checksumLines = checksumLines;
  names.generatedArtifacts = [names.install, names.source, names.checksums, names.report];

  const report = {
    schemaVersion: 1,
    moduleId,
    displayTitle: manifest.title,
    version,
    apiVersion: "1.0.0",
    dataSchemaVersion: 1,
    foundry: manifest.compatibility,
    installArchive: names.install,
    sourceArchive: names.source,
    checksumFile: names.checksums,
    checksumEntries: names.checksumLines.trim().split("\n"),
    installRoot: names.installRoot,
    sourceRoot: names.sourceRoot,
    installFiles: installFiles.length,
    sourceFiles: sourceFiles.length,
    installBytes: (await readFile(resolve(dist, names.install))).length,
    sourceBytes: (await readFile(resolve(dist, names.source))).length,
    reproducibleTimestamp: "1980-01-01T00:00:00Z",
    runtime: {
      entrypoint: manifest.esmodules?.[0] ?? null,
      strategy: "versioned-safe-esm-graph",
      sourceDirectoryPackaged: false,
      guardedBootstrap: true,
    },
    gitSource: stagingReport,
    identity: {
      moduleId,
      apiLookup: `game.modules.get("${moduleId}")?.api`,
      settingsNamespace: moduleId,
      hookPrefix: `${moduleId}.*`,
      sourceFlagNamespace: `flags.${moduleId}.source`,
      localizationPrefix: "RO.",
      cssPrefix: "ro-",
      apiClass: "RunythOrderApi",
      complementaryModuleUpdateRequired: false,
      compatibilityMigrationRegistered: false,
    },
    namingContract: {
      pattern: "Runyth Order: <Category> <Content Name>",
      recommendedIdPattern: "runyth-order-<category-slug>-<content-name-slug>",
      providerWarningCodes: ["PROVIDER_NAMING_MISMATCH", "MODULE_NAMING_MISMATCH"],
      nonBlocking: true,
    },
    localizationContract: {
      schemaVersion: 1,
      baseLanguage: "en",
      namespace: "RO",
      bundledLanguages: (manifest.languages ?? []).map((entry) => entry.lang),
      externalLanguagePacks: true,
      languageSelection: "Foundry global Configure Settings language control",
      customModuleSetting: false,
      dashboardSelector: false,
      recommendedLanguagePackIdPattern: "runyth-order-language-<language-slug>",
    },
    license: {
      spdx: "AGPL-3.0-or-later",
      licenseFile: "LICENSE",
      includedInArchives: true,
    },
    generatedArtifacts: names.generatedArtifacts,
  };
  await writeFile(resolve(dist, names.report), `${JSON.stringify(report, null, 2)}\n`);
  return { dist, names, report };
}

async function walkSource(sourceRoot) {
  const { walk, isExcludedSourcePath } = await import("./lib/files.mjs");
  const files = await walk(sourceRoot);
  const failures = [];
  const manifest = JSON.parse(await readFile(resolve(sourceRoot, "module.json"), "utf8"));
  if (manifest.id !== "runyth-order" || manifest.version !== manifest.version) {
    failures.push("Staged manifest identity mismatch.");
  }
  return { files, failures };
}

function isExcludedSourcePath(path) {
  return (
    path === "dist" ||
    path.startsWith("dist/") ||
    path === "node_modules" ||
    path.startsWith("node_modules/") ||
    path === ".staging" ||
    path.startsWith(".staging/") ||
    path.endsWith(".log") ||
    path === ".DS_Store"
  );
}

const manifest = await readJson(resolve(root, "module.json"));

{
  // Keep the checked-in runtime graph synchronized with the developer's source tree.
  await emitRuntimeGraph(root, { version: manifest.version, moduleId: manifest.id, moduleTitle: manifest.title });
}

const staging = await stageSource(root, {});
assertBuildInputs(root, manifest, staging.report);

const packagedOne = await packageModule(staging.root, manifest, { stagingReport: staging.report });
const distOne = packagedOne.dist;
void distOne;

// Preserve the first artifacts in memory before a second independent packaging run,
// so the comparison cannot read overwritten files.
const firstBuffers = new Map();
for (const name of packagedOne.names.generatedArtifacts) {
  firstBuffers.set(name, await readFile(resolve(packagedOne.dist, name)));
}

const secondStagingRoot = resolve(root, ".staging");
const stagedTwoRoot = resolve(secondStagingRoot, "publication");
const stagingReportTwo = { ...staging.report };
void stagedTwoRoot;
void stagingReportTwo;

const referenceStaging = await stageSource(root, { stagingRoot: resolve(root, ".staging-second") });
assertBuildInputs(root, manifest, referenceStaging.report);
const packagedTwo = await packageModule(referenceStaging.root, manifest, { stagingReport: referenceStaging.report });

for (const name of packagedOne.names.generatedArtifacts) {
  const secondBuffer = await readFile(resolve(packagedTwo.dist, name));
  if (!firstBuffers.get(name).equals(secondBuffer)) {
    throw new Error(`Staged build is not byte-reproducible: ${name}`);
  }
}

await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(resolve(root, "dist"), { recursive: true });
for (const name of packagedOne.names.generatedArtifacts) {
  await copyFile(resolve(packagedOne.dist, name), resolve(root, "dist", name));
}
await rm(resolve(root, ".staging"), { recursive: true, force: true });
await rm(resolve(root, ".staging-second"), { recursive: true, force: true });

console.log(`Built ${packagedOne.names.install} (${packagedOne.report.installFiles} files).`);
console.log(`Built ${packagedOne.names.source} (${packagedOne.report.sourceFiles} files).`);
console.log(`Staged Git metadata: ${staging.report.strategy} from ${staging.report.selectedRefs.length} selected ref(s).`);
