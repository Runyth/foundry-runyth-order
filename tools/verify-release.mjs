import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { listZip, readZipEntry } from "./lib/zip.mjs";
import { readJson } from "./lib/files.mjs";
import { isolatedGitEnv, extractZip, RECONSTRUCTED_CONFIG, assertGitAllowlist } from "./stage-source.mjs";
import { projectFileInventory, prohibitedMatches, companionVariantMatches } from "./lib/release-scan.mjs";
import { checkBaselineRow } from "./lib/release-baseline-check.mjs";
import { closureObjectIds, storedObjectIds, closureDigest, compareObjectSets } from "./lib/release-closure.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const manifest = await readJson(resolve(root, "module.json"));
const reportFile = resolve(dist, `${manifest.id}-v${manifest.version}-build-report.json`);
const report = await readJson(reportFile);
const installPath = resolve(dist, report.installArchive);
const sourcePath = resolve(dist, report.sourceArchive);
const installBuffer = await readFile(installPath);
const installEntries = await listZip(installPath);
const sourceEntries = await listZip(sourcePath);
const failures = [];

const releaseBaseline = await readJson(resolve(root, "tools/release-baseline.json")).catch((error) => {
  failures.push(`Release baseline is unavailable: ${error.message}`);
  return null;
});
const signingKeyMaterial = await readFile(resolve(root, "keys/release-signing.asc"), "utf8").catch(() => null);
if (releaseBaseline && !signingKeyMaterial) {
  failures.push("Public signing key material is missing for signature verification.");
}

function scanForProhibited(label, buffer) {
  for (const source of prohibitedMatches(buffer)) {
    failures.push(`Prohibited content detected (${source}) in ${label}.`);
  }
  const variants = companionVariantMatches(buffer);
  if (variants.length) {
    const fingerprint = variants[0].replaceAll(" ", "");
    failures.push(`Distinctive companion/baseline content (${fingerprint}) remains in ${label}.`);
  }
}

// The project's own licence grant is verified structurally (root package entry) rather
// than through a generic literal scan, because dev-dependency lockfile metadata
// legitimately carries third-party SPDX identifiers.
async function assertProjectLicenceGrant(sourceTreeRoot) {
  for (const name of ["package.json", "package-lock.json"]) {
    const bytes = await readFile(resolve(sourceTreeRoot, name), "utf8").catch(() => null);
    if (!bytes) {
      failures.push(`${name} is missing from the archived source revision.`);
      continue;
    }
    try {
      const parsed = JSON.parse(bytes);
      const rootEntry = parsed.packages?.[""] ?? parsed[""] ?? parsed;
      const declared = rootEntry.license
        ?? (Array.isArray(rootEntry.licenses)
          ? rootEntry.licenses.map((entry) => entry.type ?? entry).join(", ")
          : undefined);
      if (declared !== "AGPL-3.0-or-later") {
        failures.push(`${name} root licence declaration is ${declared ?? "missing"}, expected AGPL-3.0-or-later.`);
      }
    } catch (error) {
      failures.push(`${name} is not valid JSON in the archived source revision: ${error.message}`);
    }
  }
}

if (report.displayTitle !== "Runyth Order") failures.push("Build report display title is not Runyth Order.");
if (report.namingContract?.pattern !== "Runyth Order: <Category> <Content Name>") failures.push("Build report naming contract is missing.");
if (report.license?.spdx !== "AGPL-3.0-or-later" || report.license?.includedInArchives !== true) {
  failures.push("Build report must declare the AGPL-3.0-or-later license contract for both archives.");
}
if (report.gitSource?.strategy !== "pack-object-canonical-transfer") {
  failures.push("Source archive Git metadata must use the canonical pack-object transfer strategy.");
}
if (manifest.url !== "https://github.com/Runyth/foundry-runyth-order") {
  failures.push("Manifest website URL is not the intended public repository.");
}
if (manifest.manifest !== "https://github.com/Runyth/foundry-runyth-order/releases/latest/download/module.json") {
  failures.push("Manifest manifest URL is not the intended public release asset.");
}
if (manifest.download !== `https://github.com/Runyth/foundry-runyth-order/releases/download/v${manifest.version}/runyth-order-v${manifest.version}.zip`) {
  failures.push("Manifest download URL is not the intended public release asset.");
}
if (manifest.license !== "LICENSE") failures.push("Manifest license field must point at the LICENSE file.");
if (report.gitSource?.releaseTag && report.gitSource.revisionSource !== report.gitSource.releaseTag) {
  failures.push("Recorded release revision is inconsistent with the staged release tag.");
}

if (!installEntries.length) failures.push("Install archive is empty.");
if (!sourceEntries.length) failures.push("Source archive is empty.");
if (installEntries.some((entry) => !entry.startsWith(`${report.installRoot}/`))) failures.push("Install archive has an invalid root.");
if (sourceEntries.some((entry) => !entry.startsWith(`${report.sourceRoot}/`))) failures.push("Source archive has an invalid root.");
if (!installEntries.includes(`${report.installRoot}/module.json`)) failures.push("Install archive has no root module.json.");
if (!installEntries.includes(`${report.installRoot}/lang/en.json`)) failures.push("Install archive has no English localization dictionary.");
if (!installEntries.includes(`${report.installRoot}/LICENSE`)) failures.push("Install archive has no LICENSE document.");
if (!installEntries.includes(`${report.installRoot}/${report.runtime?.entrypoint}`)) failures.push("Install archive has no guarded runtime bootstrap.");
if (!installEntries.includes(`${report.installRoot}/runtime/v${report.version}/graph.json`)) failures.push("Install archive has no runtime graph manifest.");
if (installEntries.some((entry) => entry.startsWith(`${report.installRoot}/src/`))) failures.push("Install archive exposes source-path runtime modules instead of the emitted safe runtime graph.");
if (installEntries.includes(`${report.installRoot}/lang/de.json`)) failures.push("Install archive still bundles German localization.");
if (!sourceEntries.includes(`${report.sourceRoot}/package.json`)) failures.push("Source archive has no package.json.");
if (!sourceEntries.includes(`${report.sourceRoot}/tools/build.mjs`)) failures.push("Source archive is not reproducible.");
if (!sourceEntries.includes(`${report.sourceRoot}/.git/HEAD`)) failures.push("Source archive does not include Git history.");
if (!sourceEntries.includes(`${report.sourceRoot}/.git/config`)) failures.push("Source archive Git metadata has no reconstructed config.");
if (!sourceEntries.includes(`${report.sourceRoot}/runtime/v${report.version}/graph.json`)) failures.push("Source archive has no runtime graph manifest.");
for (const forbidden of ["/node_modules/", "/dist/", "/.staging/", "/coverage/"]) {
  if (sourceEntries.some((entry) => entry.includes(forbidden))) failures.push(`Source archive includes ${forbidden.slice(1)}`);
}
for (const forbidden of ["/.git/", "/.staging/", "/test/", "/tools/", "/examples/", "/package.json", "/package-lock.json", "/docs/"]) {
  if (installEntries.some((entry) => entry.includes(forbidden))) {
    failures.push(`Install archive includes source-only path ${forbidden.slice(1)}`);
  }
}

const rootManifestBytes = await readFile(resolve(root, "module.json"));
const rootLicenseBytes = await readFile(resolve(root, "LICENSE"));

const archivedInstallManifest = await readZipEntry(installBuffer, `${report.installRoot}/module.json`).catch(() => null);
if (!archivedInstallManifest) {
  failures.push("Archived install manifest could not be read.");
} else {
  if (!archivedInstallManifest.equals(rootManifestBytes)) {
    failures.push("Archived install manifest differs from the root working-tree manifest.");
  }
  try {
    const archivedManifest = JSON.parse(archivedInstallManifest.toString("utf8"));
    if (archivedManifest.version !== report.version) failures.push("Archived manifest version disagrees with the build report.");
    if (archivedManifest.id !== report.moduleId) failures.push("Archived manifest module ID disagrees with the build report.");
    if ((archivedManifest.manifest ?? "").includes("/Runyth/runyth-order/")) failures.push("Archived manifest still points at the former repository.");
    if (archivedManifest.license !== "LICENSE") failures.push("Archived manifest license field is wrong.");
  } catch (error) {
    failures.push(`Archived install manifest is not valid JSON: ${error.message}`);
  }
}

const checksumMap = new Map(
  (await readFile(resolve(dist, report.checksumFile), "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, name] = line.trim().split(/\s{2,}/u);
      return [name, hash];
    }),
);
for (const [name, path] of [[report.installArchive, installPath], [report.sourceArchive, sourcePath]]) {
  const actual = createHash("sha256").update(await readFile(path)).digest("hex");
  if (checksumMap.get(name) !== actual) failures.push(`${name} checksum mismatch.`);
}
if (!checksumMap.has("module.json")) {
  failures.push("Checksum list does not cover the uploaded module.json manifest.");
} else if (checksumMap.get("module.json") !== createHash("sha256").update(rootManifestBytes).digest("hex")) {
  failures.push("Uploaded module.json checksum entry does not match the root manifest.");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function digest(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const KNOWN_OBJECT_TYPES = new Set(["commit", "tree", "blob", "tag"]);

function splitBatchRecords(buffer) {
  const records = [];
  let offset = 0;
  while (offset + 46 <= buffer.length) {
    const lineEnd = buffer.indexOf("\n", offset);
    if (lineEnd < 0) break;
    const [objectId, type, sizeText] = buffer.subarray(offset, lineEnd).toString("utf8").trim().split(/\s+/u);
    if (!/^[0-9a-f]{40}$/u.test(objectId ?? "") || !KNOWN_OBJECT_TYPES.has(type)) break;
    const size = Number(sizeText);
    const dataLength = Number.isFinite(size) && size >= 0 ? size : -1;
    if (dataLength < 0) break;
    const dataStart = lineEnd + 1;
    const data = buffer.subarray(dataStart, dataStart + dataLength);
    records.push({ objectId, type, data });
    offset = dataStart + dataLength + 1;
  }
  return records;
}

async function listSelectedRefNames(gitDir) {
  const names = new Set(["refs/heads/master"]);
  for (const entry of report.gitSource?.selectedRefs ?? []) names.add(entry.split("@")[0]);
  void gitDir;
  return [...names];
}

async function decodeHistoryObjects(gitDir) {
  const refNames = await listSelectedRefNames(gitDir);
  const revList = spawnSync("git", ["-C", gitDir, "rev-list", "--objects", "--no-object-names", ...refNames], {
    env: isolatedGitEnv(),
    encoding: "buffer",
    // Large closure output is bounded explicitly; the default limit is too small.
    maxBuffer: 64 * 1024 * 1024,
  });
  if (revList.status !== 0) {
    throw new Error(`git rev-list failed in the extracted metadata: ${revList.stderr.toString().trim()}`);
  }
  const ids = revList.stdout
    .toString("utf8")
    .split("\n")
    .filter((id) => /^[0-9a-f]{40}$/u.test(id));
  if (!ids.length) return { count: 0, records: [] };
  const catFile = spawnSync("git", ["-C", gitDir, "cat-file", "--batch"], {
    env: isolatedGitEnv(),
    input: Buffer.from(`${ids.join("\n")}\n`, "utf8"),
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (catFile.status !== 0) {
    throw new Error(`git cat-file --batch failed: ${catFile.stderr.toString("utf8").trim()}`);
  }
  return { count: ids.length, records: splitBatchRecords(catFile.stdout) };
}

async function listMetadataFileNames(gitDir, depth = 6) {
  const files = [];
  async function walk(relative, remaining) {
    if (remaining < 0) return;
    let entries;
    try {
      entries = await readdir(resolve(gitDir, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(name, remaining - 1);
      else files.push(name);
    }
  }
  await walk("", depth);
  return files;
}

async function collectDirectoryMap(base, ignored) {
  const map = new Map();
  async function visit(dir, prefix) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const name = `${prefix}${entry.name}`;
      if (ignored.some((ignoredName) => name === ignoredName || name.startsWith(`${ignoredName}/`))) continue;
      const absolute = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        map.set(name, "dir");
        await visit(absolute, `${name}/`);
      } else {
        map.set(name, createHash("sha256").update(await readFile(absolute)).digest("hex").slice(0, 64));
      }
    }
  }
  await visit(base, "");
  return map;
}

const temp = await mkdtemp(resolve(tmpdir(), "runyth-order-verify-"));
try {
  const extractedSource = resolve(temp, "source");
  await mkdir(extractedSource, { recursive: true });
  const extractionResult = await extractZip(sourcePath, extractedSource);
  if (!extractionResult.ok) failures.push("Source archive could not be extracted.");

  const gitDir = resolve(extractedSource, report.sourceRoot, ".git");
  const sourceTreeRoot = resolve(extractedSource, report.sourceRoot);
  const gitChecksPossible = await exists(gitDir);
  if (!gitChecksPossible) {
    failures.push("Extracted source archive has no .git metadata.");
  } else {
    const violations = await assertGitAllowlist(gitDir, (report.gitSource?.selectedRefs ?? []).map((entry) => entry.split("@").reverse()).map(([sha, refname]) => ({ refname, objectname: sha })));
    for (const violation of violations) failures.push(`Extracted Git metadata allow-list violation: ${violation}`);

    const env = isolatedGitEnv();
    const runGit = (args, options = {}) => spawnSync("git", ["-C", gitDir, ...args], { encoding: "utf8", env, maxBuffer: 32 * 1024 * 1024, ...options });

    const fsck = runGit(["fsck", "--full", "--strict", "--no-reflogs"]);
    if (fsck.status !== 0) failures.push(`Extracted Git metadata failed fsck --full --strict: ${fsck.stderr.trim()}`);

    const configText = await readFile(resolve(gitDir, "config"), "utf8");
    if (configText !== RECONSTRUCTED_CONFIG) failures.push("Extracted Git config is not the reconstructed minimal closed set.");

    const headText = (await readFile(resolve(gitDir, "HEAD"), "utf8")).trim();
    const expectedHead = report.gitSource?.headRef;
    if (!expectedHead) failures.push("Build report does not record the staged HEAD target.");
    else if (headText !== `ref: ${expectedHead}`) failures.push(`Extracted Git HEAD is ${headText}, expected ref: ${expectedHead}.`);

    const actualRefs = new Map();
    for (const line of runGit(["for-each-ref", "--format=%(objectname) %(refname)"]).stdout.trim().split("\n")) {
      if (!line.trim()) continue;
      const [objectName, refName] = line.trim().split(/\s+/u);
      actualRefs.set(refName, objectName);
    }
    const selectedByRef = new Map(
      (report.gitSource?.selectedRefs ?? []).map((entry) => entry.split("@")).map(([refname, objectname]) => [refname, objectname]),
    );
    for (const [refname, objectname] of selectedByRef) {
      if (!actualRefs.has(refname)) failures.push(`Extracted Git metadata is missing selected ref ${refname}.`);
      else if (actualRefs.get(refname) !== objectname) failures.push(`Extracted ref ${refname} does not match the recorded object.`);
    }
    for (const refname of actualRefs.keys()) {
      if (!selectedByRef.has(refname)) failures.push(`Extracted Git metadata contains an unselected ref ${refname}.`);
    }

    const revisionSha = report.gitSource?.revisionSha;
    const headCommit = runGit(["rev-parse", "HEAD"]).stdout.trim();
    // Branch provenance and worktree-revision provenance are recorded and checked
    // separately under the retained-master policy: HEAD legitimately resolves to the
    // source branch tip, while the archived worktree is built from the recorded
    // revision (a release tag further down the branch, or a pinned PR revision).
    if (report.gitSource?.branchSourceSha) {
      const branchTarget = runGit(["rev-parse", "refs/heads/master"]).stdout.trim();
      if (branchTarget !== report.gitSource.branchSourceSha) {
        failures.push("Retained master branch does not resolve to the recorded public branch tip.");
      }
    }
    if (revisionSha) {
      if (report.gitSource?.releaseTag) {
        const tagTarget = runGit(["rev-parse", `${report.gitSource.releaseTag}^{commit}`]).stdout.trim();
        if (tagTarget !== revisionSha) {
          failures.push("The recorded release tag does not resolve to the recorded staging revision.");
        }
      }
      if (report.gitSource?.revisionPinnedRef) {
        const pinnedTarget = runGit(["rev-parse", report.gitSource.revisionPinnedRef]).stdout.trim();
        if (pinnedTarget !== revisionSha) {
          failures.push("The retained staged-revision ref does not resolve to the recorded staging revision.");
        }
      }
      // A HEAD-selected revision is provenance-checked through its pin when the
      // staged revision is not reachable from the retained branch/tag closure.
    }
    const recordedTree = report.gitSource?.revisionTree;
    if (recordedTree) {
      const actualTree = runGit(["rev-parse", `${revisionSha ?? headCommit}^{tree}`]).stdout.trim();
      if (actualTree !== recordedTree) failures.push("Archived revision tree disagrees with the recorded tree.");
    }

    const commitCount = Number(runGit(["rev-list", "--count", revisionSha ?? headCommit]).stdout.trim() || 0);
    if (!Number.isFinite(commitCount) || commitCount < 6) {
      failures.push("Extracted Git history has fewer than the six required release commits.");
    }

    const decodedHistory = await decodeHistoryObjects(gitDir).catch((error) => {
      failures.push(error.message);
      return { count: 0, records: [] };
    });
    if (decodedHistory.count !== report.gitSource?.closureObjectCount) {
      failures.push("Object closure count differs from the recorded staging closure.");
    }

    // F24: every stored object must belong to the approved reachable closure and
    // versa; the recorded count and closure digest must match the retained refs.
    const selectedRefTargets = (report.gitSource?.selectedRefs ?? []).map((entry) => entry.split("@")[1]);
    const approvedClosure = closureObjectIds(gitDir, selectedRefTargets);
    const closureDigestNow = closureDigest(approvedClosure);
    if (closureDigestNow !== report.gitSource?.closureObjectIdsSha256) {
      failures.push("Approved closure object-ID digest differs from the recorded staging closure.");
    }
    if (revisionSha && !approvedClosure.includes(revisionSha)) {
      failures.push("Recorded staging revision is not part of the approved retained closure.");
    }
    const storedObjectListing = storedObjectIds(gitDir);
    const setComparison = compareObjectSets(approvedClosure, storedObjectListing);
    if (!setComparison.identical) {
      if (setComparison.extras.length) {
        failures.push(`Staged storage contains objects outside the approved closure: ${setComparison.extras.slice(0, 4).join(", ")}`);
      }
      if (setComparison.missing.length) {
        failures.push(`Staged storage is missing approved closure objects: ${setComparison.missing.slice(0, 4).join(", ")}`);
      }
    }

    for (const record of decodedHistory.records) {
      scanForProhibited(`object ${record.objectId.slice(0, 12)} (${record.type})`, record.data);
    }
    for (const metadataName of await listMetadataFileNames(gitDir)) {
      if (/pack-[0-9a-f]{40}\.(?:pack|idx|rev)$/u.test(metadataName)) continue;
      const bytes = await readFile(resolve(gitDir, metadataName)).catch(() => null);
      if (bytes) scanForProhibited(`.git metadata ${metadataName}`, bytes);
    }
    const inventory = await projectFileInventory(sourceTreeRoot).catch((error) => {
      failures.push(`Extracted project-file inventory failed: ${error.message}`);
      return null;
    });
    if (inventory) {
      for (const [relativeName, bytes] of inventory) {
        scanForProhibited(`extracted project file ${relativeName}`, bytes);
      }
    }

    const archiveArchive = runGitToBuffer(gitDir, ["archive", "--format=tar", revisionSha ?? headCommit]);
    if (!archiveArchive.ok) failures.push("Could not materialize the extracted revision tree for comparison.");
    else {
      const treeDir = resolve(temp, "tree");
      await mkdir(treeDir, { recursive: true });
      const tarFile = resolve(temp, "treeArchive.tar");
      await writeFile(tarFile, archiveArchive.buffer);
      const tarExtraction = spawnSync("tar", ["-xf", tarFile, "-C", treeDir], { encoding: "utf8" });
      if (tarExtraction.status !== 0) failures.push("Archived tree extraction failed.");
      else {
        const [stagedFiles, archiveFiles] = await Promise.all([
          collectDirectoryMap(sourceTreeRoot, [".git", "dist", "node_modules"]),
          collectDirectoryMap(treeDir, []),
        ]);
        for (const [name, value] of stagedFiles) {
          if (archiveFiles.get(name) !== value) failures.push(`Extracted worktree differs from the recorded revision tree at ${name}.`);
        }
        for (const name of archiveFiles.keys()) {
          if (!stagedFiles.has(name)) failures.push(`Extracted worktree differs from the recorded revision tree at ${name}.`);
        }
      }
    }

    await assertProjectLicenceGrant(sourceTreeRoot);
    await verifyReleaseBaseline(sourceTreeRoot, extractedSource);
  }

  const archivedLicense = await readZipEntry(installBuffer, `${report.installRoot}/LICENSE`).catch(() => null);
  if (!archivedLicense) failures.push("Archived install licence could not be read.");
  else if (!archivedLicense.equals(rootLicenseBytes)) failures.push("Archived install licence differs from the project licence file.");
  else if (!archivedLicense.toString("utf8").includes("GNU AFFERO GENERAL PUBLIC LICENSE")) {
    failures.push("Archived install licence does not contain the GNU AGPL text.");
  }

  const archivedRuntimeModules = [];
  for (const entry of installEntries) {
    if (!entry.startsWith(`${report.installRoot}/runtime/v${report.version}/`) || !entry.endsWith(".mjs")) continue;
    const bytes = await readZipEntry(installBuffer, entry).catch(() => null);
    if (bytes) archivedRuntimeModules.push([entry, bytes]);
  }
  if (!archivedRuntimeModules.some(([, bytes]) => bytes.toString("utf8").includes("denied by the configured audit permission"))) {
    failures.push("Archived runtime lacks the central Actor-audit authorization enforcement.");
  }

  const rebuildRoot = resolve(extractedSource, report.sourceRoot);
  // The extracted metadata intentionally has no staged index; its tree is authoritative,
  // so the uncommitted-input gate must not interpret an empty index as deletions. The
  // rebuild stages the exact recorded revision: the checked-in v* release ref when one
  // was published, or the staged revision commit for HEAD/PR provenance.
  const recordedRevision = report.gitSource?.releaseTag ?? report.gitSource?.revisionSha;
  const rebuild = spawnSync(process.execPath, ["tools/build.mjs"], {
    cwd: rebuildRoot,
    env: isolatedGitEnv({
      RUNYTH_ALLOW_UNCOMMITTED: "1",
      ...(recordedRevision ? { RUNYTH_RELEASE_REF: recordedRevision } : {}),
    }),
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
  const rebuiltInstall = resolve(rebuildRoot, "dist", report.installArchive);
  const rebuiltSource = resolve(rebuildRoot, "dist", report.sourceArchive);
  if (rebuild.status !== 0) {
    failures.push(`Clean extracted source did not rebuild: ${rebuild.stderr.toString().trim().slice(-400)}`);
  } else if (!(await exists(rebuiltInstall)) || !(await exists(rebuiltSource))) {
    failures.push("Clean extracted source rebuild did not produce the expected archive artifacts.");
  } else {
    if ((await digest(rebuiltInstall)) !== createHash("sha256").update(installBuffer).digest("hex")) {
      failures.push("Rebuilt install archive from clean extracted history differs from the published artifact.");
    }
    if ((await digest(rebuiltSource)) !== (await digest(sourcePath))) {
      failures.push("Rebuilt source archive from clean extracted history differs from the published artifact.");
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Release verification passed: ${installEntries.length} install files, ${sourceEntries.length} source files, clean reconstructed Git metadata, baseline-verified history, byte-identical rebuild from clean extraction.`);
}

function runGitToBuffer(gitDir, args) {
  const child = spawnSync("git", ["-C", gitDir, ...args], { encoding: "buffer", env: isolatedGitEnv(), maxBuffer: 64 * 1024 * 1024 });
  if (child.status !== 0) return { ok: false, buffer: null };
  return { ok: true, buffer: child.stdout };
}

function gpg(base, args) {
  const result = spawnSync("gpg", ["--homedir", base, ...args], {
    encoding: "utf8",
    env: isolatedGitEnv(),
  });
  return result;
}

async function verifyReleaseBaseline(workRoot, tempRoot) {
  if (!releaseBaseline) return;
  const gnupgHome = resolve(tempRoot, "gpg-home");
  await rm(gnupgHome, { recursive: true, force: true });
  await mkdir(gnupgHome, { recursive: true });
  await writeFile(resolve(gnupgHome, "release.asc"), signingKeyMaterial);
  const imported = gpg(gnupgHome, ["--batch", "--import", resolve(gnupgHome, "release.asc")]);
  if (imported.status !== 0) {
    failures.push(`Public key import failed: ${imported.stderr.trim()}`);
    return;
  }

  const env = { ...isolatedGitEnv({ GNUPGHOME: gnupgHome }) };
  const runGit = (args) =>
    spawnSync("git", ["-C", workRoot, ...args], { encoding: "utf8", env, maxBuffer: 32 * 1024 * 1024 });

  const baselineReleases = releaseBaseline.releases ?? [];
  if (!baselineReleases.length) {
    failures.push("Release baseline defines no historical releases.");
    return;
  }

  // Every row's target is checked field-by-field against its own author/committer
  // expectations from the row data shared with the unit-tested helper, each parent
  // must linearly follow the previous release, and tag targets must occupy the first
  // positions of the retained branch in the approved order.
  const rowTargets = [];
  for (const expected of baselineReleases) {
    const commit = runGit(["rev-parse", `${expected.tag}^{commit}`]).stdout.trim();
    if (!/^[0-9a-f]{40}$/u.test(commit)) {
      failures.push(`Baseline tag ${expected.tag} does not resolve in the archived history.`);
      return;
    }
    rowTargets.push({ tag: expected.tag, tagTarget: commit, chainMode: expected.chainMode ?? "rewrite" });

    const commitBody = spawnSync("git", ["-C", workRoot, "cat-file", "commit", commit], {
      encoding: "utf8",
      env: isolatedGitEnv(),
      maxBuffer: 8 * 1024 * 1024,
    });
    if (commitBody.status !== 0) {
      failures.push(`Archived commit ${expected.tag} could not be read.`);
      return;
    }
    const rowResult = checkBaselineRow(commitBody.stdout, expected);
    failures.push(...rowResult.failures);
    if (rowResult.failures.length) continue;

    const verified = runGit(["verify-commit", "--raw", commit]).stderr;
    const validSig = verified.split("\n").find((line) => line.startsWith("[GNUPG:] VALIDSIG "));
    if (!validSig) {
      failures.push(`${expected.tag}: signature verification failed in the clean environment.`);
    } else {
      const fingerprint = validSig.split(/\s+/u)[2];
      if (fingerprint !== releaseBaseline.signingKeyFingerprint) {
        failures.push(`${expected.tag}: signature key does not match the release baseline fingerprint.`);
      }
    }

    if (rowTargets.length > 1) {
      const previousTarget = rowTargets.at(-2).tagTarget;
      if ((expected.chainMode ?? "rewrite") === "release") {
        // Appended release rows bless a normal Git release flow: the previous retained
        // release must be an ancestor even when intermediate non-release commits exist.
        const ancestry = runGit(["merge-base", "--is-ancestor", previousTarget, commit]);
        if (ancestry.status !== 0) {
          failures.push(`${expected.tag}: does not retain the previous release (${previousTarget.slice(0, 12)}) in its history.`);
        }
      } else if (rowResult.parents.length !== 1 || rowResult.parents[0] !== previousTarget) {
        failures.push(`${expected.tag}: parent mapping does not linearly follow the previous release commit.`);
      }
    } else if (rowResult.parents.length !== 0) {
      failures.push(`${expected.tag}: the first release commit must have no parents.`);
    }
  }

  const commits = runGit(["rev-list", "--reverse", "--topo-order", "refs/heads/master"]).stdout.trim().split(/\s+/u).filter(Boolean);
  const rewriteRows = rowTargets.filter((row) => row.chainMode === "rewrite");
  rewriteRows.forEach((row, index) => {
    if (commits.length > index && commits[index] !== row.tagTarget) {
      failures.push(`${row.tag}: does not occupy retained-chain position ${index} of the retained branch.`);
    }
  });
  for (const row of rowTargets.filter((entry) => entry.chainMode === "release")) {
    const branchContains = runGit(["merge-base", "--is-ancestor", row.tagTarget, "refs/heads/master"]);
    if (branchContains.status !== 0) {
      failures.push(`${row.tag}: recorded release is not reachable from the retained branch.`);
    }
  }
}
