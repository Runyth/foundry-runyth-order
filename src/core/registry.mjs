import {
  API_VERSION,
  CAPABILITY_PATTERN,
  CONTENT_KINDS,
  LOCAL_ID_PATTERN,
  MIGRATION_ID_PATTERN,
  PROVIDER_ID_PATTERN,
  STANDARD_CAPABILITIES,
} from "../constants.mjs";
import { deepFreeze, isPlainObject, publicClone, uniqueStrings } from "../util/objects.mjs";
import { normalizeCompatibility, versionInRange } from "../util/versions.mjs";

const STANDARD_CAPABILITY_SET = new Set(STANDARD_CAPABILITIES);
const CONTENT_KIND_SET = new Set(CONTENT_KINDS);
const VALIDATOR_SCOPES = new Set(["actor"]);
const MIGRATION_SCOPES = new Set(["world", "documents"]);

export class ProviderValidationError extends Error {
  constructor(message, { code = "INVALID_PROVIDER", path = null } = {}) {
    super(message);
    this.name = "ProviderValidationError";
    this.code = code;
    this.path = path;
  }
}

function requireObject(value, path) {
  if (!isPlainObject(value)) {
    throw new ProviderValidationError(`${path} must be an object.`, { path });
  }
  return value;
}

function requireString(value, path, { pattern = null } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new ProviderValidationError(`${path} must be a non-empty string.`, { path });
  }
  if (pattern && !pattern.test(normalized)) {
    throw new ProviderValidationError(`${path} has an invalid format.`, { path });
  }
  return normalized;
}

function optionalString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeCompatibilityAt(value, path) {
  try {
    return normalizeCompatibility(value);
  } catch (error) {
    throw new ProviderValidationError(`${path} is invalid: ${error.message}`, {
      code: "INVALID_COMPATIBILITY",
      path,
    });
  }
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    throw new ProviderValidationError(`${path} must be an array.`, { path });
  }
  return value;
}

function normalizeStringArray(value, path) {
  return uniqueStrings(requireArray(value ?? [], path));
}

function rejectDuplicateIds(values, path, key) {
  const seen = new Set();
  for (const value of values) {
    const id = value[key];
    if (seen.has(id)) {
      throw new ProviderValidationError(`${path} contains duplicate ${key} ${id}.`, {
        code: "DUPLICATE_DECLARATION",
        path,
      });
    }
    seen.add(id);
  }
  return values;
}

function normalizeSystems(systems = []) {
  const normalized = requireArray(systems, "systems").map((system, index) => {
    requireObject(system, `systems[${index}]`);
    return {
      id: requireString(system.id, `systems[${index}].id`, { pattern: PROVIDER_ID_PATTERN }),
      ...normalizeCompatibilityAt(system, `systems[${index}]`),
    };
  });
  return rejectDuplicateIds(normalized, "systems", "id");
}

function normalizeDependencies(dependencies = [], path = "dependencies") {
  const normalized = requireArray(dependencies, path).map((dependency, index) => {
    const itemPath = `${path}[${index}]`;
    requireObject(dependency, itemPath);
    return {
      moduleId: requireString(dependency.moduleId, `${itemPath}.moduleId`, {
        pattern: PROVIDER_ID_PATTERN,
      }),
      required: dependency.required !== false,
      ...normalizeCompatibilityAt(dependency, itemPath),
    };
  });
  return rejectDuplicateIds(normalized, path, "moduleId");
}

function normalizeCapabilities(providerId, capabilities = []) {
  if (!Array.isArray(capabilities)) {
    throw new ProviderValidationError("capabilities must be an array.", { path: "capabilities" });
  }

  return normalizeStringArray(capabilities, "capabilities").map((capability) => {
    if (!CAPABILITY_PATTERN.test(capability)) {
      throw new ProviderValidationError(`Capability ${capability} has an invalid format.`, {
        code: "INVALID_CAPABILITY",
        path: "capabilities",
      });
    }
    if (!STANDARD_CAPABILITY_SET.has(capability) && !capability.startsWith(`${providerId}.`)) {
      throw new ProviderValidationError(
        `Custom capability ${capability} must be namespaced with ${providerId}.`,
        { code: "UNNAMESPACED_CAPABILITY", path: "capabilities" },
      );
    }
    return capability;
  });
}

function normalizeEntry(entry, path) {
  requireObject(entry, path);
  const kind = requireString(entry.kind, `${path}.kind`);
  if (!CONTENT_KIND_SET.has(kind)) {
    throw new ProviderValidationError(`${path}.kind is not supported.`, {
      code: "INVALID_CONTENT_KIND",
      path: `${path}.kind`,
    });
  }

  return {
    id: requireString(entry.id, `${path}.id`, { pattern: LOCAL_ID_PATTERN }),
    title: requireString(entry.title, `${path}.title`),
    kind,
    uuid: optionalString(entry.uuid),
    identifier: optionalString(entry.identifier),
    version: optionalString(entry.version),
    tags: normalizeStringArray(entry.tags ?? [], `${path}.tags`),
    metadata: isPlainObject(entry.metadata) ? publicClone(entry.metadata) : {},
  };
}

function normalizePack(providerId, pack, path = "pack") {
  requireObject(pack, path);
  const localId = requireString(pack.id, `${path}.id`, { pattern: LOCAL_ID_PATTERN });
  const contentKinds = normalizeStringArray(pack.contentKinds ?? [], `${path}.contentKinds`);
  for (const kind of contentKinds) {
    if (!CONTENT_KIND_SET.has(kind)) {
      throw new ProviderValidationError(`${path}.contentKinds contains unsupported kind ${kind}.`, {
        code: "INVALID_CONTENT_KIND",
        path: `${path}.contentKinds`,
      });
    }
  }

  const entries = Array.isArray(pack.entries)
    ? pack.entries.map((entry, index) => normalizeEntry(entry, `${path}.entries[${index}]`))
    : [];
  const entryIds = new Set();
  for (const entry of entries) {
    if (entryIds.has(entry.id)) {
      throw new ProviderValidationError(`${path} contains duplicate entry id ${entry.id}.`, {
        code: "DUPLICATE_ENTRY",
        path: `${path}.entries`,
      });
    }
    entryIds.add(entry.id);
  }

  return {
    id: `${providerId}.${localId}`,
    localId,
    providerId,
    title: requireString(pack.title, `${path}.title`),
    description: optionalString(pack.description),
    version: optionalString(pack.version),
    systemId: optionalString(pack.systemId),
    contentKinds,
    compendia: normalizeStringArray(pack.compendia ?? [], `${path}.compendia`),
    entries,
    dependencies: normalizeDependencies(pack.dependencies ?? [], `${path}.dependencies`),
    documentationUrl: optionalString(pack.documentationUrl),
    metadata: isPlainObject(pack.metadata) ? publicClone(pack.metadata) : {},
  };
}

function normalizeValidator(providerId, validator, path = "validator") {
  requireObject(validator, path);
  const localId = requireString(validator.id, `${path}.id`, { pattern: LOCAL_ID_PATTERN });
  const scope = requireString(validator.scope ?? "actor", `${path}.scope`);
  if (!VALIDATOR_SCOPES.has(scope)) {
    throw new ProviderValidationError(`${path}.scope is not supported.`, {
      code: "INVALID_VALIDATOR_SCOPE",
      path: `${path}.scope`,
    });
  }
  if (typeof validator.run !== "function") {
    throw new ProviderValidationError(`${path}.run must be a function.`, {
      code: "INVALID_VALIDATOR_HANDLER",
      path: `${path}.run`,
    });
  }

  return {
    descriptor: {
      id: `${providerId}.${localId}`,
      localId,
      providerId,
      title: requireString(validator.title, `${path}.title`),
      description: optionalString(validator.description),
      scope,
      timeoutMs:
        Number.isInteger(validator.timeoutMs) && validator.timeoutMs > 0
          ? validator.timeoutMs
          : null,
    },
    run: validator.run,
  };
}

function normalizeMigration(providerId, migration, path = "migration") {
  requireObject(migration, path);
  const localId = requireString(migration.id, `${path}.id`, { pattern: MIGRATION_ID_PATTERN });
  const scope = requireString(migration.scope ?? "world", `${path}.scope`);
  if (!MIGRATION_SCOPES.has(scope)) {
    throw new ProviderValidationError(`${path}.scope is not supported.`, {
      code: "INVALID_MIGRATION_SCOPE",
      path: `${path}.scope`,
    });
  }
  if (typeof migration.run !== "function") {
    throw new ProviderValidationError(`${path}.run must be a function.`, {
      code: "INVALID_MIGRATION_HANDLER",
      path: `${path}.run`,
    });
  }

  return {
    descriptor: {
      id: `${providerId}.${localId}`,
      localId,
      providerId,
      title: requireString(migration.title, `${path}.title`),
      description: optionalString(migration.description),
      version: requireString(migration.version, `${path}.version`),
      scope,
      requiresBackup: migration.requiresBackup !== false,
    },
    run: migration.run,
  };
}

export class ProviderRegistry {
  #providers = new Map();
  #packs = new Map();
  #validators = new Map();
  #migrations = new Map();

  constructor({ getModule = () => null } = {}) {
    this.getModule = getModule;
  }

  registerProvider(provider) {
    requireObject(provider, "provider");
    const id = requireString(provider.id, "provider.id", { pattern: PROVIDER_ID_PATTERN });
    const moduleId = requireString(provider.moduleId ?? id, "provider.moduleId", {
      pattern: PROVIDER_ID_PATTERN,
    });
    if (this.#providers.has(id)) {
      throw new ProviderValidationError(`Provider ${id} is already registered.`, {
        code: "DUPLICATE_PROVIDER",
        path: "provider.id",
      });
    }

    const module = this.getModule(moduleId);
    if (!module?.active) {
      throw new ProviderValidationError(`Provider module ${moduleId} is not active.`, {
        code: "INACTIVE_PROVIDER_MODULE",
        path: "provider.moduleId",
      });
    }

    requireObject(provider.coreApi, "provider.coreApi");
    const coreApi = normalizeCompatibilityAt(provider.coreApi, "provider.coreApi");
    if (!coreApi.minimum && !coreApi.maximum) {
      throw new ProviderValidationError(
        "provider.coreApi must declare a minimum or maximum supported API version.",
        { code: "INVALID_COMPATIBILITY", path: "provider.coreApi" },
      );
    }
    if (!versionInRange(API_VERSION, coreApi)) {
      throw new ProviderValidationError(
        `Provider ${id} does not support Runyth Rules Core API ${API_VERSION}.`,
        { code: "INCOMPATIBLE_CORE_API", path: "provider.coreApi" },
      );
    }

    const descriptor = {
      id,
      moduleId,
      title: requireString(provider.title, "provider.title"),
      description: optionalString(provider.description),
      version: requireString(provider.version ?? module.version, "provider.version"),
      coreApi,
      systems: normalizeSystems(provider.systems),
      dependencies: normalizeDependencies(provider.dependencies),
      capabilities: normalizeCapabilities(id, provider.capabilities),
      documentationUrl: optionalString(provider.documentationUrl),
      repositoryUrl: optionalString(provider.repositoryUrl),
      authors: Array.isArray(provider.authors)
        ? provider.authors.map((author) => String(author).trim()).filter(Boolean)
        : [],
      metadata: isPlainObject(provider.metadata) ? publicClone(provider.metadata) : {},
      packIds: [],
      validatorIds: [],
      migrationIds: [],
    };

    this.#providers.set(id, {
      descriptor,
      registeredAt: new Date().toISOString(),
    });

    try {
      for (const pack of requireArray(provider.packs ?? [], "provider.packs")) {
        this.registerPack(id, pack);
      }
      for (const validator of requireArray(provider.validators ?? [], "provider.validators")) {
        this.registerValidator(id, validator);
      }
      for (const migration of requireArray(provider.migrations ?? [], "provider.migrations")) {
        this.registerMigration(id, migration);
      }
    } catch (error) {
      this.unregisterProvider(id);
      throw error;
    }

    return this.getProvider(id);
  }

  unregisterProvider(providerId) {
    const provider = this.#providers.get(providerId);
    if (!provider) return false;

    for (const packId of provider.descriptor.packIds) this.#packs.delete(packId);
    for (const validatorId of provider.descriptor.validatorIds) this.#validators.delete(validatorId);
    for (const migrationId of provider.descriptor.migrationIds) this.#migrations.delete(migrationId);
    this.#providers.delete(providerId);
    return true;
  }

  registerPack(providerId, pack) {
    const provider = this.#providers.get(providerId);
    if (!provider) {
      throw new ProviderValidationError(`Provider ${providerId} is not registered.`, {
        code: "UNKNOWN_PROVIDER",
        path: "providerId",
      });
    }

    const descriptor = normalizePack(providerId, pack);
    if (this.#packs.has(descriptor.id)) {
      throw new ProviderValidationError(`Pack ${descriptor.id} is already registered.`, {
        code: "DUPLICATE_PACK",
        path: "pack.id",
      });
    }

    this.#packs.set(descriptor.id, descriptor);
    provider.descriptor.packIds.push(descriptor.id);
    return publicClone(descriptor);
  }

  registerValidator(providerId, validator) {
    const provider = this.#providers.get(providerId);
    if (!provider) {
      throw new ProviderValidationError(`Provider ${providerId} is not registered.`, {
        code: "UNKNOWN_PROVIDER",
      });
    }

    const normalized = normalizeValidator(providerId, validator);
    if (this.#validators.has(normalized.descriptor.id)) {
      throw new ProviderValidationError(
        `Validator ${normalized.descriptor.id} is already registered.`,
        { code: "DUPLICATE_VALIDATOR" },
      );
    }

    this.#validators.set(normalized.descriptor.id, normalized);
    provider.descriptor.validatorIds.push(normalized.descriptor.id);
    return publicClone(normalized.descriptor);
  }

  registerMigration(providerId, migration) {
    const provider = this.#providers.get(providerId);
    if (!provider) {
      throw new ProviderValidationError(`Provider ${providerId} is not registered.`, {
        code: "UNKNOWN_PROVIDER",
      });
    }

    const normalized = normalizeMigration(providerId, migration);
    if (this.#migrations.has(normalized.descriptor.id)) {
      throw new ProviderValidationError(
        `Migration ${normalized.descriptor.id} is already registered.`,
        { code: "DUPLICATE_MIGRATION" },
      );
    }

    this.#migrations.set(normalized.descriptor.id, normalized);
    provider.descriptor.migrationIds.push(normalized.descriptor.id);
    return publicClone(normalized.descriptor);
  }

  getProvider(providerId) {
    const provider = this.#providers.get(providerId);
    if (!provider) return null;
    return publicClone({
      ...provider.descriptor,
      registeredAt: provider.registeredAt,
    });
  }

  listProviders() {
    return [...this.#providers.keys()]
      .map((providerId) => this.getProvider(providerId))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  getPack(packId) {
    const pack = this.#packs.get(packId);
    return pack ? publicClone(pack) : null;
  }

  listPacks({ providerId = null, contentKind = null, systemId = null } = {}) {
    return [...this.#packs.values()]
      .filter((pack) => !providerId || pack.providerId === providerId)
      .filter((pack) => !contentKind || pack.contentKinds.includes(contentKind))
      .filter((pack) => !systemId || !pack.systemId || pack.systemId === systemId)
      .map((pack) => publicClone(pack))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  getValidator(validatorId) {
    return this.#validators.get(validatorId) ?? null;
  }

  listValidators({ providerId = null, scope = null } = {}) {
    return [...this.#validators.values()]
      .filter(({ descriptor }) => !providerId || descriptor.providerId === providerId)
      .filter(({ descriptor }) => !scope || descriptor.scope === scope)
      .map(({ descriptor }) => publicClone(descriptor))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  getMigration(migrationId) {
    return this.#migrations.get(migrationId) ?? null;
  }

  listMigrations({ providerId = null } = {}) {
    return [...this.#migrations.values()]
      .filter(({ descriptor }) => !providerId || descriptor.providerId === providerId)
      .map(({ descriptor }) => publicClone(descriptor))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  hasCapability(capability, { providerId = null, systemId = null } = {}) {
    return [...this.#providers.values()].some(({ descriptor }) => {
      if (providerId && descriptor.id !== providerId) return false;
      if (systemId && descriptor.systems.length > 0 && !descriptor.systems.some((system) => system.id === systemId)) return false;
      return descriptor.capabilities.includes(capability);
    });
  }

  snapshot() {
    return deepFreeze({
      providers: this.listProviders(),
      packs: this.listPacks(),
      validators: this.listValidators(),
      migrations: this.listMigrations(),
    });
  }
}
