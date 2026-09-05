/**
 * Golden Lock — freezes the finalized visual reference (SPEC §9).
 *
 * The SVGs under tests/golden/baselines/arte (arte-theme) and
 * tests/golden/baselines/github-theme are the approved visual baseline (demo
 * previews were removed). All of them are produced by the production renderers
 * (see golden-render.test.ts for the
 * byte-for-byte equality check); this file adds a cheap FNV-1a hash lock plus
 * readable invariants. To intentionally update visuals, run
 * `npm run golden:update` and re-freeze the hashes — normal `npm test` never
 * overwrites the goldens.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fnv1a } from "../../src/theme/color.js";

/** (path, frozen hash) — computed from the current finalized state. */
const LOCKED: Array<[string, number]> = [
  // Changed by the final visual pass: codebase language bar uses square segments
  // clipped by one rounded clipPath (exact right edge, no per-segment pill);
  // structure rows show direct dirs/files counts and a whole-repo level-0 row,
  // with day-of-month headers for 14/30 days.
  // Legend pass: top summary + language rows share ONE two-line legend item
  // (legendItemGeometry): 19×4 rounded bar on the LABEL row, label at
  // swatch+8px (SWATCH_TEXT_OFFSET), 17px label↔value baseline gap, and the
  // row-2 value starting at the ITEM LEFT edge (no label indent).
  // Centered-row pass: EVERY legend row is one group centered on the card
  // center (equal internal pitch). The summary 4-item row and a full 4-item
  // language row share the same centered anchors; incomplete rows center
  // independently.
  ["tests/golden/baselines/arte/codebase-golden.svg", 0x2e10eb40],
  ["tests/golden/baselines/arte/codebase-golden-comments.svg", 0x58cbecda],
  ["tests/golden/baselines/arte/codebase-golden-wide.svg", 0x86ebea04],
  ["tests/golden/baselines/arte/structure-7d.svg", 0x81fd531f],
  ["tests/golden/baselines/arte/structure-14d.svg", 0xd4675a3b],
  ["tests/golden/baselines/arte/structure-30d.svg", 0xae7f5e68],
  ["tests/golden/baselines/arte/palette-golden.svg", 0x11320941],
  ["tests/golden/baselines/github-theme/codebase.svg", 0x9b03dfc9],
  ["tests/golden/baselines/github-theme/codebase-comments.svg", 0xbc18261b],
  ["tests/golden/baselines/github-theme/codebase-wide.svg", 0xd47055fb],
  ["tests/golden/baselines/github-theme/structure-7d.svg", 0x52c0f1cb],
  ["tests/golden/baselines/github-theme/structure-14d.svg", 0x692d1b7e],
  ["tests/golden/baselines/github-theme/structure-30d.svg", 0x2351e997],
  ["tests/golden/baselines/github-theme/palette.svg", 0x8efb90e5],
];

describe("golden lock — finalized visuals are frozen", () => {
  for (const [path, frozenHash] of LOCKED) {
    it(`${path} matches the frozen baseline`, () => {
      const content = readFileSync(path, "utf8");
      expect(fnv1a(content)).toBe(frozenHash);
    });
  }
});

describe("golden lock — readable invariants", () => {
  const codebase = readFileSync("tests/golden/baselines/arte/codebase-golden.svg", "utf8");
  const wide = readFileSync("tests/golden/baselines/arte/codebase-golden-wide.svg", "utf8");
  const structure = readFileSync("tests/golden/baselines/arte/structure-7d.svg", "utf8");
  const palette = readFileSync("tests/golden/baselines/arte/palette-golden.svg", "utf8");
  const gitCodebase = readFileSync("tests/golden/baselines/github-theme/codebase.svg", "utf8");
  const gitStructure = readFileSync("tests/golden/baselines/github-theme/structure-7d.svg", "utf8");

  it("codebase golden: 680×212; summary + full 4-item language row share ONE centered row", () => {
    expect(codebase).toContain('width="680" height="212"');
    expect(codebase).toContain('viewBox="0 0 680 212"');
    // Legend bars sit on the LABEL row (first line): first language row at y=124.2.
    // The four summary anchors are ONE centered, equally-pitched row (B−A == C−B == D−C).
    const summaryXs = [...codebase.matchAll(/<g transform="translate\(([\d.]+) 32\)"><rect x="0" y="[^"]*" width="19"/g)].map((m) => Number(m[1]));
    expect(summaryXs).toHaveLength(4);
    expect(summaryXs[0]).toBeGreaterThan(24); // centered → not glued to contentLeft
    expect(summaryXs[1]! - summaryXs[0]!).toBeCloseTo(summaryXs[2]! - summaryXs[1]!, 6);
    expect(summaryXs[2]! - summaryXs[1]!).toBeCloseTo(summaryXs[3]! - summaryXs[2]!, 6);
    // full 4-item language row reuses the exact same centered anchors
    const firstRowXs = [...codebase.matchAll(/<rect x="([\d.]+)" y="124\.2" width="19" height="4"/g)].map((m) => Number(m[1]));
    expect(firstRowXs.slice(0, 4)).toEqual(summaryXs);
    // an incomplete final language row exists and is centered as its OWN row (not the first anchors)
    const tailXs = [...codebase.matchAll(/<rect x="([\d.]+)" y="166\.2" width="19" height="4"/g)].map((m) => Number(m[1]));
    expect(tailXs.length).toBeGreaterThan(0);
    expect(tailXs.length).toBeLessThan(4);
    expect(tailXs[0]!).not.toBeCloseTo(summaryXs[0]!, 6);
    // the unified swatch width (19) appears in the golden, never the old 18.
    expect(codebase).not.toContain('width="18" height="4"');
    expect(codebase).toContain('width="19" height="4"');
  });

  it("wide codebase golden: single row [6] at 920 wide (reads the -wide file)", () => {
    expect(wide).toContain('width="920"');
    expect(wide).not.toContain('y="166.2"'); // no second language row
    expect(wide).toContain('y="124.2"'); // single row at the top grid position
  });

  it("fan side edges are hidden (opacity 0) but the geometry remains", () => {
    expect((codebase.match(/stop-opacity="0"/g) || []).length).toBe(4);
    expect(codebase).toContain('stop-opacity="0.16"');
    expect(codebase).toContain('stop-opacity="0.03"');
    expect(codebase).toMatch(/stroke="url\(#fanStrokeL\)"/);
    expect(codebase).toMatch(/stroke="url\(#fanStrokeR\)"/);
  });

  it("arte structure 7d: metadata (end-aligned numbers, fixed labels, separators), heatmap + changes baseline", () => {
    // numbers are right-aligned; labels (dir/dirs, file/files) and the "·"
    // separator(s) are present — precise anchors are covered by layout tests.
    expect(structure).toMatch(/text-anchor="end" class="small muted mono">\d+<\/text>/);
    expect(structure).toMatch(/class="small muted mono">dirs?<\/text>/);
    expect(structure).toMatch(/class="small muted mono">files?<\/text>/);
    expect((structure.match(/>·<\/text>/g) || []).length).toBeGreaterThan(0);
    // heatmap intensity opacity (arte shades one hue)
    expect(structure).toContain('fill="#D77655" fill-opacity="0.22"');
    expect(structure).toContain('fill="#D77655" fill-opacity="0.92"');
    // changes baseline + 4-level opacity ramp
    expect(structure).toContain('fill="none" stroke="#C8C1B5"');
    expect(structure).toContain('fill="#74866D" fill-opacity="0.45"');
    expect(structure).toContain('fill="#74866D"');
    // commit legend is generated from the SAME dynamic scale used for cells and
    // starts with the exact-zero bucket (never a fixed 16+ cap)
    expect(structure).toMatch(/0 · /);
    expect(structure).toMatch(/commits/);
  });

  it("arte palette is labelled arte-theme", () => {
    expect(palette).toContain("THEME PALETTE · arte-theme");
  });

  it("github codebase uses the bright GitHub language palette", () => {
    expect(gitCodebase).toContain('fill="#3178C6"'); // TypeScript blue
    expect(gitCodebase).toContain('fill="#F1E05A"'); // JavaScript yellow
  });

  it("github structure: 5-level contribution-green ramp (solid) + green/red changes", () => {
    for (const ramp of ["#EFF2F5", "#ACEEBB", "#4AC26B", "#2DA44E", "#116329"]) {
      expect(gitStructure).toContain(`fill="${ramp}"`);
    }
    expect(gitStructure).toContain('fill="#2DA44E"'); // additions
    expect(gitStructure).toContain('fill="#E5534B"'); // deletions
  });
});
