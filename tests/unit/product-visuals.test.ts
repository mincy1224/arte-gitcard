/**
 * Focused visual/product regression coverage for the v1.0.0 final pass:
 *  - codebase stacked bar: exact right edge, square trailing segments, one
 *    rounded whole-bar clip (no per-segment pill);
 *  - structure direct dirs/files counts, singular/plural, whole-repo level-0 row,
 *    root commit aggregation;
 *  - activity windows (recent/last-activity × 7/14/30), month/year boundaries,
 *    shared bucket dates, per-bucket header labels.
 */

import { describe, expect, it } from "vitest";
import { layoutCodebase, NAME_FONT, VALUE_FONT } from "../../src/layout/codebase.js";
import { renderCodebaseCard } from "../../src/codebase/render.js";
import type { CodebaseCardData } from "../../src/codebase/card.js";
import {
  MINI_BAR_WIDTH,
  MINI_BAR_HEIGHT,
  MINI_BAR_GAP,
  SWATCH_TEXT_OFFSET,
  LABEL_TO_VALUE_GAP,
  NAME_FONT_SIZE,
  VALUE_FONT_SIZE,
  textBlockCenterY,
  legendItemGeometry,
} from "../../src/layout/languages.js";
import { buildTree } from "../../src/structure/tree.js";
import { buildStructureData } from "../../src/structure/model.js";
import {
  layoutStructure,
  DESC_FONT,
  META_GUTTER,
  NAME_TEXT_OFFSET,
  ROW_FONT_WEIGHT,
  ROOT_FONT_WEIGHT,
  TREE_FONT,
} from "../../src/layout/structure.js";
import { buildCommitScale, levelOf, commitScaleLegendText } from "../../src/structure/commit-scale.js";
import type { CommitScale } from "../../src/structure/commit-scale.js";
import { estimateTextWidth } from "../../src/layout/measure.js";
import { renderStructureCard } from "../../src/structure/render.js";
import { resolveActivityHeader } from "../../src/structure/header.js";
import { resolveActivityWindow, bucketDates } from "../../src/structure/dates.js";
import { parseGitLogNumstat } from "../../src/structure/activity.js";
import type { ActivityDay } from "../../src/structure/activity.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { DEFAULT_CONFIG_V2 } from "../../src/config/defaults.js";
import { DEFAULT_RUNTIME } from "../../src/runtime.js";
import { codeShareOf, shareLabel } from "../../src/structure/share.js";

const theme = resolveTheme(DEFAULT_THEME);

function codebaseCard(fractions: number[]): CodebaseCardData {
  const colors = ["#A86D76", "#4A877F", "#8B7D47", "#6E77A4", "#AD6D5D", "#5E8D6E", "#B9852F", "#705B9E"];
  const languages = fractions.map((fraction, i) => ({
    id: `l${i}`,
    name: `L${i}`,
    color: colors[i % colors.length]!,
    counted: Math.round(fraction * 100000),
    fraction,
    value: `${Math.round(fraction * 100)}%`,
  }));
  return {
    total: "10,000",
    effective: "8,000 · 80.0%",
    comments: "1,000 · 10.0%",
    blank: "1,000 · 10.0%",
    summaryFracs: [0.8, 0.1, 0.1],
    languages,
    includeComments: false,
  };
}

describe("codebase language stacked bar (right edge)", () => {
  it("segments sum EXACTLY to the bar right edge (no overshoot)", () => {
    const fractions = [0.3, 0.3, 0.25, 0.1, 0.03, 0.01, 0.006, 0.004]; // sum 1.0
    const layout = layoutCodebase(codebaseCard(fractions));
    const segs = layout.languageBar.segments;
    const barEnd = layout.languageBar.left + layout.languageBar.width;
    expect(segs[segs.length - 1]!.x + segs[segs.length - 1]!.width).toBeCloseTo(barEnd, 6);
  });

  it("a float-overshooting final tiny segment is clamped, never drawn past the edge", () => {
    // cumulative fractions exceed 1.0 slightly (simulated float overshoot).
    const fractions = [0.5, 0.4, 0.10000000000000002];
    const layout = layoutCodebase(codebaseCard(fractions));
    const barEnd = layout.languageBar.left + layout.languageBar.width;
    for (const s of layout.languageBar.segments) {
      expect(s.x + s.width).toBeLessThanOrEqual(barEnd + 1e-9);
    }
    expect(layout.languageBar.segments[layout.languageBar.segments.length - 1]!.x + layout.languageBar.segments[layout.languageBar.segments.length - 1]!.width).toBeCloseTo(barEnd, 6);
  });

  it("tiny trailing segments render as SQUARE rects inside one rounded clip — no pill path", () => {
    const fractions = [0.4, 0.3, 0.2, 0.05, 0.025, 0.015, 0.005, 0.003, 0.002];
    const svg = renderCodebaseCard(layoutCodebase(codebaseCard(fractions)), theme);
    const clipAt = svg.indexOf('clip-path="url(#agcLangBarClip)">');
    expect(clipAt).toBeGreaterThan(-1);
    const groupEnd = svg.indexOf("</g>", clipAt);
    const group = svg.slice(clipAt, groupEnd);
    expect(group).toContain("<rect");
    expect(group).not.toContain("<path"); // no per-segment rounded path/bulb
  });
});

function structureData(files: string[], days = 7, repoName?: string, activityByDir?: Record<string, ActivityDay[]>) {
  const tree = buildTree(files.map((p) => ({ absolutePath: p, relative: p })), ".", 20);
  const activity = {
    totalCommits: 0,
    byDir: new Map(Object.entries(activityByDir ?? {})) as Map<string, ActivityDay[]>,
  };
  return buildStructureData(tree, activity, days, new Date("2026-09-05T00:00:00Z"), repoName);
}

describe("structure tree counts (direct dirs · direct files)", () => {
  it("direct dirs/files and leaves are counted (not descendants)", () => {
    // root files: a.ts; docs: b.md,c.md + nested dir with d.ts; e/: f.ts
    const files = ["a.ts", "docs/b.md", "docs/c.md", "docs/nested/d.ts", "e/f.ts"];
    const data = structureData(files, 7, "my-repo");
    const root = data.rows[0]!;
    expect(root.name).toBe("my-repo");
    expect(root.depth).toBe(0);
    expect(root.dirs).toBe(2); // docs, e
    expect(root.files).toBe(1); // a.ts
    const docs = data.rows.find((r) => r.rel === "docs")!;
    expect(docs.depth).toBe(1);
    expect(docs.dirs).toBe(1); // nested
    expect(docs.files).toBe(2); // b.md, c.md
    const nested = data.rows.find((r) => r.rel === "docs/nested")!;
    expect(nested.dirs).toBe(0);
    expect(nested.files).toBe(1); // d.ts (leaf)
    const e = data.rows.find((r) => r.rel === "e")!;
    expect(e.files).toBe(1); // f.ts
  });

  it("counts do not shrink when max_depth prunes rendering", () => {
    const files = ["docs/nested/deep/x.ts"];
    const tree = buildTree(files.map((p) => ({ absolutePath: p, relative: p })), ".", 1); // renders only docs
    const data = buildStructureData(tree, null, 7, new Date("2026-09-05T00:00:00Z"));
    const docs = data.rows[0]!;
    expect(docs.dirs).toBe(1); // nested still counted (pre-prune)
    expect(docs.files).toBe(0);
  });

  it("singular/plural via rendered count text", () => {
    const one = structureData(["only.ts", "src/a.ts"], 7);
    const singleDir = one.rows.find((r) => r.rel === "src")!;
    expect(singleDir.dirs).toBe(0);
    expect(singleDir.files).toBe(1);
    const svg = renderStructureCard(layoutStructure(one, { commits: false, changes: false }), theme, 2);
    expect(svg).toContain(">1</text>");
    expect(svg).toContain(">file</text>");
    const many = structureData(["src/a.ts", "src/b.ts"], 7);
    const dir = many.rows.find((r) => r.rel === "src")!;
    expect(dir.files).toBe(2);
    const manySvg = renderStructureCard(layoutStructure(many, { commits: false, changes: false }), theme, 2);
    expect(manySvg).toContain(">2</text>");
    expect(manySvg).toContain(">files</text>");
  });

  it("descriptions coexist with counts (no overwrite)", () => {
    const data = structureData(["src/a.ts"], 7);
    const row = data.rows.find((r) => r.rel === "src")!;
    row.description = "核心源码";
    expect(row.dirs).toBe(0);
    expect(row.files).toBe(1);
    const svg = renderStructureCard(layoutStructure(data, { commits: false, changes: false }), theme, 1);
    expect(svg).toContain("核心源码");
    expect(svg).toContain(">file</text>");
  });

  it("dirs/files labels START at one fixed x each; numbers right-align on fixed edges; description stays clear", () => {
    const data = structureData(
      ["readme.md", "zz/very/deep/name.ts", "src/a/b.ts", "docs/guide.md"],
      7,
      "repo",
    );
    const combos: Array<[number, number]> = [
      [0, 1],
      [1, 9],
      [12, 15],
    ];
    data.rows.forEach((r, i) => {
      const c = combos[i % combos.length]!;
      r.dirs = c[0];
      r.files = c[1];
    });
    const src = data.rows.find((r) => r.rel === "src")!;
    src.description = "核心源码目录"; // longer than many names
    const layout = layoutStructure(data, { commits: false, changes: false });

    // every row shares the SAME global anchors (row-local + iconLeft)
    for (const r of layout.rows) {
      expect(r.dirsLabelXLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.dirsLabelX, 3);
      expect(r.filesLabelXLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.filesLabelX, 3);
      expect(r.dirsNumRightLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.dirsNumRight, 3);
      expect(r.filesNumRightLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.filesNumRight, 3);
      expect(r.sep1XLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.sep1, 3);
    }

    // description clears the dirs metadata slot by at least the META_GUTTER
    // (checked against dirsSlotLeft, the region start — dirsNumRight is too far
    // right to catch content overlapping the gutter/slot).
    const idx = data.rows.indexOf(src);
    const row = layout.rows[idx]!;
    const descW = estimateTextWidth(src.description!, { fontSize: DESC_FONT, mono: false });
    const descEndGlobal = row.iconLeft + row.descXLocal! + descW;
    expect(layout.countAnchors.dirsSlotLeft - descEndGlobal).toBeGreaterThanOrEqual(META_GUTTER - 0.01);

    const svg = renderStructureCard(layout, theme, 4);
    expect(svg).toContain("核心源码目录");
    expect(svg).toContain(">dirs</text>");
    expect(svg).toContain(">dir</text>");
    expect(svg).toContain(">files</text>");
    expect(svg).toContain(">file</text>");
    expect(svg).toContain(">1</text>");
  });
});

describe("whole-repo level-0 row activity aggregation", () => {
  const commitOut =
    "0123456789abcdef0123456789abcdef01234567\n2026-09-03T10:00:00Z\0" +
    ["\n1\t0\tsrc/a.ts", "\n2\t3\tdocs/b.md"].join("\0") +
    "\0";
  const map = parseGitLogNumstat(commitOut, "2026-08-30", 7);

  it("a commit touching multiple top-level dirs counts ONCE at the repo root", () => {
    const tree = buildTree(["src/a.ts", "docs/b.md"].map((p) => ({ absolutePath: p, relative: p })), ".", 20);
    const data = buildStructureData(tree, { totalCommits: map.totalCommits, byDir: map.byDir }, 7, new Date("2026-09-05T00:00:00Z"), "my-repo");
    const root = data.rows[0]!;
    const day = root.activity[4]!; // 2026-09-03 is index 4 of Aug30..Sep5
    expect(day.commits).toBe(1); // NOT multiplied by the 2 files
    expect(day.additions).toBe(3); // sums both files' additions
    expect(day.deletions).toBe(3);
    expect(data.totalCommits).toBe(1);
  });
});

describe("activity windows (recent / last-activity) share one date set", () => {
  it("recent 7 ends today; last-activity 7 ends on the latest commit day", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    const rec = resolveActivityWindow(7, "recent", now);
    expect(rec.endDate).toBe("2026-09-05");
    expect(rec.startDate).toBe("2026-08-30");
    expect(rec.dates).toHaveLength(7);
    const last = resolveActivityWindow(7, "last-activity", now, "2026-08-20");
    expect(last.endDate).toBe("2026-08-20");
    expect(last.startDate).toBe("2026-08-14");
  });

  it("14 and 30 days produce exact bucket dates", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    expect(resolveActivityWindow(14, "recent", now).dates).toHaveLength(14);
    expect(resolveActivityWindow(30, "recent", now).dates).toHaveLength(30);
    expect(resolveActivityWindow(30, "last-activity", now, "2026-08-20").endDate).toBe("2026-08-20");
  });

  it("bucket dates cross months and years cleanly", () => {
    const crossMonth = bucketDates("2026-08-15", 30);
    expect(crossMonth[0]).toBe("2026-07-17"); // prior month
    expect(crossMonth[29]).toBe("2026-08-15");
    const crossYear = bucketDates("2026-01-05", 7);
    expect(crossYear[0]).toBe("2025-12-30");
    expect(crossYear[6]).toBe("2026-01-05");
  });

  it("every rendered row shares the SAME window start/activity arrays", () => {
    const data = structureData(["src/a.ts", "docs/b.md"], 7, "repo", {
      ".": Array.from({ length: 7 }, () => ({ commits: 1, additions: 2, deletions: 0 })),
      src: Array.from({ length: 7 }, () => ({ commits: 1, additions: 2, deletions: 0 })),
    });
    expect(data.rows[0]!.activity).toHaveLength(7);
    for (const r of data.rows) expect(r.activity).toHaveLength(7); // all rows same bucket count
  });

  it("last-activity with no history degrades to recent (empty, no fabricated dates)", () => {
    const w = resolveActivityWindow(7, "last-activity", new Date("2026-09-05T00:00:00Z"), null);
    expect(w.endDate).toBe("2026-09-05");
    expect(w.startDate).toBe("2026-08-30");
  });
});

describe("activity headers correspond to bucket dates", () => {
  it("7-day labels are the ACTUAL weekday of each bucket date", () => {
    // 2026-08-31 is a Monday → M T W T F S S
    expect(resolveActivityHeader(7, "2026-08-31").map((l) => l.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    // 2026-08-30 is a Sunday → S M T W T F S
    expect(resolveActivityHeader(7, "2026-08-30").map((l) => l.label)).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });

  it("14/30-day labels are the calendar day-of-month of each bucket date (month-safe)", () => {
    const labels14 = resolveActivityHeader(14, "2026-08-23");
    expect(labels14[0]!.label).toBe("23");
    expect(labels14[14 - 1]!.label).toBe("05"); // crosses into September
    const labels30 = resolveActivityHeader(30, "2026-09-01");
    expect(labels30).toHaveLength(30);
    expect(labels30[0]!.label).toBe("01");
    expect(labels30[29]!.label).toBe("30");
  });

  it("a 30-day layout still renders every column label inside its column (no overflow in golden path)", () => {
    const data = structureData(["src/a.ts"], 30, "repo");
    const layout = layoutStructure(data, { commits: true, changes: true });
    expect(layout.weekdayLabels).toHaveLength(30);
    const commitsCol = layout.columns.commits;
    const lastLabelX = commitsCol.left + (30 - 1) * 20 + 6; // labelX formula (cell 12 + gap 8)/2 → +6
    expect(lastLabelX).toBeLessThanOrEqual(commitsCol.left + commitsCol.width);
  });
});

describe("row metadata alignment (dirs · files · share)", () => {
  it("dirs/files LABEL starts, number right-edges and BOTH separators are fixed across rows", () => {
    const data = structureData(["src/a/b.ts", "docs/x/y.ts", "lib/z.ts", "top.ts"], 7, "repo");
    const combos: Array<[number, number]> = [
      [0, 1],
      [1, 9],
      [12, 15],
    ];
    data.rows.forEach((r, i) => {
      const c = combos[i % combos.length]!;
      r.dirs = c[0];
      r.files = c[1];
      r.codeShare = [0.008, 0.02, 0.667, 1][i % 4]!;
    });
    const layout = layoutStructure(data, { commits: false, changes: false });
    for (const r of layout.rows) {
      expect(r.dirsLabelXLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.dirsLabelX, 3);
      expect(r.dirsNumRightLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.dirsNumRight, 3);
      expect(r.filesLabelXLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.filesLabelX, 3);
      expect(r.filesNumRightLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.filesNumRight, 3);
      expect(r.sep1XLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.sep1, 3);
      expect(r.sep2XLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.sep2, 3);
      expect(r.shareRightXLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.shareRight, 3);
    }
    expect(layout.countAnchors.sep1).toBeGreaterThan(layout.countAnchors.dirsLabelX);
    expect(layout.countAnchors.filesLabelX).toBeGreaterThan(layout.countAnchors.sep1);
    expect(layout.countAnchors.sep2).toBeGreaterThan(layout.countAnchors.filesLabelX);
    expect(layout.countAnchors.shareRight).toBeGreaterThan(layout.countAnchors.sep2);
  });

  it("share percentages render RIGHT-ALIGNED (text-anchor=end) with compact labels; no pill", () => {
    const data = structureData(["src/a/b.ts", "docs/x/y.ts", "lib/z.ts", "top.ts"], 7, "repo");
    data.rows.forEach((r, i) => {
      r.codeShare = [0.008, 0.02, 0.667, 1][i % 4]!;
    });
    const layout = layoutStructure(data, { commits: false, changes: false });
    const svg = renderStructureCard(layout, theme, 4);
    expect(svg).toContain("0.8%");
    expect(svg).toContain("2%");
    expect(svg).toContain("66.7%");
    expect(svg).toContain("100%");
    // each row renders an end-anchored percentage (right alignment proven in the
    // layout-anchor test above)
    const shareMatches = [...svg.matchAll(/<text x="[\d.]+" y="4\.5" text-anchor="end" class="small muted mono">\d+(?:\.\d)?%<\/text>/g)];
    expect(shareMatches.length).toBe(data.rows.length);
    // no rounded pill / background badge in the rows
    expect(svg).not.toMatch(/height="12" rx="6"/);
  });

  it("code-share zero-denominator repo renders 0% with no NaN/Infinity", () => {
    const data = structureData(["src/a.ts"], 7, "repo");
    data.rows.forEach((r) => {
      r.codeShare = 0;
    });
    const layout = layoutStructure(data, { commits: false, changes: false });
    const svg = renderStructureCard(layout, theme, 1);
    expect(svg).not.toMatch(/NaN|Infinity|NaN%/);
    expect(svg).toContain("0%");
    expect(codeShareOf(new Map([["src", { effective: 0, comments: 0, blank: 99 }]]), "src", true)).toBe(0);
    expect(shareLabel(0)).toBe("0%");
  });

  it("a long repo-root name (35–50 chars, .root weight) keeps META_GUTTER from the dirs·files·share region", () => {
    const root = "awesome-monorepo-kitchen-sink-patterns-toolkit-v2";
    expect(root.length).toBeGreaterThanOrEqual(35);
    expect(root.length).toBeLessThanOrEqual(50);
    const data = structureData(["docs/x.md", "lib/y.ts", "src/z.ts"], 7, root);
    const rootRow = data.rows[0]!;
    expect(rootRow.depth).toBe(0);
    rootRow.dirs = 3;
    rootRow.files = 1;
    rootRow.codeShare = 1; // the metadata row's "100%"
    // Keep every descendant short and shallow so the LONG ROOT, not a deep name,
    // is what sizes the metadata region (this is the overlap the bug produced).
    for (const r of data.rows.slice(1)) r.codeShare = 0.25;

    const layout = layoutStructure(data, { commits: true, changes: true });
    const svg = renderStructureCard(layout, theme, 4);
    // dirs/files/share really are rendered beside the long root name.
    expect(svg).toContain("100%");
    expect(svg).toContain("dirs");
    expect(svg).toContain("file");

    // Every row's rightmost directory text — mirrored from the renderer CSS
    // (.row/.root weight) — must clear dirsSlotLeft by >= META_GUTTER. Before the
    // fix the root name was measured at regular weight, so its 650-weight glyphs
    // ran under the dirs·files·share columns.
    for (const row of layout.rows) {
      const weight = row.row.depth === 0 ? ROOT_FONT_WEIGHT : ROW_FONT_WEIGHT;
      const nameEndGlobal =
        row.iconLeft + NAME_TEXT_OFFSET + estimateTextWidth(row.row.name, { fontSize: TREE_FONT, mono: false, fontWeight: weight });
      expect(layout.countAnchors.dirsSlotLeft - nameEndGlobal).toBeGreaterThanOrEqual(META_GUTTER - 0.01);
    }

    // The long root name is the binding constraint: its text right edge sits
    // exactly one META_GUTTER before dirsSlotLeft (nothing is wider to its right).
    const rootEndGlobal =
      layout.rows[0]!.iconLeft +
      NAME_TEXT_OFFSET +
      estimateTextWidth(root, { fontSize: TREE_FONT, mono: false, fontWeight: ROOT_FONT_WEIGHT });
    expect(layout.countAnchors.dirsSlotLeft - META_GUTTER).toBeCloseTo(rootEndGlobal, 3);
  });
});

describe("tree connector rails (last sibling with descendants)", () => {
  const rail = (svg: string): string[] => [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!);
  const xOf = (depth: number): number => 26 + depth * 34 + 8; // contentLeft(26) + depth*TREE_INDENT(34) + ICON/2(8)
  const yOf = (index: number): number => 97 + index * 30; // FIRST_ROW_Y + index*ROW_HEIGHT

  function svgOf(files: string[]): { svg: string; rowCount: number } {
    const data = structureData(files, 7, "root");
    const layout = layoutStructure(data, { commits: false, changes: false });
    return { svg: renderStructureCard(layout, theme, files.length), rowCount: layout.rows.length };
  }

  it("A: root-child rail ends at the LAST child (b), not at b's descendant b2", () => {
    // root → a(leaf), b → [b1, b2]
    const { svg, rowCount } = svgOf(["a/x.ts", "b/b1/y.ts", "b/b2/z.ts"]);
    // rows: root,a,b,b1,b2 → b center y=index2
    const bIndex = 2;
    const b2Index = 4;
    expect(rowCount).toBe(5);
    const ds = rail(svg);
    expect(ds).toContain(`M${xOf(0)} ${yOf(0) + 6} V${yOf(bIndex)}`); // root rail → b
    expect(ds).not.toContain(`M${xOf(0)} ${yOf(0) + 6} V${yOf(b2Index)}`); // never through the subtree
    expect(ds).toContain(`M${xOf(1)} ${yOf(bIndex) + 6} V${yOf(b2Index)}`); // b's own child rail → b2
  });

  it("B: ancestor rail DOES continue through a1 because b is a later sibling of a", () => {
    // root → a → [a1], b(leaf)
    const { svg, rowCount } = svgOf(["a/a1/x.ts", "b/y.ts"]);
    const a1Index = 2;
    const bIndex = 3;
    expect(rowCount).toBe(4);
    const ds = rail(svg);
    // root rail spans a..b (past a1's rows at column 0)
    expect(ds).toContain(`M${xOf(0)} ${yOf(0) + 6} V${yOf(bIndex)}`);
    expect(ds).toContain(`M${xOf(1)} ${yOf(1) + 6} V${yOf(a1Index)}`); // a's child rail ends at a1
  });

  it("C: multiple nested last-children-with-descendants never extend ancestor rails", () => {
    // root → k(leaf), m → [p1, p2 → [q]]
    const { svg, rowCount } = svgOf(["k/y.ts", "m/p1/t1.ts", "m/p2/q/u.ts"]);
    // rows: root,k,m,p1,p2,q
    const mIndex = 2;
    const p2Index = 4;
    const qIndex = 5;
    expect(rowCount).toBe(6);
    const ds = rail(svg);
    expect(ds).toContain(`M${xOf(0)} ${yOf(0) + 6} V${yOf(mIndex)}`); // root rail → m
    expect(ds).not.toContain(`M${xOf(0)} ${yOf(0) + 6} V${yOf(qIndex)}`);
    expect(ds).toContain(`M${xOf(1)} ${yOf(mIndex) + 6} V${yOf(p2Index)}`); // m rail → p2
    expect(ds).toContain(`M${xOf(2)} ${yOf(p2Index) + 6} V${yOf(qIndex)}`); // p2 rail → q
  });
});

describe("COMMITS heat scale — geometric, non-root calibrated", () => {
  const build = (maxPositive: number): CommitScale => buildCommitScale(maxPositive);
  const label = (s: CommitScale): string => commitScaleLegendText(s);

  it("A: all-zero → only neutral; no invented thresholds", () => {
    const s = build(0);
    expect(s.thresholds).toEqual([0]);
    expect(levelOf(s, 0)).toBe(0);
    expect(label(s)).toBe("0 commits");
  });

  it("B: max positive 1 → single positive bucket; 1 uses the strongest color; 0 neutral", () => {
    const s = build(1);
    expect(s.thresholds).toEqual([0, 1]);
    expect(levelOf(s, 0)).toBe(0);
    expect(levelOf(s, 1)).toBe(4);
    expect(label(s)).toBe("0 · 1+ commits");
  });

  it("C: small range 1..3 → meaningful distinct thresholds, monotonic, top strongest", () => {
    const s = build(3);
    expect(s.thresholds).toEqual([0, 1, 2, 3]);
    expect(levelOf(s, 0)).toBe(0);
    expect(levelOf(s, 1)).toBeGreaterThan(0);
    expect(levelOf(s, 3)).toBe(4);
    const seq = [0, 1, 2, 3].map((c) => levelOf(s, c));
    for (let i = 1; i < seq.length; i++) expect(seq[i]!).toBeGreaterThanOrEqual(seq[i - 1]!);
  });

  it("D: max 21 → geometric thresholds 0·1·3·5·10+; ranges map as designed", () => {
    const s = build(21);
    expect(s.thresholds).toEqual([0, 1, 3, 5, 10]);
    expect(label(s)).toBe("0 · 1 · 3 · 5 · 10+ commits");
    expect([1, 2].every((c) => levelOf(s, c) === 1)).toBe(true);
    expect([3, 4].every((c) => levelOf(s, c) === 2)).toBe(true);
    expect([5, 9].every((c) => levelOf(s, c) === 3)).toBe(true);
    expect([10, 21].every((c) => levelOf(s, c) === 4)).toBe(true);
  });

  it("E: max 100 → 0·1·4·10·32+", () => {
    const s = build(100);
    expect(s.thresholds).toEqual([0, 1, 4, 10, 32]);
    expect(label(s)).toBe("0 · 1 · 4 · 10 · 32+ commits");
    expect(levelOf(s, 100)).toBe(4);
  });

  it("F/G: repo-root aggregate is EXCLUDED from calibration but still renders on the shared scale", () => {
    const data = structureData(["src/a.ts", "docs/b.ts"], 7, "repo");
    // repo root row (index 0) is the whole-repo aggregate: huge.
    data.rows[0]!.activity = Array.from({ length: 7 }, () => ({ commits: 1000, additions: 0, deletions: 0 }));
    // ordinary module rows peak at 21 (deterministic).
    data.rows.slice(1).forEach((r, i) => {
      const arr = Array.from({ length: 7 }, () => ({ commits: 0, additions: 0, deletions: 0 }));
      arr[i % 7]!.commits = i === 0 ? 21 : i + 2;
      r.activity = arr;
    });
    const layout = layoutStructure(data, { commits: true, changes: false });
    // scale calibrated on the MODULE max (21), NOT the root aggregate (1000)
    expect(layout.commitScale.thresholds).toEqual([0, 1, 3, 5, 10]);
    expect(levelOf(layout.commitScale, 1000)).toBe(4); // root still colored darkest on the shared scale
    expect(label(layout.commitScale)).toBe("0 · 1 · 3 · 5 · 10+ commits");
    const svg = renderStructureCard(layout, theme, 2);
    expect(svg).toContain(label(layout.commitScale)); // legend == same scale as cells
  });

  it("H/I/J/K/L/M: 0 neutral, positives colored, monotonic, top darkest, legend matches computed scale", () => {
    for (const m of [1, 2, 3, 8, 21, 100]) {
      const s = build(m);
      expect(levelOf(s, 0)).toBe(0);
      for (let c = 1; c <= Math.max(m, 1); c += Math.max(1, Math.floor(m / 10))) {
        expect(levelOf(s, c)).toBeGreaterThan(0); // positive always colored
      }
      expect(levelOf(s, m)).toBe(4); // max positive → darkest
      const seq = [0, 1, Math.ceil(m / 3), Math.ceil(m / 2), m].map((c) => levelOf(s, c));
      for (let i = 1; i < seq.length; i++) expect(seq[i]!).toBeGreaterThanOrEqual(seq[i - 1]!);
      // legend text encodes the very scale used by the classifier
      expect(commitScaleLegendText(s)).toMatch(/^0 · /);
    }
  });
});

describe("structure.max-depth is capped at 5 (render depth 1..5)", () => {
  it("schema accepts 1..5 and rejects 6+", () => {
    for (const d of [1, 2, 3, 5]) {
      const cfg = structuredClone(DEFAULT_CONFIG_V2);
      cfg.cards.structure.max_depth = d;
      expect(DEFAULT_RUNTIME.config.v2Schema.safeParse(cfg).success).toBe(true);
    }
    const bad = structuredClone(DEFAULT_CONFIG_V2);
    bad.cards.structure.max_depth = 6;
    expect(DEFAULT_RUNTIME.config.v2Schema.safeParse(bad).success).toBe(false);
    const bad0 = structuredClone(DEFAULT_CONFIG_V2);
    bad0.cards.structure.max_depth = 0;
    expect(DEFAULT_RUNTIME.config.v2Schema.safeParse(bad0).success).toBe(false);
  });
});

describe("code-share percentage tags", () => {
  const map = new Map<string, { effective: number; comments: number; blank: number }>([
    [".", { effective: 10, comments: 2, blank: 99 }],
    ["src", { effective: 6, comments: 2, blank: 0 }],
    ["docs", { effective: 4, comments: 0, blank: 5 }],
  ]);

  it("uses the codebase include-comments policy; blank lines are never counted; root is 100%", () => {
    expect(codeShareOf(map, ".", false)).toBeCloseTo(1, 9);
    expect(codeShareOf(map, ".", true)).toBeCloseTo(1, 9);
    expect(codeShareOf(map, "src", false)).toBeCloseTo(6 / 10, 9);
    expect(codeShareOf(map, "src", true)).toBeCloseTo(8 / 12, 9);
    expect(codeShareOf(map, "docs", false)).toBeCloseTo(0.4, 9);
    expect(shareLabel(0.6)).toBe("60%");
    expect(shareLabel(8 / 12)).toBe("66.7%");
    expect(shareLabel(0.124)).toBe("12.4%");
    expect(shareLabel(1)).toBe("100%");
  });

  it("renders the share as plain text at multiple depths (root 100%); description stays clear; NO pill", () => {
    const data = structureData(["src/a.ts", "src/deep/b.ts", "lib/c.ts", "top.ts"], 7, "repo");
    data.rows.forEach((r) => {
      r.codeShare = r.repoRel === "." ? 1 : r.repoRel === "src" ? 0.4 : r.repoRel === "src/deep" ? 0.2 : 0.35;
    });
    const src = data.rows.find((r) => r.repoRel === "src")!;
    src.description = "较长目录描述，用于验证 share+描述不重叠";
    const layout = layoutStructure(data, { commits: true, changes: true });
    const svg = renderStructureCard(layout, theme, 4);

    expect(svg).toContain("100%");
    expect(svg).toContain("40%");
    expect(svg).toContain("较长目录描述，用于验证 share+描述不重叠");
    // no rounded background badge / pill anywhere
    expect(svg).not.toMatch(/height="12" rx="6"/);
    expect(svg).not.toContain('y="-6"');
    // every row's share right edge == the one fixed global anchor
    for (const r of layout.rows) {
      expect(r.shareRightXLocal + r.iconLeft).toBeCloseTo(layout.countAnchors.shareRight, 3);
    }
  });
});

describe("codebase legend items — ONE shared two-line component (top summary + language)", () => {
  // 8 languages → a two-row language block under the single legend rule.
  const fractions = [0.16, 0.16, 0.16, 0.14, 0.12, 0.1, 0.09, 0.07];

  // g: 1 barX(=translate) 2 barY 3 w 4 h 5 rx 6 fill 7 nameX 8 nameY 9 label 10 valueX 11 valueY 12 value
  const metricGroupRe =
    /<g transform="translate\(([\d.]+) 32\)"><rect x="0" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="([^"]+)"\/><text x="([\d.]+)" y="(-?[\d.]+)" class="name">(Total|Effective|Comments|Blank)<\/text><text x="([\d.]+)" y="(-?[\d.]+)" class="data">([^<]+)<\/text>/g;
  // g: 1 barX 2 barY 3 w 4 h 5 rx 6 fill 7 nameX 8 nameY 9 name 10 valueX 11 valueY 12 value
  const langGroupRe =
    /<g>\n      <rect x="([\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="([^"]+)"\/>\n      <text x="([\d.]+)" y="(-?[\d.]+)" class="name">([^<]+)<\/text>\n      <text x="([\d.]+)" y="(-?[\d.]+)" class="data">([^<]+)<\/text>\n    <\/g>/g;

  const metricBarsOf = (svg: string) => [...svg.matchAll(metricGroupRe)];
  const langBarsOf = (svg: string) => [...svg.matchAll(langGroupRe)];

  it("summary + language bars share width/height (~20% longer than the previous 16px)", () => {
    expect(MINI_BAR_WIDTH).toBeGreaterThan(16);
    expect(MINI_BAR_WIDTH).toBeLessThanOrEqual(20);
    const svg = renderCodebaseCard(layoutCodebase(codebaseCard(fractions)), theme);
    const metricBars = metricBarsOf(svg);
    const langBars = langBarsOf(svg);
    expect(metricBars.length + langBars.length).toBe(4 + fractions.length);
    for (const [w, h] of [...metricBars.map((g) => [g[3], g[4]]), ...langBars.map((g) => [g[3], g[4]])]) {
      expect(w).toBe(String(MINI_BAR_WIDTH));
      expect(h).toBe(String(MINI_BAR_HEIGHT));
    }
    expect(svg).not.toContain('width="16" height="4"');
  });

  it("top summary items: SAME geometry + gap; bar on the LABEL row; row-2 value at the item LEFT edge (x=0)", () => {
    const layout = layoutCodebase(codebaseCard(fractions));
    const svg = renderCodebaseCard(layout, theme);
    const groups = metricBarsOf(svg);
    expect(groups).toHaveLength(4);
    expect(new Set(groups.map((g) => g[3])).size).toBe(1);
    expect(new Set(groups.map((g) => g[4])).size).toBe(1);
    expect(new Set(groups.map((g) => g[2])).size).toBe(1);
    for (const g of groups) {
      // label sits at the shared SWATCH_TEXT_OFFSET after the bar (bar left local 0)
      expect(Number(g[7])).toBeCloseTo(SWATCH_TEXT_OFFSET, 6);
      expect(Number(g[7]) - MINI_BAR_WIDTH).toBeCloseTo(MINI_BAR_GAP, 6);
      // row-2 VALUE starts at the item LEFT edge (x=0) — NOT indented to the label x
      expect(Number(g[10])).toBe(0);
      expect(Number(g[10])).not.toBe(Number(g[7]));
      // baselines come from the shared legendItemGeometry (17px gap)
      const expected = legendItemGeometry(Number(g[8]));
      expect(Number(g[11]) - Number(g[8])).toBeCloseTo(LABEL_TO_VALUE_GAP, 1);
      expect(Number(g[11])).toBeCloseTo(expected.valueBaseline, 1);
      // bar is centered on the LABEL row (first line), not on the whole block
      expect(Number(g[2]) + MINI_BAR_HEIGHT / 2).toBeCloseTo(expected.barCenterY, 1);
    }
  });

  it("every language item: 17px gap, bar on the label row, row-2 value at the item LEFT edge (== bar x)", () => {
    const layout = layoutCodebase(codebaseCard(fractions));
    const svg = renderCodebaseCard(layout, theme);
    const groups = langBarsOf(svg);
    expect(groups).toHaveLength(fractions.length);
    expect(new Set(groups.map((g) => g[3])).size).toBe(1);
    expect(new Set(groups.map((g) => g[4])).size).toBe(1);
    expect(groups.map((g) => g[3])[0]).toBe(String(MINI_BAR_WIDTH));
    for (const g of groups) {
      const p = layout.languageArea.items.find((i) => i.name === g[9])!;
      expect(Number(g[11]) - Number(g[8])).toBeCloseTo(LABEL_TO_VALUE_GAP, 1); // same 17px gap
      // value x == item (bar) left edge, NOT the label x
      expect(Number(g[10])).toBeCloseTo(Number(g[1]), 1);
      expect(Number(g[10])).toBeLessThan(Number(g[7]));
      // bar centered on the LABEL row (layout-exact + rendered)
      expect(p.miniBarY + MINI_BAR_HEIGHT / 2).toBeCloseTo(p.labelCenterY, 9);
      expect(Number(g[2]) + MINI_BAR_HEIGHT / 2).toBeCloseTo(p.labelCenterY, 1);
      // label offset is the shared rule; bar clears it by MINI_BAR_GAP
      expect(Number(g[7]) - (Number(g[1]) + MINI_BAR_WIDTH)).toBeCloseTo(MINI_BAR_GAP, 1);
    }
  });

  it("top and bottom are the SAME legend component: size, radius, offsets, bar-on-label AND value-at-item-left", () => {
    expect(NAME_FONT).toBe(NAME_FONT_SIZE); // top label font == shared legend font
    expect(VALUE_FONT).toBe(VALUE_FONT_SIZE); // top value font == shared legend font
    const svg = renderCodebaseCard(layoutCodebase(codebaseCard(fractions)), theme);
    const metricBars = metricBarsOf(svg);
    const langBars = langBarsOf(svg);
    for (const [w, h, r] of [...metricBars.map((g) => [g[3], g[4], g[5]]), ...langBars.map((g) => [g[3], g[4], g[5]])]) {
      expect(w).toBe(String(MINI_BAR_WIDTH));
      expect(h).toBe(String(MINI_BAR_HEIGHT));
    }
    expect(new Set(metricBars.map((g) => g[5]))).toHaveLength(1);
    expect(new Set(langBars.map((g) => g[5]))).toHaveLength(1);
    // SAME bar-to-label offset
    expect(Number(metricBars[0]![7])).toBeCloseTo(SWATCH_TEXT_OFFSET, 6);
    const langLabelOffsets = langBars.map((g) => Number(g[7]) - Number(g[1]));
    for (const off of langLabelOffsets) expect(off).toBeCloseTo(SWATCH_TEXT_OFFSET, 1);
    // SAME label↔value baseline gap
    const metricDelta = Number(metricBars[0]![11]) - Number(metricBars[0]![8]);
    expect(metricDelta).toBeCloseTo(LABEL_TO_VALUE_GAP, 1);
    for (const g of langBars) {
      expect(Number(g[11]) - Number(g[8])).toBeCloseTo(metricDelta, 1);
    }
    // BOTH place the value at the item left edge (no label indent)
    expect(Number(metricBars[0]![10])).toBe(0);
    for (const g of langBars) {
      expect(Number(g[10])).toBeCloseTo(Number(g[1]), 1);
    }
  });
});
