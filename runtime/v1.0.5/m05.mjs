// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { DATA_SCHEMA_VERSION, HOOKS } from "./m01.mjs";
import { publicClone, safeError } from "./m15.mjs";

function defaultState() {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    completedMigrations: {},
  };
}

export class MigrationService {
  #queue = Promise.resolve();
  #runningById = new Map();

  constructor({ registry, readState, writeState, hooks = globalThis.Hooks, logger }) {
    this.registry = registry;
    this.readState = readState;
    this.writeState = writeState;
    this.hooks = hooks;
    this.logger = logger;
  }

  async getState() {
    const state = (await this.readState()) ?? defaultState();
    return {
      schemaVersion: Number(state.schemaVersion ?? DATA_SCHEMA_VERSION),
      completedMigrations:
        state.completedMigrations && typeof state.completedMigrations === "object"
          ? { ...state.completedMigrations }
          : {},
    };
  }

  async listPending({ providerId = null } = {}) {
    const state = await this.getState();
    return this.registry
      .listMigrations({ providerId })
      .filter((migration) => state.completedMigrations[migration.id] !== migration.version);
  }

  async runMigration(migrationId) {
    if (!globalThis.game?.user?.isGM) throw new Error("Only a Game Master can run migrations.");

    const registered = this.registry.getMigration(migrationId);
    if (!registered) throw new Error(`Unknown migration ${migrationId}.`);

    const existing = this.#runningById.get(migrationId);
    if (existing) return existing;

    const queued = this.#queue
      .catch(() => undefined)
      .then(() => this.#run(registered));
    const tracked = queued.finally(() => {
      if (this.#runningById.get(migrationId) === tracked) {
        this.#runningById.delete(migrationId);
      }
    });

    this.#runningById.set(migrationId, tracked);
    this.#queue = tracked.then(
      () => undefined,
      () => undefined,
    );
    return tracked;
  }

  async runPending({ providerId = null } = {}) {
    const results = [];
    for (const migration of await this.listPending({ providerId })) {
      results.push(await this.runMigration(migration.id));
    }
    return publicClone(results);
  }

  async #run(registered) {
    const { descriptor, run } = registered;
    const state = await this.getState();
    if (state.completedMigrations[descriptor.id] === descriptor.version) {
      return publicClone({
        migrationId: descriptor.id,
        version: descriptor.version,
        status: "already-complete",
      });
    }

    this.hooks?.callAll?.(HOOKS.BEFORE_MIGRATION, descriptor);
    const startedAt = new Date().toISOString();
    try {
      const result = await run({
        game: globalThis.game,
        migration: publicClone(descriptor),
        logger: this.logger,
      });
      state.completedMigrations[descriptor.id] = descriptor.version;
      await this.writeState(state);
      const report = publicClone({
        migrationId: descriptor.id,
        version: descriptor.version,
        status: "complete",
        startedAt,
        completedAt: new Date().toISOString(),
        result: result && typeof result === "object" ? result : null,
      });
      this.hooks?.callAll?.(HOOKS.AFTER_MIGRATION, descriptor, report);
      return report;
    } catch (error) {
      const report = publicClone({
        migrationId: descriptor.id,
        version: descriptor.version,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: safeError(error),
      });
      this.hooks?.callAll?.(HOOKS.AFTER_MIGRATION, descriptor, report);
      throw Object.assign(new Error(`Migration ${descriptor.id} failed: ${report.error.message}`), {
        cause: error,
        report,
      });
    }
  }
}
