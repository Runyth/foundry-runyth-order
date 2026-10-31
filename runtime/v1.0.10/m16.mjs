// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
const VERSION_PATTERN = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?\s*$/u;

export function parseVersion(value) {
  const match = VERSION_PATTERN.exec(String(value ?? ""));
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

export function compareVersions(left, right) {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (!parsedLeft || !parsedRight) return null;

  for (let index = 0; index < 3; index += 1) {
    if (parsedLeft[index] > parsedRight[index]) return 1;
    if (parsedLeft[index] < parsedRight[index]) return -1;
  }
  return 0;
}

export function versionInRange(version, range = {}) {
  if (!parseVersion(version)) return false;

  for (const boundary of [range.minimum, range.verified, range.maximum]) {
    if (boundary && !parseVersion(boundary)) return false;
  }

  if (range.minimum) {
    const comparison = compareVersions(version, range.minimum);
    if (comparison === null || comparison < 0) return false;
  }
  if (range.maximum) {
    const comparison = compareVersions(version, range.maximum);
    if (comparison === null || comparison > 0) return false;
  }
  return true;
}

export function normalizeCompatibility(value = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Compatibility must be an object.");
  }

  const normalized = {
    minimum: value.minimum ? String(value.minimum).trim() : null,
    verified: value.verified ? String(value.verified).trim() : null,
    maximum: value.maximum ? String(value.maximum).trim() : null,
  };

  for (const [key, version] of Object.entries(normalized)) {
    if (version && !parseVersion(version)) {
      throw new TypeError(`Compatibility ${key} version ${version} is invalid.`);
    }
  }

  if (
    normalized.minimum &&
    normalized.maximum &&
    compareVersions(normalized.minimum, normalized.maximum) > 0
  ) {
    throw new TypeError("Compatibility minimum cannot be greater than maximum.");
  }

  if (normalized.verified && !versionInRange(normalized.verified, normalized)) {
    throw new TypeError("Compatibility verified version must be inside the declared range.");
  }

  return normalized;
}

export function versionSeries(value) {
  const parsed = parseVersion(value);
  return parsed ? `${parsed[0]}.${parsed[1]}` : null;
}
