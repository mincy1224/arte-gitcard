import { describe, expect, it } from "vitest";
import { layoutCodebase, NAME_FONT, VALUE_FONT } from "../../src/layout/codebase.js";
import { layoutStructure, changeBarHeight } from "../../src/layout/structure.js";
import { commitScaleLegendText } from "../../src/structure/commit-scale.js";
import { buildTree, flattenTree } from "../../src/structure/tree.js";
import { estimateTextWidth } from "../../src/layout/measure.js";
import type { CodebaseCardData } from "../../src/codebase/card.js";
import type { StructureData } from "../../src/structure/model.js";
import { MINI_BAR_WIDTH, MINI_BAR_GAP, SWATCH_TEXT_OFFSET, LANGUAGE_ITEM_GAP } from "../../src/layout/languages.js";

function fakeCard(): CodebaseCardData {
  const lang = (id: string, name: string, counted: number, color: string) => ({
    id, name, color, counted, fraction: 0, value: `${counted} · 1.0%`,
  });
  return {
    total: "48,732",
    effective: "38,642 · 79.3%",
    comments: "6,940 · 14.2%",
    blank: "3,150 · 6.5%",
    summaryFracs: [0.793, 0.142, 0.065],
    languages: [
      lang("ts", "TypeScript", 15147, "#A86D76"),
      lang("py", "Python", 10859, "#4A877F"),
      lang("rs", "Rust", 6338, "#8B7D47"),
      lang("js", "JavaScript", 3285, "#6E77A4"),
      lang("go", "Go", 1584, "#AD6D5D"),
      lang("sh", "Shell", 1429, "#5E8D6E"),
    ],
    includeComments: false,
  };
}

describe("codebase card layout", () => {
  const layout = layoutCodebase(fakeCard());

  const groupsByRow = (items: Array<{ row: number; col: number; miniBarLeft: number; width: number }>) => {
    const rows = new Map<number, Array<{ row: number; col: number; miniBarLeft: number; width: number }>>();
    for (const p of items) {
      const arr = rows.get(p.row) ?? [];
      arr.push(p);
      rows.set(p.row, arr);
    }
    return [...rows.values()].map((arr) => [...arr].sort((a, b) => a.col - b.col));
  };
  const rowCenterX = (row: Array<{ row: number; col: number; miniBarLeft: number; width: number }>) => {
    const first = row[0]!.miniBarLeft;
    const last = row[row.length - 1]!.miniBarLeft;
    return (first + (last + row[0]!.width)) / 2;
  };

  it("summary row is ONE centered group of 4 equally-spaced items (row center == card center)", () => {
    const a = layout.summaryColumnAnchors;
    expect(a).toHaveLength(4);
    // equal pitch inside the row: B−A == C−B == D−C == cell+gap
    const pitch = layout.legendCellWidth + LANGUAGE_ITEM_GAP;
    expect(a[1]! - a[0]!).toBeCloseTo(a[2]! - a[1]!, 9);
    expect(a[2]! - a[1]!).toBeCloseTo(a[3]! - a[2]!, 9);
    expect(a[1]! - a[0]!).toBeCloseTo(pitch, 9);
    // the whole 4-item row is centered on the card center
    expect(a[0]! + layout.summaryRowWidth / 2).toBeCloseTo(layout.centerX, 6);
    layout.metrics.forEach((m, i) => expect(m.left).toBeCloseTo(a[i]!, 9));
    // every summary item fits its uniform cell (no overlap with a neighbour)
    for (const m of layout.metrics) {
      const extent = Math.max(
        estimateTextWidth(m.value, { fontSize: VALUE_FONT, mono: true }),
        SWATCH_TEXT_OFFSET + estimateTextWidth(m.name, { fontSize: NAME_FONT, mono: false }),
      );
      expect(extent).toBeLessThanOrEqual(layout.legendCellWidth + 1e-9);
    }
  });

  it("summary bar is centered and 0.8×contentWidth; fan spans eff→eff(+comments)", () => {
    const contentWidth = layout.cardWidth - 48;
    expect(layout.summary.width).toBeCloseTo(0.8 * contentWidth, 1);
    expect(Math.abs(layout.summary.left + layout.summary.width / 2 - layout.centerX)).toBeLessThan(0.1);
    expect(layout.fanTopLeft).toBeCloseTo(layout.summary.left, 1);
    expect(layout.fanTopRight).toBeCloseTo(layout.summary.effEnd, 1);
    expect(layout.fanTopRight).toBeGreaterThan(layout.fanTopLeft);
  });

  it("full 4-item language row shares the summary row's centered anchors; EVERY row centered (fakeCard 680)", () => {
    const l = layoutCodebase(fakeCard());
    const area = l.languageArea;
    expect(area.columns).toBe(4);
    expect(area.distribution).toEqual([4, 2]);
    const groups = groupsByRow(area.items);
    const [full, tail] = groups;
    // every rendered row's bounding-box center == the card/content center
    for (const row of groups) expect(rowCenterX(row)).toBeCloseTo(l.centerX, 6);
    // the full 4-item row shares the summary row's centered anchors exactly
    expect(full!.map((p) => p.miniBarLeft)).toEqual(l.summaryColumnAnchors);
    // equal pitch inside the full row
    for (let c = 1; c < full!.length; c++) {
      expect(full![c]!.miniBarLeft - full![c - 1]!.miniBarLeft).toBeCloseTo(area.cellWidth + LANGUAGE_ITEM_GAP, 6);
    }
    // the incomplete 2-item tail is centered as its OWN row — NOT the first 2 anchors
    expect(tail).toHaveLength(2);
    expect(tail![0]!.miniBarLeft).not.toBeCloseTo(l.summaryColumnAnchors[0]!, 6);
    expect(tail!.map((p) => p.miniBarLeft)).not.toEqual(l.summaryColumnAnchors.slice(0, 2));
    for (const p of area.items) {
      expect(p.nameLeft).toBeCloseTo(p.miniBarLeft + MINI_BAR_WIDTH + MINI_BAR_GAP, 6);
      expect(p.valueLeft).toBeCloseTo(p.miniBarLeft, 6); // value at item left
    }
  });

  it("3-item final row is independently centered, NOT left-aligned to the first 3 anchors (7 items, 4 cols)", () => {
    const card = fakeCard();
    card.languages = [...card.languages, { id: "kotlin", name: "Kotlin", color: "#7C5A99", counted: 900, fraction: 0, value: "900 · 1.0%" }];
    const l = layoutCodebase(card);
    const area = l.languageArea;
    expect(area.columns).toBe(4);
    expect(area.distribution).toEqual([4, 3]);
    const groups = groupsByRow(area.items);
    const [full, tail] = groups;
    expect(tail).toHaveLength(3);
    for (const row of groups) expect(rowCenterX(row)).toBeCloseTo(l.centerX, 6);
    // the 3-item tail row is its own centered group — NOT the first 3 summary anchors
    expect(tail![0]!.miniBarLeft).not.toBeCloseTo(l.summaryColumnAnchors[0]!, 6);
    expect(tail!.map((p) => p.miniBarLeft)).not.toEqual(l.summaryColumnAnchors.slice(0, 3));
    // …but it still has equal internal pitch
    for (let c = 1; c < tail!.length; c++) {
      expect(tail![c]!.miniBarLeft - tail![c - 1]!.miniBarLeft).toBeCloseTo(area.cellWidth + LANGUAGE_ITEM_GAP, 6);
    }
  });

  it("non-4 language grids keep every ROW centered (independent of the summary row)", () => {
    const l = layoutCodebase(fakeCard(), { minCardWidth: 920 });
    const area = l.languageArea;
    expect(area.columns).not.toBe(4); // wide card resolves to a larger count
    for (const row of groupsByRow(area.items)) {
      expect(rowCenterX(row)).toBeCloseTo(l.centerX, 6);
    }
    // independent geometry: its anchors are NOT the (4-item) summary anchors
    const row0 = groupsByRow(area.items)[0]!;
    if (row0.length === l.summaryColumnAnchors.length) {
      expect(row0.map((p) => p.miniBarLeft)).not.toEqual(l.summaryColumnAnchors);
    }
  });
});

function fakeStructure(days: number = 7): StructureData {
  const activity = (max: number) => Array.from({ length: days }, (_, i) => ({ commits: i % (max + 1), additions: i * 2, deletions: i }));
  const rows = [
    { name: "src", rel: "src", repoRel: "src", depth: 0, descendantDirs: 2, dirs: 2, files: 0, hasChildren: true, activity: activity(4) },
    { name: "components", rel: "src/components", repoRel: "src/components", depth: 1, descendantDirs: 0, dirs: 0, files: 0, hasChildren: false, activity: activity(0) },
    { name: "core", rel: "src/core", repoRel: "src/core", depth: 1, descendantDirs: 0, dirs: 0, files: 0, hasChildren: false, activity: activity(1) },
  ];
  return { rows, days, totalCommits: 8, startDate: "2026-08-25" };
}

describe("structure card layout", () => {
  const layout = layoutStructure(fakeStructure(), { commits: true, changes: true });

  it("columns do not overlap and are ordered tree → commits → changes", () => {
    const t = layout.columns.tree;
    const c = layout.columns.commits;
    const ch = layout.columns.changes;
    expect(c.left).toBeGreaterThanOrEqual(t.left + t.width);
    expect(ch.left).toBeGreaterThanOrEqual(c.left + c.width);
  });

  it("every directory has ONE shared rowCenterY (no wrap, SPEC §5)", () => {
    const unique = new Set(layout.rows.map((r) => r.centerY));
    expect(unique.size).toBe(layout.rows.length);
    // rows are 30px apart starting at FIRST_ROW_Y
    expect(layout.rows[1]!.centerY - layout.rows[0]!.centerY).toBe(30);
  });

  it("legend + footer are centered on their columns", () => {
    expect(Math.abs(layout.commitLegend.centerX - layout.columns.commits.centerX)).toBeLessThan(1);
    expect(Math.abs(layout.changesLegend.centerX - layout.columns.changes.centerX)).toBeLessThan(1);
    expect(Math.abs(layout.footer.x - layout.columns.tree.centerX)).toBeLessThan(1);
  });

  it("disabled columns leave NO blank space: real re-layout + card shrinks", () => {
    const all = layoutStructure(fakeStructure(), { commits: true, changes: true });
    const chOnly = layoutStructure(fakeStructure(), { commits: false, changes: true });
    expect(chOnly.columns.commits.enabled).toBe(false);
    // changes slides into the slot the commits column occupied
    expect(chOnly.columns.changes.left).toBe(all.columns.commits.left);
    // card width loses the commits column width + its column gap (fp-tolerant:
    // the count text now carries "dirs/files", so width arithmetic lands a hair
    // off on some platforms)
    expect(chOnly.cardWidth).toBeCloseTo(all.cardWidth - all.columns.commits.width - 32, 6);
    // no trailing gap: changes right edge == contentRight
    expect(chOnly.columns.changes.left + chOnly.columns.changes.width).toBeCloseTo(chOnly.contentRight, 1);

    // tree-only
    const treeOnly = layoutStructure(fakeStructure(), { commits: false, changes: false });
    expect(treeOnly.columns.tree.left + treeOnly.columns.tree.width).toBeCloseTo(treeOnly.contentRight, 1);
    expect(treeOnly.cardWidth).toBeLessThan(chOnly.cardWidth);
  });

  it("7/14/30 NEVER wrap: days widen the columns and card, height stays put", () => {
    const mk = (days: number) => layoutStructure(fakeStructure(days), { commits: true, changes: true });
    const l7 = mk(7);
    const l14 = mk(14);
    const l30 = mk(30);
    expect(l14.columns.commits.width).toBeGreaterThan(l7.columns.commits.width);
    expect(l30.columns.commits.width).toBeGreaterThan(l14.columns.commits.width);
    expect(l30.cardWidth).toBeGreaterThan(l7.cardWidth);
    // height driven only by the directory row count → identical across days
    expect(l14.cardHeight).toBe(l7.cardHeight);
    expect(l30.cardHeight).toBe(l7.cardHeight);
    expect(l30.rows.map((r) => r.centerY)).toEqual(l7.rows.map((r) => r.centerY));
  });

  it("N dirs count right edge aligns globally across depths (countRightLocal)", () => {
    const globalRight = layout.rows.map((r) => r.iconLeft + r.countRightLocal);
    expect(new Set(globalRight).size).toBe(1);
    expect(globalRight[0]).toBeCloseTo(layout.rows[0]!.countRight, 6);
  });

  it("commit legend is centered by MEASURED width, not a fixed offset (SPEC §5)", () => {
    const n = layout.commitScale.thresholds.length;
    const textW = estimateTextWidth(commitScaleLegendText(layout.commitScale), { fontSize: 11, mono: false });
    const width = (n - 1) * 14 + 20 + textW;
    expect(layout.commitLegend.left).toBeCloseTo(layout.columns.commits.centerX - width / 2, 1);
  });

  it("changes additions/deletions use INDEPENDENT maxima (SPEC §5)", () => {
    const l = layoutStructure(fakeStructure(), { commits: true, changes: true });
    // fakeStructure: additions = i*2 (max 12), deletions = i (max 6)
    expect(l.maxAdditions).toBe(12);
    expect(l.maxDeletions).toBe(6);
    // each direction reaches full height against its own max
    expect(changeBarHeight(l.maxAdditions, l.maxAdditions)).toBe(14);
    expect(changeBarHeight(l.maxDeletions, l.maxDeletions)).toBe(14);
  });
});

describe("directory tree (SPEC §5)", () => {
  const files = ["a/b/c/d/f1.ts", "a/b/f2.ts"].map((relative) => ({ absolutePath: relative, relative }));

  it("descendantDirs counts REAL subtree dirs (count before max_depth prune)", () => {
    const deep = flattenTree(buildTree(files, ".", 20));
    const a = deep.find((n) => n.name === "a")!;
    expect(a.descendantDirs).toBe(3); // b, c, d

    const shallow = flattenTree(buildTree(files, ".", 2)); // prune below depth 2
    expect(shallow.some((n) => n.name === "c")).toBe(false);
    expect(shallow.find((n) => n.name === "a")!.descendantDirs).toBe(3); // count unaffected by prune
  });

  it("structure.root stripping keeps repo-relative activity keys via repoRel", () => {
    // generate.ts strips the root prefix before buildTree (display tree), but
    // repoRel still carries the repo-relative path for activity lookup.
    const files2 = ["packages/foo/src/a.ts", "packages/foo/lib/b.ts"].map((relative) => ({ absolutePath: relative, relative }));
    const stripped = files2.map((f) => ({ ...f, relative: f.relative.slice("packages/foo".length + 1) }));
    const tree = buildTree(stripped, "packages/foo", 20);
    const flat = flattenTree(tree);
    expect(flat.map((n) => n.name).sort()).toEqual(["lib", "src"]);
    expect(flat.find((n) => n.name === "src")!.repoRel).toBe("packages/foo/src");
  });
});

describe("codebase empty states (SPEC §6)", () => {
  const emptyCard = (languages: CodebaseCardData["languages"]): CodebaseCardData => ({
    total: "0",
    effective: "0 · 0.0%",
    comments: "0 · 0.0%",
    blank: "0 · 0.0%",
    summaryFracs: [0, 0, 0],
    languages,
    includeComments: false,
  });

  it("zero languages: clean layout, no negative blockWidth/height", () => {
    const layout = layoutCodebase(emptyCard([]));
    expect(layout.languageArea.items).toEqual([]);
    expect(layout.languageArea.height).toBe(0);
    expect(layout.hasLanguageData).toBe(false);
    expect(layout.hasSummaryData).toBe(false);
    expect(layout.cardHeight).toBeGreaterThan(0);
  });

  it("zero counted lines (empty/comments-only): hasLanguageData false, no fan triangle", () => {
    const layout = layoutCodebase(
      emptyCard([{ id: "ts", name: "TypeScript", color: "#A86D76", counted: 0, fraction: 0, value: "0 · 0.0%" }]),
    );
    expect(layout.hasLanguageData).toBe(false);
    expect(layout.languageBar.segments.every((s) => s.width === 0)).toBe(true);
  });
});
