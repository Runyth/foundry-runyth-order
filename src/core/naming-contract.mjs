// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_ID, MODULE_TITLE } from "../constants.mjs";
import { isPlainObject, publicClone } from "../util/objects.mjs";

export const RUNYTH_ORDER_NAME = MODULE_TITLE;
export const RUNYTH_ORDER_TITLE_PATTERN = "Runyth Order: <Category> <Content Name>";

export const NAMING_CODES = Object.freeze({
  PROVIDER_MISMATCH: "PROVIDER_NAMING_MISMATCH",
  MODULE_MISMATCH: "MODULE_NAMING_MISMATCH",
  METADATA_CONFLICT: "NAMING_METADATA_CONFLICT",
  METADATA_INVALID: "NAMING_METADATA_INVALID",
  METADATA_MISSING: "NAMING_METADATA_MISSING",
});

function requiredText(value, field, path) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`${path}.${field} must be a non-empty string.`);
  return normalized;
}

export function buildCanonicalTitle({ orderName, moduleKind, contentName }) {
  return `${String(orderName).trim()}: ${String(moduleKind).trim()} ${String(contentName).trim()}`;
}

export function normalizeNamingMetadata(value, { path = "naming" } = {}) {
  if (value == null) return null;
  if (!isPlainObject(value)) throw new TypeError(`${path} must be an object.`);

  const naming = {
    orderName: requiredText(value.orderName, "orderName", path),
    moduleKind: requiredText(value.moduleKind, "moduleKind", path),
    contentName: requiredText(value.contentName, "contentName", path),
    canonicalTitle: requiredText(value.canonicalTitle, "canonicalTitle", path),
  };

  if (naming.orderName !== RUNYTH_ORDER_NAME) {
    throw new TypeError(`${path}.orderName must be exactly ${RUNYTH_ORDER_NAME}.`);
  }

  const derived = buildCanonicalTitle(naming);
  if (naming.canonicalTitle !== derived) {
    throw new TypeError(`${path}.canonicalTitle must equal ${derived}.`);
  }

  return publicClone(naming);
}

function manifestFlags(module) {
  if (isPlainObject(module?.flags)) return module.flags;
  if (isPlainObject(module?.manifest?.flags)) return module.manifest.flags;
  try {
    const object = module?.toObject?.();
    if (isPlainObject(object?.flags)) return object.flags;
  } catch {
    // Some Package implementations may not expose a serializable object during init.
  }
  return null;
}

export function readManifestNaming(module) {
  const raw = manifestFlags(module)?.runyth ?? null;
  if (raw == null) return { naming: null, error: null };
  try {
    return { naming: normalizeNamingMetadata(raw, { path: "module.flags.runyth" }), error: null };
  } catch (error) {
    return { naming: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function finding({ severity, code, messageKey, provider, module, expectedTitle, data = {} }) {
  return publicClone({
    severity,
    code,
    messageKey,
    providerId: provider.id,
    moduleId: provider.moduleId,
    data: {
      providerId: provider.id,
      moduleId: provider.moduleId,
      actualProviderTitle: provider.title,
      actualModuleTitle: String(module?.title ?? ""),
      expectedTitle: expectedTitle ?? "",
      requiredPattern: RUNYTH_ORDER_TITLE_PATTERN,
      ...data,
    },
  });
}

export function evaluateProviderNaming({ provider, module }) {
  if (!provider || provider.id === MODULE_ID || provider.moduleId === MODULE_ID) return [];

  const providerNaming = provider.naming ?? null;
  const { naming: moduleNaming, error: moduleNamingError } = readManifestNaming(module);
  const findings = [];

  if (moduleNamingError) {
    findings.push(
      finding({
        severity: "warning",
        code: NAMING_CODES.METADATA_INVALID,
        messageKey: "RO.Naming.MetadataInvalid",
        provider,
        module,
        expectedTitle: providerNaming?.canonicalTitle ?? null,
        data: { reason: moduleNamingError },
      }),
    );
  }

  if (!providerNaming && !moduleNaming) {
    findings.push(
      finding({
        severity: "info",
        code: NAMING_CODES.METADATA_MISSING,
        messageKey: "RO.Naming.MetadataMissing",
        provider,
        module,
        expectedTitle: null,
      }),
    );
    return findings;
  }

  const authoritative = providerNaming ?? moduleNaming;
  const expectedTitle = authoritative.canonicalTitle;

  if (providerNaming && moduleNaming && providerNaming.canonicalTitle !== moduleNaming.canonicalTitle) {
    findings.push(
      finding({
        severity: "warning",
        code: NAMING_CODES.METADATA_CONFLICT,
        messageKey: "RO.Naming.MetadataConflict",
        provider,
        module,
        expectedTitle,
        data: { manifestExpectedTitle: moduleNaming.canonicalTitle },
      }),
    );
  }

  if (provider.title !== expectedTitle) {
    findings.push(
      finding({
        severity: "warning",
        code: NAMING_CODES.PROVIDER_MISMATCH,
        messageKey: "RO.Naming.ProviderMismatch",
        provider,
        module,
        expectedTitle,
      }),
    );
  }

  if (String(module?.title ?? "") !== expectedTitle) {
    findings.push(
      finding({
        severity: "warning",
        code: NAMING_CODES.MODULE_MISMATCH,
        messageKey: "RO.Naming.ModuleMismatch",
        provider,
        module,
        expectedTitle,
      }),
    );
  }

  return findings;
}

export function isConsoleNamingWarning(finding) {
  return [NAMING_CODES.PROVIDER_MISMATCH, NAMING_CODES.MODULE_MISMATCH].includes(finding?.code);
}

export function formatNamingConsoleWarning(finding) {
  const data = publicClone(finding?.data ?? {});
  return {
    message: "Complementary provider naming does not follow the Runyth Order contract.",
    data: { code: finding?.code ?? "NAMING_WARNING", ...data },
  };
}
