import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { closureDigest } from "./lib/release-closure.mjs";
import { isolatedGitEnv } from "./lib/git-env.mjs";

export { isolatedGitEnv };
import { createHash } from "node:crypto";

export const RECONSTRUCTED_CONFIG = `\
[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = false
\tlogallrefupdates = false
`;

export function git(root, args, options = {}) {
  const input = options.input === undefined
    ? undefined
    : Buffer.isBuffer(options.input)
      ? options.input
      : Buffer.from(options.input, "utf8");
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "buffer",
    env: isolatedGitEnv(options.environment),
    cwd: root,
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `git ${args.join(" ")} failed (${result.status}, ${result.signal ?? ""}): ${Buffer.from(result.stderr).toString("utf8").trim()}`,
    );
  }
  return result;
}

function gitText(root, args, options = {}) {
  return git(root, args, options).stdout.toString("utf8");
}

function gitBuffer(root, args, options = {}) {
  return git(root, args, options).stdout;
}

const BRANCH_CANDIDATES = [
  "refs/heads/master",
  "refs/remotes/origin/master",
  "refs/remotes/upstream/master",
];

const RELEASE_TAG_PATTERN = /^refs\/tags\/v\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u;

function resolveCommit(root, ref) {
  const result = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFailure: true });
  return result.status === 0 ? result.stdout.toString("utf8").trim() : null;
}

function canonicalBranch(root) {
  if (process.env.RUNYTH_SOURCE_BRANCH) {
    const explicit = {
      refname: process.env.RUNYTH_SOURCE_BRANCH,
      objectname: resolveCommit(root, process.env.RUNYTH_SOURCE_BRANCH),
    };
    if (!explicit.objectname) {
      throw new Error(`Configured staging branch ${explicit.refname} does not resolve.`);
    }
    return explicit;
  }
  for (const candidate of BRANCH_CANDIDATES) {
    const objectname = resolveCommit(root, candidate);
    if (objectname) return { refname: candidate, objectname };
  }
  return null;
}

function listTagRefs(root) {
  const listing = gitText(root, ["for-each-ref", "--format=%(objectname) %(refname)", "refs/tags/v*"]).trim();
  if (!listing) return [];
  return listing.split("\n").map((line) => {
    const [objectname, refname] = line.trim().split(/\s+/u);
    return { refname, objectname };
  });
}

const packDeterministicConfig = [
  "-c", "pack.threads=1",
  "-c", "pack.compression=9",
  "-c", "pack.depth=50",
  "-c", "pack.window=10",
];

async function closureObjectIdsAsync(gitRoot, shas) {
  const listing = gitText(gitRoot, ["rev-list", "--objects", "--no-object-names", ...shas]).trim();
  const ids = listing ? listing.split("\n").map((line) => line.split(/\s+/u)[0]).filter((id) => /^[0-9a-f]{40}$/u.test(id)) : [];
  return [...new Set(ids)].sort();
}

function setEquality(left, right) {
  if (left.length !== right.length) return false;
  for (const [index, value] of left.entries()) {
    if (right[index] !== value) return false;
  }
  return true;
}

export async function fsck(root, label = "staged") {
  const result = git(root, ["fsck", "--full", "--strict", "--no-reflogs"], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`${label} repository failed git fsck --full: ${Buffer.from(result.stderr).toString("utf8").trim()}`);
  }
}

function packObjectPatternFor(path) {
  return /^objects\/pack\/pack-[0-9a-f]{40}\.(?:pack|idx|rev)$/u.test(path);
}

export async function assertGitAllowlist(stagedGit, refs) {
  const allowedDirs = new Set(["objects", "objects/pack", "refs", "refs/heads", "refs/tags"]);
  const allowedFiles = new Set(["HEAD", "config"]);
  for (const { refname } of refs) {
    allowedDirs.add(refname.slice(0, refname.lastIndexOf("/")));
    allowedFiles.add(refname);
  }
  const violations = [];
  async function walk(relative) {
    const entries = (await readdir(resolve(stagedGit, relative || ""), { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const name = `${relative}${entry.name}`;
      if (entry.isSymbolicLink()) {
        violations.push(`unapproved symlink in reconstructed Git metadata: ${name}`);
        continue;
      }
      const absolute = resolve(stagedGit, name);
      const metadata = await stat(absolute);
      if (metadata.isDirectory()) {
        if (!allowedDirs.has(name)) {
          violations.push(`unapproved directory in reconstructed Git metadata: ${name}`);
          continue;
        }
        await walk(`${name}/`);
      } else if (entry.isFile()) {
        const approved =
          allowedFiles.has(name) ||
          packObjectPatternFor(name);
        if (!approved) {
          violations.push(`unapproved metadata file in reconstructed Git metadata: ${name}`);
        }
      }
    }
  }
  await walk("");
  return violations;
}

function materializeTree(root, revisionSha, targetDir) {
  const tarFile = resolve(targetDir + ".tree.tar");
  git(root, ["archive", "--format=tar", revisionSha, "-o", tarFile]);
  const tar = spawnSync("tar", ["-xf", tarFile, "-C", targetDir], { encoding: "utf8" });
  if (tar.status !== 0) throw new Error(`tar extraction failed for ${revisionSha}: ${tar.stderr}`);
}

export async function stageSource(root, options = {}) {
  const branch = canonicalBranch(root);
  if (!branch) {
    throw new Error(
      "Unable to determine a canonical public branch for staging; set RUNYTH_SOURCE_BRANCH or provide refs/heads/master.",
    );
  }

  const revisionRequest = options.revision ?? process.env.RUNYTH_RELEASE_REF ?? "HEAD";
  const rawShaPattern = /^[0-9a-f]{40}$/u;
  if (revisionRequest !== "HEAD" && !revisionRequest.startsWith("refs/") && !rawShaPattern.test(revisionRequest)) {
    throw new Error(`Invalid staging revision ${revisionRequest}; use HEAD, a full ref, or a commit object ID.`);
  }
  const revisionSha = resolveCommit(root, revisionRequest);
  if (!revisionSha) throw new Error(`Cannot resolve staging revision ${revisionRequest}.`);

  let releaseTag = null;
  if (process.env.RUNYTH_PUBLIC_RELEASE) {
    if (!RELEASE_TAG_PATTERN.test(revisionRequest)) {
      throw new Error(`Public release builds must select their version tag (got ${revisionRequest}).`);
    }
    releaseTag = revisionRequest;
  } else if (revisionRequest.startsWith("refs/tags/")) {
    releaseTag = revisionRequest;
  }

  const retainedTags = [];
  for (const tagRef of listTagRefs(root)) {
    const commit = resolveCommit(root, tagRef.refname);
    if (commit) retainedTags.push({ refname: tagRef.refname, objectname: tagRef.objectname, commit });
  }

  // Retained-ref policy (F24/F25): the staged master keeps the source branch's exact
  // tip, selected version tags are preserved as published with their actual ref target
  // objects (annotated tags keep their tag objects; lightweight tags name commits), and
  // a build revision that is not reachable from those refs receives its own explicit
  // approved ref. Pack inputs, counts, digests and verification derive from this exact
  // union closure; peeled commits are used only to select the worktree revision.
  const selectedRefs = [{ refname: "refs/heads/master", objectname: branch.objectname }];
  const closureTargets = [branch.objectname];
  for (const tag of retainedTags) {
    selectedRefs.push({ refname: tag.refname, objectname: tag.objectname });
    closureTargets.push(tag.objectname);
  }
  let revisionPinnedRef = null;
  const pinnedBefore = new Set(await closureObjectIdsAsync(root, closureTargets));
  if (!pinnedBefore.has(revisionSha)) {
    revisionPinnedRef = "refs/heads/staged-revision";
    selectedRefs.push({ refname: revisionPinnedRef, objectname: revisionSha });
  }
  const packClosureShas = [...closureTargets];
  if (revisionPinnedRef) packClosureShas.push(revisionSha);
  packClosureShas.sort();

  const stagingRoot = options.stagingRoot ?? resolve(root, ".staging");
  const versionedRoot = resolve(stagingRoot, "publication");
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(versionedRoot, { recursive: true });

  const stagedGit = resolve(versionedRoot, ".git");
  git(versionedRoot, ["init", "--quiet", "--initial-branch", "staging-import", "--template="]);
  await rm(resolve(stagedGit, "hooks"), { recursive: true, force: true });
  git(versionedRoot, ["config", "core.logallrefupdates", "false"]);

  const closureInput = `${packClosureShas.join("\n")}\n`;
  const packBuffer = gitBuffer(root, [
    ...packDeterministicConfig,
    "pack-objects", "--revs", "--no-reuse-delta", "--no-reuse-object", "--stdout",
  ], { input: closureInput });
  if (!packBuffer.length) throw new Error("Canonical object transfer produced an empty pack.");
  const packSha = createHash("sha256").update(packBuffer).digest("hex");
  git(versionedRoot, ["index-pack", "--stdin"], { input: packBuffer });

  for (const entry of selectedRefs) {
    git(versionedRoot, ["update-ref", entry.refname, entry.objectname]);
  }

  // A symbolic HEAD may only target a branch without tripping fsck policy; the staged
  // master always exists, while the archived worktree is materialized from the exact
  // recorded revision independently of HEAD.
  const headTarget = "refs/heads/master";
  git(versionedRoot, ["symbolic-ref", "HEAD", headTarget]);

  materializeTree(root, revisionSha, versionedRoot);

  for (const volatile of ["logs", "hooks", "info", "description", "index", "FETCH_HEAD", "ORIG_HEAD", "shallow", "packed-refs"]) {
    await rm(resolve(stagedGit, volatile), { recursive: true, force: true });
  }
  await rm(resolve(stagedGit, "objects/info"), { recursive: true, force: true });
  const violations = await assertGitAllowlist(stagedGit, selectedRefs);
  if (violations.length) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw new Error(`Reconstructed Git metadata failed the allow-list policy:\n${violations.join("\n")}`);
  }
  await writeFile(resolve(stagedGit, "config"), RECONSTRUCTED_CONFIG);

  await fsck(versionedRoot);

  const sourceClosureIds = await closureObjectIdsAsync(root, packClosureShas);
  const stagedClosureIds = await closureObjectIdsAsync(versionedRoot, packClosureShas);
  if (sourceClosureIds.length === 0 || !setEquality(sourceClosureIds, stagedClosureIds)) {
    throw new Error(
      `Object closure mismatch between source and staged repositories: ${sourceClosureIds.length} vs ${stagedClosureIds.length} objects.`,
    );
  }

  const storedObjectListing = gitText(versionedRoot, ["cat-file", "--batch-all-objects", "--batch-check=%(objectname)"]).trim();
  const storedIds = storedObjectListing ? storedObjectListing.split("\n").map((line) => line.split(/\s+/u)[0]) : [];
  if (!setEquality(storedIds, stagedClosureIds)) {
    throw new Error("Staged object storage contains objects outside the approved reachable closure.");
  }

  const revisionTree = gitText(versionedRoot, ["rev-parse", `${revisionSha}^{tree}`]).trim();

  const report = {
    strategy: "pack-object-canonical-transfer",
    headRef: headTarget,
    branch: "refs/heads/master",
    branchSource: branch.refname,
    branchSourceSha: branch.objectname,
    revisionSha,
    revisionTree,
    revisionSource: revisionRequest,
    releaseTag,
    revisionPinnedRef,
    selectedRefs: selectedRefs.map((entry) => `${entry.refname}@${entry.objectname}`),
    closureObjectCount: stagedClosureIds.length,
    closureObjectIdsSha256: closureDigest(stagedClosureIds),
    closurePackSha256: packSha,
    reconstructedConfigSha256: createHash("sha256").update(RECONSTRUCTED_CONFIG).digest("hex"),
  };
  return { stagingRoot, root: versionedRoot, report };
}

export async function copyArtifacts(fromDir, toDir, names) {
  await mkdir(toDir, { recursive: true });
  for (const name of names) {
    await cp(resolve(fromDir, name), resolve(toDir, name), { force: true });
  }
}

export async function readFileSum(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function extractZip(archivePath, targetDir) {
  const unzip = spawnSync("unzip", ["-q", archivePath, "-d", targetDir], { encoding: "utf8" });
  if (unzip.status === 0) return { ok: true, tool: "unzip" };
  const bsdtar = spawnSync("tar", ["-xf", archivePath, "-C", targetDir], { encoding: "utf8" });
  if (bsdtar.status === 0) return { ok: true, tool: "tar" };
  return { ok: false, detail: `${unzip.stderr}${bsdtar.stderr}`.trim() };
}
