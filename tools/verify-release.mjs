import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { listZip } from "./lib/zip.mjs";
import { readJson } from "./lib/files.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const manifest = await readJson(resolve(root, "module.json"));
const report = await readJson(resolve(dist, `${manifest.id}-v${manifest.version}-build-report.json`));
const installPath = resolve(dist, report.installArchive);
const sourcePath = resolve(dist, report.sourceArchive);
const installEntries = await listZip(installPath);
const sourceEntries = await listZip(sourcePath);
const failures = [];

if (report.displayTitle !== "Runyth Order") failures.push("Build report display title is not Runyth Order.");
if (report.namingContract?.pattern !== "Runyth Order: <Category> <Content Name>") failures.push("Build report naming contract is missing.");
if (report.localizationContract?.baseLanguage !== "en") failures.push("Build report base language is not English.");
if (JSON.stringify(report.localizationContract?.bundledLanguages) !== JSON.stringify(["en"])) failures.push("Build report must list only English as bundled.");
if (report.localizationContract?.externalLanguagePacks !== true) failures.push("Build report does not advertise external language packs.");
if (report.localizationContract?.customModuleSetting !== false || report.localizationContract?.dashboardSelector !== false) {
  failures.push("Build report incorrectly advertises a custom language selector.");
}
if (!installEntries.length) failures.push("Install archive is empty.");
if (!sourceEntries.length) failures.push("Source archive is empty.");
if (installEntries.some((entry) => !entry.startsWith(`${report.installRoot}/`))) failures.push("Install archive has an invalid root.");
if (sourceEntries.some((entry) => !entry.startsWith(`${report.sourceRoot}/`))) failures.push("Source archive has an invalid root.");
if (!installEntries.includes(`${report.installRoot}/module.json`)) failures.push("Install archive has no root module.json.");
if (!installEntries.includes(`${report.installRoot}/lang/en.json`)) failures.push("Install archive has no English localization dictionary.");
if (installEntries.includes(`${report.installRoot}/lang/de.json`)) failures.push("Install archive still bundles German localization.");
if (!sourceEntries.includes(`${report.sourceRoot}/package.json`)) failures.push("Source archive has no package.json.");
if (!sourceEntries.includes(`${report.sourceRoot}/tools/build.mjs`)) failures.push("Source archive is not reproducible.");
for (const forbidden of ["node_modules/", "dist/", ".git/"]) {
  if (sourceEntries.some((entry) => entry.includes(`/${forbidden}`))) failures.push(`Source archive includes ${forbidden}.`);
}
for (const forbidden of ["/test/", "/tools/", "/examples/", "/package.json", "/package-lock.json", "/docs/"]) {
  if (installEntries.some((entry) => entry.includes(forbidden))) failures.push(`Install archive includes source-only path ${forbidden}.`);
}

const expectedChecksums = new Map(
  (await readFile(resolve(dist, report.checksumFile), "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, name] = line.trim().split(/\s{2,}/u);
      return [name, hash];
    }),
);
async function digest(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
if ((await digest(installPath)) !== expectedChecksums.get(report.installArchive)) failures.push("Install checksum mismatch.");
if ((await digest(sourcePath)) !== expectedChecksums.get(report.sourceArchive)) failures.push("Source checksum mismatch.");

const temp = await mkdtemp(resolve(tmpdir(), "runyth-order-build-"));
try {
  const firstInstall = await readFile(installPath);
  const firstSource = await readFile(sourcePath);
  const child = await import("node:child_process");
  const result = child.spawnSync(process.execPath, [resolve(root, "tools/build.mjs")], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) failures.push(`Second build failed: ${result.stderr}`);
  else {
    const secondInstall = await readFile(installPath);
    const secondSource = await readFile(sourcePath);
    if (!firstInstall.equals(secondInstall)) failures.push("Install archive is not byte-reproducible.");
    if (!firstSource.equals(secondSource)) failures.push("Source archive is not byte-reproducible.");
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Release verification passed: ${installEntries.length} install files, ${sourceEntries.length} source files, byte-identical rebuild.`);
}
