/**
 * Golden = Production Renderer (SPEC §9). This is the real regression guard:
 * it runs the PRODUCTION model → layout → renderer over the shared fixtures
 * and asserts the output is byte-identical to the frozen golden SVGs.
 *
 * `tests/golden/gen-goldens.mjs` regenerates those files intentionally via
 * `npm run golden:update`; normal `npm test` only compares here and never
 * overwrites them.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveTheme } from "../../src/theme/resolve.js";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { GITHUB_THEME } from "../../src/theme/github-theme.js";
import { buildCodebaseCard } from "../../src/codebase/card.js";
import { layoutCodebase } from "../../src/layout/codebase.js";
import { renderCodebaseCard } from "../../src/codebase/render.js";
import { buildTree } from "../../src/structure/tree.js";
import { buildStructureData } from "../../src/structure/model.js";
import type { ActivityDay } from "../../src/structure/activity.js";
import { layoutStructure } from "../../src/layout/structure.js";
import { renderStructureCard } from "../../src/structure/render.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fixture = any;

const fixture = (name: string): Fixture =>
  JSON.parse(readFileSync(`tests/golden/fixtures/${name}`, "utf8"));
const golden = (name: string): string => readFileSync(`tests/golden/baselines/arte/${name}`, "utf8");
const gitGolden = (name: string): string => readFileSync(`tests/golden/baselines/github-theme/${name}`, "utf8");

function codebaseCard(f: Fixture, includeComments: boolean, minCardWidth: number, theme: ReturnType<typeof resolveTheme>): string {
  const data = buildCodebaseCard(f, includeComments, theme.dataColors);
  return renderCodebaseCard(layoutCodebase(data, { minCardWidth }), theme);
}

function structureCard(f: Fixture, theme: ReturnType<typeof resolveTheme>): string {
  // Production chain: raw fixture → model → layout → renderer (SPEC §9).
  const tree = buildTree(
    f.files.map((p: string) => ({ absolutePath: p, relative: p })),
    ".",
    f.maxDepth,
  );
  const activity = {
    totalCommits: f.activity.totalCommits,
    byDir: new Map(Object.entries(f.activity.byDir)) as Map<string, ActivityDay[]>,
  };
  const data = buildStructureData(tree, activity, f.days, new Date(f.now), "example-repo");
  return renderStructureCard(layoutStructure(data, { commits: true, changes: true }), theme, f.analyzedSourceFiles);
}

const arte = resolveTheme(DEFAULT_THEME);
const git = resolveTheme(GITHUB_THEME);

describe("production renderer == frozen golden (arte-theme)", () => {
  const cases: Array<[string, string]> = [
    ["codebase-golden.svg", codebaseCard(fixture("codebase.json"), false, 680, arte)],
    ["codebase-golden-comments.svg", codebaseCard(fixture("codebase.json"), true, 680, arte)],
    ["codebase-golden-wide.svg", codebaseCard(fixture("codebase.json"), false, 920, arte)],
    ["structure-7d.svg", structureCard(fixture("structure-7d.json"), arte)],
    ["structure-14d.svg", structureCard(fixture("structure-14d.json"), arte)],
    ["structure-30d.svg", structureCard(fixture("structure-30d.json"), arte)],
  ];
  for (const [file, svg] of cases) {
    it(`${file} is byte-identical to the frozen golden`, () => {
      expect(svg).toBe(golden(file));
    });
  }
});

describe("production renderer == frozen golden (github-theme)", () => {
  const cases: Array<[string, string]> = [
    ["codebase.svg", codebaseCard(fixture("codebase.json"), false, 680, git)],
    ["codebase-comments.svg", codebaseCard(fixture("codebase.json"), true, 680, git)],
    ["codebase-wide.svg", codebaseCard(fixture("codebase.json"), false, 920, git)],
    ["structure-7d.svg", structureCard(fixture("structure-7d.json"), git)],
    ["structure-14d.svg", structureCard(fixture("structure-14d.json"), git)],
    ["structure-30d.svg", structureCard(fixture("structure-30d.json"), git)],
  ];
  for (const [file, svg] of cases) {
    it(`${file} is byte-identical to the frozen golden`, () => {
      expect(svg).toBe(gitGolden(file));
    });
  }
});
