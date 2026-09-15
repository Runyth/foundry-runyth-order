// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { API_VERSION, DATA_SCHEMA_VERSION, HOOKS, MODULE_ID } from "./constants.mjs";
import { normalizeSourceDescriptor, readSource, tagDocument } from "./core/source-flags.mjs";
import { publicClone } from "./util/objects.mjs";

export class RunythOrderApi {
  #ready = false;
  #readyPromise;
  #resolveReady;
  #openHub = null;

  constructor({ registry, auditService, diagnosticsService, migrationService, hooks, logger }) {
    this.registry = registry;
    this.auditService = auditService;
    this.diagnosticsService = diagnosticsService;
    this.migrationService = migrationService;
    this.hooks = hooks;
    this.logger = logger;
    this.#readyPromise = new Promise((resolve) => {
      this.#resolveReady = resolve;
    });

    Object.defineProperties(this, {
      moduleId: { value: MODULE_ID, enumerable: true },
      apiVersion: { value: API_VERSION, enumerable: true },
      dataSchemaVersion: { value: DATA_SCHEMA_VERSION, enumerable: true },
    });
  }

  setHubOpener(openHub) {
    if (typeof openHub !== "function") throw new TypeError("openHub must be a function.");
    this.#openHub = openHub;
  }

  markReady() {
    if (this.#ready) return;
    this.#ready = true;
    this.#resolveReady(this);
    this.hooks?.callAll?.(HOOKS.READY, this);
  }

  isReady() {
    return this.#ready;
  }

  async whenReady() {
    return this.#readyPromise;
  }

  registerProvider(provider) {
    try {
      const registered = this.registry.registerProvider(provider);
      this.hooks?.callAll?.(HOOKS.PROVIDER_REGISTERED, registered, this);
      return registered;
    } catch (error) {
      this.logger?.error("Provider registration failed.", error);
      this.hooks?.callAll?.(HOOKS.PROVIDER_REJECTED, provider, error, this);
      throw error;
    }
  }

  registerPack(providerId, pack) {
    const registered = this.registry.registerPack(providerId, pack);
    this.hooks?.callAll?.(HOOKS.PACK_REGISTERED, registered, this);
    return registered;
  }

  registerActorValidator(providerId, validator) {
    return this.registry.registerValidator(providerId, validator);
  }

  registerMigration(providerId, migration) {
    return this.registry.registerMigration(providerId, migration);
  }

  unregisterProvider(providerId) {
    return this.registry.unregisterProvider(providerId);
  }

  listProviders() {
    return this.registry.listProviders();
  }

  getProvider(providerId) {
    return this.registry.getProvider(providerId);
  }

  listNamingFindings(filters = {}) {
    return this.registry.listNamingFindings(filters);
  }

  listPacks(filters = {}) {
    return this.registry.listPacks(filters);
  }

  getPack(packId) {
    return this.registry.getPack(packId);
  }

  hasCapability(capability, filters = {}) {
    return this.registry.hasCapability(capability, filters);
  }

  snapshot() {
    return this.registry.snapshot();
  }

  async resolveContent(reference) {
    if (typeof reference === "string") return globalThis.fromUuid(reference);
    if (!reference || typeof reference !== "object") {
      throw new TypeError("A UUID string or content reference object is required.");
    }

    const pack = this.registry.getPack(reference.packId);
    if (!pack) throw new Error(`Unknown content pack ${reference.packId}.`);
    const entry = pack.entries.find((candidate) => candidate.id === reference.entryId);
    if (!entry) {
      throw new Error(`Unknown entry ${reference.entryId} in ${reference.packId}.`);
    }
    if (!entry.uuid) throw new Error(`Entry ${reference.entryId} has no resolvable UUID.`);
    return globalThis.fromUuid(entry.uuid);
  }

  async auditActor(actorOrUuid, options = {}) {
    return this.auditService.auditActor(actorOrUuid, options);
  }

  async runDiagnostics(options = {}) {
    return this.diagnosticsService.run(options);
  }

  async listPendingMigrations(filters = {}) {
    return this.migrationService.listPending(filters);
  }

  async runMigration(migrationId) {
    return this.migrationService.runMigration(migrationId);
  }

  async runPendingMigrations(filters = {}) {
    return this.migrationService.runPending(filters);
  }

  normalizeSource(source) {
    return publicClone(normalizeSourceDescriptor(source));
  }

  readSource(document) {
    return readSource(document);
  }

  async tagDocument(document, source, options = {}) {
    return tagDocument(document, source, options);
  }

  async openHub(options = {}) {
    if (!this.#openHub) throw new Error("The Rules Hub is not initialized yet.");
    return this.#openHub(options);
  }
}
