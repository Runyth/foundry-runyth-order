import assert from "node:assert/strict";
import test from "node:test";
import { ActorAuditService } from "../src/core/audit-service.mjs";
import { ProviderRegistry } from "../src/core/registry.mjs";

function item(id, source) {
  return {
    id,
    uuid: `Actor.actor.Item.${id}`,
    name: id,
    getFlag: () => source,
  };
}

function actor(items = []) {
  return {
    documentName: "Actor",
    id: "actor",
    uuid: "Actor.actor",
    name: "Actor",
    type: "character",
    items,
  };
}

function configuredRegistry(validator = async () => []) {
  const subject = new ProviderRegistry({
    getModule: () => ({ active: true, version: "1.0.0" }),
  });
  subject.registerProvider({
    id: "example-homebrew",
    title: "Example",
    version: "1.0.0",
    coreApi: { minimum: "1.0.0", maximum: "1.0.0" },
    capabilities: ["validation.actor"],
    packs: [
      {
        id: "options",
        title: "Options",
        version: "2.0.0",
        contentKinds: ["feature"],
        entries: [{ id: "known", title: "Known", kind: "feature" }],
      },
    ],
    validators: [{ id: "actor", title: "Actor", scope: "actor", run: validator }],
  });
  return subject;
}

test("audits managed sources without mutating the Actor", async () => {
  const source = {
    providerId: "example-homebrew",
    packId: "example-homebrew.options",
    entryId: "known",
    contentVersion: "1.0.0",
  };
  const target = actor([item("one", source), item("two", source)]);
  const before = JSON.stringify(target);
  const service = new ActorAuditService({
    registry: configuredRegistry(),
    resolveUuid: async () => null,
    hooks: { callAll() {} },
    logger: { warn() {} },
  });
  const report = await service.auditActor(target);
  assert.equal(report.counts.warning, 1);
  assert.equal(report.counts.info, 2);
  assert.ok(report.issues.some((issue) => issue.code === "DUPLICATE_SOURCE"));
  assert.ok(report.issues.some((issue) => issue.code === "CONTENT_VERSION_DIFFERENCE"));
  assert.equal(JSON.stringify(target), before);
});

test("isolates a failing provider validator as an audit issue", async () => {
  const service = new ActorAuditService({
    registry: configuredRegistry(async () => {
      throw new Error("provider failure");
    }),
    resolveUuid: async () => null,
    hooks: { callAll() {} },
    logger: { warn() {} },
  });
  const report = await service.auditActor(actor());
  assert.equal(report.counts.error, 1);
  assert.equal(report.issues[0].code, "VALIDATOR_FAILED");
  assert.equal(report.providerRuns[0].status, "failed");
});

test("normalizes provider issues and passes provider context", async () => {
  let received;
  const service = new ActorAuditService({
    registry: configuredRegistry(async (context) => {
      received = context;
      return [{ severity: "warning", code: "choice-missing", message: "Choose one." }];
    }),
    resolveUuid: async () => null,
    hooks: { callAll() {} },
    logger: { warn() {} },
  });
  const report = await service.auditActor(actor());
  assert.equal(report.issues[0].providerId, "example-homebrew");
  assert.equal(received.provider.id, "example-homebrew");
  assert.equal(received.packs[0].id, "example-homebrew.options");
  assert.ok(received.coreApi.registry.providers.length === 1);
});
