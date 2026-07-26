export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function deepClone(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Functions and Foundry documents are intentionally handled by the fallback.
    }
  }
  if (Array.isArray(value)) return value.map((entry) => deepClone(entry));
  if (!isPlainObject(value)) return value;

  const clone = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "function") clone[key] = deepClone(entry);
  }
  return clone;
}

export function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

export function publicClone(value) {
  return deepFreeze(deepClone(value));
}

export function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function safeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  return {
    name: "Error",
    message: String(error),
    stack: null,
  };
}
