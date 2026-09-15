// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, posix, relative, resolve, sep } from "node:path";
import { walk } from "./lib/files.mjs";

const RELATIVE_SPECIFIER = /(["'])(\.\.?\/[^"']+)\1/gu;

function slash(path) {
  return path.split(sep).join("/");
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

function resolveSourceSpecifier(importer, specifier) {
  return posix.normalize(posix.join(posix.dirname(importer), specifier));
}

export async function analyzeSourceGraph(root) {
  const srcRoot = resolve(root, "src");
  const sourceFiles = (await walk(srcRoot))
    .filter((entry) => entry.path.endsWith(".mjs"))
    .map((entry) => entry.path)
    .sort((a, b) => a.localeCompare(b));
  const exact = new Set(sourceFiles);
  const edges = [];
  const failures = [];

  for (const sourcePath of sourceFiles) {
    const source = await readFile(resolve(srcRoot, sourcePath), "utf8");
    for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
      const specifier = match[2];
      const target = resolveSourceSpecifier(sourcePath, specifier);
      if (target.startsWith("../") || target === "..") {
        failures.push(`${sourcePath}: import escapes src/: ${specifier}`);
        continue;
      }
      if (!exact.has(target)) {
        const lower = sourceFiles.find((candidate) => candidate.toLowerCase() === target.toLowerCase());
        failures.push(
          lower
            ? `${sourcePath}: case mismatch ${specifier}; exact packaged path is ${lower}`
            : `${sourcePath}: unresolved import ${specifier} -> ${target}`,
        );
        continue;
      }
      edges.push({ importer: sourcePath, specifier, target });
    }
  }

  return { sourceFiles, edges, failures };
}

function safeName(index) {
  return `m${String(index).padStart(2, "0")}.mjs`;
}

export async function emitRuntimeGraph(root, { version, moduleId, moduleTitle }) {
  const graph = await analyzeSourceGraph(root);
  if (graph.failures.length) throw new Error(`Invalid source import graph:\n${graph.failures.join("\n")}`);

  const runtimeBase = `runtime/v${version}`;
  const runtimeRoot = resolve(root, runtimeBase);
  await rm(resolve(root, "runtime"), { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });

  const mapping = Object.fromEntries(graph.sourceFiles.map((sourcePath, index) => [sourcePath, safeName(index)]));
  const srcRoot = resolve(root, "src");
  const emitted = [];

  for (const sourcePath of graph.sourceFiles) {
    const input = await readFile(resolve(srcRoot, sourcePath), "utf8");
    const output = input.replace(RELATIVE_SPECIFIER, (whole, quote, specifier) => {
      const target = resolveSourceSpecifier(sourcePath, specifier);
      const emittedTarget = mapping[target];
      if (!emittedTarget) throw new Error(`${sourcePath}: cannot emit unresolved import ${specifier}`);
      return `${quote}./${emittedTarget}${quote}`;
    });
    const runtimeName = mapping[sourcePath];
    await writeFile(resolve(runtimeRoot, runtimeName), output);
    emitted.push({
      source: `src/${sourcePath}`,
      runtime: `${runtimeBase}/${runtimeName}`,
      sha256: digest(output),
    });
  }

  const mainRuntime = mapping["main.mjs"];
  if (!mainRuntime) throw new Error("src/main.mjs is missing from the source graph.");
  const bootstrap = `const MODULE_ID = ${JSON.stringify(moduleId)};\nconst MODULE_TITLE = ${JSON.stringify(moduleTitle)};\nlet reported = false;\n\ntry {\n  await import(${JSON.stringify(`./${mainRuntime}`)});\n} catch (error) {\n  if (!reported) {\n    reported = true;\n    console.error(\`${moduleTitle} | Fatal runtime initialization failure\`, error);\n    try {\n      const module = globalThis.game?.modules?.get?.(MODULE_ID);\n      if (module) module.api = undefined;\n    } catch {\n      // Do not mask the original runtime loading failure.\n    }\n    try {\n      globalThis.Hooks?.once?.(\"ready\", () => {\n        globalThis.ui?.notifications?.error?.(\`${moduleTitle}: required runtime resources failed to load. Reinstall the module and reload the world.\`, { permanent: true });\n      });\n    } catch {\n      // Console reporting above is always available.\n    }\n  }\n}\n`;
  await writeFile(resolve(runtimeRoot, "bootstrap.mjs"), bootstrap);

  const runtimeEdges = graph.edges.map((edge) => ({
    importer: `${runtimeBase}/${mapping[edge.importer]}`,
    target: `${runtimeBase}/${mapping[edge.target]}`,
  }));
  const manifest = {
    schemaVersion: 1,
    moduleId,
    moduleVersion: version,
    entrypoint: `${runtimeBase}/bootstrap.mjs`,
    sourceEntrypoint: "src/main.mjs",
    emittedEntrypoint: `${runtimeBase}/${mainRuntime}`,
    sourceFiles: graph.sourceFiles.length,
    edges: runtimeEdges,
    files: emitted,
  };
  await writeFile(resolve(runtimeRoot, "graph.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function verifyRuntimeGraph(root, { version, moduleId }) {
  const runtimeBase = `runtime/v${version}`;
  const runtimeRoot = resolve(root, runtimeBase);
  const graph = JSON.parse(await readFile(resolve(runtimeRoot, "graph.json"), "utf8"));
  const failures = [];
  if (graph.moduleId !== moduleId) failures.push(`Runtime graph module ID is ${graph.moduleId}, expected ${moduleId}.`);
  if (graph.moduleVersion !== version) failures.push(`Runtime graph version is ${graph.moduleVersion}, expected ${version}.`);
  if (graph.entrypoint !== `${runtimeBase}/bootstrap.mjs`) failures.push("Runtime graph entrypoint is invalid.");

  const runtimeFiles = new Set((await walk(runtimeRoot)).map((entry) => `${runtimeBase}/${entry.path}`));
  for (const file of graph.files ?? []) {
    if (!runtimeFiles.has(file.runtime)) failures.push(`Runtime graph references missing file ${file.runtime}.`);
    else {
      const text = await readFile(resolve(root, file.runtime), "utf8");
      if (digest(text) !== file.sha256) failures.push(`Runtime file hash mismatch: ${file.runtime}.`);
    }
  }
  for (const edge of graph.edges ?? []) {
    if (!runtimeFiles.has(edge.importer)) failures.push(`Runtime edge importer is missing: ${edge.importer}.`);
    if (!runtimeFiles.has(edge.target)) failures.push(`Runtime edge target is missing: ${edge.target}.`);
    if (!edge.importer.startsWith(`${runtimeBase}/`) || !edge.target.startsWith(`${runtimeBase}/`)) {
      failures.push(`Runtime edge escapes versioned module root: ${edge.importer} -> ${edge.target}.`);
    }
  }
  return { graph, failures };
}
