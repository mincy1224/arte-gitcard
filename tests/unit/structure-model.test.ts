/**
 * buildStructureData (SPEC §5) — the production model the Structure golden
 * now flows through: startDate = window day 0, rows from flattenTree with
 * descendantDirs/hasChildren wired, activity attached by repoRel.
 */

import { describe, expect, it } from "vitest";
import { buildTree } from "../../src/structure/tree.js";
import { buildStructureData } from "../../src/structure/model.js";

const files = ["src/a.ts", "src/components/b.ts", "src/core/mod.ts", "src/core/parser/p.ts", "src/tests/t.ts"].map(
  (relative) => ({ absolutePath: relative, relative }),
);

const activity = {
  totalCommits: 5,
  byDir: new Map([
    ["src", Array.from({ length: 7 }, () => ({ commits: 1, additions: 2, deletions: 1 }))],
    ["src/components", Array.from({ length: 7 }, () => ({ commits: 0, additions: 1, deletions: 0 }))],
  ]),
};

describe("buildStructureData (SPEC §5)", () => {
  it("startDate = window day 0 = now - (days-1) in UTC", () => {
    const tree = buildTree(files, ".", 3);
    const data = buildStructureData(tree, activity, 7, new Date("2026-08-31T12:00:00.000Z"));
    expect(data.startDate).toBe("2026-08-25"); // 2026-08-31 minus 6 days
    expect(data.days).toBe(7);
    expect(data.totalCommits).toBe(5);
  });

  it("rows come from flattenTree with descendantDirs + hasChildren wired", () => {
    const tree = buildTree(files, ".", 3);
    const data = buildStructureData(tree, activity, 7, new Date("2026-08-31T00:00:00.000Z"));
    expect(data.rows.map((r) => r.name)).toEqual(["src", "components", "core", "parser", "tests"]);
    const src = data.rows[0]!;
    expect(src.repoRel).toBe("src");
    expect(src.hasChildren).toBe(true); // children: components, core, tests
    expect(src.descendantDirs).toBe(4); // components + core + parser + tests
    expect(data.rows[1]!.descendantDirs).toBe(0); // components is a leaf
    expect(data.rows[2]!.hasChildren).toBe(true); // core → parser
  });

  it("activity attaches by repoRel; missing dirs get zero-filled days", () => {
    const tree = buildTree(files, ".", 3);
    const data = buildStructureData(tree, activity, 7, new Date("2026-08-31T00:00:00.000Z"));
    const src = data.rows.find((r) => r.name === "src")!;
    expect(src.activity[0]!.commits).toBe(1);
    expect(src.activity[0]!.additions).toBe(2);
    const parser = data.rows.find((r) => r.name === "parser")!;
    expect(parser.activity).toHaveLength(7);
    expect(parser.activity[3]!.commits).toBe(0); // no activity for parser → zeros
  });
});
