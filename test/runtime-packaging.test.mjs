// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { analyzeSourceGraph, emitRuntimeGraph, verifyRuntimeGraph } from "../tools/runtime-graph.mjs";

const root = resolve(import.meta.dirname, "..");

test("source import graph resolves every relative ESM dependency exactly", async () => {
  const graph = await analyzeSourceGraph(root);
  assert.equal(graph.failures.length, 0);
  assert.ok(graph.sourceFiles.includes("main.mjs"));
  assert.ok(graph.edges.some((edge) => edge.target === "core/registry.mjs"));
  assert.ok(graph.edges.every((edge) => !edge.target.startsWith("../")));
});

test("generated browser graph is complete, hashed, versioned, and manifest-aligned", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "module.json"), "utf8"));
  const result = await verifyRuntimeGraph(root, { version: manifest.version, moduleId: manifest.id });
  assert.deepEqual(result.failures, []);
  assert.equal(result.graph.entrypoint, manifest.esmodules[0]);
  assert.match(result.graph.entrypoint, /^runtime\/v1\.0\.6\/bootstrap\.mjs$/u);
  assert.equal(result.graph.sourceFiles, 17);
  assert.equal(result.graph.files.length, 17);
  assert.ok(result.graph.files.every((file) => /^runtime\/v1\.0\.6\/m\d{2}\.mjs$/u.test(file.runtime)));
  assert.ok(result.graph.edges.every((edge) => edge.importer.startsWith("runtime/v1.0.6/") && edge.target.startsWith("runtime/v1.0.6/")));
});

test("guarded bootstrap contains one fatal boundary and no direct source import", async () => {
  const bootstrap = await readFile(resolve(root, "runtime/v1.0.6/bootstrap.mjs"), "utf8");
  assert.match(bootstrap, /await import\("\.\/m\d{2}\.mjs"\)/u);
  assert.match(bootstrap, /Fatal runtime initialization failure/u);
  assert.match(bootstrap, /if \(!reported\)/u);
  assert.doesNotMatch(bootstrap, /src\//u);
});

test("runtime emitter rejects wrong-case and escaping imports on case-sensitive inventory", async () => {
  const temp = await mkdtemp(resolve(tmpdir(), "runyth-order-graph-"));
  try {
    await mkdir(resolve(temp, "src/core"), { recursive: true });
    await writeFile(resolve(temp, "src/main.mjs"), 'import "./core/Registry.mjs";\n');
    await writeFile(resolve(temp, "src/core/registry.mjs"), "export const ok = true;\n");
    let graph = await analyzeSourceGraph(temp);
    assert.equal(graph.failures.length, 1);
    assert.match(graph.failures[0], /case mismatch/u);

    await writeFile(resolve(temp, "src/main.mjs"), 'import "../outside.mjs";\n');
    graph = await analyzeSourceGraph(temp);
    assert.equal(graph.failures.length, 1);
    assert.match(graph.failures[0], /escapes src/u);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("runtime emission is deterministic for unchanged source", async () => {
  const temp = await mkdtemp(resolve(tmpdir(), "runyth-order-emit-"));
  try {
    await mkdir(resolve(temp, "src/core"), { recursive: true });
    await writeFile(resolve(temp, "src/main.mjs"), 'import { value } from "./core/value.mjs";\nexport { value };\n');
    await writeFile(resolve(temp, "src/core/value.mjs"), "export const value = 42;\n");
    const first = await emitRuntimeGraph(temp, { version: "9.9.9", moduleId: "test-module", moduleTitle: "Test Module" });
    const firstGraph = await readFile(resolve(temp, "runtime/v9.9.9/graph.json"));
    const second = await emitRuntimeGraph(temp, { version: "9.9.9", moduleId: "test-module", moduleTitle: "Test Module" });
    const secondGraph = await readFile(resolve(temp, "runtime/v9.9.9/graph.json"));
    assert.deepEqual(first, second);
    assert.deepEqual(firstGraph, secondGraph);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
