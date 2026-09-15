import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { isolatedGitEnv } from "./git-env.mjs";

// Retained-closure helpers shared by staging snapshots, release verification, and
// tests. Every staging/verify path must derive its object IDs, counts and pack
// inputs from the same approved reachable set — the union of the selected refs.

const OBJECT_ID_PATTERN = /^[0-9a-f]{40}$/u;

export function gitBuffer(gitRoot, args, options = {}) {
  const result = spawnSync("git", ["-C", gitRoot, ...args], {
    encoding: "buffer",
    env: isolatedGitEnv(options.environment),
    cwd: gitRoot,
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `git ${args.join(" ")} failed (${result.status}, ${result.signal ?? ""}): ${result.stderr.toString("utf8").trim()}`,
    );
  }
  return result.stdout;
}

export function closureObjectIds(gitRoot, refTargetShas) {
  if (!refTargetShas.length) return [];
  const listing = gitBuffer(gitRoot, [
    "rev-list", "--objects", "--no-object-names", ...refTargetShas,
  ]).toString("utf8");
  return [...new Set(listing.split("\n").filter((id) => OBJECT_ID_PATTERN.test(id)))].sort();
}

export function storedObjectIds(gitRoot) {
  const listing = gitBuffer(gitRoot, [
    "cat-file", "--batch-all-objects", "--batch-check=%(objectname)",
  ]).toString("utf8");
  return [...new Set(listing.split("\n").map((line) => line.split(/\s+/u)[0]).filter((id) => OBJECT_ID_PATTERN.test(id)))].sort();
}

export function closureDigest(objectIds) {
  return createHash("sha256").update(`${objectIds.join("\n")}\n`, "utf8").digest("hex");
}

export function compareObjectSets(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((id) => !actualSet.has(id));
  const extras = [...actualSet].filter((id) => !expectedSet.has(id));
  return { missing, extras, identical: missing.length === 0 && extras.length === 0 };
}
