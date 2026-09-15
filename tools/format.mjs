// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { walk, isExcludedSourcePath } from "./lib/files.mjs";

const root = resolve(import.meta.dirname, "..");
const write = process.argv.includes("--write");
const supported = new Set([".mjs", ".json", ".md", ".css", ".yml", ".yaml", ".hbs", ".txt"]);
const failures = [];

for (const file of await walk(root)) {
  if (isExcludedSourcePath(file.path) || file.path.startsWith("node_modules/") || !supported.has(extname(file.path))) continue;
  const original = await readFile(file.absolute, "utf8");
  let formatted = original.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  formatted = formatted
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n")
    .replace(/\n*$/u, "\n");
  if (extname(file.path) === ".json") {
    formatted = `${JSON.stringify(JSON.parse(formatted), null, 2)}\n`;
  }
  if (formatted !== original) {
    if (write) await writeFile(file.absolute, formatted);
    else failures.push(file.path);
  }
}

if (failures.length) {
  console.error(`Formatting differs in ${failures.length} file(s):`);
  failures.forEach((path) => console.error(`- ${path}`));
  process.exitCode = 1;
} else {
  console.log(write ? "Formatting completed." : "Formatting verification passed.");
}
