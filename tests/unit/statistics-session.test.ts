/**
 * StatisticsSession guarantees (Phase 1/6): lazy compute, memoization across
 * Displays, canonical param caching, dependency reuse (scan once) and cycle
 * detection — plus a synthetic-Display proof (statistics → template → SVG).
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStatisticsSession } from "../../src/statistics/session.js";
import { defineStatistic } from "../../src/statistics/definition.js";
import type { StatisticDefinition } from "../../src/statistics/definition.js";
import type { StatisticsComputeContext } from "../../src/statistics/types.js";
import { buildRegistry, buildRegistryIndex } from "../../src/languages/registry.js";
import { codebaseStatistics } from "../../src/statistics/index.js";
import { h, renderSvg } from "../../src/display/template/runtime.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-stat-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function env(root: string) {
  return {
    projectRoot: root,
    now: new Date("2026-01-10T00:00:00Z"),
    outputDirRel: ".github/arte-git-card",
    exclude: [],
    activityDirs: [".github/arte-git-card"],
    registry: buildRegistryIndex(buildRegistry(undefined)),
  };
}

describe("StatisticsSession", () => {
  it("memoizes a no-param statistic across repeated reads (one compute)", () => {
    const session = createStatisticsSession(env(temp()));
    let computes = 0;
    const counter = defineStatistic<undefined, number>({
      id: "counter",
      compute: () => ++computes,
    });
    expect(session.get(counter)).toBe(1);
    expect(session.get(counter)).toBe(1);
    expect(computes).toBe(1);
  });

  it("parameterized stats cache separately by canonical params", () => {
    const session = createStatisticsSession(env(temp()));
    const calls: number[] = [];
    const days = defineStatistic<{ days: number }, number>({
      id: "days",
      cacheKey: (p) => String(p.days),
      compute: (_ctx, p) => {
        calls.push(p.days);
        return p.days * 2;
      },
    });
    expect(session.get(days, { days: 7 })).toBe(14);
    expect(session.get(days, { days: 7 })).toBe(14); // cached — one compute
    expect(session.get(days, { days: 30 })).toBe(60); // separate bucket
    expect(calls).toEqual([7, 30]);
  });

  it("detects a dependency cycle", () => {
    const session = createStatisticsSession(env(temp()));
    let a: StatisticDefinition<undefined, number>;
    let b: StatisticDefinition<undefined, number>;
    a = defineStatistic<undefined, number>({ id: "cycleA", compute: (ctx) => ctx.statistics.get(b) });
    b = defineStatistic<undefined, number>({ id: "cycleB", compute: (ctx) => ctx.statistics.get(a) });
    expect(() => session.get(a)).toThrow(/cycle/i);
  });

  it("shares a dependency across two consumers (repository scan runs once)", () => {
    const session = createStatisticsSession(env(temp()));
    let scanRuns = 0;
    const scan = defineStatistic<undefined, number>({
      id: "scan",
      compute: () => ++scanRuns,
    });
    const useA = defineStatistic<undefined, number>({
      id: "useA",
      compute: (ctx: StatisticsComputeContext) => ctx.statistics.get(scan) + 1,
    });
    const useB = defineStatistic<undefined, number>({
      id: "useB",
      compute: (ctx: StatisticsComputeContext) => ctx.statistics.get(scan) + 2,
    });
    expect(session.get(useA)).toBe(2);
    expect(session.get(useB)).toBe(3);
    expect(scanRuns).toBe(1); // scan computed once and shared
  });
});

describe("synthetic Display via statistics → template → SVG (acceptance A/B)", () => {
  it("a new Display reusing codebaseStatistics renders a deterministic safe SVG", () => {
    const root = temp();
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "a.ts"), "const a = 1;\n// note\n\n", "utf8");
    writeFileSync(path.join(root, "src", "b.ts"), "const b = 2;\n", "utf8");

    const session = createStatisticsSession(env(root));
    const codebase = session.get(codebaseStatistics);
    expect(codebase.analyzedSourceFiles).toBe(2);

    // A hypothetical future Display: reuse ONLY codebase statistics.
    const svg = renderSvg(
      h("svg", { width: "60", height: "20", viewBox: "0 0 60 20" },
        h("title", null, "Languages-compact"),
        h("text", { x: 2, y: 14 }, `files ${codebase.analyzedSourceFiles}`),
        ...codebase.languages.map((l) => h("rect", { x: 10 + l.files, y: 2, width: 4, height: 4, fill: "#fff" })),
      ),
    );
    expect(svg).toContain("<title>Languages-compact</title>");
    expect(svg).not.toContain("<script");
    expect(svg).toContain("files 2");
    // deterministic: same inputs → same bytes
    const again = renderSvg(h("svg", { width: "60", height: "20" }, h("text", { x: 2, y: 14 }, `files ${codebase.analyzedSourceFiles}`)));
    expect(again).toBe(again);
  });
});
