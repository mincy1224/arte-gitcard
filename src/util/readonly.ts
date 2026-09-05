/** Recursively readonly view (arrays/Map/objects). Compile-time guard only. */
export type DeepReadonly<T> = T extends Map<infer K, infer V>
  ? ReadonlyMap<K, DeepReadonly<V>>
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends (...args: never[]) => unknown
      ? T
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

/**
 * Field-agnostic deep clone for STRICT JSON-compatible data (defaults, config).
 * Never shares references, so materializing/mutating one copy never corrupts a
 * canonical default snapshot or another materialization.
 */
export function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
