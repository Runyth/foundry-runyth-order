import { API_VERSION, DATA_SCHEMA_VERSION, MODULE_ID } from "../constants.mjs";
import { publicClone } from "../util/objects.mjs";
import { versionInRange } from "../util/versions.mjs";

function diagnostic({ severity, code, message, providerId = null, packId = null, data = {} }) {
  return { severity, code, message, providerId, packId, data };
}

export class DiagnosticsService {
  constructor({ registry, migrationService, getModule, getPack, getSystem, getCoreVersion }) {
    this.registry = registry;
    this.migrationService = migrationService;
    this.getModule = getModule;
    this.getPack = getPack;
    this.getSystem = getSystem;
    this.getCoreVersion = getCoreVersion;
  }

  async run({ deep = false } = {}) {
    const findings = [];
    const system = this.getSystem();
    const providers = this.registry.listProviders();
    const packs = this.registry.listPacks();

    for (const provider of providers) {
      const module = this.getModule(provider.moduleId);
      if (!module?.active) {
        findings.push(
          diagnostic({
            severity: "error",
            code: "PROVIDER_MODULE_INACTIVE",
            providerId: provider.id,
            message: `Provider module ${provider.moduleId} is not active.`,
          }),
        );
      } else if (String(module.version) !== String(provider.version)) {
        findings.push(
          diagnostic({
            severity: "warning",
            code: "PROVIDER_VERSION_MISMATCH",
            providerId: provider.id,
            message: `Registered version ${provider.version} differs from active module version ${module.version}.`,
          }),
        );
      }

      const declaredSystem = provider.systems.find((candidate) => candidate.id === system.id);
      if (provider.systems.length > 0 && !declaredSystem) {
        findings.push(
          diagnostic({
            severity: "error",
            code: "SYSTEM_NOT_SUPPORTED",
            providerId: provider.id,
            message: `${provider.title} does not declare support for system ${system.id}.`,
          }),
        );
      } else if (declaredSystem && !versionInRange(system.version, declaredSystem)) {
        findings.push(
          diagnostic({
            severity: "error",
            code: "SYSTEM_VERSION_NOT_SUPPORTED",
            providerId: provider.id,
            message: `${provider.title} does not support ${system.id} ${system.version}.`,
            data: { declaredSystem },
          }),
        );
      }

      for (const dependency of provider.dependencies) {
        const dependencyModule = this.getModule(dependency.moduleId);
        const missing = !dependencyModule?.active;
        const incompatible =
          dependencyModule?.active && !versionInRange(dependencyModule.version, dependency);
        if ((missing || incompatible) && dependency.required) {
          findings.push(
            diagnostic({
              severity: "error",
              code: missing ? "REQUIRED_DEPENDENCY_MISSING" : "REQUIRED_DEPENDENCY_INCOMPATIBLE",
              providerId: provider.id,
              message: missing
                ? `Required module ${dependency.moduleId} is not active.`
                : `Required module ${dependency.moduleId} ${dependencyModule.version} is outside the declared range.`,
            }),
          );
        } else if (missing || incompatible) {
          findings.push(
            diagnostic({
              severity: "warning",
              code: missing ? "OPTIONAL_DEPENDENCY_MISSING" : "OPTIONAL_DEPENDENCY_INCOMPATIBLE",
              providerId: provider.id,
              message: missing
                ? `Optional module ${dependency.moduleId} is not active.`
                : `Optional module ${dependency.moduleId} ${dependencyModule.version} is outside the declared range.`,
            }),
          );
        }
      }
    }

    for (const pack of packs) {
      for (const compendiumId of pack.compendia) {
        if (!this.getPack(compendiumId)) {
          findings.push(
            diagnostic({
              severity: "error",
              code: "COMPENDIUM_MISSING",
              providerId: pack.providerId,
              packId: pack.id,
              message: `Compendium ${compendiumId} is not available.`,
            }),
          );
        }
      }
      if (pack.systemId && pack.systemId !== system.id) {
        findings.push(
          diagnostic({
            severity: "warning",
            code: "PACK_SYSTEM_MISMATCH",
            providerId: pack.providerId,
            packId: pack.id,
            message: `${pack.title} targets ${pack.systemId}, while the active system is ${system.id}.`,
          }),
        );
      }
      if (deep) {
        for (const entry of pack.entries) {
          if (!entry.uuid) continue;
          try {
            const resolved = await globalThis.fromUuid(entry.uuid);
            if (!resolved) throw new Error("No document returned.");
          } catch {
            findings.push(
              diagnostic({
                severity: "warning",
                code: "CONTENT_UUID_UNRESOLVED",
                providerId: pack.providerId,
                packId: pack.id,
                message: `${entry.title} cannot be resolved from ${entry.uuid}.`,
                data: { entryId: entry.id, uuid: entry.uuid },
              }),
            );
          }
        }
      }
    }

    const pendingMigrations = await this.migrationService.listPending();
    for (const migration of pendingMigrations) {
      findings.push(
        diagnostic({
          severity: migration.requiresBackup ? "warning" : "info",
          code: "MIGRATION_PENDING",
          providerId: migration.providerId,
          message: `Migration ${migration.title} (${migration.version}) is pending.`,
          data: { migrationId: migration.id, requiresBackup: migration.requiresBackup },
        }),
      );
    }

    const counts = {
      info: findings.filter((entry) => entry.severity === "info").length,
      warning: findings.filter((entry) => entry.severity === "warning").length,
      error: findings.filter((entry) => entry.severity === "error").length,
    };

    return publicClone({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      core: {
        moduleId: MODULE_ID,
        apiVersion: API_VERSION,
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        foundryVersion: this.getCoreVersion(),
      },
      system,
      counts,
      providers,
      packs,
      pendingMigrations,
      findings,
    });
  }
}
