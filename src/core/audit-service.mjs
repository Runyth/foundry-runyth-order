import {
  AUDIT_SEVERITIES,
  DEFAULT_VALIDATOR_TIMEOUT_MS,
  HOOKS,
} from "../constants.mjs";
import { withTimeout } from "../util/async.mjs";
import { publicClone, safeError } from "../util/objects.mjs";
import { readSource } from "./source-flags.mjs";

const SEVERITY_SET = new Set(AUDIT_SEVERITIES);

function issueId(providerId, code, suffix = "") {
  return `${providerId}:${code}${suffix ? `:${suffix}` : ""}`;
}

function normalizeIssue(issue, providerId, index) {
  if (!issue || typeof issue !== "object") {
    throw new TypeError(`Validator ${providerId} returned a non-object issue at index ${index}.`);
  }

  const severity = String(issue.severity ?? "warning");
  if (!SEVERITY_SET.has(severity)) {
    throw new TypeError(`Validator ${providerId} returned unsupported severity ${severity}.`);
  }

  const code = String(issue.code ?? `issue-${index + 1}`).trim();
  const message = String(issue.message ?? "").trim();
  if (!message) throw new TypeError(`Validator ${providerId} returned an issue without a message.`);

  return {
    id: String(issue.id ?? issueId(providerId, code, String(index + 1))),
    providerId,
    severity,
    code,
    title: String(issue.title ?? code),
    message,
    remediation: issue.remediation ? String(issue.remediation) : null,
    documentUuid: issue.documentUuid ? String(issue.documentUuid) : null,
    data: issue.data && typeof issue.data === "object" ? publicClone(issue.data) : {},
  };
}

export class ActorAuditService {
  constructor({ registry, resolveUuid, hooks = globalThis.Hooks, logger }) {
    this.registry = registry;
    this.resolveUuid = resolveUuid;
    this.hooks = hooks;
    this.logger = logger;
  }

  async resolveActor(actorOrUuid) {
    if (typeof actorOrUuid === "string") {
      const document = await this.resolveUuid(actorOrUuid);
      if (!document || document.documentName !== "Actor") {
        throw new TypeError(`UUID ${actorOrUuid} does not resolve to an Actor.`);
      }
      return document;
    }
    if (!actorOrUuid || actorOrUuid.documentName !== "Actor") {
      throw new TypeError("An Actor document or Actor UUID is required.");
    }
    return actorOrUuid;
  }

  async auditActor(actorOrUuid, { includeProviderValidators = true } = {}) {
    const actor = await this.resolveActor(actorOrUuid);
    const startedAt = new Date().toISOString();
    const issues = [];
    const providerRuns = [];

    this.hooks?.callAll?.(HOOKS.BEFORE_AUDIT_ACTOR, actor);
    issues.push(...(await this.#auditSources(actor)));

    if (includeProviderValidators) {
      for (const descriptor of this.registry.listValidators({ scope: "actor" })) {
        const registered = this.registry.getValidator(descriptor.id);
        const runStarted = performance.now();
        try {
          const result = await withTimeout(
            Promise.resolve(
              registered.run({
                actor,
                options: publicClone({ includeProviderValidators }),
                provider: this.registry.getProvider(descriptor.providerId),
                packs: this.registry.listPacks({ providerId: descriptor.providerId }),
                coreApi: {
                  registry: this.registry.snapshot(),
                  resolveUuid: this.resolveUuid,
                  readSource,
                },
              }),
            ),
            descriptor.timeoutMs ?? DEFAULT_VALIDATOR_TIMEOUT_MS,
            `Validator ${descriptor.id} timed out.`,
          );
          if (!Array.isArray(result)) {
            throw new TypeError(`Validator ${descriptor.id} must return an array.`);
          }
          result.forEach((issue, index) => {
            issues.push(normalizeIssue(issue, descriptor.providerId, index));
          });
          providerRuns.push({
            validatorId: descriptor.id,
            status: "ok",
            issueCount: result.length,
            durationMs: Math.round(performance.now() - runStarted),
          });
        } catch (error) {
          const serialized = safeError(error);
          this.logger?.warn(`Actor validator ${descriptor.id} failed.`, error);
          issues.push({
            id: issueId(descriptor.providerId, "validator-failed", descriptor.localId),
            providerId: descriptor.providerId,
            severity: "error",
            code: "VALIDATOR_FAILED",
            title: descriptor.title,
            message: `Validator ${descriptor.title} failed: ${serialized.message}`,
            remediation: "Update or disable the provider module, then rerun the audit.",
            documentUuid: actor.uuid,
            data: { validatorId: descriptor.id },
          });
          providerRuns.push({
            validatorId: descriptor.id,
            status: "failed",
            issueCount: 1,
            durationMs: Math.round(performance.now() - runStarted),
            error: serialized,
          });
        }
      }
    }

    const counts = {
      info: issues.filter((issue) => issue.severity === "info").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      error: issues.filter((issue) => issue.severity === "error").length,
    };
    const report = publicClone({
      schemaVersion: 1,
      actor: {
        uuid: actor.uuid,
        id: actor.id,
        name: actor.name,
        type: actor.type,
      },
      startedAt,
      completedAt: new Date().toISOString(),
      counts,
      issues,
      providerRuns,
    });
    this.hooks?.callAll?.(HOOKS.AFTER_AUDIT_ACTOR, actor, report);
    return report;
  }

  async #auditSources(actor) {
    const issues = [];
    const seen = new Set();
    const items = actor.items ? [...actor.items] : [];

    for (const item of items) {
      const source = readSource(item);
      if (!source) continue;
      const sourceKey = `${source.providerId}:${source.packId}:${source.entryId}`;
      if (seen.has(sourceKey)) {
        issues.push({
          id: issueId("runyth-rules-core", "duplicate-source", item.id),
          providerId: "runyth-rules-core",
          severity: "warning",
          code: "DUPLICATE_SOURCE",
          title: "Duplicate managed source",
          message: `${item.name} duplicates another embedded Item from ${sourceKey}.`,
          remediation: "Review the Actor and remove only the unintended duplicate.",
          documentUuid: item.uuid,
          data: { sourceKey },
        });
      }
      seen.add(sourceKey);

      const provider = this.registry.getProvider(source.providerId);
      if (!provider) {
        issues.push({
          id: issueId("runyth-rules-core", "missing-provider", item.id),
          providerId: "runyth-rules-core",
          severity: "error",
          code: "MISSING_PROVIDER",
          title: "Source provider unavailable",
          message: `${item.name} came from ${source.providerId}, but that provider is not registered.`,
          remediation: "Enable or update the complementary module that owns this content.",
          documentUuid: item.uuid,
          data: { source },
        });
        continue;
      }

      const pack = this.registry.getPack(source.packId);
      if (!pack) {
        issues.push({
          id: issueId("runyth-rules-core", "missing-pack", item.id),
          providerId: "runyth-rules-core",
          severity: "error",
          code: "MISSING_PACK",
          title: "Source pack unavailable",
          message: `${item.name} references unavailable pack ${source.packId}.`,
          remediation: "Update the owning provider or correct the document source metadata.",
          documentUuid: item.uuid,
          data: { source },
        });
        continue;
      }

      const entry = pack.entries.find((candidate) => candidate.id === source.entryId);
      if (!entry) {
        issues.push({
          id: issueId("runyth-rules-core", "missing-entry", item.id),
          providerId: "runyth-rules-core",
          severity: "warning",
          code: "MISSING_ENTRY",
          title: "Source entry no longer declared",
          message: `${item.name} references ${source.entryId}, which is not declared by ${pack.title}.`,
          remediation: "Check the provider changelog before replacing or removing the Actor Item.",
          documentUuid: item.uuid,
          data: { source },
        });
      }

      if (source.contentVersion && pack.version && source.contentVersion !== pack.version) {
        issues.push({
          id: issueId("runyth-rules-core", "content-version", item.id),
          providerId: "runyth-rules-core",
          severity: "info",
          code: "CONTENT_VERSION_DIFFERENCE",
          title: "Newer source content may exist",
          message: `${item.name} was imported from pack version ${source.contentVersion}; ${pack.version} is registered.`,
          remediation: "Review the provider's migration or update guidance before changing the Actor.",
          documentUuid: item.uuid,
          data: { sourceVersion: source.contentVersion, registeredVersion: pack.version },
        });
      }

      if (source.sourceUuid) {
        const sourceDocument = await this.resolveUuid(source.sourceUuid).catch(() => null);
        if (!sourceDocument) {
          issues.push({
            id: issueId("runyth-rules-core", "unresolved-source-uuid", item.id),
            providerId: "runyth-rules-core",
            severity: "warning",
            code: "UNRESOLVED_SOURCE_UUID",
            title: "Source UUID cannot be resolved",
            message: `${item.name} references unavailable UUID ${source.sourceUuid}.`,
            remediation: "Enable the provider compendium or update the source reference.",
            documentUuid: item.uuid,
            data: { sourceUuid: source.sourceUuid },
          });
        }
      }
    }

    return issues;
  }
}
