import { createHash } from "node:crypto";

// Row-level release-baseline verification. The verifier provides raw commit text and
// the approved baseline row; these functions compare every required field against the
// row's own expectations — author fields against author expectations and committer
// fields against committer expectations — so neither field can substitute for the
// other, even when both originals happen to share dates.

function headerRow(rawCommit, header) {
  const match = new RegExp(`(?:^|\\n)${header} ([^\\n<>]+) <([^<>]+)> (\\d+) ([+-]\\d{4})$`, "mu").exec(rawCommit);
  if (!match) return null;
  return { name: match[1], email: match[2], epoch: Number(match[3]), offset: match[4] };
}

export function messageFromRawCommit(rawCommit) {
  const separator = rawCommit.indexOf("\n\n");
  return rawCommit.slice(separator + 2);
}

export function checkBaselineRow(rawCommit, expected) {
  const failures = [];
  const prefix = expected.tag;

  if (!rawCommit.includes("\ngpgsig ") && !rawCommit.includes("\n\n")) {
    failures.push(`${prefix}: raw commit text is missing required content.`);
  }

  // Exact message bytes are pinned by digest, independent of header parsing.
  const message = messageFromRawCommit(rawCommit);
  const messageDigest = createHash("sha256").update(message, "utf8").digest("hex");
  if (messageDigest !== expected.messageSha256) {
    failures.push(`${prefix}: message digest differs from the release baseline.`);
  }

  const author = headerRow(rawCommit, "author");
  const committer = headerRow(rawCommit, "committer");

  if (!author) {
    failures.push(`${prefix}: author headers could not be parsed.`);
  } else {
    if (author.name !== expected.authorName) {
      failures.push(`${prefix}: author name differs from the release baseline.`);
    }
    if (author.email !== expected.authorEmail) {
      failures.push(`${prefix}: author email differs from the release baseline.`);
    }
    if (author.epoch !== expected.authorEpoch) {
      failures.push(`${prefix}: preserved author epoch ${author.epoch} differs from the release baseline (${expected.authorEpoch}).`);
    }
    if (author.offset !== expected.authorOffset) {
      failures.push(`${prefix}: preserved author offset ${author.offset} differs from the release baseline (${expected.authorOffset}).`);
    }
  }

  if (!committer) {
    failures.push(`${prefix}: committer headers could not be parsed.`);
  } else {
    if (committer.name !== expected.committerName) {
      failures.push(`${prefix}: committer name differs from the release baseline.`);
    }
    if (committer.email !== expected.committerEmail) {
      failures.push(`${prefix}: committer email differs from the release baseline.`);
    }
    if (committer.epoch !== expected.committerEpoch) {
      failures.push(`${prefix}: preserved committer epoch ${committer.epoch} differs from the release baseline (${expected.committerEpoch}).`);
    }
    if (committer.offset !== expected.committerOffset) {
      failures.push(`${prefix}: preserved committer offset ${committer.offset} differs from the release baseline (${expected.committerOffset}).`);
    }
  }

  return { failures, author, committer, parents: parentsFromRawCommit(rawCommit), messageDigest };
}

export function parentsFromRawCommit(rawCommit) {
  const parents = [];
  for (const match of rawCommit.matchAll(/(?:^|\n)parent ([0-9a-f]{40})/gu)) {
    parents.push(match[1]);
  }
  return parents;
}
