/**
 * Framework Closure regressions:
 *  FC-1  generation is TRULY lazy — internal planner requests no statistics
 *        unless a Display does (scan/analyze count 0 for a stateless Display).
 *  FC-2  Display/Statistic Date inputs never share a mutable clock.
 *  FC-4  canonical params are collision-safe / fail-closed on ambiguous values.
 *  FC-6  function-component children pass through in the safe TSX runtime.
 *  FC-8  display defaults are canonical snapshots (fresh deep clones).
 *  LC-1  ONE canonical defaults snapshot is captured at definition-freeze time
 *        (the author defaults() runs once; later calls clone that snapshot).
 *  LC-3  canonical params distinguish 0/-0, {} vs null-prototype {"__proto__"},
 *        and normal {} vs a null-prototype object with identical own props
 *        (the supported prototype is encoded in the canonical key), and fail
 *        closed on symbol keys, non-enumerable props and sparse arrays.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const fcCounters = vi.hoisted(() => ({ scan: 0, analyze: 0 }));

vi.mock("../../src/scanner/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/scanner/index.js")>();
  return {
    ...actual,
    scanRepository: vi.fn((...args: Parameters<typeof actual.scanRepository>) => {
      fcCounters.scan += 1;
      return actual.scanRepository(...args);
    }),
  };
});

vi.mock("../../src/codebase/analyze.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/codebase/analyze.js")>();
  return {
    ...actual,
    analyzeCodebase: vi.fn((...args: Parameters<typeof actual.analyzeCodebase>) => {
      fcCounters.analyze += 1;
      return actual.analyzeCodebase(...args);
    }),
  };
});

import { createArteRuntime } from "../../src/runtime.js";
import {
  defineDisplay,
  ensureDisplayCardSlice,
  freshDisplayDefaults,
  resolveDisplayConfig,
} from "../../src/display/definition.js";
import { h, renderSvg } from "../../src/display/template/runtime.js";
import type { SvgNode } from "../../src/display/template/runtime.js";
import type { DisplayContext } from "../../src/display/types.js";
import { planCardArtifactsInternal } from "../../src/generate/plan.js";
import { codebaseStatistics } from "../../src/statistics/index.js";
import { defineStatistic } from "../../src/statistics/definition.js";
import { createStatisticsSession } from "../../src/statistics/session.js";
import { buildRegistry, buildRegistryIndex } from "../../src/languages/registry.js";
import type { LoadedConfig } from "../../src/config/types.js";
import type { ResolvedTheme } from "../../src/theme/resolve.js";

const dirs: string[] = [];
function tmpRoot(): string {
  const d = mkdtempSync(path.join(os.tmpdir(), "agc-fc-"));
  mkdirSync(path.join(d, "src"), { recursive: true });
  writeFileSync(path.join(d, "src", "main.ts"), "const x = 1;\n// c\n", "utf8");
  dirs.push(d);
  return d;
}
afterEach(() => {
  fcCounters.scan = 0;
  fcCounters.analyze = 0;
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function makeDisplay(id: string, template: (ctx: DisplayContext<any>) => SvgNode) {
  return defineDisplay<any>({
    id,
    title: id,
    config: {
      schema: z.object({ enabled: z.boolean() }).strict() as any,
      defaults: () => ({ enabled: false }),
      requiredInSchemaV2: false,
      settings: [],
    },
    template,
  });
}

function loadedFor(root: string, cards: Record<string, unknown>): LoadedConfig {
  return {
    config: {
      "schema-version": 2,
      cards: cards as never,
      theme: ".arte-git-card/themes/arte-theme.yml",
      output: { directory: ".github/arte-git-card" },
      "auto-update": false,
    },
    projectRoot: root,
    configPath: path.join(root, "arte-gitcard.yml"),
  };
}
const theme = {} as ResolvedTheme;

describe("FC-1: generation is truly lazy", () => {
  it("a Display that requests NO statistic never triggers scan/analyze", () => {
    const root = tmpRoot();
    const statless = makeDisplay("statless", () => h("svg", null, h("title", null, "x")));
    const runtime = createArteRuntime({ displays: [statless] });
    const loaded = loadedFor(root, { statless: { enabled: true } });
    const out = planCardArtifactsInternal(loaded, theme, { runtime });
    expect(out.artifacts).toHaveLength(1);
    expect(fcCounters.scan).toBe(0);
    expect(fcCounters.analyze).toBe(0);
  });

  it("a Display requesting codebaseStatistics runs scan+analyze once, even across two Displays", () => {
    const root = tmpRoot();
    const codeA = makeDisplay("code-a", (ctx) => {
      const cb = ctx.statistics.get(codebaseStatistics);
      return h("svg", null, h("text", null, String(cb.analyzedSourceFiles)));
    });
    const codeB = makeDisplay("code-b", (ctx) => {
      const cb = ctx.statistics.get(codebaseStatistics);
      return h("svg", null, h("text", null, String(cb.analyzedSourceFiles)));
    });
    const runtime = createArteRuntime({ displays: [codeA, codeB] });
    const loaded = loadedFor(root, { "code-a": { enabled: true }, "code-b": { enabled: true } });
    const out = planCardArtifactsInternal(loaded, theme, { runtime });
    expect(out.artifacts).toHaveLength(2);
    expect(fcCounters.scan).toBe(1);
    expect(fcCounters.analyze).toBe(1);
  });
});

describe("FC-2: Display/Statistic Date inputs never share a mutable clock", () => {
  it("Display A mutating ctx.now cannot affect Display B or a Statistic compute", () => {
    const root = tmpRoot();
    const instant = new Date("2021-03-04T05:06:07.000Z").getTime();
    let bObserved = 0;
    let statObserved = 0;
    const probeStat = defineStatistic<undefined, number>({
      id: "probe-time",
      compute: (ctx) => {
        statObserved = ctx.now.getTime();
        return 1;
      },
    });
    const displayA = makeDisplay("time-a", (ctx) => {
      ctx.now.setTime(0); // hostile mutation of the received Date
      return h("svg", null);
    });
    const displayB = makeDisplay("time-b", (ctx) => {
      bObserved = ctx.now.getTime();
      ctx.statistics.get(probeStat);
      return h("svg", null);
    });
    const runtime = createArteRuntime({ displays: [displayA, displayB] });
    const loaded = loadedFor(root, { "time-a": { enabled: true }, "time-b": { enabled: true } });
    planCardArtifactsInternal(loaded, theme, { now: new Date(instant), runtime });
    expect(bObserved).toBe(instant);
    expect(statObserved).toBe(instant);
  });
});

describe("FC-4: canonical params are collision-safe and fail closed", () => {
  function session() {
    const root = tmpRoot();
    return createStatisticsSession({
      projectRoot: root,
      now: new Date("2022-01-01T00:00:00Z"),
      outputDirRel: ".github/arte-git-card",
      activityDirs: [".github/arte-git-card"],
      registry: buildRegistryIndex(buildRegistry(undefined)),
    });
  }

  it("supported primitives never alias ({a:5} vs {a:\"5\"})", () => {
    let runs = 0;
    const stat = defineStatistic<{ a: number | string }, number | string>({
      id: "alias",
      compute: (_ctx, params) => {
        runs += 1;
        return params.a;
      },
    });
    const s = session();
    expect(s.get(stat, { a: 5 })).toBe(5);
    expect(s.get(stat, { a: "5" })).toBe("5");
    expect(s.get(stat, { a: 5 })).toBe(5);
    expect(runs).toBe(2); // two DISTINCT canonical bodies
  });

  it("ambiguous/non-plain values fail closed with the cacheKey hint", () => {
    const stat = defineStatistic<Record<string, unknown>, number>({ id: "reject", compute: () => 1 });
    const s = session();
    expect(() => s.get(stat, { v: undefined })).toThrow(/canonicalized/i);
    expect(() => s.get(stat, { v: Number.NaN })).toThrow(/canonicalized/i);
    expect(() => s.get(stat, { v: new Date() })).toThrow(/canonicalized/i);
    expect(() => s.get(stat, { v: new Map() })).toThrow(/canonicalized/i);
    expect(() => s.get(stat, { v: () => 1 })).toThrow(/canonicalized/i);
    const circle: Record<string, unknown> = {};
    circle.self = circle;
    expect(() => s.get(stat, circle)).toThrow(/canonicalized/i);
  });

  it("LC-3: 0 and -0 canonicalize to DISTINCT cache entries", () => {
    let runs = 0;
    const stat = defineStatistic<{ n: number }, number>({
      id: "negzero",
      compute: (_ctx, params) => {
        runs += 1;
        return params.n;
      },
    });
    const s = session();
    expect(s.get(stat, { n: 0 })).toBe(0);
    expect(s.get(stat, { n: -0 })).toBe(-0);
    expect(runs).toBe(2); // two DISTINCT canonical bodies — no -0/0 collapse
    expect(s.get(stat, { n: -0 })).toBe(-0);
    expect(runs).toBe(2); // memoized within its own body
  });

  it("LC-3: {} vs a null-prototype object with own \"__proto__\" key are DISTINCT", () => {
    let runs = 0;
    const stat = defineStatistic<object, number>({
      id: "proto-obj",
      compute: () => {
        runs += 1;
        return 1;
      },
    });
    const s = session();
    const nullProto: Record<string, unknown> = Object.create(null);
    nullProto["__proto__"] = "x"; // an ordinary own DATA property here
    expect(s.get(stat, {})).toBe(1);
    expect(s.get(stat, nullProto)).toBe(1);
    expect(runs).toBe(2); // the own "__proto__" key is never aliased to {} or lost
  });

  it("LC-3: a normal {} and a null-prototype object with identical own props are DISTINCT", () => {
    let runs = 0;
    const stat = defineStatistic<object, number>({
      id: "proto-kind",
      compute: (_ctx, params) => {
        runs += 1;
        // A Statistic can observe the difference via Object.getPrototypeOf — so
        // the canonical cache key must encode the supported prototype too.
        return Object.getPrototypeOf(params) === null ? 2 : 1;
      },
    });
    const s = session();
    const normal = { x: 1 };
    const nullProto: Record<string, unknown> = Object.create(null);
    nullProto.x = 1;
    expect(s.get(stat, normal)).toBe(1);
    expect(s.get(stat, nullProto)).toBe(2);
    expect(runs).toBe(2); // normal {} and null-prototype {} are DISTINCT cache entries
    expect(s.get(stat, normal)).toBe(1);
    expect(s.get(stat, nullProto)).toBe(2);
    expect(runs).toBe(2); // each memoized within its own canonical body
  });

  it("LC-3: symbol own keys fail closed instead of being ignored", () => {
    const s = session();
    const stat = defineStatistic<object, number>({ id: "symbol-key", compute: () => 1 });
    const withSymbol = { [Symbol("k")]: 1 };
    expect(() => s.get(stat, withSymbol)).toThrow(/canonicalized/i);
  });

  it("LC-3: a non-enumerable own property fails closed instead of being ignored", () => {
    const s = session();
    const stat = defineStatistic<object, number>({ id: "non-enum", compute: () => 1 });
    const withHidden: Record<string, unknown> = {};
    Object.defineProperty(withHidden, "hidden", { value: 1, enumerable: false });
    expect(() => s.get(stat, withHidden)).toThrow(/canonicalized/i);
  });

  it("LC-3: a sparse array fails closed instead of normalizing holes", () => {
    const s = session();
    const stat = defineStatistic<object, number>({ id: "sparse", compute: () => 1 });
    const sparse = new Array(3);
    sparse[0] = 1;
    sparse[2] = 3; // index 1 is a hole
    expect(() => s.get(stat, sparse as object)).toThrow(/canonicalized/i);
  });

  it("LC-3: normal nested JSON-like params stay stable and order-independent", () => {
    let runs = 0;
    const stat = defineStatistic<object, number>({
      id: "stable-order",
      compute: () => {
        runs += 1;
        return 1;
      },
    });
    const s = session();
    expect(s.get(stat, { a: 1, b: { c: "x" }, d: [1, 2] })).toBe(1);
    expect(s.get(stat, { d: [1, 2], b: { c: "x" }, a: 1 })).toBe(1);
    expect(runs).toBe(1); // same canonical body regardless of insertion order
  });
});

describe("FC-6: function-component children pass through", () => {
  it("renders nested JSX children through a component", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Group = (props: { children?: unknown }): SvgNode =>
      h("g", null, props.children as never);
    const out = renderSvg(h(Group, null, h("text", null, "Hello")));
    expect(out).toContain("<text>Hello</text>");
  });
});

describe("FC-8: display defaults are canonical deep-cloned snapshots", () => {
  it("two defaults results never share nested references; mutating one is inert", () => {
    const shared = { enabled: false, nested: { limit: 3 } };
    const display = defineDisplay<any>({
      id: "shared-defaults",
      title: "Shared",
      config: {
        schema: z.object({ enabled: z.boolean(), nested: z.object({ limit: z.number() }) }).strict() as any,
        defaults: () => shared,
        requiredInSchemaV2: false,
        settings: [],
      },
      template: () => h("svg", null),
    });
    const a = freshDisplayDefaults(display);
    const b = freshDisplayDefaults(display);
    expect(a.nested).not.toBe(b.nested);
    a.nested.limit = 999;
    expect(b.nested.limit).toBe(3);
    expect(shared.nested.limit).toBe(3);
  });

  it("LC-1: the author defaults() runs ONCE — every later result is a clone of that snapshot", () => {
    let calls = 0;
    const display = defineDisplay<any>({
      id: "canonical-defaults",
      title: "Canonical",
      config: {
        schema: z
          .object({ enabled: z.boolean(), nested: z.object({ limit: z.number() }).strict() })
          .strict() as any,
        // A nondeterministic/mutable-closure defaults fn: must not keep advancing.
        defaults: () => ({ enabled: false, nested: { limit: ++calls } }),
        requiredInSchemaV2: false,
        settings: [],
      },
      template: () => h("svg", null),
    });
    expect(calls).toBe(1); // freeze-time capture invoked the author fn exactly once

    // Compiling the runtime re-validates a CLONE of the canonical snapshot.
    const runtime = createArteRuntime({ displays: [display] });
    void runtime;

    const config = { cards: {} as Record<string, unknown> };
    const a = freshDisplayDefaults(display);
    const b = freshDisplayDefaults(display);
    const resolved = resolveDisplayConfig(config, display); // absent optional → defaults
    const materialized = ensureDisplayCardSlice(config, display); // materialization

    expect(calls).toBe(1); // the original defaults fn is never invoked again
    for (const value of [a, b, resolved, materialized]) {
      expect(value.nested.limit).toBe(1); // every result starts from the SAME value
    }

    // Mutating one returned default never affects another or the canonical value.
    a.nested.limit = 999;
    expect(b.nested.limit).toBe(1);
    expect(resolved.nested.limit).toBe(1);
    expect(materialized.nested.limit).toBe(1);
    expect(freshDisplayDefaults(display).nested.limit).toBe(1);
    expect(calls).toBe(1);
  });
});
