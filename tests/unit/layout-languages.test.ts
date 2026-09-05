import { describe, expect, it } from "vitest";
import {
  layoutLanguageArea,
  measureLanguageCell,
  resolveColumns,
  chunkColumns,
  MINI_BAR_WIDTH,
  MINI_BAR_GAP,
  MINI_BAR_HEIGHT,
  LANGUAGE_ITEM_GAP,
  LANGUAGE_ROW_HEIGHT,
  NAME_FONT_SIZE,
  VALUE_FONT_SIZE,
  TEXT_VISUAL_CENTER,
  textBlockCenterY,
  chooseLegendColumns,
  centeredRowStart,
  type LanguageItemInput,
} from "../../src/layout/languages.js";
import { estimateTextWidth } from "../../src/layout/measure.js";

/** The 6-language golden fixture (names + display values, measured via the estimator). */
const SIX_ITEMS: LanguageItemInput[] = [
  { id: "typescript", name: "TypeScript", value: "15,147 · 39.2%", color: "#A86D76" },
  { id: "python", name: "Python", value: "10,859 · 28.1%", color: "#4A877F" },
  { id: "rust", name: "Rust", value: "6,338 · 16.4%", color: "#8B7D47" },
  { id: "javascript", name: "JavaScript", value: "3,285 · 8.5%", color: "#6E77A4" },
  { id: "go", name: "Go", value: "1,584 · 4.1%", color: "#AD6D5D" },
  { id: "shell", name: "Shell", value: "1,429 · 3.7%", color: "#5E8D6E" },
];

const EIGHT_ITEMS: LanguageItemInput[] = [
  ...SIX_ITEMS,
  { id: "kotlin", name: "Kotlin", value: "900 · 2.4%", color: "#7C5A99" },
  { id: "c", name: "C", value: "777 · 2.1%", color: "#8A8A8A" },
];

const layoutAt = (contentWidth: number) =>
  layoutLanguageArea(SIX_ITEMS, { contentWidth, left: 24, top: 125 });

type Placements = ReturnType<typeof layoutLanguageArea>["items"];
const groupsByRow = (items: Placements): Placements[] => {
  const rows = new Map<number, Placements>();
  for (const p of items) {
    const arr = rows.get(p.row) ?? [];
    arr.push(p);
    rows.set(p.row, arr);
  }
  return [...rows.values()].map((arr) => [...arr].sort((a, b) => a.col - b.col));
};
/** Bounding-box center of one centered legend row (anchors + uniform cell width). */
const rowCenterX = (row: Placements): number => {
  const cell = row[0]!.width;
  const first = row[0]!.miniBarLeft;
  const last = row[row.length - 1]!.miniBarLeft;
  return (first + (last + cell)) / 2;
};

describe("resolveColumns — column count comes from available width", () => {
  it("computes the max columns that fit, capped by the item count", () => {
    expect(resolveColumns(100, 6, 632, 32)).toBe(5);
    expect(resolveColumns(100, 6, 920, 32)).toBe(6);
    expect(resolveColumns(100, 6, 300, 32)).toBe(2);
    expect(resolveColumns(100, 6, 220, 32)).toBe(1);
    expect(resolveColumns(120, 4, 632, 32)).toBe(4);
  });

  it("never returns 0 or negative", () => {
    expect(resolveColumns(500, 3, 100, 32)).toBe(1);
  });
});

describe("chunkColumns — row-major chunking preserves order", () => {
  it("chunks sorted items into rows of `columns`", () => {
    expect(chunkColumns(6, 4)).toEqual([[0, 1, 2, 3], [4, 5]]);
    expect(chunkColumns(6, 2)).toEqual([[0, 1], [2, 3], [4, 5]]);
    expect(chunkColumns(6, 6)).toEqual([[0, 1, 2, 3, 4, 5]]);
    expect(chunkColumns(6, 1)).toEqual([[0], [1], [2], [3], [4], [5]]);
  });
});

describe("measureLanguageCell — uniform dynamic cell width", () => {
  it("cellWidth = (miniBar + gap) + max(max(name, value)) (measured, not a constant)", () => {
    const cell = measureLanguageCell(SIX_ITEMS, {});
    // valueWidth of "15,147 · 39.2%" (14 mono chars @ 10.5px) → ~88.2
    expect(cell.cellWidth).toBeCloseTo(MINI_BAR_WIDTH + MINI_BAR_GAP + 88.2, 6);
  });

  it("changes when the contents change", () => {
    const longName = measureLanguageCell([{ id: "x", name: "VeryLongLanguageName", value: "1,234 · 1.0%", color: "#000" }], {});
    const short = measureLanguageCell([{ id: "y", name: "Go", value: "1,234 · 1.0%", color: "#000" }], {});
    expect(longName.cellWidth).toBeGreaterThan(short.cellWidth);
  });
});

describe("centeredRowStart — every row is one group centered on the content center", () => {
  const cell = 100;
  const gap = 32;
  const left = 24;
  const width = 632;
  const center = left + width / 2;

  it("rowLeft = center − rowWidth/2 for any item count (incl. incomplete rows)", () => {
    for (const count of [4, 3, 5, 1]) {
      const rowWidth = count * cell + (count - 1) * gap;
      const rowLeft = centeredRowStart(count, cell, gap, left, width);
      expect(rowLeft).toBeCloseTo(center - rowWidth / 2, 9);
      expect(rowLeft).toBeGreaterThanOrEqual(left - 1e-9);
    }
  });

  it("anchors inside one row are equally pitched (cell + gap)", () => {
    const rowLeft = centeredRowStart(4, cell, gap, left, width);
    const anchors = Array.from({ length: 4 }, (_, i) => rowLeft + i * (cell + gap));
    expect(anchors[1]! - anchors[0]!).toBeCloseTo(cell + gap, 9);
    expect(anchors[2]! - anchors[1]!).toBeCloseTo(cell + gap, 9);
    expect(anchors[3]! - anchors[2]!).toBeCloseTo(cell + gap, 9);
  });
});

describe("layoutLanguageArea — each ROW centered individually", () => {
  const layout = layoutAt(632);

  it("the 680px fixture measures to 4 columns → [4, 2]", () => {
    expect(layout.columns).toBe(4);
    expect(layout.distribution).toEqual([4, 2]);
  });

  it("column count and distribution change with width (elastic, not fixed)", () => {
    const wide = layoutAt(920);
    const medium = layoutAt(632);
    const narrow = layoutAt(300);
    expect(wide.columns).toBe(6);
    expect(wide.distribution).toEqual([6]);
    expect(medium.columns).toBe(4);
    expect(narrow.columns).toBe(2);
    expect(narrow.distribution).toEqual([2, 2, 2]);
    expect(narrow.columns).toBeLessThan(wide.columns);
  });

  it("EVERY row's bounding box is centered on the content center", () => {
    const center = 24 + 632 / 2;
    for (const row of groupsByRow(layout.items)) {
      expect(rowCenterX(row)).toBeCloseTo(center, 6);
    }
  });

  it("anchors inside a row are equally pitched; rows of equal length share anchors", () => {
    const twoFour = layoutLanguageArea(EIGHT_ITEMS, { contentWidth: 632, left: 24, top: 125 });
    expect(twoFour.columns).toBe(4);
    expect(twoFour.distribution).toEqual([4, 4]);
    const groups = groupsByRow(twoFour.items);
    const [r0, r1] = groups;
    const pitch = twoFour.cellWidth + LANGUAGE_ITEM_GAP;
    for (const row of groups) {
      for (let c = 1; c < row.length; c++) {
        expect(row[c]!.miniBarLeft - row[c - 1]!.miniBarLeft).toBeCloseTo(pitch, 6);
      }
    }
    // two full 4-item rows share the SAME centered anchors
    expect(r0!.map((p) => p.miniBarLeft)).toEqual(r1!.map((p) => p.miniBarLeft));
  });

  it("an incomplete final row is independently centered, NOT left-aligned to the full row's anchors", () => {
    // 6 items → rows [4, 2]; row 2 is a 2-item row centered on its own
    const rows = groupsByRow(layout.items);
    expect(rows.map((r) => r.length)).toEqual([4, 2]);
    const [full, tail] = rows;
    const center = 24 + 632 / 2;
    expect(rowCenterX(tail!)).toBeCloseTo(center, 6); // its own group centered
    // …and it does not reuse the full row's first two anchors
    expect(tail![0]!.miniBarLeft).not.toBeCloseTo(full![0]!.miniBarLeft, 6);
    expect(tail!.map((p) => p.miniBarLeft)).not.toEqual(full!.slice(0, 2).map((p) => p.miniBarLeft));
    // single-item tail row is centered too (7 items → [4,3] handled elsewhere)
  });

  it("strict left anchor per item: miniBarLeft == cellLeft; label/value offsets are the shared rule", () => {
    for (const p of layout.items) {
      expect(p.miniBarLeft).toBeCloseTo(p.cellLeft, 6);
      expect(p.nameLeft).toBeCloseTo(p.miniBarLeft + MINI_BAR_WIDTH + MINI_BAR_GAP, 6);
    }
  });

  it("row-2 value starts at the ITEM left edge (== miniBarLeft), NOT indented to the name", () => {
    for (const p of layout.items) {
      expect(p.valueLeft).toBeCloseTo(p.miniBarLeft, 6);
      expect(p.valueLeft).not.toBeCloseTo(p.nameLeft, 6); // no label indent
    }
  });

  it("all items share one uniform cellWidth", () => {
    expect(new Set(layout.items.map((p) => p.width)).size).toBe(1);
    expect(layout.items[0]!.width).toBeCloseTo(layout.cellWidth, 6);
  });

  it("mini bar is vertically centered on the LABEL row (first line), not on the two-line block", () => {
    for (const p of layout.items) {
      // bar rides the first line, aligned with the label's own optical center
      expect(p.miniBarY + MINI_BAR_HEIGHT / 2).toBeCloseTo(p.labelCenterY, 6);
      expect(p.labelCenterY).toBeCloseTo(p.nameBaseline - NAME_FONT_SIZE * TEXT_VISUAL_CENTER, 6);
      // …deliberately NOT centered between the label and value lines
      const blockCenter = textBlockCenterY(p.nameBaseline, p.valueBaseline, NAME_FONT_SIZE, VALUE_FONT_SIZE);
      expect(p.miniBarY + MINI_BAR_HEIGHT / 2).not.toBeCloseTo(blockCenter, 6);
    }
  });

  it("per row: all name baselines equal, all value baselines equal", () => {
    for (const row of layout.rows) {
      const inRow = layout.items.filter((p) => p.row === layout.rows.indexOf(row));
      expect(new Set(inRow.map((p) => p.nameBaseline)).size).toBe(1);
      expect(new Set(inRow.map((p) => p.valueBaseline)).size).toBe(1);
      expect(row.labelBaseline).toBe(inRow[0]!.nameBaseline);
      expect(row.valueBaseline).toBe(inRow[0]!.valueBaseline);
    }
  });

  it("each centered row stays inside the content bounds (no overflow)", () => {
    const contentRight = 24 + 632;
    for (const row of groupsByRow(layout.items)) {
      const rowRight = row[row.length - 1]!.miniBarLeft + row[0]!.width;
      expect(rowRight).toBeLessThanOrEqual(contentRight + 1e-6);
    }
  });

  it("items are chunked in canonical sorted order", () => {
    expect(layout.items.map((p) => p.id)).toEqual(SIX_ITEMS.map((i) => i.id));
  });

  it("height depends on the row count", () => {
    const oneRow = layoutAt(920);
    const threeRow = layoutAt(300);
    expect(oneRow.height).toBeCloseTo(45, 6);
    expect(threeRow.height).toBeGreaterThan(oneRow.height);
    expect(threeRow.height).toBeCloseTo((threeRow.rows.length - 1) * LANGUAGE_ROW_HEIGHT + 45, 6);
  });
});

describe("chooseLegendColumns — responsive, density-first with a mild 4-column preference", () => {
  it("a barely-fitting 5 is downgraded to a comfortable 4 (rows stay tidy)", () => {
    // width(5) = 5·100 + 4·32 = 628 → 632 leaves 4px (< comfort 32); width(4) = 496 leaves 136.
    expect(chooseLegendColumns(7, 100, 632, 32)).toBe(4);
  });

  it("a comfortable 5 stays 5 (density wins)", () => {
    expect(chooseLegendColumns(7, 100, 700, 32)).toBe(5); // 700 − 628 = 72 ≥ comfort 32
  });

  it("4 fitting naturally stays 4", () => {
    expect(chooseLegendColumns(7, 100, 560, 32)).toBe(4); // 5 needs 628 > 560
  });

  it("3 when 4 cannot fit at all", () => {
    expect(chooseLegendColumns(7, 100, 470, 32)).toBe(3); // 4 needs 496 > 470
  });

  it("boundary: exactly one comfort margin of slack → 5 is kept (not downgraded)", () => {
    expect(chooseLegendColumns(7, 100, 660, 32)).toBe(5); // 660 − 628 = 32 == comfort
  });

  it("never hard-codes on the number of languages (same widths, any count ≥ 5)", () => {
    expect(chooseLegendColumns(5, 100, 632, 32)).toBe(4);
    expect(chooseLegendColumns(100, 100, 632, 32)).toBe(4);
  });
});
