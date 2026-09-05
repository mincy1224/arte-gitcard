/**
 * StatisticsSession (one per generation): TRULY lazy compute, memoized per
 * definition-object across every Display (the repository scan runs ONCE even
 * when Codebase + Structure both consume it), canonical deterministic param
 * keys (fail closed on unsupported values — see canonicalParams), dependency
 * reuse, and cycle detection.
 *
 * The cache is keyed by the StatisticDefinition OBJECT (compile-time token),
 * not its id: two independent definitions may share an id for diagnostics but
 * never alias each other's value/cycle state.
 *
 * Each compute receives its OWN Date clone of the generation instant — the
 * shared mutable env Date is never handed out.
 */

import type { Registry } from "../languages/registry.js";
import type { StatisticDefinition } from "./definition.js";
import type { DeepReadonly, StatisticsComputeContext, StatisticsReader } from "./types.js";

export interface StatisticsEnvironment {
  projectRoot: string;
  now: Date;
  outputDirRel: string;
  exclude?: string[];
  activityDirs: string[];
  registry: Registry;
}

/** Namespace a real param body (default-canonicalized or custom cacheKey) away from the no-params sentinel. */
const DEFAULT_BODY = "@default";
const PARAM_PREFIX = "P:";

/**
 * Canonicalize a params object to a stable, genuinely COLLISION-SAFE string.
 * Supported domain only: null | boolean | finite number | string | arrays |
 * plain objects (sorted keys). Leaves are TYPE-TAGGED so supported primitives
 * can never alias each other (`"5"` ≠ 5, `true` ≠ `"true"`).
 *
 * Collision-safety guarantees (LC-3):
 *  - numbers encode canonically: 0 and -0 are DISTINCT (Object.is); NaN/∞ fail;
 *  - plain objects become an explicit sorted ["obj", protoTag, [[key, value], …]]
 *    TUPLE tree — never rebuilt into a normal `{}` — so the prototype is part of
 *    the key (Object.prototype vs null-proto objects are DISTINCT) and an own
 *    "__proto__" key can never alias an empty object;
 *  - own keys via Reflect.ownKeys + descriptors: symbol, non-enumerable and
 *    accessor properties all FAIL CLOSED;
 *  - arrays reject sparse arrays and any extra/symbol/non-enumerable/accessor
 *    own property.
 *
 * FAILS CLOSED on undefined/bigint/symbol/function/NaN/Infinity/Date/Map/Set/
 * class instances/non-plain objects/sparse arrays/circular values, with an
 * actionable message suggesting StatisticDefinition.cacheKey.
 */
function canonicalParams(params: Readonly<unknown>): string {
  const seen = new WeakSet<object>();

  const enc = (value: unknown): unknown => {
    if (value === null) return ["null"];
    const t = typeof value;
    switch (t) {
      case "boolean":
        return ["bool", value];
      case "number": {
        if (!Number.isFinite(value as number)) {
          throw new Error("unsupported (NaN/Infinity)");
        }
        // -0 is distinct (Object.is) but String()s to "0" — encode it explicitly.
        return ["num", Object.is(value as number, -0) ? "-0" : String(value as number)];
      }
      case "string":
        return ["str", value];
      case "undefined":
        throw new Error("unsupported (undefined)");
      case "bigint":
        throw new Error("unsupported (bigint)");
      case "symbol":
        throw new Error("unsupported (symbol)");
      case "function":
        throw new Error("unsupported (function)");
      default:
        break;
    }
    if (value === null || typeof value !== "object") throw new Error(`unsupported (${t})`);
    const obj = value as object;
    if (obj instanceof Date) throw new Error("unsupported (Date)");
    if (obj instanceof Map) throw new Error("unsupported (Map)");
    if (obj instanceof Set) throw new Error("unsupported (Set)");
    if (seen.has(obj)) throw new Error("unsupported (circular)");
    seen.add(obj);
    try {
      if (Array.isArray(obj)) return encodeArray(obj as unknown[]);
      const proto = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error("unsupported (non-plain object)");
      }
      return encodeObject(obj, proto);
    } finally {
      seen.delete(obj);
    }
  };

  const encodeArray = (arr: unknown[]): unknown => {
    const len = arr.length;
    // A hole is not an own property and serializes like nothing-to-null in JSON —
    // ambiguous, so sparse arrays FAIL CLOSED instead of silently normalizing.
    for (let i = 0; i < len; i++) {
      if (!(i in arr)) throw new Error("unsupported (sparse array)");
    }
    // The ONLY allowed own keys are the canonical index props (+ non-enumerable
    // `length`). Reject extra/non-index, symbol, non-enumerable and accessor props.
    for (const k of Reflect.ownKeys(arr)) {
      if (k === "length") continue;
      const ks = typeof k === "string" ? k : "";
      if (!/^(?:0|[1-9]\d*)$/.test(ks) || Number(ks) >= len) {
        throw new Error("unsupported (array extra/non-index/symbol property)");
      }
      const desc = Object.getOwnPropertyDescriptor(arr, ks);
      if (!desc) throw new Error("unsupported (array element without descriptor)");
      if (desc.get || desc.set) throw new Error("unsupported (accessor array element)");
      if (!desc.enumerable) throw new Error("unsupported (non-enumerable array element)");
    }
    const out: unknown[] = new Array(len);
    for (let i = 0; i < len; i++) out[i] = enc(arr[i]);
    return out;
  };

  const encodeObject = (obj: object, proto: object | null): unknown => {
    // Snapshot every own data property first, then emit a sorted ["obj", protoTag,
    // [[key, value], …]] tuple tree — never a rebuilt `{}`. Symbols/non-enumerable/
    // accessor props fail closed; insertion order is normalized by the sort.
    const entries: Array<[string, PropertyDescriptor]> = [];
    for (const k of Reflect.ownKeys(obj)) {
      if (typeof k !== "string") throw new Error("unsupported (symbol key)");
      const desc = Object.getOwnPropertyDescriptor(obj, k);
      if (!desc) throw new Error("unsupported (property without descriptor)");
      if (desc.get || desc.set) throw new Error("unsupported (accessor property)");
      if (!desc.enumerable) throw new Error("unsupported (non-enumerable property)");
      entries.push([k, desc]);
    }
    entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    // Read values off descriptors (never obj["__proto__"]) so "__proto__" is an
    // ordinary key; the key's proto tag already makes null-proto objects distinct.
    const protoTag = proto === null ? "null-proto" : "object-proto";
    return ["obj", protoTag, entries.map(([k, desc]) => [k, enc(desc.value)])];
  };

  try {
    return JSON.stringify(enc(params));
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unsupported value";
    throw new Error(
      `statistics: params could not be canonicalized deterministically (${reason}) — ` +
        `supported values are null/boolean/finite-number/string/arrays/plain objects. ` +
        `Define StatisticDefinition.cacheKey for this parameter type.`,
    );
  }
}

function paramBody<P>(definition: StatisticDefinition<P, unknown>, params: Readonly<P> | undefined): string {
  if (params === undefined) return DEFAULT_BODY;
  const body = definition.cacheKey ? definition.cacheKey(params) : canonicalParams(params);
  return PARAM_PREFIX + body;
}

export class StatisticsSession implements StatisticsReader {
  private readonly env: StatisticsEnvironment;
  private readonly instant: number;
  /** Per-definition-object cache: definition → canonicalParamBody → value. */
  private readonly cache = new Map<StatisticDefinition<unknown, unknown>, Map<string, unknown>>();
  /** Per-definition-object cycle stack (param bodies currently computing). */
  private readonly computing = new Map<StatisticDefinition<unknown, unknown>, string[]>();

  constructor(env: StatisticsEnvironment) {
    this.env = env;
    // FC-2: keep the generation instant as a primitive; consumers get their own Date clone.
    this.instant = env.now.getTime();
  }

  get<P, R>(definition: StatisticDefinition<P, R>, params?: Readonly<P>): DeepReadonly<R> {
    const body = paramBody(definition, params);
    const key = definition as StatisticDefinition<unknown, unknown>;
    let byParams = this.cache.get(key);
    if (!byParams) {
      byParams = new Map<string, unknown>();
      this.cache.set(key, byParams);
    }
    if (byParams.has(body)) return byParams.get(body) as DeepReadonly<R>;

    const stack = this.computing.get(key) ?? [];
    if (stack.includes(body)) {
      throw new Error(`statistic cycle detected: "${definition.id}" (${body}) depends on itself`);
    }
    stack.push(body);
    this.computing.set(key, stack);
    try {
      const value = definition.compute(this.context(), params as Readonly<P>);
      byParams.set(body, value);
      return value as unknown as DeepReadonly<R>;
    } finally {
      stack.pop();
      if (stack.length === 0) this.computing.delete(key);
    }
  }

  private context(): StatisticsComputeContext {
    return {
      projectRoot: this.env.projectRoot,
      now: new Date(this.instant), // fresh Date per compute call
      outputDirRel: this.env.outputDirRel,
      exclude: this.env.exclude,
      activityDirs: this.env.activityDirs,
      registry: this.env.registry,
      statistics: this,
    };
  }
}

export function createStatisticsSession(env: StatisticsEnvironment): StatisticsSession {
  return new StatisticsSession(env);
}
