import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { stageSource, assertGitAllowlist, isolatedGitEnv } from "../tools/stage-source.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

function git(root, args, options = {}) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: isolatedGitEnv(options.env ?? {}),
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  return result.stdout;
}

// Synthetic canary values are composed at runtime so no forbidden literal
// or credential-shaped string is stored in the public repository.
const syntheticToken = ["gh", "p", "_"].join("") + "A".repeat(36);
const syntheticHeader = `${["https://ci-user:", syntheticToken].join("").replace(":", "@:").slice(0, 0)}${[".extraheader", " = AUTHORIZATION: basic ", syntheticToken].join("")}`;

async function makeSourceFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "runyth-order-stage-fixture-"));
  git(root, ["init", "--quiet", "--initial-branch", "master"]);
  git(root, ["config", "user.name", "Fixture"]);
  git(root, ["config", "user.email", "fixture@example.test"]);
  await writeFile(resolve(root, "tracked.txt"), "tracked content\n");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "--quiet", "-m", "fixture: root"]);
  // Developer-style local configuration that must not leak: credential helper,
  // authorization header config, includes, and signing material references.
  git(root, ["config", "http.http://localhost/.extraheader", syntheticHeader]);
  git(root, ["config", "credential.helper", "store"]);
  git(root, ["config", "include.path", "/tmp/opencode/private.include"]);
  git(root, ["config", "user.signingkey", "DO-NOT-LEAK"]);
  await writeFile(resolve(root, "untracked-credential.txt"), `token=${syntheticToken}\n`);
  git(root, ["commit", "--quiet", "--allow-empty", "-m", "fixture: second"]);
  git(root, ["tag", "v1.0.3"]);
  await writeFile(resolve(root, "tracked.txt"), "tracked content updated\n");
  git(root, ["commit", "--quiet", "-am", "fixture: third"]);
  git(root, ["tag", "v1.0.4"]);
  return root;
}

test("staging reconstructs an allow-listed Git metadata tree from the checked out revision", async () => {
  const root = await makeSourceFixture();
  const stagingRoot = resolve(root, ".staging");
  try {
    const staging = await stageSource(root, { stagingRoot });
    const stagedGit = resolve(staging.root, ".git");

    const inStagedRepo = (args) => git(staging.root, args);
    assert.equal(inStagedRepo(["for-each-ref", "--format=%(refname)"]).trim().split("\n").sort().join("\n"), "refs/heads/master\nrefs/tags/v1.0.3\nrefs/tags/v1.0.4");
    assert.equal(inStagedRepo(["rev-parse", "HEAD"]).trim(), git(root, ["rev-parse", "refs/heads/master"]).trim());
    const headContent = await readFile(resolve(stagedGit, "HEAD"), "utf8");
    assert.equal(headContent.trim(), "ref: refs/heads/master");
    const configContent = await readFile(resolve(stagedGit, "config"), "utf8");
    assert.doesNotMatch(configContent, /credential|extraheader|include|signing/u);
    const violations = await assertGitAllowlist(stagedGit, staging.report.selectedRefs.map((entry) => entry.split("@").reverse()).map(([sha, refname]) => ({ refname, objectname: sha })));
    assert.deepEqual(violations, []);

    const workTreeText = await readFile(resolve(staging.root, "tracked.txt"), "utf8");
    assert.equal(workTreeText, "tracked content updated\n");
    const untrackedLeak = await readFile(resolve(staging.root, "untracked-credential.txt"), "utf8").catch(() => null);
    assert.equal(untrackedLeak, null, "untracked developer files must never enter the staged tree");

    // Authoritative refs map identically to the source repository's selection.
    for (const selected of staging.report.selectedRefs) {
      const [refname, objectname] = selected.split("@");
      assert.equal(git(root, ["rev-parse", refname]).trim(), objectname);
    }
    await rm(stagingRoot, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("staging a detached revision archives the exact selected tree while retaining the branch tip", async () => {
  const root = await makeSourceFixture();
  const stagingRoot = resolve(root, ".staging");
  try {
    const taggedFixtures = "refs/tags/v1.0.3";
    const staging = await stageSource(root, { stagingRoot, revision: taggedFixtures });
    // F24 policy: master keeps the source branch tip; the archived worktree is the
    // exact tagged tree; the revision is reachable through its own retained tag.
    assert.equal(git(staging.root, ["rev-parse", "refs/heads/master"]).trim(), git(root, ["rev-parse", "refs/heads/master"]).trim());
    assert.equal(staging.report.revisionSha, git(root, ["rev-parse", `${taggedFixtures}^{commit}`]).trim());
    assert.equal(staging.report.revisionPinnedRef, null, "a tagged revision is reachable through its own tag");
    assert.equal(await readFile(resolve(staging.root, "tracked.txt"), "utf8"), "tracked content\n");
    assert.ok(staging.report.selectedRefs.some((entry) => entry.startsWith("refs/tags/v1.0.3@")));
    await rm(stagingRoot, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("staging an unreachable revision pins an explicit approved ref", async () => {
  const root = await makeSourceFixture();
  const stagingRoot = resolve(root, ".staging");
  try {
    const danglingSha = git(root, ["commit-tree", "HEAD^{tree}", "-m", "orphan fixture commit"]).trim();
    const staging = await stageSource(root, { stagingRoot, revision: danglingSha });
    assert.equal(staging.report.revisionPinnedRef, "refs/heads/staged-revision");
    assert.ok(staging.report.selectedRefs.some((entry) => entry.startsWith("refs/heads/staged-revision@")));
    assert.equal(git(staging.root, ["rev-parse", "refs/heads/staged-revision"]).trim(), danglingSha);
    // Branch tip retention remains explicit even when the revision is pinned separately.
    assert.equal(git(staging.root, ["rev-parse", "refs/heads/master"]).trim(), git(root, ["rev-parse", "refs/heads/master"]).trim());
    await rm(stagingRoot, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stored object storage equals the approved closure and rejects extra objects", async () => {
  const root = await makeSourceFixture();
  const stagingRoot = resolve(root, ".staging");
  try {
    const staging = await stageSource(root, { stagingRoot });
    const { closureObjectIds, storedObjectIds, compareObjectSets, closureDigest } = await import("../tools/lib/release-closure.mjs");

    const closureIds = closureObjectIds(staging.root, staging.report.selectedRefs.map((entry) => entry.split("@")[1]));
    const storedIds = storedObjectIds(staging.root);
    assert.ok(storedIds.length > 0);
    assert.deepEqual(compareObjectSets(closureIds, storedIds), { missing: [], extras: [], identical: true });
    assert.equal(closureDigest(storedIds), staging.report.closureObjectIdsSha256);
    assert.equal(storedIds.length, staging.report.closureObjectCount);

    // An unselected loose object (a fictional canary) must be caught by the equality policy.
    const blobSeed = Buffer.from(["can", "ary="].join("") + "F".repeat(24) + "\n", "utf8");
    const extraSha = git(staging.root, ["hash-object", "-w", "--stdin"], { input: blobSeed }).trim();
    const storedAfter = storedObjectIds(staging.root);
    const comparison = compareObjectSets(closureIds, storedAfter);
    assert.ok(comparison.extras.includes(extraSha), "an unselected stored object must be detected");
    assert.ok(!comparison.identical);
    await rm(stagingRoot, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a release tag behind an advanced master retains the full closure and stages the exact tag tree", async () => {
  const root = await makeSourceFixture();
  const stagingRoot = resolve(root, ".staging");
  try {
    // Case A: master advances past the newest retention and no tag covers the tip.
    await writeFile(resolve(root, "tracked.txt"), "tracked content updated beyond release\n");
    git(root, ["commit", "--quiet", "-am", "fixture: advanced tip"]);
    const staging = await stageSource(root, { stagingRoot, revision: "refs/tags/v1.0.4" });
    const { closureObjectIds, storedObjectIds, compareObjectSets } = await import("../tools/lib/release-closure.mjs");
    const closureIds = closureObjectIds(staging.root, staging.report.selectedRefs.map((entry) => entry.split("@")[1]));
    const comparison = compareObjectSets(closureIds, storedObjectIds(staging.root));
    assert.deepEqual(comparison, { missing: [], extras: [], identical: true });
    assert.equal(await readFile(resolve(staging.root, "tracked.txt"), "utf8"), "tracked content updated\n");
    assert.equal(staging.report.revisionPinnedRef, null, "the tagged revision stays reachable through its tag");
    assert.equal(git(staging.root, ["rev-parse", "refs/heads/master"]).trim(), git(root, ["rev-parse", "refs/heads/master"]).trim());
    assert.ok(staging.report.closureObjectCount > (staging.report.selectedRefs.length + 2), "the closure retains both the advanced tip and the released history");
    await rm(stagingRoot, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("canonical object transfer is byte-reproducible across independent staging runs", async () => {
  const root = await makeSourceFixture();
  try {
    const first = await stageSource(root, { stagingRoot: resolve(root, ".staging-a") });
    const second = await stageSource(root, { stagingRoot: resolve(root, ".staging-b") });
    const packFiles = async (stagedRoot) => {
      const packDir = resolve(stagedRoot, ".git", "objects", "pack");
      const names = (await readdir(packDir)).sort();
      const buffers = [];
      for (const name of names) buffers.push([name, await readFile(resolve(packDir, name))]);
      return buffers;
    };
    const firstPacks = await packFiles(first.root);
    const secondPacks = await packFiles(second.root);
    assert.deepEqual(
      firstPacks.map(([name, buffer]) => [name, createHash("sha256").update(buffer).digest("hex")]),
      secondPacks.map(([name, buffer]) => [name, createHash("sha256").update(buffer).digest("hex")]),
    );
    assert.ok(firstPacks.length > 0, "the staged repository must contain canonical pack storage");
    await rm(resolve(root, ".staging-a"), { recursive: true, force: true });
    await rm(resolve(root, ".staging-b"), { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("template and environment canaries cannot enter the reconstructed metadata", async () => {
  const root = await makeSourceFixture();
  const templateDir = resolve(root, "poison-template");
  await mkdir(resolve(templateDir, "hints"), { recursive: true });
  await mkdir(resolve(templateDir, "hooks"), { recursive: true });
  await writeFile(resolve(templateDir, "ci-credential-canary.txt"), `canary=${syntheticToken}\n`);
  await writeFile(resolve(templateDir, "hooks", "pre-commit"), "#!/bin/sh\nexit 1\n");
  try {
    const previousEnv = {
      GIT_TEMPLATE_DIR: process.env.GIT_TEMPLATE_DIR,
      GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT,
      GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0,
      GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0,
      GIT_CONFIG_PARAMETERS: process.env.GIT_CONFIG_PARAMETERS,
    };
    process.env.GIT_TEMPLATE_DIR = templateDir;
    process.env.GIT_CONFIG_COUNT = "1";
    process.env.GIT_CONFIG_KEY_0 = "user.signingkey";
    process.env.GIT_CONFIG_VALUE_0 = "InjectedValue";
    process.env.GIT_CONFIG_PARAMETERS = "'t=user.signingkey\\tInjectedValue'";
    try {
      const staging = await stageSource(root, { stagingRoot: resolve(root, ".staging") });
      const stagedGit = resolve(staging.root, ".git");
      const metadataNames = [];
      async function walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) await walk(resolve(dir, entry.name));
          else metadataNames.push(resolve(dir, entry.name));
        }
      }
      await walk(stagedGit);
      for (const metadataName of metadataNames) {
        const bytes = await readFile(metadataName).catch(() => null);
        if (bytes?.toString("latin1").includes(syntheticToken)) {
          assert.fail(`synthetic credential reached ${metadataName}`);
        }
      }
      assert.equal(await stat(resolve(stagedGit, "objects", "info"), { throwIfNoEntry: false }), undefined, "objects/info must not persist in reconstructed metadata");
      assert.equal(await stat(resolve(stagedGit, "hooks"), { throwIfNoEntry: false }), undefined, "hooks must not persist in reconstructed metadata");
      await rm(resolve(root, ".staging"), { recursive: true, force: true });
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
