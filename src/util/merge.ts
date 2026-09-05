/** Deep-merge plain objects/arrays. Arrays and primitives from `source` win. */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(base: T, source: unknown): T {
  if (!isPlainObject(source)) {
    return (source === undefined ? base : source) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
