import assert from "node:assert/strict";
import { mkdtemp, readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { prohibitedMatches, companionVariantMatches, projectFileInventory } from "../tools/lib/release-scan.mjs";

function buffer(text) {
  return Buffer.from(text, "utf8");
}

// Synthetic credential shapes are assembled at runtime so the repository never
// embeds a complete, functional token-shaped canary.
const syntheticClassic = ["g", "h", "p", "_"].join("") + "A".repeat(36);
const syntheticFineGrained = ["github", "_pat_"].join("") + "B".repeat(40);
const syntheticBasicUrl = ["ht", "tps://", "ci-user:"].join("") + "C".repeat(20) + "@unit.test/repo.git";

test("harmless repository content does not trigger credential or identity detection", async () => {
  const scannerSources = [
    "tools/lib/release-scan.mjs",
    "tools/verify-release.mjs",
    "tools/stage-source.mjs",
  ];
  for (const path of scannerSources) {
    const source = await readFile(new URL(`../${path}`, import.meta.url));
    assert.deepEqual(prohibitedMatches(source), [], `${path} must not self-match the credential scanner`);
    assert.deepEqual(companionVariantMatches(source), [], `${path} must not self-match the identity scanner`);
  }

  const harmlessProse = buffer(`
    The validator suggests an ordinary campaign-facing example.
    See the flavour text about the martial trainee and the assassination plot.
    Links to the repository use https://github.com/example/example.
    Documentation covers pattern ${"{stub}"} syntax and the release checklist.
  `);
  assert.deepEqual(prohibitedMatches(harmlessProse), [], "ordinary prose and URLs must not match");
  assert.deepEqual(companionVariantMatches(harmlessProse), [], "ordinary RPG vocabulary must not match");
});

test("representative embedded credential shapes are detected in arbitrary content", () => {
  assert.ok(prohibitedMatches(buffer(`const token = "${syntheticClassic}";`)).includes("classic platform access token"));
  assert.ok(prohibitedMatches(buffer(`config: ${syntheticFineGrained}`)).includes("fine-grained platform access token"));
  assert.ok(prohibitedMatches(buffer(`origin ${syntheticBasicUrl}`)).includes("URL with embedded credentials"));
  const composedExtraheader = [
    "ex", "traheader", " = ",
    "AU", "THORIZATION: ba", "sic ",
  ].join("") + "D-OriginTokenValue0987654321";
  assert.ok(
    prohibitedMatches(buffer(composedExtraheader)).includes("HTTP/Bearer authorization credential header"),
  );
  assert.ok(
    prohibitedMatches(buffer(`${["Au", "th", "orization"].join("")}: ${["ba", "sic"].join("")} ${["D", "-Origin", "Token", "Value", "09876", "54321"].join("")}`)).includes("HTTP/Bearer authorization credential header"),
  );
  assert.ok(
    prohibitedMatches(buffer(`${["Authorization:", "Bearer"].join(" ")} D-OriginTokenValue0987654321`)).includes("HTTP/Bearer authorization credential header"),
  );
  assert.ok(
    prohibitedMatches(buffer(["ht", "tp://ci-", "user:"].join("") + "d".repeat(16) + "@example.invalid/path")).includes("URL with embedded credentials"),
  );
  const machineAliasUrl = `${["ht", "tps://"].join("")}${["x-access", "-token:"].join("")}ci:${"T".repeat(12)}@unit.test/repo.git`;
  assert.ok(
    prohibitedMatches(buffer(`origin ${machineAliasUrl}\n`)).includes("machine-account token URL alias"),
  );
  const pem = [
    "-----BEGIN OPENSSH PRIVATE",
    `KEY-----${"Z".repeat(8)}`,
    "-----END OPENSSH PRIVATE",
    "KEY-----",
  ].join("\n");
  assert.ok(prohibitedMatches(buffer(pem)).includes("private key material"));
});

test("companion identity detection covers spaced, hyphenated, underscored and compact variants", () => {
  const label = ["a", "ssassin"].join("");
  const digit = "1424";
  const other = ["m", "artial"].join("");
  const discipline = ["mag", "ic"].join("");
  const baselineWord = ["ca", "mpaign"].join("");
  const shiftedWord = ["ba", "seline"].join("");

  assert.ok(companionVariantMatches(buffer(`${label} ${digit}`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`${label}-${digit}`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`${label}_${digit}`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`${label}${digit}`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`${other} ${discipline}`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`${other}-${discipline}`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`the ${baselineWord} ${shiftedWord} wording`)).length > 0);
  assert.ok(companionVariantMatches(buffer(`${baselineWord}_${shiftedWord}`)).length > 0);
});

test("negative fixtures reject similar but safe wording without campaign material", () => {
  const prose = buffer(`
    A martial artist trains diligently.
    The assassin 42 plot was rejected for numbering reasons.
    Our example baseline guidance uses explicit versions.
  `);
  const hits = companionVariantMatches(prose);
  assert.deepEqual(hits.filter((hit) => hit.endsWith("1424")), []);
  assert.deepEqual(hits.filter((hit) => hit.includes("magic")), []);
  const assertedBaselineToken = ["ca", "mpaign", "ba", "seline"].join("");
  assert.deepEqual(hits.filter((hit) => hit.replaceAll(" ", "").includes(assertedBaselineToken)), []);
});

test("project file traversal starts at the archive root and fails closed", async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), "runyth-order-inventory-"));
  try {
    await mkdir(resolve(fixture, "src"), { recursive: true });
    await mkdir(resolve(fixture, ".git", "objects"), { recursive: true });
    await writeFile(resolve(fixture, "module.json"), "{}\n");
    await writeFile(resolve(fixture, "src", "example.mjs"), "export const example = 1;\n");
    await writeFile(resolve(fixture, ".git", "HEAD"), "ref: refs/heads/master\n");

    const inventory = await projectFileInventory(fixture);
    assert.deepEqual([...inventory.keys()].sort(), ["module.json", "src/example.mjs"].sort());
    assert.equal(inventory.get("src/example.mjs").toString(), "export const example = 1;\n");
    assert.ok(!inventory.has(".git/HEAD"), "metadata directories are deliberately excluded from the project inventory");

    await assert.rejects(
      () => projectFileInventory(resolve(fixture, "does-not-exist")),
      /unreadable/i,
    );

    await rm(fixture, { recursive: true, force: true });
    // A missing root (deleted dir) must fail loudly rather than scan zero files.
    await assert.rejects(() => projectFileInventory(fixture), /unreadable/i);
  } finally {
    await rm(fixture, { recursive: true, force: true }).catch(() => undefined);
  }
});

test("baseline row checks enforce author and committer fields independently", async () => {
  const { checkBaselineRow } = await import("../tools/lib/release-baseline-check.mjs");

  // Synthetic commit bodies are assembled from fragments so divergent author and
  // committer dates cannot accidentally substitute for each other in verification.
  const commitBody = ({ epoch: numberEpoch, offset, name, email }) => [
    "tree 1111111111111111111111111111111111111111",
    `author ${name} <${email}> ${numberEpoch} ${offset}`,
    `committer ${name} <${email}> ${numberEpoch + 900} ${offset === "+0200" ? "+0300" : "+0200"}`,
    "",
    "fixture message\n",
  ].join("\n");
  const expected = {
    tag: "refs/tags/v1.0.0",
    authorName: "Fixture Author",
    authorEmail: "fixture@example.test",
    authorEpoch: 1785060000,
    authorOffset: "+0200",
    committerName: "Fixture Author",
    committerEmail: "fixture@example.test",
    committerEpoch: 1785060900,
    committerOffset: "+0300",
    messageSha256: undefined,
  };
  expected.messageSha256 = (await import("node:crypto")).createHash("sha256").update("fixture message\n", "utf8").digest("hex");

  const clean = checkBaselineRow(commitBody({ epoch: expected.authorEpoch, offset: "+0200", name: expected.authorName, email: expected.authorEmail }), expected);
  assert.deepEqual(clean.failures, [], "an exactly matching row with divergent author/committer dates must pass");

  const authorDrift = checkBaselineRow(
    commitBody({ epoch: expected.authorEpoch + 100, offset: "+0300", name: expected.authorName, email: expected.authorEmail }),
    expected,
  );
  assert.ok(authorDrift.failures.some((line) => line.includes("author epoch")), "an author epoch change must be rejected");
  assert.ok(authorDrift.failures.some((line) => line.includes("author offset")), "an author offset change must be rejected");

  const committerDriftRow = [
    `tree 1111111111111111111111111111111111111111`,
    `author ${expected.authorName} <${expected.authorEmail}> ${expected.authorEpoch} ${expected.authorOffset}`,
    `committer ${expected.committerName} <other@example.test> ${expected.committerEpoch} ${expected.committerOffset}`,
    "",
    "fixture message\n",
  ].join("\n");
  const committerDrift = checkBaselineRow(committerDriftRow, expected);
  assert.ok(committerDrift.failures.some((line) => line.includes("committer email")), "a committer identity change must be rejected");
});
