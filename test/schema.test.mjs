import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import Ajv from "ajv/dist/2020.js";
import { ActorAuditService } from "../src/core/audit-service.mjs";
import { normalizeSourceDescriptor } from "../src/core/source-flags.mjs";
import { DiagnosticsService } from "../src/core/diagnostics-service.mjs";
import { MigrationService } from "../src/core/migration-service.mjs";
import { ProviderRegistry } from "../src/core/registry.mjs";

const schemaRoot = new URL("../schemas/", import.meta.url);
const files = (await readdir(schemaRoot)).filter((file) => file.endsWith(".json")).sort();

const schemas = new Map();
for (const file of files) {
  schemas.set(file, JSON.parse(await readFile(new URL(file, schemaRoot), "utf8")));
}

// Published schemas use the standard `date-time` format; registering the canonical
// RFC 3339 shape keeps the contract tests enforcing real timestamp syntax instead of
// silently ignoring the declared format.
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/u;

function createAjv() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  ajv.addFormat("date-time", { validate: (value) => DATE_TIME_PATTERN.test(value), compare: undefined });
  return ajv;
}

function validatorFor(file) {
  const schema = schemas.get(file);
  const ajv = createAjv();
  ajv.compile(schema);
  return { schema, validate: ajv.compile(schema) };
}

function validatorForDefinition(file, definition) {
  const parent = schemas.get(file);
  const ajv = createAjv();
  return ajv.compile({ $schema: "https://json-schema.org/draft/2020-12/schema", $defs: parent.$defs, ...definition });
}

test("published schemas are parseable standard JSON Schema documents", async () => {
  assert.deepEqual([...schemas.keys()], [
    "audit-report.schema.json",
    "localization-pack.schema.json",
    "provider-descriptor.schema.json",
    "provider-registration.schema.json",
    "source-descriptor.schema.json",
  ]);
  for (const file of files) {
    const schema = schemas.get(file);
    assert.ok(schema.properties, `${file} must expose a top-level property contract.`);
    assert.ok(schema.$schema, `${file} must declare its dialect.`);
    validatorFor(file);
  }
});

test("real registration examples satisfy the registration contract", async () => {
  const { validate } = validatorFor("provider-registration.schema.json");
  const examples = [
    {
      id: "example-homebrew",
      moduleId: "example-homebrew",
      title: "Example Homebrew",
      version: "1.0.0",
      coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
      systems: [{ id: "dnd5e", minimum: "5.3.3", maximum: "5.3.3" }],
      dependencies: [{ moduleId: "optional-helper", required: false, minimum: "12.0.0" }],
      capabilities: ["content.subclasses", "example-homebrew.special"],
      packs: [
        {
          id: "options",
          title: "Example Subclasses",
          version: "1.0.0",
          systemId: "dnd5e",
          contentKinds: ["subclass", "feature"],
          compendia: ["example-homebrew.subclasses"],
          entries: [],
          dependencies: [{ moduleId: "pack-helper", required: true }],
        },
      ],
      validators: [
        { id: "actor-progression", title: "Actor progression", scope: "actor", async run() { return []; } },
      ],
    },
    {
      id: "runyth-order-class-example-vanguard",
      moduleId: "runyth-order-class-example-vanguard",
      title: "Runyth Order: Class Example Vanguard",
      coreApi: { maximum: "1.0.99" },
      naming: {
        orderName: "Runyth Order",
        moduleKind: "Class",
        contentName: "Example Vanguard",
        canonicalTitle: "Runyth Order: Class Example Vanguard",
      },
    },
    { id: "minimal-provider", title: "Minimal provider", coreApi: { minimum: "1.0.0" }, naming: null },
  ];
  for (const example of examples) {
    validate(example);
    assert.ok(validate.errors === null || validate.errors.length === 0, `registration example rejected: ${JSON.stringify(validate.errors)}`);
  }

  const invalid = { ...examples[2], naming: { orderName: "Other Order" } };
  assert.ok(!validate(invalid), "a malformed naming object must be rejected");

  await assert.rejects(
    async () => {
      const registry = new ProviderRegistry({
        getModule: () => ({ active: true, version: "1.0.0" }),
      });
      return registry.registerProvider({ id: "bad-provider", title: "Bad" });
    },
    (error) => error.name === "ProviderValidationError",
  );
});

test("normalized registry output satisfies the descriptor contract", async () => {
  const file = "provider-descriptor.schema.json";
  const { schema, validate } = validatorFor(file);
  const registry = new ProviderRegistry({ getModule: () => ({ active: true, version: "1.0.0" }) });
  registry.registerProvider({
    id: "example-homebrew",
    title: "Example Homebrew",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    systems: [{ id: "dnd5e", minimum: "5.3.3", maximum: "5.3.3" }],
    dependencies: [{ moduleId: "optional-helper", required: false, minimum: "12.0.0" }],
    capabilities: ["content.subclasses"],
    packs: [
      {
        id: "options",
        title: "Example Subclasses",
        contentKinds: ["subclass"],
        dependencies: [{ moduleId: "pack-helper", required: true, minimum: "12.0.0", maximum: "12.99.0" }],
        entries: [{ id: "known", title: "Known", kind: "subclass" }],
      },
    ],
    naming: {
      orderName: "Runyth Order",
      moduleKind: "Class",
      contentName: "Example Vanguard",
      canonicalTitle: "Runyth Order: Class Example Vanguard",
    },
  });

  validate(registry.getProvider("example-homebrew"));
  assert.ok(validate.errors === null || validate.errors.length === 0, `provider output rejected: ${JSON.stringify(validate.errors)}`);

  for (const pack of registry.listPacks()) {
    const packValidator = validatorForDefinition(file, schema.$defs.normalizedPack);
    packValidator(pack);
    assert.ok(packValidator.errors === null || packValidator.errors.length === 0, `pack output rejected: ${JSON.stringify(packValidator.errors)}`);
  }

  const coreMissingBounds = { ...registry.getProvider("example-homebrew"), coreApi: {} };
  validate(coreMissingBounds);
  assert.ok(validate.errors?.length > 0, "a descriptor without a core API bound must be rejected");
});

test("real audit output satisfies the audit report contract", async () => {
  const { validate } = validatorFor("audit-report.schema.json");
  const registry = new ProviderRegistry({ getModule: () => ({ active: true, version: "1.0.0" }) });
  registry.registerProvider({
    id: "example-homebrew",
    title: "Example",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    packs: [
      {
        id: "options",
        title: "Options",
        version: "2.0.0",
        contentKinds: ["feature"],
        entries: [{ id: "known", title: "Known", kind: "feature" }],
      },
    ],
    validators: [{ id: "actor", title: "Actor", scope: "actor", run: () => [] }],
  });
  const auditService = new ActorAuditService({
    registry,
    resolveUuid: async () => null,
    hooks: { callAll() {} },
    logger: { warn() {} },
    authorize: () => true,
  });
  const report = await auditService.auditActor({
    documentName: "Actor",
    id: "actor-id",
    uuid: "Actor.actor-id",
    name: "Target",
    type: "character",
    items: [
      {
        id: "one",
        uuid: "Actor.actor-id.Item.one",
        name: "Known",
        getFlag: () => ({
          providerId: "example-homebrew",
          packId: "example-homebrew.options",
          entryId: "known",
        }),
      },
    ],
  });
  validate(report);
  assert.ok(validate.errors === null || validate.errors.length === 0, `audit output rejected: ${JSON.stringify(validate.errors)}`);

  const withoutTimestamps = { ...report };
  delete withoutTimestamps.startedAt;
  assert.ok(!validate(withoutTimestamps), "an audit report without the timestamp contract must be rejected");
});

test("real normalized source output satisfies the source descriptor contract", async () => {
  const { validate } = validatorFor("source-descriptor.schema.json");
  const normalized = normalizeSourceDescriptor({
    providerId: "example-homebrew",
    packId: "example-homebrew.options",
    entryId: "known",
  });
  validate(normalized);
  assert.ok(validate.errors === null || validate.errors.length === 0, `source output rejected: ${JSON.stringify(validate.errors)}`);

  const missingEntryId = { ...normalized };
  delete missingEntryId.entryId;
  assert.ok(!validate(missingEntryId), "a source flag without an entry ID must be rejected");
});

test("real diagnostics output satisfies the report contract and minimal export omits details", async () => {
  const registry = new ProviderRegistry({ getModule: () => ({ active: true, version: "1.0.0" }) });
  registry.registerProvider({
    id: "example-homebrew",
    title: "Example",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    packs: [{ id: "options", title: "Options", compendia: ["example-homebrew.missing"] }],
  });
  const migrationService = new MigrationService({
    registry,
    readState: async () => ({ schemaVersion: 1, completedMigrations: {} }),
    writeState: async () => undefined,
    hooks: { callAll() {} },
    logger: { info() {}, warn() {} },
  });
  const diagnostics = new DiagnosticsService({
    registry,
    migrationService,
    getModule: () => ({ active: true, version: "1.0.0" }),
    getPack: () => null,
    getSystem: () => ({ id: "dnd5e", title: "D&D 5e", version: "5.3.3" }),
    getCoreVersion: () => "13.351",
  });

  const full = await diagnostics.run();
  assert.equal(full.mode, "full");
  assert.ok(full.providers.length > 0);
  assert.ok(full.findings.length > 0);

  const minimal = await diagnostics.run({ minimal: true });
  assert.equal(minimal.mode, "minimal-support");
  assert.ok(!("providers" in minimal), "Minimal support export must omit provider descriptors.");
  assert.ok(!("packs" in minimal), "Minimal support export must omit pack descriptors.");
  assert.ok(!("pendingMigrations" in minimal), "Minimal support export must omit migration detail.");
  assert.deepEqual(Object.keys(minimal.system).sort(), ["id", "version"]);
  for (const finding of minimal.findings) {
    assert.deepEqual(Object.keys(finding).sort(), ["code", "packId", "providerId", "severity"]);
  }
});

test("declared date-time fields enforce RFC 3339 timestamp syntax", async () => {
  const registry = new ProviderRegistry({ getModule: () => ({ active: true, version: "1.0.0" }) });
  const descriptor = registry.registerProvider({
    id: "example-homebrew",
    title: "Example",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    packs: [{ id: "options", title: "Options", compendia: [] }],
  });
  const { validate } = validatorFor("provider-descriptor.schema.json");
  validate({ ...descriptor, registeredAt: "2026-10-11 20:15:00" });
  assert.equal(validate.errors?.some((error) => error.message?.includes("date-time")), true, "a spaced, non-RFC 3339 timestamp must be rejected");
  validate({ ...descriptor, registeredAt: "20261011T201500Z" });
  assert.equal(validate.errors?.some((error) => error.message?.includes("date-time")), true, "a compact non-RFC 3339 timestamp must be rejected");
  validate(descriptor);
  assert.ok(!validate.errors, `the runtime RFC 3339 timestamp must pass: ${JSON.stringify(validate.errors)}`);
});
