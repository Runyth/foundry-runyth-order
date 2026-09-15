// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_ID, PROVIDER_ID_PATTERN } from "../constants.mjs";
import { isPlainObject, publicClone } from "../util/objects.mjs";

export const SOURCE_FLAG_KEY = "source";

export function normalizeSourceDescriptor(source) {
  if (!isPlainObject(source)) throw new TypeError("source must be an object.");

  const providerId = String(source.providerId ?? "").trim();
  const packId = String(source.packId ?? "").trim();
  const entryId = String(source.entryId ?? "").trim();
  if (!PROVIDER_ID_PATTERN.test(providerId)) throw new TypeError("source.providerId is invalid.");
  if (!packId.startsWith(`${providerId}.`)) {
    throw new TypeError("source.packId must be globally namespaced by source.providerId.");
  }
  if (!entryId) throw new TypeError("source.entryId is required.");

  return {
    schemaVersion: 1,
    providerId,
    packId,
    entryId,
    sourceUuid: source.sourceUuid ? String(source.sourceUuid) : null,
    contentVersion: source.contentVersion ? String(source.contentVersion) : null,
    checksum: source.checksum ? String(source.checksum) : null,
    importedAt: source.importedAt ? String(source.importedAt) : new Date().toISOString(),
  };
}

export function readSource(document) {
  if (!document) return null;
  const source =
    typeof document.getFlag === "function"
      ? document.getFlag(MODULE_ID, SOURCE_FLAG_KEY)
      : document.flags?.[MODULE_ID]?.[SOURCE_FLAG_KEY];
  return isPlainObject(source) ? publicClone(source) : null;
}

export async function tagDocument(document, source, { update = true } = {}) {
  if (!globalThis.game?.user?.isGM) throw new Error("Only a Game Master can tag documents.");

  const normalized = normalizeSourceDescriptor(source);
  if (!update) {
    return {
      [`flags.${MODULE_ID}.${SOURCE_FLAG_KEY}`]: normalized,
    };
  }
  if (!document) throw new TypeError("A Foundry document is required when update is true.");
  if (typeof document.setFlag === "function") {
    await document.setFlag(MODULE_ID, SOURCE_FLAG_KEY, normalized);
    return normalized;
  }
  if (typeof document.update === "function") {
    await document.update({ [`flags.${MODULE_ID}.${SOURCE_FLAG_KEY}`]: normalized });
    return normalized;
  }
  throw new TypeError("The supplied document cannot be updated.");
}
