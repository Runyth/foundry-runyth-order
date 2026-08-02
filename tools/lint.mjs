import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { walk } from "./lib/files.mjs";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const prohibited = [
  [/(?:^|\W)eval\s*\(/u, "eval is prohibited"],
  [/new\s+Function\s*\(/u, "Function constructor is prohibited"],
  [/game\.socket\.emit/u, "direct game socket mutation is prohibited"],
  [/socketlib/u, "socketlib dependency is prohibited in the thin core"],
  [/FormDataExtended/u, "legacy FormDataExtended usage is prohibited"],
  [/extends\s+Application(?:\s|\{)/u, "legacy Application inheritance is prohibited"],
  [/renderActorSheet(?!V2)/u, "legacy Actor-sheet render hook is prohibited"],
  [/\bmergeObject\b/u, "legacy mergeObject helper is prohibited"],
];

for (const file of await walk(resolve(root, "src"))) {
  if (extname(file.path) !== ".mjs") continue;
  const source = await readFile(file.absolute, "utf8");
  for (const [pattern, message] of prohibited) {
    if (pattern.test(source)) failures.push(`${file.path}: ${message}`);
  }
  if (file.path === "ui/launchers.mjs") {
    if (/\bonClick\s*:/u.test(source)) failures.push(`${file.path}: Foundry V12 SceneControlTool.onClick is prohibited`);
    if (/Array\.isArray\(controls\)/u.test(source)) failures.push(`${file.path}: Foundry V12 Scene Controls array compatibility is prohibited`);
    if (!/\bonChange\s*:/u.test(source)) failures.push(`${file.path}: Foundry V13 SceneControlTool.onChange is required`);
  }
  const syntax = spawnSync(process.execPath, ["--check", file.absolute], { encoding: "utf8" });
  if (syntax.status !== 0) failures.push(`${file.path}: ${syntax.stderr.trim()}`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Runtime lint and syntax audit passed.");
}
