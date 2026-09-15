import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

// All detection literals are composed from fragments so the checker repository
// never embeds a complete credential-shaped or campaign-shaped string.
const composed = (...parts) => parts.join("");

export const prohibitedPatterns = [
  {
    source: "classic platform access token",
    pattern: new RegExp(`${composed("g", "h")}[posr]_[A-Za-z0-9]{20,}`, "u"),
  },
  {
    source: "fine-grained platform access token",
    pattern: new RegExp(`${composed("github", "_pat_")}[A-Za-z0-9_]{20,}`, "u"),
  },
  {
    source: "machine-account token URL alias",
    pattern: new RegExp(`x-access-${composed("to", "ken")}:[^@\\s]{6,}@`, "iu"),
  },
  {
    source: "URL with embedded credentials",
    pattern: new RegExp(`${composed("ht", "tp")}s?:\\/\\/[^@\\s/]+:[^@\\s]+@`, "u"),
  },
  {
    source: "HTTP/Bearer authorization credential header",
    pattern: new RegExp(
      `(?:^|\\r?\\n)\\s*(?:${composed("ex", "tra", "hea", "der")}\\s*=\\s*)?${composed("Au", "th", "orization")}\\s*:\\s*(?:${composed("ba", "sic")}|${composed("be", "ar", "er")})\\s+\\S`,
      "iu",
    ),
  },
  {
    source: "private key material",
    pattern: new RegExp(
      `${composed("-----", "BE", "GIN ")}(?:RSA |OPENSSH |EC |PGP )?${composed("PR")}IVATE\\s+${composed("KE", "Y")}-----`,
      "u",
    ),
  },
  {
    source: "removed campaign identity reference",
    pattern: new RegExp(`${composed("orph", "an")}[\\s_-]*${composed("bl", "ack")}`, "iu"),
  },
];

// Distinctive companion display names and assumed baseline phrasings are matched on
// separator-normalized text so spaced/hyphenated/underscored/compact variants are covered.
export const companionCandidates = [
  composed("a", "ssassin", " ", "1", "424"),
  composed("assassin", "1424"),
  composed("m", "ar", "tial", " ", "ma", "gic"),
  composed("martial", "magic"),
  composed("c", "amp", "aign", " ", "ba", "se", "line"),
];

function candidateLabel(candidate) {
  return [...candidate].filter((character) => character !== " ").join("");
}

export function prohibitedMatches(buffer) {
  const decoded = buffer.toString("latin1");
  return prohibitedPatterns
    .filter(({ pattern }) => pattern.test(decoded))
    .map(({ source }) => source);
}

export function companionVariantMatches(buffer) {
  const decoded = buffer.toString("latin1");
  const normalized = decoded.toLowerCase().replace(/[-_\s]+/gu, " ");
  const compact = normalized.replaceAll(" ", "");
  return companionCandidates
    .filter((candidate) => {
      const strongForm = candidate.toLowerCase();
      return normalized.includes(strongForm) || compact.includes(strongForm.replaceAll(" ", ""));
    })
    .map(candidateLabel);
}

// Archive project-file inventory: traversal starts exactly at the extracted archive
// root with an empty relative prefix. Missing roots and unexpectedly empty inventories
// are errors, not silent zero-file scans.
const EXCLUDED_TRAVERSAL_DIRS = new Set([".git", "dist", "node_modules", ".staging"]);

export async function projectFileInventory(archiveRoot) {
  let rootStat;
  try {
    rootStat = await statSync(archiveRoot);
  } catch (error) {
    throw new Error(`Extracted archive root is unreadable: ${archiveRoot} (${error.code ?? "ENOENT"})`);
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`Extracted archive root is not a directory: ${archiveRoot}`);
  }
  const inventory = new Map();

  function walkSync(relative) {
    const entries = readdirSync(resolve(archiveRoot, relative || "."), { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!relative && EXCLUDED_TRAVERSAL_DIRS.has(entry.name)) continue;
        walkSync(name);
      } else if (entry.isFile()) {
        inventory.set(name, readFileSync(resolve(archiveRoot, name)));
      }
    }
  }
  walkSync("");
  if (inventory.size === 0) {
    throw new Error(`Extracted archive root contains no project files: ${archiveRoot}`);
  }
  return inventory;
}
