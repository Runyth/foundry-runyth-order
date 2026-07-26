import { DATA_SCHEMA_VERSION, HOOKS } from "../constants.mjs";
import { publicClone, safeError } from "../util/objects.mjs";

function defaultState() {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    completedMigrations: {},
  };
}

export class MigrationService {
  #running = null;

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
    if (this.#running) return this.#running;

    const registered = this.registry.getMigration(migrationId);
    if (!registered) throw new Error(`Unknown migration ${migrationId}.`);
    this.#running = this.#run(registered).finally(() => {
      this.#running = null;
    });
    return this.#running;
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
