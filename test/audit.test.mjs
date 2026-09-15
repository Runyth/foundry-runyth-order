// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
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
    authorize: () => true,
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
    authorize: () => true,
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
    authorize: () => true,
  });
  const report = await service.auditActor(actor());
  assert.equal(report.issues[0].providerId, "example-homebrew");
  assert.equal(received.provider.id, "example-homebrew");
  assert.equal(received.packs[0].id, "example-homebrew.options");
  assert.ok(received.coreApi.registry.providers.length === 1);
});

test("enforces the configured audit permission before any audit work", async () => {
  const validatorRuns = [];
  const hookCalls = [];
  let authorizeCalls = 0;
  const denied = new ActorAuditService({
    registry: configuredRegistry(() => {
      validatorRuns.push(1);
      return [];
    }),
    resolveUuid: async (uuid) => (uuid === "Actor.actor" ? actor() : null),
    hooks: { callAll: (hook) => hookCalls.push(hook) },
    logger: { warn() {} },
    authorize: () => {
      authorizeCalls += 1;
      return false;
    },
  });
  const target = actor();

  await assert.rejects(
    () => denied.auditActor(target),
    (error) => error.message === "Actor audit is denied by the configured audit permission.",
  );
  await assert.rejects(
    () => denied.auditActor("Actor.actor"),
    (error) => error.message === "Actor audit is denied by the configured audit permission.",
  );

  assert.equal(authorizeCalls, 2);
  assert.deepEqual(validatorRuns, []);
  assert.deepEqual(hookCalls, []);
  assert.equal(target.items.length, 0);
});

test("granting the permission produces identical reports for object and UUID calls", async () => {
  const service = new ActorAuditService({
    registry: configuredRegistry(() => []),
    resolveUuid: async (uuid) => (uuid === "Actor.actor" ? actor() : null),
    hooks: { callAll() {} },
    logger: { warn() {} },
    authorize: () => true,
  });
  const byObject = await service.auditActor(actor(), { includeProviderValidators: false });
  const byUuid = await service.auditActor("Actor.actor", { includeProviderValidators: false });
  assert.deepEqual(byObject.actor, byUuid.actor);
  assert.deepEqual(byObject.counts, byUuid.counts);
  assert.deepEqual(byObject.issues, byUuid.issues);
  assert.deepEqual(byObject.providerRuns, byUuid.providerRuns);
});

function actorPolicyWorld({ isGM, permission, isOwner }) {
  const previous = globalThis.game;
  const target = actor();
  target.isOwner = isOwner;
  globalThis.game = {
    user: { isGM },
    settings: {
      get: (moduleId, key) => {
        assert.equal(moduleId, "runyth-order");
        assert.equal(key, "actorAuditPermission");
        return permission;
      },
    },
  };
  return {
    target,
    restore() {
      if (previous === undefined) delete globalThis.game;
      else globalThis.game = previous;
    },
  };
}

test("default authorization follows the GM/owner audit policy", async () => {
  const service = new ActorAuditService({
    registry: configuredRegistry(() => []),
    resolveUuid: async () => null,
    hooks: { callAll() {} },
    logger: { warn() {} },
  });

  let policy = actorPolicyWorld({ isGM: true, permission: "gm", isOwner: false });
  await service.auditActor(policy.target);
  policy.restore();

  policy = actorPolicyWorld({ isGM: false, permission: "owner", isOwner: true });
  await service.auditActor(policy.target);
  policy.restore();

  policy = actorPolicyWorld({ isGM: false, permission: "owner", isOwner: false });
  await assert.rejects(() => service.auditActor(policy.target), /denied/u);
  policy.restore();

  policy = actorPolicyWorld({ isGM: false, permission: "gm", isOwner: true });
  await assert.rejects(() => service.auditActor(policy.target), /denied/u);
  policy.restore();
});
