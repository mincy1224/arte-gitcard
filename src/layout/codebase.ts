/**
 * Codebase card layout: metrics row, summary bar, fan, language bar and the
 * elastic language area. Pure geometry — no rendering, no theme colors.
 * Mirrors the finalized golden relationships (plan.md §18/§26, SPEC §6).
 */

import { estimateTextWidth } from "./measure.js";
import {
  layoutLanguageArea,
  LANGUAGE_ITEM_GAP,
  SWATCH_TEXT_OFFSET,
  NAME_FONT_SIZE,
  VALUE_FONT_SIZE,
  measureLanguageCell,
  chooseLegendColumns,
  centeredRowStart,
  gridWidth,
  type LanguageAreaLayout,
} from "./languages.js";
import type { CodebaseCardData } from "../codebase/card.js";

export const CARD_PAD = 24;
export const SUMMARY_BAR_Y = 59;
export const BAR_HEIGHT = 4;
export const FAN_BOTTOM_Y = 97;
export const LANGUAGE_BAR_Y = 97;
export const LANGUAGE_AREA_GAP = 24; // language bar bottom → grid top
export const METRIC_GAP = 48; // metric-to-metric gap (centered row, balanced margins)
// Top summary legend label/value fonts — ALIASES of the shared language-legend
// font constants, so the two-line text block is identical top-to-bottom.
export const NAME_FONT = NAME_FONT_SIZE;
export const VALUE_FONT = VALUE_FONT_SIZE;

export interface MetricLayout {
  left: number;
  name: string;
  value: string;
  barColorKey: "text" | "accent" | "accentSoft" | "neutral";
}

export interface SummaryLayout {
  left: number;
  width: number;
  effEnd: number;
  comEnd: number;
  blankEnd: number;
}

export interface LanguageBarSegment {
  x: number;
  width: number;
  color: string;
}

export interface CodebaseLayout {
  cardWidth: number;
  cardHeight: number;
  contentLeft: number;
  contentRight: number;
  centerX: number;
  metrics: MetricLayout[];
  summary: SummaryLayout;
  fanTopLeft: number;
  fanTopRight: number;
  /**
   * False when no language has counted lines; renderer hides the fan and
   * language segments (no zero-width Effective → full-bar triangle).
   */
  hasLanguageData: boolean;
  /**
   * True when total lines > 0. On an empty repo the renderer draws only the
   * neutral track, never a full-width "100% Blank" bar (SPEC §6).
   */
  hasSummaryData: boolean;
  languageBar: { left: number; width: number; segments: LanguageBarSegment[] };
  languageArea: LanguageAreaLayout;
  /**
   * The four summary swatch-start x positions, centered on the card. A full
   * 4-item language row shares these exact anchors.
   */
  summaryColumnAnchors: number[];
  /** Width of the centered 4-item summary row: 4·cell + 3·gap. */
  summaryRowWidth: number;
  /** The ONE uniform legend cell width shared by the summary and language rows. */
  legendCellWidth: number;
  /** True when the resolved language grid is exactly 4 (full rows share the summary anchors). */
  alignLanguageToSummary: boolean;
}

function metricWidth(name: string, value: string): number {
  const nameW = estimateTextWidth(name, { fontSize: NAME_FONT, mono: false });
  const valueW = estimateTextWidth(value, { fontSize: VALUE_FONT, mono: true });
  // Reserve swatch + shared text gap (same rule as the language rows).
  return SWATCH_TEXT_OFFSET + Math.max(nameW, valueW);
}

export function layoutCodebase(
  data: CodebaseCardData,
  opts: { minCardWidth?: number } = {},
): CodebaseLayout {
  // Single source of truth for comment mode (SPEC §6): the card data carries it.
  const includeComments = data.includeComments;
  const metricDefs: Array<{ name: string; value: string; barColorKey: MetricLayout["barColorKey"] }> = [
    { name: "Total", value: data.total, barColorKey: "text" },
    { name: "Effective", value: data.effective, barColorKey: "accent" },
    { name: "Comments", value: data.comments, barColorKey: "accentSoft" },
    { name: "Blank", value: data.blank, barColorKey: "neutral" },
  ];
  const contentLeft = CARD_PAD;
  const langItems = data.languages.map((l) => ({
    id: l.id,
    name: l.name,
    value: l.value,
    color: l.color,
  }));
  const areaTop = LANGUAGE_BAR_Y + BAR_HEIGHT + LANGUAGE_AREA_GAP;

  // ONE uniform grid (single cell width + gap) for the summary row and every
  // language row, so 4-item rows share identical centered anchors.
  const summaryColumns = 4;
  const metricCells = metricDefs.map((m) => metricWidth(m.name, m.value));
  const langCell = langItems.length > 0 ? measureLanguageCell(langItems, {}).cellWidth : 0;
  const legendCell = Math.max(...metricCells, langCell);
  const gap = LANGUAGE_ITEM_GAP;

  // Grow the card until content fits the 4-item summary row and language rows.
  const minCardWidth = opts.minCardWidth ?? 680;
  let cardWidth = minCardWidth;
  for (let i = 0; i < 20; i++) {
    const contentWidth = cardWidth - CARD_PAD * 2;
    const langCols = langItems.length > 0 ? chooseLegendColumns(langItems.length, legendCell, contentWidth, gap) : 0;
    const need = Math.max(
      contentWidth,
      Math.ceil(
        Math.max(
          gridWidth(summaryColumns, legendCell, gap),
          langCols > 0 ? gridWidth(langCols, legendCell, gap) : 0,
        ),
      ),
    );
    const targetCard = need + CARD_PAD * 2;
    if (targetCard <= cardWidth) break;
    cardWidth = targetCard;
  }
  const contentWidth = cardWidth - CARD_PAD * 2;

  const centerX = cardWidth / 2;
  const contentRight = cardWidth - CARD_PAD;

  const summaryRowLeft = centeredRowStart(summaryColumns, legendCell, gap, contentLeft, contentWidth);
  const summaryColumnAnchors = Array.from({ length: summaryColumns }, (_, i) => summaryRowLeft + i * (legendCell + gap));
  const metrics: MetricLayout[] = metricDefs.map((m, i) => ({
    left: summaryColumnAnchors[i]!,
    name: m.name,
    value: m.value,
    barColorKey: m.barColorKey,
  }));

  const languageColumns = langItems.length > 0 ? chooseLegendColumns(langItems.length, legendCell, contentWidth, gap) : 0;
  const alignLanguageToSummary = langItems.length > 0 && languageColumns === summaryColumns;
  let languageArea: LanguageAreaLayout = {
    items: [],
    rows: [],
    columns: 0,
    cellWidth: 0,
    height: 0,
    distribution: [],
  };
  if (langItems.length > 0) {
    languageArea = layoutLanguageArea(langItems, {
      contentWidth,
      left: contentLeft,
      top: areaTop,
      columns: languageColumns,
      cellWidth: legendCell,
      itemGap: gap,
    });
  }

  const summaryW = 0.8 * contentWidth;
  const summaryLeft = centerX - summaryW / 2;
  const [effFrac, comFrac, blankFrac] = data.summaryFracs;
  const effEnd = summaryLeft + effFrac * summaryW;
  const comEnd = summaryLeft + (effFrac + comFrac) * summaryW;
  // Empty repo ([0,0,0]) → blankEnd = summaryLeft (zero-width blank, never "100% Blank").
  const blankEnd = summaryLeft + (effFrac + comFrac + blankFrac) * summaryW;

  // Same canonical order as the language rows; the final segment is clamped to
  // the remaining width so float overshoot never passes the bar's right edge.
  const languageBarSegs: LanguageBarSegment[] = [];
  {
    const barEnd = contentLeft + contentWidth;
    let x = contentLeft;
    for (const l of data.languages) {
      if (x >= barEnd) break;
      const width = Math.min(l.fraction * contentWidth, barEnd - x);
      if (width <= 0) break;
      languageBarSegs.push({ x, width, color: l.color });
      x += width;
    }
  }
  const languageBar: CodebaseLayout["languageBar"] = {
    left: contentLeft,
    width: contentWidth,
    segments: languageBarSegs,
  };

  // Fan top spans the Effective segment (plus Comments when include_comments).
  const fanTopRight = includeComments ? comEnd : effEnd;

  const cardHeight = areaTop + languageArea.height;
  return {
    cardWidth,
    cardHeight,
    contentLeft,
    contentRight,
    centerX,
    metrics,
    summary: { left: summaryLeft, width: summaryW, effEnd, comEnd, blankEnd },
    fanTopLeft: summaryLeft,
    fanTopRight,
    hasLanguageData: data.languages.some((l) => l.counted > 0),
    hasSummaryData: data.summaryFracs.some((f) => f > 0),
    languageBar,
    languageArea,
    summaryColumnAnchors,
    summaryRowWidth: gridWidth(summaryColumns, legendCell, gap),
    legendCellWidth: legendCell,
    alignLanguageToSummary,
  };
}
