/**
 * Renderer-level behavior tests (SPEC §4/§6): empty-summary rendering, long-name
 * card re-solve, huge metrics, empty structure, and the exhaustive
 * theme.style → renderer wiring audit.
 */

import { describe, expect, it } from "vitest";
import { resolveTheme } from "../../src/theme/resolve.js";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { layoutCodebase } from "../../src/layout/codebase.js";
import { renderCodebaseCard } from "../../src/codebase/render.js";
import { layoutStructure } from "../../src/layout/structure.js";
import { renderStructureCard } from "../../src/structure/render.js";
import type { CodebaseCardData } from "../../src/codebase/card.js";
import type { StructureData } from "../../src/structure/model.js";

const theme = resolveTheme(DEFAULT_THEME);

const emptyCard = (): CodebaseCardData => ({
  total: "0",
  effective: "0 · 0.0%",
  comments: "0 · 0.0%",
  blank: "0 · 0.0%",
  summaryFracs: [0, 0, 0],
  languages: [],
  includeComments: false,
});

describe("renderer — codebase empty summary (P0-1)", () => {
  it("total=0 renders ONLY the neutral track at the summary row, never a full-width Blank segment", () => {
    const layout = layoutCodebase(emptyCard());
    expect(layout.hasSummaryData).toBe(false);
    const svg = renderCodebaseCard(layout, theme);
    // the divider track is drawn at SUMMARY_BAR_Y (59)
    expect(svg).toMatch(/y="59"[^>]*fill="#D7D0C3"/);
    // no effective / comments / blank semantic segments on the summary row
    expect(svg).not.toMatch(/y="59"[^>]*fill="#D77655"/); // effective (accent)
    expect(svg).not.toMatch(/y="59"[^>]*fill="#E5A18A"/); // comments (accent_soft)
    expect(svg).not.toMatch(/y="59"[^>]*fill="#A49E94"/); // blank (neutral) — the 100% Blank bug
  });
});

describe("renderer — long-name width re-solve (SPEC §6)", () => {
  it("a very long language name grows the card width and nothing clips", () => {
    const lang = (name: string, counted: number, color: string): CodebaseCardData["languages"][number] => ({
      id: name.toLowerCase().replace(/[^a-z]/g, ""),
      name,
      color,
      counted,
      fraction: counted / 1000,
      value: `${counted} · 100.0%`,
    });
    // Long enough that a single measured cell exceeds the 680px default, forcing
    // the two-phase width solver to grow the card and re-solve all geometry.
    const longName =
      "TypeScript With A Remarkably Long Display Name That Definitely Overflows The Default Minimum Card Width Of Six Hundred And Eighty Pixels";
    const data: CodebaseCardData = {
      total: "1,000",
      effective: "800 · 80.0%",
      comments: "100 · 10.0%",
      blank: "100 · 10.0%",
      summaryFracs: [0.8, 0.1, 0.1],
      languages: [lang(longName, 1000, "#A86D76")],
      includeComments: false,
    };
    const layout = layoutCodebase(data);
    expect(layout.cardWidth).toBeGreaterThan(680);
    for (const p of layout.languageArea.items) {
      expect(p.miniBarLeft).toBeGreaterThanOrEqual(layout.contentLeft);
      expect(p.nameLeft).toBeLessThan(layout.cardWidth);
    }
    const svg = renderCodebaseCard(layout, theme);
    expect(svg).toContain(`width="${layout.cardWidth}"`);
    expect(svg).not.toMatch(/x="-[\d.]/); // no negative item x
  });

  it("huge numeric metrics lay out without overlap", () => {
    const data: CodebaseCardData = {
      total: "9,999,999,999",
      effective: "8,123,456,789 · 81.2%",
      comments: "1,000,000,000 · 10.0%",
      blank: "876,543,210 · 8.8%",
      summaryFracs: [0.812, 0.1, 0.088],
      languages: [{ id: "ts", name: "TypeScript", color: "#A86D76", counted: 1000, fraction: 1, value: "1,000 · 100.0%" }],
      includeComments: false,
    };
    const layout = layoutCodebase(data);
    for (let i = 1; i < layout.metrics.length; i++) {
      expect(layout.metrics[i]!.left).toBeGreaterThan(layout.metrics[i - 1]!.left);
    }
  });
});

describe("renderer — empty structure (SPEC §5)", () => {
  const emptyData = (): StructureData => ({ rows: [], days: 7, totalCommits: 0, startDate: "2026-08-25" });
  const combos: Array<{ name: string; enabled: { commits: boolean; changes: boolean } }> = [
    { name: "all columns", enabled: { commits: true, changes: true } },
    { name: "tree-only", enabled: { commits: false, changes: false } },
    { name: "tree+commits", enabled: { commits: true, changes: false } },
    { name: "tree+changes", enabled: { commits: false, changes: true } },
  ];

  for (const c of combos) {
    it(`zero-directory geometry: no dangling connector, header/footer centered (${c.name})`, () => {
      const layout = layoutStructure(emptyData(), c.enabled);
      // the tree column keeps room for DIRECTORY + footer, so the header is not
      // centered at the raw left edge (no viewBox clipping)
      expect(layout.columns.tree.width).toBeGreaterThan(0);
      expect(layout.columns.tree.centerX).toBeGreaterThan(layout.contentLeft);
      const svg = renderStructureCard(layout, theme, 0);
      expect(svg).toContain("DIRECTORY");
      expect(svg).toContain("0 source files");
      // no dangling root connector path inside the tree group
      expect(svg).not.toMatch(/<g class="tree">[\s\S]*?<path d="M/);
    });
  }

  it("renders a footer with zero directory rows without crashing (regression)", () => {
    const layout = layoutStructure(emptyData(), { commits: true, changes: true });
    const svg = renderStructureCard(layout, theme, 0);
    expect(layout.cardHeight).toBeGreaterThan(0);
    expect(svg).toContain("0 source files");
  });
});

describe("theme.style — every public field reaches the renderer (SPEC §4)", () => {
  const styled = resolveTheme({
    ...DEFAULT_THEME,
    style: { card: { radius: 3, border_width: 4 }, bar: { radius: 5 }, heatmap: { radius: 6 } },
  });

  it("codebase card consumes card.radius, card.border_width (inset) and bar.radius", () => {
    const layout = layoutCodebase(emptyCard());
    const svg = renderCodebaseCard(layout, styled);
    // border inset = border_width/2 = 2 → the outer rect is x=2 y=2 w=cardWidth-4
    expect(svg).toMatch(/<rect x="2" y="2" width="\d+\.?\d*" height="\d+\.?\d*"[^>]*rx="3"[^>]*stroke-width="4"/);
    expect(svg).toContain('rx="5"'); // bar radius (summary/metrics/language/mini bars)
  });

  it("structure card consumes card.radius, card.border_width (inset) and heatmap.radius", () => {
    const data: StructureData = {
      rows: [
        {
          name: "src",
          rel: "src",
          repoRel: "src",
          depth: 0,
          descendantDirs: 0,
          dirs: 0,
          files: 0,
          hasChildren: false,
          activity: [{ commits: 1, additions: 0, deletions: 0 }],
        },
      ],
      days: 7,
      totalCommits: 1,
      startDate: "2026-08-25",
    };
    const layout = layoutStructure(data, { commits: true, changes: true });
    const svg = renderStructureCard(layout, styled, 1);
    expect(svg).toMatch(/<rect x="2" y="2" width="\d+\.?\d*" height="\d+\.?\d*"/); // border inset
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain('rx="6"'); // heatmap cells + legend swatches
  });
});
