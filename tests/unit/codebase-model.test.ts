import { describe, expect, it } from "vitest";
import {
  countedLines,
  compareLanguageRank,
  sortLanguages,
  rankLanguages,
  type LanguageStat,
} from "../../src/codebase/model.js";
import { layoutLanguageArea } from "../../src/layout/languages.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { deriveTone } from "../../src/theme/color.js";

const stat = (id: string, name: string, effective: number, comments: number): LanguageStat => ({
  id,
  name,
  effective,
  comments,
  files: 1,
});

describe("countedLines / include_comments", () => {
  it("counts effective only, or effective + comments", () => {
    const s = stat("ts", "TypeScript", 100, 50);
    expect(countedLines(s, false)).toBe(100);
    expect(countedLines(s, true)).toBe(150);
  });
});

describe("sortLanguages — canonical ranking", () => {
  it("sorts by countedLines DESC", () => {
    const langs = [stat("a", "Alpha", 10, 0), stat("b", "Beta", 30, 0), stat("c", "Gamma", 20, 0)];
    expect(sortLanguages(langs, false).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by name ASC", () => {
    const langs = [stat("x", "Beta", 100, 0), stat("y", "Alpha", 100, 0)];
    expect(sortLanguages(langs, false).map((s) => s.id)).toEqual(["y", "x"]);
  });

  it("include_comments can legitimately re-rank the languages", () => {
    const langs = [
      stat("a", "Alpha", 100, 500),
      stat("b", "Beta", 200, 50),
    ];
    expect(sortLanguages(langs, false).map((s) => s.id)).toEqual(["b", "a"]);
    expect(sortLanguages(langs, true).map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("comparator is total and deterministic", () => {
    const a = stat("a", "A", 100, 10);
    const b = stat("a", "A", 100, 10);
    expect(compareLanguageRank(a, b, false)).toBe(0);
    expect(compareLanguageRank(a, b, true)).toBe(0);
  });
});

describe("rankLanguages — ranking-driven colors (BASE → DEEP → LIFT)", () => {
  const dataColors = resolveTheme(DEFAULT_THEME).dataColors;

  it("assigns dataColors[i] to the i-th ranked language", () => {
    const langs = [
      stat("ts", "TypeScript", 15000, 1000),
      stat("py", "Python", 10000, 2000),
      stat("rs", "Rust", 6000, 500),
      stat("js", "JavaScript", 3000, 300),
      stat("go", "Go", 1500, 100),
      stat("sh", "Shell", 1400, 50),
    ];
    const { ranked, colorById } = rankLanguages(langs, false, dataColors);
    expect(ranked.map((s) => s.id)).toEqual(["ts", "py", "rs", "js", "go", "sh"]);
    expect(colorById.get("ts")).toBe(dataColors[0]);
    expect(colorById.get("py")).toBe(dataColors[1]);
    expect(colorById.get("sh")).toBe(dataColors[5]);
  });

  it("ranks 13+ into the deep tier and 25+ into the lift tier", () => {
    const langs = Array.from({ length: 30 }, (_, i) =>
      stat(`lang${i}`, `Lang${i}`, 1000 - i * 10, 0),
    );
    const { ranked, colorById } = rankLanguages(langs, false, dataColors);
    // Rank #13 (index 12) starts the deep tier; rank #25 (index 24) the lift tier.
    expect(colorById.get(ranked[12]!.id)).toBe(dataColors[12]);
    expect(colorById.get(ranked[24]!.id)).toBe(dataColors[24]);
    expect(colorById.get(ranked[0]!.id)).toBe(dataColors[0]);
  });

  it("tier entry colors: deep/lift are OKLCH-derived from the base hue (SPEC §4)", () => {
    expect(dataColors[0]).toBe("#A86D76"); // base: rose (first interleaved family)
    expect(dataColors[12]).toBe(deriveTone(dataColors[0]!, "deep"));
    expect(dataColors[24]).toBe(deriveTone(dataColors[0]!, "lift"));
  });

  it("the Language Bar and the list share the same ranked array and colors", () => {
    const langs = [
      stat("ts", "TypeScript", 15000, 1000),
      stat("py", "Python", 10000, 2000),
      stat("rs", "Rust", 6000, 500),
      stat("js", "JavaScript", 3000, 300),
      stat("go", "Go", 1500, 100),
      stat("sh", "Shell", 1400, 50),
    ];
    const { ranked, colorById } = rankLanguages(langs, false, dataColors);

    // Bar segments are emitted in ranked order with colorById.get(id).
    const barSegments = ranked.map((s) => ({ id: s.id, color: colorById.get(s.id)! }));

    // The language rows are built from the SAME ranked array with the SAME colors.
    const layout = layoutLanguageArea(
      ranked.map((s) => ({
        id: s.id,
        name: s.name,
        value: `${s.effective} · 1.0%`,
        color: colorById.get(s.id)!,
      })),
      { contentWidth: 632, left: 24, top: 125 },
    );

    expect(layout.items.map((p) => p.id)).toEqual(barSegments.map((s) => s.id));
    for (let i = 0; i < layout.items.length; i++) {
      // Hard invariant: mini bar color == bar segment color for the same language.
      expect(layout.items[i]!.color).toBe(barSegments[i]!.color);
      expect(layout.items[i]!.color).toBe(dataColors[i]);
    }
  });
});
