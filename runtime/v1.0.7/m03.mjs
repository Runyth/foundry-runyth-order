// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { API_VERSION, DATA_SCHEMA_VERSION, MODULE_ID } from "./m01.mjs";
import { publicClone } from "./m15.mjs";
import { versionInRange } from "./m16.mjs";

function diagnostic({ severity, code, message, messageKey = null, providerId = null, packId = null, data = {} }) {
  return { severity, code, message, messageKey, providerId, packId, data };
}

function namingMessage(finding) {
  const data = finding.data ?? {};
  if (finding.code === "PROVIDER_NAMING_MISMATCH") {
    return `Provider ${finding.providerId} title ${data.actualProviderTitle} does not match ${data.expectedTitle}.`;
  }
  if (finding.code === "MODULE_NAMING_MISMATCH") {
    return `Module ${finding.moduleId} title ${data.actualModuleTitle} does not match ${data.expectedTitle}.`;
  }
  if (finding.code === "NAMING_METADATA_CONFLICT") {
    return `Provider and manifest naming metadata disagree for ${finding.providerId}.`;
  }
  if (finding.code === "NAMING_METADATA_INVALID") {
    return `Module naming metadata is invalid for ${finding.providerId}: ${data.reason}.`;
  }
  return `Legacy provider ${finding.providerId} does not declare Runyth Order naming metadata.`;
}

export class DiagnosticsService {
  constructor({
    registry,
    migrationService,
    getModule,
    getPack,
    getSystem,
    getCoreVersion,
    resolveUuid = (uuid) => globalThis.fromUuid(uuid),
  }) {
    this.registry = registry;
    this.migrationService = migrationService;
    this.getModule = getModule;
    this.getPack = getPack;
    this.getSystem = getSystem;
    this.getCoreVersion = getCoreVersion;
    this.resolveUuid = resolveUuid;
  }

  #diagnoseDependencies(dependencies, { providerId, packId = null }) {
    const findings = [];
    for (const dependency of dependencies) {
      const dependencyModule = this.getModule(dependency.moduleId);
      const missing = !dependencyModule?.active;
      const incompatible =
        dependencyModule?.active && !versionInRange(dependencyModule.version, dependency);
      if (!missing && !incompatible) continue;

      const scope = packId ? `Pack ${packId}` : `Provider ${providerId}`;
      if (dependency.required) {
        findings.push(
          diagnostic({
            severity: "error",
            code: missing ? "REQUIRED_DEPENDENCY_MISSING" : "REQUIRED_DEPENDENCY_INCOMPATIBLE",
            providerId,
            packId,
            message: missing
              ? `${scope} requires active module ${dependency.moduleId}.`
              : `${scope} requires ${dependency.moduleId} within its declared version range; ${dependencyModule.version} is active.`,
            data: { dependency },
          }),
        );
      } else {
        findings.push(
          diagnostic({
            severity: "warning",
            code: missing ? "OPTIONAL_DEPENDENCY_MISSING" : "OPTIONAL_DEPENDENCY_INCOMPATIBLE",
            providerId,
            packId,
            message: missing
              ? `${scope} optionally integrates with module ${dependency.moduleId}, which is not active.`
              : `${scope} optionally integrates with ${dependency.moduleId}, but active version ${dependencyModule.version} is outside the declared range.`,
            data: { dependency },
          }),
        );
      }
    }
    return findings;
  }

  async run({ deep = false, minimal = false } = {}) {
    const findings = [];
    const system = this.getSystem();
    const providers = this.registry.listProviders();
    const packs = this.registry.listPacks();

    for (const namingFinding of this.registry.listNamingFindings()) {
      findings.push(
        diagnostic({
          severity: namingFinding.severity,
          code: namingFinding.code,
          providerId: namingFinding.providerId,
          message: namingMessage(namingFinding),
          messageKey: namingFinding.messageKey,
          data: namingFinding.data,
        }),
      );
    }

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

      findings.push(...this.#diagnoseDependencies(provider.dependencies, { providerId: provider.id }));
    }

    const resolutionCache = new Map();
    const resolveAvailable = async (uuid) => {
      if (!resolutionCache.has(uuid)) {
        resolutionCache.set(
          uuid,
          Promise.resolve()
            .then(() => this.resolveUuid(uuid))
            .then(Boolean)
            .catch(() => false),
        );
      }
      return resolutionCache.get(uuid);
    };

    for (const pack of packs) {
      findings.push(
        ...this.#diagnoseDependencies(pack.dependencies, {
          providerId: pack.providerId,
          packId: pack.id,
        }),
      );

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
        const results = await Promise.all(
          pack.entries
            .filter((entry) => entry.uuid)
            .map(async (entry) => ({ entry, available: await resolveAvailable(entry.uuid) })),
        );
        for (const { entry, available } of results) {
          if (available) continue;
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

    const full = {
      schemaVersion: 1,
      mode: "full",
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
    };

    if (!minimal) return publicClone(full);

    return publicClone({
      schemaVersion: 1,
      mode: "minimal-support",
      generatedAt: full.generatedAt,
      core: full.core,
      system: { id: system.id, version: system.version },
      counts,
      findings: findings.map((finding) => ({
        severity: finding.severity,
        code: finding.code,
        providerId: finding.providerId,
        packId: finding.packId,
      })),
    });
  }
}
