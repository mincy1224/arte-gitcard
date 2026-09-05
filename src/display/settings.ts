/** Typed Display settings — own parse/get/set/reset over a typed config slice, never string-path. The CLI key is auto-prefixed `${display.id}.${setting.key}`. */

export interface DisplaySetting<C> {
  /** e.g. "limit" → CLI key `<displayId>.limit` (hyphenated like existing keys). */
  readonly key: string;
  /** human type label for `config list` (e.g. "integer 1..20"). */
  readonly type: string;
  readonly description: string;
  read(c: C): unknown;
  /** Parse + apply a raw CLI value; throws on invalid. */
  apply(c: C, raw: string): void;
  reset(c: C): void;
}

export class DisplaySettingError extends Error {}

function fail(message: string): never {
  throw new DisplaySettingError(message);
}

export function parseBool(raw: string, label: string): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fail(`${label} expects a boolean (true|false), got "${raw}"`);
}

export function parseIntegerRange(raw: string, min: number, max: number, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    return fail(`${label} expects an integer in ${min}..${max}, got "${raw}"`);
  }
  return n;
}

export function parseEnumValue(raw: string, values: readonly (number | string)[], label: string): number | string {
  const hit = values.find((v) => String(v) === raw);
  if (hit === undefined) {
    return fail(`${label} expects one of ${values.join("|")}, got "${raw}"`);
  }
  return hit as number | string;
}
