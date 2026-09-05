/**
 * Codebase Card — Language Area layout engine (Final Spec).
 *
 * Two-line legend items chunked row-major into equal columns. Each row is
 * centered as one group on the content center and shares one column geometry:
 * cell left = mini-bar left, name at bar + gap, value at the item's left edge.
 * Pure geometry — the single algorithm source for the renderer and goldens.
 */

import { estimateTextWidth } from "./measure.js";

export const MINI_BAR_WIDTH = 19; // ONE shared legend-swatch width (top summary + language rows)
export const MINI_BAR_HEIGHT = 4;
export const MINI_BAR_GAP = 8; // mini bar → text (shared top summary + language rows)
/** Legend text offset shared by the summary row and the language rows (identical spacing rule). */
export const SWATCH_TEXT_OFFSET = MINI_BAR_WIDTH + MINI_BAR_GAP;
export const LANGUAGE_ITEM_GAP = 32;
export const LANGUAGE_ROW_HEIGHT = 42; // label row → next row's label row (row gap)
export const NAME_FONT_SIZE = 11;
export const VALUE_FONT_SIZE = 10.5;
/** Label baseline → value baseline (the two lines of one item). */
export const LABEL_TO_VALUE_GAP = 17;
/** Distance from the language grid top to the first label baseline. */
export const LABEL_TOP_PAD = 5;
/** Fraction of the font size the *visual center* of a text line sits below its baseline. */
export const TEXT_VISUAL_CENTER = 0.35;
/** Below the last value baseline: descender + card bottom padding. */
export const AREA_BOTTOM_PAD = 23;

/**
 * Vertical center of a label+value block — the swatch centers on the block, not
 * the first line. Optical line center = baseline − 0.35·fontSize.
 */
export function textBlockCenterY(
  labelBaseline: number,
  valueBaseline: number,
  labelFont: number,
  valueFont: number,
  visualCenter = TEXT_VISUAL_CENTER,
): number {
  return ((labelBaseline - labelFont * visualCenter) + (valueBaseline - valueFont * visualCenter)) / 2;
}

/**
 * Shared two-line legend-item geometry for the Codebase card. The mini-bar sits
 * on the label row, centered on the label's optical center.
 */
export interface LegendItemGeometry {
  labelBaseline: number;
  valueBaseline: number;
  /** Visual (optical) center of the FIRST line (label); the mini-bar is centered on it. */
  barCenterY: number;
  barY: number;
}

export function legendItemGeometry(
  labelBaseline: number,
  lineGap: number = LABEL_TO_VALUE_GAP,
): LegendItemGeometry {
  const valueBaseline = labelBaseline + lineGap;
  // Bar is on row 1: centered on the LABEL's optical center, not the whole block.
  const barCenterY = labelBaseline - NAME_FONT_SIZE * TEXT_VISUAL_CENTER;
  return { labelBaseline, valueBaseline, barCenterY, barY: barCenterY - MINI_BAR_HEIGHT / 2 };
}

/** A language item as laid out by this engine. Colors are resolved upstream. */
export interface LanguageItemInput {
  id: string;
  name: string;
  /** Pre-formatted second line, e.g. "15,147 · 39.2%". */
  value: string;
  color: string;
}

/** Measured dimensions of one language item (layout stage, before render). */
export interface LanguageItemMeasure {
  nameWidth: number;
  valueWidth: number;
  requiredHeight: number;
}

/** The uniform cell shared by every language item in the grid. */
export interface LanguageCellMeasure {
  /** (miniBarWidth + miniBarGap) + max(max(nameWidth, valueWidth)) over all items. */
  cellWidth: number;
}

export interface LanguageRowPlacement {
  /** Indices into the input items, in display order. */
  indices: number[];
  labelBaseline: number;
  valueBaseline: number;
}

export interface LanguageItemPlacement {
  index: number;
  id: string;
  name: string;
  value: string;
  color: string;
  row: number;
  col: number;
  cellLeft: number;
  itemLeft: number;
  width: number;
  miniBarLeft: number;
  nameLeft: number;
  /** valueLeft = miniBarLeft — row-2 value starts at the ITEM left edge, NOT under the label. */
  valueLeft: number;
  /** Visual center of the label line (row 1); the mini bar is centered on it. */
  labelCenterY: number;
  /** Top of the mini bar; its center equals labelCenterY (bar sits on the label row). */
  miniBarY: number;
  nameBaseline: number;
  valueBaseline: number;
}

export interface LanguageAreaOptions {
  /** Available width for the grid (e.g. content width of the card). */
  contentWidth: number;
  /** Content left anchor (== languageBarLeft / content left). Center point for rows. */
  left: number;
  /** languageGridTop: below the language bar (bar bottom + area gap). */
  top: number;
  /**
   * Override the responsive column count (items per full row). When set, the
   * count is NOT re-derived from the available width.
   */
  columns?: number;
  /**
   * Override the uniform cell width (measured by default). Lets the caller share
   * ONE grid geometry between the summary row and the language rows.
   */
  cellWidth?: number;
  itemGap?: number;
  rowHeight?: number;
  miniBarWidth?: number;
  miniBarGap?: number;
}

export interface LanguageAreaLayout {
  items: LanguageItemPlacement[];
  rows: LanguageRowPlacement[];
  columns: number;
  cellWidth: number;
  /** Vertical extent from `top` to the last row's bottom (incl. padding). */
  height: number;
  /** Per-row item counts, e.g. [4, 2]. */
  distribution: number[];
}

function measureItem(
  it: LanguageItemInput,
  mbarW: number,
  mbarGap: number,
): LanguageItemMeasure {
  const nameWidth = estimateTextWidth(it.name, { fontSize: NAME_FONT_SIZE, mono: false });
  const valueWidth = estimateTextWidth(it.value, { fontSize: VALUE_FONT_SIZE, mono: true });
  return { nameWidth, valueWidth, requiredHeight: NAME_FONT_SIZE + LABEL_TO_VALUE_GAP };
}

/** Uniform cell width for the whole set, measured from the actual items. */
export function measureLanguageCell(
  items: LanguageItemInput[],
  opts: Pick<LanguageAreaOptions, "miniBarWidth" | "miniBarGap">,
): LanguageCellMeasure {
  const mbarW = opts.miniBarWidth ?? MINI_BAR_WIDTH;
  const mbarGap = opts.miniBarGap ?? MINI_BAR_GAP;
  const nameLeftOffset = mbarW + mbarGap;
  let content = 0;
  for (const it of items) {
    const m = measureItem(it, mbarW, mbarGap);
    content = Math.max(content, m.nameWidth, m.valueWidth);
  }
  return { cellWidth: nameLeftOffset + content };
}

/** Column count from available space (Final Spec §4). */
export function resolveColumns(
  cellWidth: number,
  itemCount: number,
  availableWidth: number,
  gap: number = LANGUAGE_ITEM_GAP,
): number {
  const denom = cellWidth + gap;
  const maxColumns = denom > 0 ? Math.max(1, Math.floor((availableWidth + gap) / denom)) : itemCount;
  return Math.min(maxColumns, itemCount);
}

/** Total width consumed by `count` equal columns of `cellWidth` with `gap` gaps. */
export function gridWidth(count: number, cellWidth: number, gap: number = LANGUAGE_ITEM_GAP): number {
  if (count <= 0) return 0;
  return count * cellWidth + (count - 1) * gap;
}

/**
 * Column count preferring density, but a barely-fitting 5-column grid drops to
 * 4 when 4 fits comfortably so full rows align with the fixed summary row.
 */
export function chooseLegendColumns(
  itemCount: number,
  cellWidth: number,
  availableWidth: number,
  gap: number = LANGUAGE_ITEM_GAP,
  comfortMargin: number = gap,
): number {
  const maxFit = resolveColumns(cellWidth, itemCount, availableWidth, gap);
  if (
    maxFit === 5 &&
    availableWidth - gridWidth(5, cellWidth, gap) < comfortMargin &&
    availableWidth - gridWidth(4, cellWidth, gap) >= comfortMargin
  ) {
    return 4;
  }
  return maxFit;
}

/**
 * Left edge of ONE row of `count` equal items, centered independently on the
 * content center (an incomplete final row never reuses the full row's anchors).
 */
export function centeredRowStart(
  count: number,
  cellWidth: number,
  gap: number,
  contentLeft: number,
  contentWidth: number,
): number {
  if (count <= 0) return contentLeft;
  const rowWidth = gridWidth(count, cellWidth, gap);
  return contentLeft + (contentWidth - rowWidth) / 2;
}

/** Row-major chunk of `itemCount` items into `columns` columns (order preserved). */
export function chunkColumns(itemCount: number, columns: number): number[][] {
  const rows: number[][] = [];
  for (let start = 0; start < itemCount; start += columns) {
    const end = Math.min(start + columns, itemCount);
    const row: number[] = [];
    for (let i = start; i < end; i++) row.push(i);
    rows.push(row);
  }
  return rows;
}

/** Full language area layout: measure → resolve columns → chunk → place. */
export function layoutLanguageArea(
  items: LanguageItemInput[],
  opts: LanguageAreaOptions,
): LanguageAreaLayout {
  const gap = opts.itemGap ?? LANGUAGE_ITEM_GAP;
  const rowHeight = opts.rowHeight ?? LANGUAGE_ROW_HEIGHT;
  const mbarW = opts.miniBarWidth ?? MINI_BAR_WIDTH;
  const mbarGap = opts.miniBarGap ?? MINI_BAR_GAP;
  const left = opts.left;
  const nameLeftOffset = mbarW + mbarGap;

  // Explicit empty state: no negative blockWidth / height (SPEC §6).
  if (items.length === 0) {
    return {
      items: [],
      rows: [],
      columns: 0,
      cellWidth: nameLeftOffset,
      height: 0,
      distribution: [],
    };
  }

  const measures = items.map((it) => measureItem(it, mbarW, mbarGap));
  let content = 0;
  for (const m of measures) {
    content = Math.max(content, m.nameWidth, m.valueWidth);
  }
  const cellWidth = opts.cellWidth ?? nameLeftOffset + content;
  const columns = opts.columns ?? chooseLegendColumns(items.length, cellWidth, opts.contentWidth, gap);
  const rowIndices = chunkColumns(items.length, columns);

  const rows: LanguageRowPlacement[] = [];
  const placements: LanguageItemPlacement[] = [];
  let labelBaseline = opts.top + LABEL_TOP_PAD;

  for (let r = 0; r < rowIndices.length; r++) {
    const indices = rowIndices[r]!;
    // Center each row as one group on the content center; a final partial row is
    // centered on its own group, never left-anchored to the previous row's grid.
    const rowLeft = centeredRowStart(indices.length, cellWidth, gap, left, opts.contentWidth);
    // Shared legend-item geometry (same helper as the top summary row).
    const geom = legendItemGeometry(labelBaseline);
    rows.push({ indices, labelBaseline: geom.labelBaseline, valueBaseline: geom.valueBaseline });

    for (let col = 0; col < indices.length; col++) {
      const itemIndex = indices[col]!;
      const it = items[itemIndex];
      if (!it) continue;
      const cellLeft = rowLeft + col * (cellWidth + gap);
      const miniBarLeft = cellLeft;
      const nameLeft = miniBarLeft + nameLeftOffset;
      const labelCenterY = labelBaseline - NAME_FONT_SIZE * TEXT_VISUAL_CENTER;
      placements.push({
        index: itemIndex,
        id: it.id,
        name: it.name,
        value: it.value,
        color: it.color,
        row: r,
        col,
        cellLeft,
        itemLeft: cellLeft,
        width: cellWidth,
        miniBarLeft,
        nameLeft,
        valueLeft: miniBarLeft,
        labelCenterY,
        miniBarY: geom.barY,
        nameBaseline: geom.labelBaseline,
        valueBaseline: geom.valueBaseline,
      });
    }
    labelBaseline += rowHeight;
  }

  const height =
    (rowIndices.length - 1) * rowHeight + (LABEL_TOP_PAD + LABEL_TO_VALUE_GAP) + AREA_BOTTOM_PAD;
  return {
    items: placements,
    rows,
    columns,
    cellWidth,
    height,
    distribution: rowIndices.map((r) => r.length),
  };
}
