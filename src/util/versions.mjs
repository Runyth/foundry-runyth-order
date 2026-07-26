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
  if (range.minimum && compareVersions(version, range.minimum) < 0) return false;
  if (range.maximum && compareVersions(version, range.maximum) > 0) return false;
  return true;
}

export function normalizeCompatibility(value = {}) {
  return {
    minimum: value.minimum ? String(value.minimum) : null,
    verified: value.verified ? String(value.verified) : null,
    maximum: value.maximum ? String(value.maximum) : null,
  };
}
