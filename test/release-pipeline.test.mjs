import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isolatedGitEnv } from "../tools/stage-source.mjs";

// End-to-end regressions: the production build (tools/build.mjs) and the production
// release verifier (tools/verify-release.mjs) run inside disposable fixture checkouts
// that contain the real project sources and the real reachable public refs. These
// fixtures exercise the complete pipeline shapes that stageSource-only tests cannot:
// PR-style detached revisions, release tags behind an advanced master, and annotated
// tag object transfer.

const projectRoot = resolve(import.meta.dirname, "..");

function fixtureGit(root, args, options = {}) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: isolatedGitEnv(options.env ?? {}),
    input: options.input,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(" ")} (fixture): ${result.stderr.trim()}`);
  }
  return result.stdout;
}

async function makeProjectFixture() {
  const fixture = await mkdtemp(resolve(tmpdir(), "runyth-order-pipeline-"));
  await cp(projectRoot, fixture, {
    recursive: true,
    filter: (source) => {
      const relative = source.slice(projectRoot.length + 1);
      if (!relative) return true;
      return !relative.startsWith("dist/") && !relative.startsWith(".staging/") && !relative.startsWith("node_modules/") && !relative.endsWith(".zip");
    },
  });
  const releaseVersion = JSON.parse(readFileSync(resolve(fixture, "module.json"), "utf8")).version;
  const releaseTag = `refs/tags/v${releaseVersion}`;
  // The project lives on a case-insensitive mounted filesystem with permissive modes;
  // normalize copied content so the tracked file modes match the committed revision.
  const { chmod, readdir, stat } = await import("node:fs/promises");
  async function normalize(relative) {
    const entries = await readdir(resolve(fixture, relative || "."), { withFileTypes: true });
    for (const entry of entries) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await normalize(name);
      else {
        const metadata = await stat(resolve(fixture, name));
        if (metadata.mode & 0o200) await chmod(resolve(fixture, name), 0o644);
      }
    }
  }
  await normalize("");
  fixtureGit(fixture, ["init", "--quiet", "--initial-branch", "master"]);
  fixtureGit(fixture, ["config", "user.name", "Pipeline Fixture"]);
  fixtureGit(fixture, ["config", "user.email", "pipeline-fixture@example.test"]);
  // Publicly reachable release history arrives through remote-tracking refs so no
  // local branch assumption covers the detached/PR shapes.
  fixtureGit(fixture, [
    "fetch", "--quiet", projectRoot,
    "refs/heads/master:refs/remotes/origin/master",
    "refs/tags/v1.0.0:refs/tags/v1.0.0",
    "refs/tags/v1.0.1:refs/tags/v1.0.1",
    "refs/tags/v1.0.2:refs/tags/v1.0.2",
    "refs/tags/v1.0.3:refs/tags/v1.0.3",
    "refs/tags/v1.0.4:refs/tags/v1.0.4",
    "refs/tags/v1.0.5:refs/tags/v1.0.5",
    `refs/tags/v${releaseVersion}:refs/tags/v${releaseVersion}`,
  ]);
  fixtureGit(fixture, ["reset", "--quiet", "--mixed", "refs/remotes/origin/master"]);
  return { fixture, releaseVersion, releaseTag };
}

function runProductionStep(fixture, file, env = {}) {
  const result = spawnSync(process.execPath, [file], {
    cwd: fixture,
    env: isolatedGitEnv(env),
    encoding: "buffer",
  });
  return result;
}

function assertStepSucceeded(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} must succeed.\nSTDOUT: ${result.stdout?.toString().slice(-1200)}\nSTDERR: ${result.stderr?.toString().slice(-1200)}`,
  );
}

async function cleanup(fixture) {
  await rm(fixture, { recursive: true, force: true });
}

test("an annotated release version tag transfers and passes full production verification", async () => {
  const { fixture, releaseVersion, releaseTag } = await makeProjectFixture();
  try {
    // Replace the release tag with an annotated tag over the identical commit.
    const releaseCommit = fixtureGit(fixture, ["rev-parse", releaseTag]).trim();
    fixtureGit(fixture, ["tag", "-d", `v${releaseVersion}`]);
    fixtureGit(fixture, ["reset", "--quiet", "--mixed", "refs/remotes/origin/master"]);
    fixtureGit(fixture, [
      "-c",
      "tag.gpgSign=false",
      "tag",
      "-a",
      `v${releaseVersion}`,
      "-m",
      "fixture annotated release tag over the identical release commit",
      releaseCommit,
    ]);

    const build = runProductionStep(fixture, "tools/build.mjs", {
      RUNYTH_RELEASE_REF: releaseTag,
      RUNYTH_PUBLIC_RELEASE: "1",
    });
    assertStepSucceeded(build, "annotated-tag build");
    const verify = runProductionStep(fixture, "tools/verify-release.mjs");
    assertStepSucceeded(verify, "annotated-tag verification");
    const report = JSON.parse(readFileSync(resolve(fixture, "dist", `runyth-order-v${releaseVersion}-build-report.json`), "utf8"));
    assert.equal(report.gitSource.revisionSha, releaseCommit);
    assert.equal(report.gitSource.releaseTag, releaseTag);
    const tagAsListed = report.gitSource.selectedRefs.find((entry) => entry.startsWith(`${releaseTag}@`));
    assert.equal(tagAsListed, `${releaseTag}@${fixtureGit(fixture, ["rev-parse", releaseTag]).trim()}`);
  } finally {
    await cleanup(fixture);
  }
});

test("a release tag behind an advanced untagged master passes the full pipeline", async () => {
  const { fixture, releaseVersion, releaseTag } = await makeProjectFixture();
  try {
    fixtureGit(fixture, ["commit", "--quiet", "--allow-empty", "-m", "advanced master without a tag"]);
    const advancedTip = fixtureGit(fixture, ["rev-parse", "refs/heads/master"]).trim();

    const build = runProductionStep(fixture, "tools/build.mjs", {
      RUNYTH_RELEASE_REF: releaseTag,
      RUNYTH_PUBLIC_RELEASE: "1",
    });
    assertStepSucceeded(build, "advanced untagged build");
    const verify = runProductionStep(fixture, "tools/verify-release.mjs");
    assertStepSucceeded(verify, "advanced untagged verification");

    const report = JSON.parse(readFileSync(resolve(fixture, "dist", `runyth-order-v${releaseVersion}-build-report.json`), "utf8"));
    assert.equal(report.gitSource.branchSourceSha, advancedTip, "master retention keeps the exact public tip");
    assert.equal(report.gitSource.revisionSha, report.gitSource.selectedRefs.find((entry) => entry.startsWith(`${releaseTag}@`)).split("@")[1]);
    assert.equal(report.gitSource.revisionPinnedRef, null, "a tagged revision remains reachable through its own tag");
  } finally {
    await cleanup(fixture);
  }
});

test("a newer annotated master tag is retained while an earlier release builds", async () => {
  const { fixture, releaseVersion, releaseTag } = await makeProjectFixture();
  try {
    fixtureGit(fixture, ["commit", "--quiet", "--allow-empty", "-m", "advanced master with a tag"]);
    fixtureGit(fixture, [
      "-c",
      "tag.gpgSign=false",
      `tag`,
      "-a",
      "v1.1.0",
      "-m",
      "later annotated release tag retained for history",
    ]);
    const advancedTip = fixtureGit(fixture, ["rev-parse", "refs/heads/master"]).trim();

    const build = runProductionStep(fixture, "tools/build.mjs", {
      RUNYTH_RELEASE_REF: releaseTag,
      RUNYTH_PUBLIC_RELEASE: "1",
    });
    assertStepSucceeded(build, "advanced tagged build");
    const verify = runProductionStep(fixture, "tools/verify-release.mjs");
    assertStepSucceeded(verify, "advanced tagged verification");

    const report = JSON.parse(readFileSync(resolve(fixture, "dist", `runyth-order-v${releaseVersion}-build-report.json`), "utf8"));
    assert.equal(report.gitSource.branchSourceSha, advancedTip);
    assert.ok(report.gitSource.selectedRefs.some((entry) => entry.startsWith("refs/tags/v1.1.0@")), "the newer annotated tag ref is retained");
    assert.equal(report.gitSource.revisionPinnedRef, null);
  } finally {
    await cleanup(fixture);
  }
});

test("a PR-style detached revision builds and verifies with its pinned provenance ref", async () => {
  const { fixture, releaseVersion, releaseTag } = await makeProjectFixture();
  try {
    // GitHub-style PR checkout: the merge/head revision exists with no local branch.
    const base = fixtureGit(fixture, ["rev-parse", "refs/remotes/origin/master"]).trim();
    fixtureGit(fixture, ["checkout", "--quiet", "--detach", base]);
    fixtureGit(fixture, ["commit", "--quiet", "--allow-empty", "-m", "pull-request head revision"]);
    const prHead = fixtureGit(fixture, ["rev-parse", "HEAD"]).trim();
    fixtureGit(fixture, ["update-ref", "-d", "refs/heads/master"]);

    const build = runProductionStep(fixture, "tools/build.mjs");
    assertStepSucceeded(build, "PR-style build");
    const verify = runProductionStep(fixture, "tools/verify-release.mjs");
    assertStepSucceeded(verify, "PR-style verification");

    const report = JSON.parse(readFileSync(resolve(fixture, "dist", `runyth-order-v${releaseVersion}-build-report.json`), "utf8"));
    assert.equal(report.gitSource.revisionSha, prHead);
    assert.equal(report.gitSource.revisionPinnedRef, "refs/heads/staged-revision", "an unreachable revision is pinned explicitly");
    assert.equal(report.gitSource.branchSourceSha, base, "base master remains the retained public branch tip");
  } finally {
    await cleanup(fixture);
  }
});

test("mismatched public release tags fail the build before any archive is produced", async () => {
  const { fixture, releaseVersion, releaseTag } = await makeProjectFixture();
  try {
    const mismatchedTag = releaseVersion === "1.0.0" ? "refs/tags/v1.0.1" : `refs/tags/v1.0.${Number(releaseVersion.split(".")[1]) - 1}`;
    const result = runProductionStep(fixture, "tools/build.mjs", {
      RUNYTH_RELEASE_REF: mismatchedTag,
      RUNYTH_PUBLIC_RELEASE: "1",
    });
    assert.notEqual(result.status, 0, "the tag/manifest guard must reject a version mismatch");
    assert.match(result.stderr.toString(), /release revision|tag|manifest/i, "an explicit guard failure is reported");
  } finally {
    await cleanup(fixture);
  }
});
