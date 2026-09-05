/**
 * Structure descriptions — display side (default-branch pass). The map is
 * CLI-managed store metadata injected at generation time and matched by
 * `row.repoRel` (repo-relative). Coverage: attach semantics (repoRel, own-key
 * prototype safety), layout growth without overlap, renderer output (escaped,
 * same-baseline, surface-masked), and that NO row with a description keeps the
 * historical SVG byte-identical. Persisted config never carries descriptions
 * (an inline key is a strict unknown-field error).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildDefaultConfig } from "../../src/config/defaults.js";
import { DEFAULT_RUNTIME } from "../../src/runtime.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { mixHex } from "../../src/theme/color.js";
import { buildTree } from "../../src/structure/tree.js";
import { buildStructureData } from "../../src/structure/model.js";
import type { StructureData, StructureRow } from "../../src/structure/model.js";
import { attachStructureDescriptions } from "../../src/display/builtin/structure/presenter.js";
import { layoutStructure, DESC_FONT, DESC_GAP, COUNT_FONT } from "../../src/layout/structure.js";
import { estimateTextWidth } from "../../src/layout/measure.js";
import { renderStructureCard } from "../../src/structure/render.js";
import type { ActivityDay } from "../../src/structure/activity.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fixture = any;

const fixture = (name: string): Fixture => JSON.parse(readFileSync(`tests/golden/fixtures/${name}`, "utf8"));

const arte = resolveTheme(DEFAULT_THEME);
const ST_F = fixture("structure-7d.json");

function makeData(): StructureData {
  const tree = buildTree(
    ST_F.files.map((p: string) => ({ absolutePath: p, relative: p })),
    ".",
    ST_F.maxDepth,
  );
  const activity = {
    totalCommits: ST_F.activity.totalCommits,
    byDir: new Map(Object.entries(ST_F.activity.byDir)) as Map<string, ActivityDay[]>,
  };
  return buildStructureData(tree, activity, ST_F.days, new Date(ST_F.now));
}

/** Build a small tree whose rendered rows are exactly `rels` (single segment). */
function tinyData(rels: string[]): StructureData {
  const files = rels.flatMap((rel) => [`${rel}/a.ts`, `${rel}/b.ts`]);
  const tree = buildTree(
    files.map((p) => ({ absolutePath: p, relative: p })),
    ".",
    3,
  );
  return buildStructureData(tree, null, 7, new Date(0));
}

function singleRow(repoRel: string, rel: string): StructureData {
  const row: StructureRow = {
    name: rel.split("/").pop()!,
    rel,
    repoRel,
    depth: 0,
    descendantDirs: 0,
    dirs: 0,
    files: 0,
    hasChildren: false,
    activity: Array.from({ length: 7 }, () => ({ commits: 0, additions: 0, deletions: 0 })),
  };
  return { rows: [row], days: 7, totalCommits: 0, startDate: "2000-01-01" };
}

describe("persisted config never owns descriptions", () => {
  it("a default config is schema-valid; an inline `descriptions:` key is a strict unknown-field error", () => {
    expect(DEFAULT_RUNTIME.config.v2Schema.safeParse(buildDefaultConfig()).success).toBe(true);
    const withInline = JSON.parse(JSON.stringify(buildDefaultConfig())) as {
      cards: { structure: Record<string, unknown>; codebase: unknown };
    };
    withInline.cards.structure = { ...withInline.cards.structure, descriptions: { src: "核心源码" } };
    expect(DEFAULT_RUNTIME.config.v2Schema.safeParse(withInline).success).toBe(false);
  });
});

describe("attachStructureDescriptions — exact row.repoRel match", () => {
  it("matches rows by exact repoRel and safely ignores unknown/stale keys", () => {
    const data = makeData();
    const firstRepoRel = data.rows[0]!.repoRel;
    expect(firstRepoRel.length).toBeGreaterThan(0);

    attachStructureDescriptions(data, {
      [firstRepoRel]: "核心源码",
      "never/exists": "ignored", // matches no rendered row → safely ignored
      ".": "ignored", // synthetic root is not a rendered row → ignored
    });

    const matched = data.rows.find((r) => r.repoRel === firstRepoRel)!;
    expect(matched.description).toBe("核心源码");
    const others = data.rows.filter((r) => r.repoRel !== firstRepoRel);
    expect(others.every((r) => r.description === undefined)).toBe(true);
  });

  it("keys are REPO-relative, not display-relative (a root-hidden repoRel still attaches)", () => {
    // Display rel "b" under root "a" has repoRel "a/b" — the store key is "a/b".
    const data = singleRow("a/b", "b");
    attachStructureDescriptions(data, { "a/b": "深层" });
    expect(data.rows[0]!.description).toBe("深层");
    const data2 = singleRow("a/b", "b");
    attachStructureDescriptions(data2, { b: "wrong-namespace" });
    expect(data2.rows[0]!.description).toBeUndefined();
  });

  it("is a no-op when descriptions is undefined or empty", () => {
    const a = makeData();
    attachStructureDescriptions(a, undefined);
    expect(a.rows.every((r) => r.description === undefined)).toBe(true);
    const b = makeData();
    attachStructureDescriptions(b, {});
    expect(b.rows.every((r) => r.description === undefined)).toBe(true);
  });

  it("prototype-named directories never read Object.prototype (P1)", () => {
    const data = tinyData(["constructor", "toString", "__proto__"]);
    attachStructureDescriptions(data, {});
    expect(data.rows.every((r) => r.description === undefined)).toBe(true);
    const layout = layoutStructure(data, { commits: true, changes: true });
    expect(renderStructureCard(layout, arte, 1).includes(".desc{")).toBe(false);

    const data2 = tinyData(["constructor", "toString", "__proto__"]);
    const map = JSON.parse('{"constructor":"c","toString":"t","__proto__":"p"}') as Record<string, string>;
    attachStructureDescriptions(data2, map);
    expect(data2.rows.find((r) => r.repoRel === "constructor")!.description).toBe("c");
    expect(data2.rows.find((r) => r.repoRel === "toString")!.description).toBe("t");
    expect(data2.rows.find((r) => r.repoRel === "__proto__")!.description).toBe("p");
  });
});

describe("layout: descriptions widen the tree/card without overlap or height change", () => {
  it("grows tree/card width, right-shifts commits, keeps height and global count alignment", () => {
    const noDesc = makeData();
    const withDesc = makeData();
    const map: Record<string, string> = {};
    for (const r of withDesc.rows) map[r.repoRel] = "核心源码";
    attachStructureDescriptions(withDesc, map);

    const a = layoutStructure(noDesc, { commits: true, changes: true });
    const b = layoutStructure(withDesc, { commits: true, changes: true });

    expect(b.cardWidth).toBeGreaterThan(a.cardWidth);
    expect(b.columns.tree.width).toBeGreaterThan(a.columns.tree.width);
    expect(b.columns.commits.left).toBeGreaterThan(a.columns.commits.left);
    expect(b.cardHeight).toBe(a.cardHeight);

    const rights = new Set(b.rows.map((r) => r.countRight));
    expect(rights.size).toBe(1);

    for (const row of b.rows) {
      expect(row.descXLocal).toBeDefined();
      const descW = estimateTextWidth(row.row.description!, { fontSize: DESC_FONT, mono: false });
      // The dirs phrase slot begins after the longest description; each row's own
      // description never reaches it (>= DESC_GAP breathing room).
      const descEndGlobal = row.iconLeft + row.descXLocal! + descW;
      expect(b.countAnchors.dirsSlotLeft - descEndGlobal).toBeGreaterThanOrEqual(DESC_GAP - 0.01);
    }
  });
});

describe("renderer: description text is small, same-baseline, escaped, masked; absent → byte-identical shape", () => {
  const descFill = mixHex(arte.palette.text, arte.palette.surface, 0.55);
  const descRule = `.desc{fill:${descFill};font-size:${DESC_FONT}px;font-weight:400}`;

  it("emits NO description style/text when no row has one", () => {
    const layout = layoutStructure(makeData(), { commits: true, changes: true });
    const svg = renderStructureCard(layout, arte, ST_F.analyzedSourceFiles);
    expect(svg.includes(descRule)).toBe(false);
    expect(svg.includes('class="desc"')).toBe(false);
  });

  it("emits the .desc style + escaped same-baseline text only when a row has one", () => {
    const data = makeData();
    const raw = `<b>&"核心源码`;
    const map: Record<string, string> = {};
    for (const r of data.rows) map[r.repoRel] = raw;
    attachStructureDescriptions(data, map);
    const layout = layoutStructure(data, { commits: true, changes: true });
    const svg = renderStructureCard(layout, arte, ST_F.analyzedSourceFiles);

    expect(svg).toContain(descRule);
    expect(svg).toContain('y="4.5" class="desc">&lt;b&gt;&amp;&quot;核心源码</text>');
    const noDescLayout = layoutStructure(makeData(), { commits: true, changes: true });
    expect(layout.cardWidth).toBeGreaterThan(noDescLayout.cardWidth);
  });
});
