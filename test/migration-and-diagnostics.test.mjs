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

test("serializes different concurrent migrations and deduplicates the same migration", async () => {
  globalThis.game = { user: { isGM: true } };
  const modules = new Map([["example-homebrew", { active: true, version: "1.0.0" }]]);
  const registry = new ProviderRegistry({ getModule: (id) => modules.get(id) ?? null });
  const order = [];
  let firstRuns = 0;
  registry.registerProvider({
    id: "example-homebrew",
    title: "Example",
    version: "1.0.0",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    capabilities: ["migration.world"],
    migrations: [
      {
        id: "first",
        title: "First",
        version: "1.0.0",
        async run() {
          firstRuns += 1;
          order.push("first-start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          order.push("first-end");
        },
      },
      {
        id: "second",
        title: "Second",
        version: "1.0.0",
        async run() {
          order.push("second-start");
          order.push("second-end");
        },
      },
    ],
  });
  let state = { schemaVersion: 1, completedMigrations: {} };
  const migrationService = new MigrationService({
    registry,
    readState: async () => state,
    writeState: async (next) => {
      state = next;
    },
    hooks: { callAll() {} },
    logger: {},
  });

  const firstA = migrationService.runMigration("example-homebrew.first");
  const firstB = migrationService.runMigration("example-homebrew.first");
  const second = migrationService.runMigration("example-homebrew.second");
  const [firstReportA, firstReportB, secondReport] = await Promise.all([firstA, firstB, second]);

  assert.equal(firstRuns, 1);
  assert.equal(firstReportA.status, "complete");
  assert.equal(firstReportB.status, "complete");
  assert.equal(secondReport.status, "complete");
  assert.deepEqual(order, ["first-start", "first-end", "second-start", "second-end"]);
});

test("diagnostics evaluates pack-level dependencies and caches repeated deep UUID resolution", async () => {
  const modules = new Map([["example-homebrew", { active: true, version: "1.0.0" }]]);
  const registry = new ProviderRegistry({ getModule: (id) => modules.get(id) ?? null });
  registry.registerProvider({
    id: "example-homebrew",
    title: "Example",
    version: "1.0.0",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    packs: [
      {
        id: "options",
        title: "Options",
        contentKinds: ["feature"],
        dependencies: [{ moduleId: "pack-helper", required: true }],
        entries: [
          { id: "one", title: "One", kind: "feature", uuid: "Compendium.example.same.Item.one" },
          { id: "two", title: "Two", kind: "feature", uuid: "Compendium.example.same.Item.one" },
        ],
      },
    ],
  });
  const migrationService = new MigrationService({
    registry,
    readState: async () => ({ schemaVersion: 1, completedMigrations: {} }),
    writeState: async () => undefined,
    hooks: { callAll() {} },
    logger: {},
  });
  let resolutions = 0;
  const diagnostics = new DiagnosticsService({
    registry,
    migrationService,
    getModule: (id) => modules.get(id) ?? null,
    getPack: () => ({ id: "present" }),
    getSystem: () => ({ id: "dnd5e", title: "D&D 5e", version: "5.3.3" }),
    getCoreVersion: () => "13.351",
    resolveUuid: async () => {
      resolutions += 1;
      return null;
    },
  });

  const report = await diagnostics.run({ deep: true });
  assert.ok(
    report.findings.some(
      (finding) => finding.code === "REQUIRED_DEPENDENCY_MISSING" && finding.packId === "example-homebrew.options",
    ),
  );
  assert.equal(resolutions, 1);
  assert.equal(report.findings.filter((finding) => finding.code === "CONTENT_UUID_UNRESOLVED").length, 2);
});
