import assert from "node:assert/strict";
import test from "node:test";
import { DiagnosticsService } from "../src/core/diagnostics-service.mjs";
import { MigrationService } from "../src/core/migration-service.mjs";
import { ProviderRegistry } from "../src/core/registry.mjs";

function setup({ migrationRun = async () => ({ updated: 1 }) } = {}) {
  const modules = new Map([
    ["example-homebrew", { active: true, version: "1.0.0" }],
  ]);
  const registry = new ProviderRegistry({ getModule: (id) => modules.get(id) ?? null });
  registry.registerProvider({
    id: "example-homebrew",
    title: "Example",
    version: "1.0.0",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    systems: [{ id: "dnd5e", minimum: "5.3.3", maximum: "5.3.3" }],
    dependencies: [{ moduleId: "optional-module", required: false }],
    capabilities: ["migration.world"],
    packs: [{ id: "options", title: "Options", compendia: ["example.missing"], contentKinds: [], entries: [] }],
    migrations: [{ id: "state-v1", title: "State", version: "1.0.0", run: migrationRun }],
  });
  let state = { schemaVersion: 1, completedMigrations: {} };
  const migrationService = new MigrationService({
    registry,
    readState: async () => state,
    writeState: async (next) => {
      state = next;
    },
    hooks: { callAll() {} },
    logger: { info() {}, warn() {} },
  });
  return { registry, migrationService, modules, getState: () => state };
}

test("runs a GM migration once and records completion only after success", async () => {
  globalThis.game = { user: { isGM: true } };
  const { migrationService, getState } = setup();
  assert.equal((await migrationService.listPending()).length, 1);
  const report = await migrationService.runMigration("example-homebrew.state-v1");
  assert.equal(report.status, "complete");
  assert.equal(getState().completedMigrations["example-homebrew.state-v1"], "1.0.0");
  assert.equal((await migrationService.listPending()).length, 0);
});

test("leaves a failed migration pending", async () => {
  globalThis.game = { user: { isGM: true } };
  const { migrationService, getState } = setup({
    migrationRun: async () => {
      throw new Error("failed");
    },
  });
  await assert.rejects(() => migrationService.runMigration("example-homebrew.state-v1"), /failed/u);
  assert.deepEqual(getState().completedMigrations, {});
  assert.equal((await migrationService.listPending()).length, 1);
});

test("rejects player-authoritative migration execution", async () => {
  globalThis.game = { user: { isGM: false } };
  const { migrationService } = setup();
  await assert.rejects(() => migrationService.runMigration("example-homebrew.state-v1"), /Game Master/u);
});

test("diagnostics reports optional dependencies, missing compendia, and pending migrations", async () => {
  const { registry, migrationService, modules } = setup();
  const diagnostics = new DiagnosticsService({
    registry,
    migrationService,
    getModule: (id) => modules.get(id) ?? null,
    getPack: () => null,
    getSystem: () => ({ id: "dnd5e", title: "D&D 5e", version: "5.3.3" }),
    getCoreVersion: () => "13.351",
  });
  const report = await diagnostics.run();
  assert.ok(report.findings.some((finding) => finding.code === "OPTIONAL_DEPENDENCY_MISSING"));
  assert.ok(report.findings.some((finding) => finding.code === "COMPENDIUM_MISSING"));
  assert.ok(report.findings.some((finding) => finding.code === "MIGRATION_PENDING"));
  assert.equal(report.core.foundryVersion, "13.351");
});
