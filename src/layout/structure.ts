/**
 * Structure card layout (plan.md §27/§28, SPEC §5): directory tree + commit
 * heatmap + changes microbars. Disabled columns leave no blank space and the
 * card shrinks. 7/14/30 days never wrap — a larger window only widens the
 * commits/changes columns (single shared rowCenterY per directory). Pure
 * geometry — no colors, no rendering.
 *
 * Horizontal model: the tree's directory content (name, and an optional
 * description) is measured at the SAME font weight the renderer draws it
 * (.row 550 / .root 650 / .desc 400). The rightmost content edge defines
 * `textRight`; the metadata region starts one semantic META_GUTTER after it
 * (`metadataLeft = textRight + META_GUTTER`). dirs/files/share anchors then
 * derive left-to-right from that single origin, so no name length or depth can
 * push content under the columns, and every row's metadata stays globally
 * aligned.
 */

import { estimateTextWidth } from "./measure.js";
import type { StructureData, StructureRow } from "../structure/model.js";
import { resolveActivityHeader, type HeaderLabel } from "../structure/header.js";
import { shareLabel } from "../structure/share.js";
import { buildCommitScale, commitScaleLegendText } from "../structure/commit-scale.js";
import type { CommitScale } from "../structure/commit-scale.js";

export const PAD_X = 26;
export const HEADER_Y = 40;
export const DIVIDER_Y = 49.5;
export const WEEKDAY_Y = 76;
export const FIRST_ROW_Y = 97;
export const ROW_HEIGHT = 30;
export const TREE_INDENT = 34;
export const ICON_SIZE = 16;
export const COLUMN_GAP = 32;
export const HEATMAP_CELL = 12;
export const HEATMAP_GAP = 8;
export const CHANGES_SLOT = 20;
export const CHANGES_BAR = 8;
export const TREE_FONT = 13;
/** Directory-name text x inside a row's translate(iconLeft) space (icon width + gap). */
export const NAME_TEXT_OFFSET = ICON_SIZE + 8;
/** .row directory-name CSS font-weight (renderer and measurement share this). */
export const ROW_FONT_WEIGHT = 550;
/** .root (depth-0 repository/subtree-root row) directory-name font-weight. */
export const ROOT_FONT_WEIGHT = 650;
/** .desc directory-description font-weight (regular; display metadata). */
export const DESC_FONT_WEIGHT = 400;
/** Optional directory-description font (smaller, regular weight; display metadata). */
export const DESC_FONT = 11;
/** Gap between a directory name and its optional description. */
export const DESC_GAP = 8;
/**
 * Minimum gutter (semantic spacing) between the rightmost directory content
 * (a name, or a name+description) and the start of the dirs·files·share metadata
 * region. Semantic layout invariant — at any depth and any name length:
 *
 *   countAnchors.dirsSlotLeft − rightmostRowContentEnd ≥ META_GUTTER
 *
 * The three metadata columns keep this gutter: dirsSlotLeft is derived as
 * `textRight + META_GUTTER`, and the dirs/files/share anchors flow from it.
 */
export const META_GUTTER = 8;
/** Gap between a word column (dirs/files/share) and a neighboring "·" separator. */
export const META_COL_GAP = 10;
/** Gap between a number's right edge and its label's fixed start x. */
export const NUM_LABEL_GAP = 4;
/** Font size of the row-count/share metadata text. */
export const COUNT_FONT = 11;

export interface ColumnLayout {
  enabled: boolean;
  left: number;
  width: number;
  centerX: number;
}

export interface RowLayout {
  row: StructureRow;
  centerY: number;
  iconLeft: number;
  nameLeft: number;
  /** Right edge (row-local) where the dirs NUMBER is right-aligned (fixed global). */
  dirsNumRightLocal: number;
  /** Fixed start x (row-local) of the `dir`/`dirs` label. */
  dirsLabelXLocal: number;
  /** Right edge (row-local) where the files NUMBER is right-aligned (fixed global). */
  filesNumRightLocal: number;
  /** Fixed start x (row-local) of the `file`/`files` label. */
  filesLabelXLocal: number;
  /** Fixed global x (row-local) of the FIRST "·" (between dirs and files). */
  sep1XLocal: number;
  /** Fixed global x (row-local) of the SECOND "·" (between files and share). */
  sep2XLocal: number;
  /** Fixed global x (row-local) the code-share % is RIGHT-aligned to. */
  shareRightXLocal: number;
  /** Global metadata right edge (same for every row). */
  countRight: number;
  /** countRight expressed in the row's local translate(iconLeft) space. */
  countRightLocal: number;
  /**
   * Left edge (in the row's local translate space) of an optional directory
   * description — immediately after the measured directory name + DESC_GAP.
   * Present exactly when `row.description` is set.
   */
  descXLocal?: number;
}

export interface StructureLayout {
  cardWidth: number;
  cardHeight: number;
  contentLeft: number;
  contentRight: number;
  columns: { tree: ColumnLayout; commits: ColumnLayout; changes: ColumnLayout };
  rows: RowLayout[];
  weekdayLabels: HeaderLabel[];
  commitLegend: { left: number; centerX: number; y: number };
  changesLegend: { left: number; centerX: number; y: number };
  footer: { x: number; y: number };
  /** The real activity window length (7/14/30) — for the <desc>, never label count. */
  activityDays: number;
  /**
   * Fixed horizontal anchors (global x) for the row metadata, shared by every
   * row: dirs/files label starts, the two "·" separators, the share right edge
   * and the number right-align edges. Values never move these anchors.
   */
  countAnchors: {
    /** Left edge of the dirs number slot (== rightmost content + META_GUTTER). */
    dirsSlotLeft: number;
    dirsNumRight: number;
    dirsLabelX: number;
    filesNumRight: number;
    filesLabelX: number;
    sep1: number;
    sep2: number;
    shareRight: number;
  };
  /** max commits in any single cell (informational). */
  maxCellCommits: number;
  /** Card-GLOBAL commit scale (cells + legend), derived from this window. */
  commitScale: CommitScale;
  maxAdditions: number;
  maxDeletions: number;
}

/**
 * Width of a directory name exactly as the renderer draws it: 13px sans at the
 * row font-weight (550), or the root weight (650) for a depth-0 row. Layout
 * measures names AND the renderer CSS use the same ROW_FONT_WEIGHT/ROOT_FONT_WEIGHT.
 */
export function directoryNameWidth(name: string, depth: number): number {
  return estimateTextWidth(name, {
    fontSize: TREE_FONT,
    mono: false,
    fontWeight: depth === 0 ? ROOT_FONT_WEIGHT : ROW_FONT_WEIGHT,
  });
}

/** Width of a directory description exactly as the renderer draws it (11px, weight 400). */
function descriptionWidth(text: string): number {
  return estimateTextWidth(text, { fontSize: DESC_FONT, mono: false, fontWeight: DESC_FONT_WEIGHT });
}

export function layoutStructure(
  data: StructureData,
  enabled: { commits: boolean; changes: boolean },
): StructureLayout {
  const contentLeft = PAD_X;
  const rowCount = data.rows.length;
  const days = data.days;

  // Row metadata model (`dirs · files · code-share`): numbers right-align at
  // fixed slots, labels start at fixed x, "·" separators fixed — shared by rows.
  const numText = (n: number): string => String(n);
  const wordText = (n: number, one: string, many: string): string => (n === 1 ? one : many);
  const measure = (t: string): number => estimateTextWidth(t, { fontSize: COUNT_FONT, mono: true });

  // Measure every row's directory content (indent + icon offset + name + optional
  // description) at the weight it is actually rendered, plus the widest number/
  // word/share the metadata columns must reserve.
  let maxTextEnd = 0; // rightmost row content, relative to contentLeft
  let dirsNumMax = 0;
  let dirsWordMax = 0;
  let filesNumMax = 0;
  let filesWordMax = 0;
  let shareMax = 0;
  for (const r of data.rows) {
    const nameW = directoryNameWidth(r.name, r.depth);
    const descW = r.description ? descriptionWidth(r.description) : 0;
    const contentEnd = NAME_TEXT_OFFSET + nameW + (r.description ? DESC_GAP + descW : 0);
    const textEnd = r.depth * TREE_INDENT + contentEnd;
    if (textEnd > maxTextEnd) maxTextEnd = textEnd;
    const dn = measure(numText(r.dirs));
    if (dn > dirsNumMax) dirsNumMax = dn;
    const dw = measure(wordText(r.dirs, "dir", "dirs"));
    if (dw > dirsWordMax) dirsWordMax = dw;
    const fn = measure(numText(r.files));
    if (fn > filesNumMax) filesNumMax = fn;
    const fw = measure(wordText(r.files, "file", "files"));
    if (fw > filesWordMax) filesWordMax = fw;
    if (r.codeShare != null) {
      const sw = measure(shareLabel(r.codeShare));
      if (sw > shareMax) shareMax = sw;
    }
  }
  // Empty state: size the tree column for the DIRECTORY header/footer so nothing
  // clips at the left edge (SPEC §5); normal trees keep their measured width.
  if (data.rows.length === 0) {
    const headerW = estimateTextWidth("DIRECTORY", { fontSize: 12, mono: false });
    const footerW = estimateTextWidth("999,999,999 source files", { fontSize: 11, mono: false });
    maxTextEnd = Math.max(headerW, footerW);
    dirsNumMax = 0;
    dirsWordMax = 0;
    filesNumMax = 0;
    filesWordMax = 0;
    shareMax = 0;
  }

  // The metadata region starts exactly one semantic META_GUTTER after the widest
  // directory content; then each anchor flows left → right from that origin.
  // Slots reserve the widest number/word/share, so multi-digit or plural rows
  // never move the shared global anchors.
  const textRight = contentLeft + maxTextEnd; // rightmost directory content (global x)
  const metadataLeft = textRight + META_GUTTER; // dirs number slot left (dirsSlotLeft)
  const dirsNumRight = metadataLeft + dirsNumMax;
  const dirsLabelX = dirsNumRight + NUM_LABEL_GAP;
  const sep1 = dirsLabelX + dirsWordMax + META_COL_GAP;
  const filesNumRight = sep1 + META_COL_GAP + filesNumMax;
  const filesLabelX = filesNumRight + NUM_LABEL_GAP;
  const sep2 = filesLabelX + filesWordMax + META_COL_GAP;
  const shareRight = sep2 + META_COL_GAP + shareMax;
  const treeWidth = shareRight - contentLeft;
  // No wrap (SPEC §5): more days widen the columns, they never reflow.
  const commitsWidth = days * HEATMAP_CELL + (days - 1) * HEATMAP_GAP;
  const changesWidth = days * CHANGES_SLOT - 8;

  // ---- Column x — advance ONLY for enabled columns (no blank space left) ----
  let cursor = contentLeft;
  const treeLeft = cursor;
  cursor += treeWidth;
  if (enabled.commits) cursor += COLUMN_GAP;
  const commitsLeft = cursor;
  if (enabled.commits) cursor += commitsWidth;
  if (enabled.changes) cursor += COLUMN_GAP;
  const changesLeft = cursor;
  if (enabled.changes) cursor += changesWidth;
  const contentRight = cursor;
  const cardWidth = contentRight + PAD_X;

  const tree: ColumnLayout = { enabled: true, left: treeLeft, width: treeWidth, centerX: treeLeft + treeWidth / 2 };
  const commits: ColumnLayout = { enabled: enabled.commits, left: commitsLeft, width: commitsWidth, centerX: commitsLeft + commitsWidth / 2 };
  const changes: ColumnLayout = { enabled: enabled.changes, left: changesLeft, width: changesWidth, centerX: changesLeft + changesWidth / 2 };

  // ---- Rows ----
  const rows: RowLayout[] = data.rows.map((row, i) => {
    const iconLeft = contentLeft + row.depth * TREE_INDENT;
    // Name and description widths are the SAME weight-aware measures used for the
    // region size above, so per-row positions match the rightmost-content bound.
    const nameW = directoryNameWidth(row.name, row.depth);
    const rowLayout: RowLayout = {
      row,
      centerY: FIRST_ROW_Y + i * ROW_HEIGHT,
      iconLeft,
      nameLeft: iconLeft + NAME_TEXT_OFFSET,
      // Same global x for every row (anchor − iconLeft in the row-local space).
      dirsNumRightLocal: dirsNumRight - iconLeft,
      dirsLabelXLocal: dirsLabelX - iconLeft,
      filesNumRightLocal: filesNumRight - iconLeft,
      filesLabelXLocal: filesLabelX - iconLeft,
      sep1XLocal: sep1 - iconLeft,
      sep2XLocal: sep2 - iconLeft,
      shareRightXLocal: shareRight - iconLeft,
      countRight: shareRight,
      countRightLocal: shareRight - iconLeft,
    };
    if (row.description) {
      rowLayout.descXLocal = NAME_TEXT_OFFSET + nameW + DESC_GAP;
    }
    return rowLayout;
  });

  const lastRowCenter = rowCount > 0 ? FIRST_ROW_Y + (rowCount - 1) * ROW_HEIGHT : FIRST_ROW_Y;
  const legendY = lastRowCenter + ROW_HEIGHT / 2 + 24;
  const cardHeight = legendY + 34;

  // Legends center on their column by measured width (SPEC §5). The commit scale
  // is card-global and calibrated on EVERY positive NON-ROOT cell in the window
  // (the repo-root row is a whole-repository aggregate; its counts must not
  // shift the quartiles, but it still classifies on the same shared scale).
  const positiveNonRootCounts: number[] = [];
  for (const r of data.rows) {
    if (r.repoRel === ".") continue;
    for (const d of r.activity) {
      if (d.commits > 0) positiveNonRootCounts.push(d.commits);
    }
  }
  const commitScale = buildCommitScale(positiveNonRootCounts);
  const commitLegendTextW = estimateTextWidth(commitScaleLegendText(commitScale), { fontSize: 11, mono: false });
  const swatchCount = commitScale.thresholds.length;
  const commitLegendWidth = (swatchCount - 1) * 14 + 20 + commitLegendTextW;
  const changesLegendWidth = 74 + estimateTextWidth("deleted", { fontSize: 11, mono: false });
  const commitLegend = { left: commits.centerX - commitLegendWidth / 2, centerX: commits.centerX, y: legendY };
  const changesLegend = { left: changes.centerX - changesLegendWidth / 2, centerX: changes.centerX, y: legendY };

  let maxCellCommits = 0;
  let maxAdditions = 0;
  let maxDeletions = 0;
  for (const r of data.rows) {
    for (const d of r.activity) {
      if (d.commits > maxCellCommits) maxCellCommits = d.commits;
      if (d.additions > maxAdditions) maxAdditions = d.additions;
      if (d.deletions > maxDeletions) maxDeletions = d.deletions;
    }
  }

  return {
    cardWidth,
    cardHeight,
    contentLeft,
    contentRight,
    columns: { tree, commits, changes },
    rows,
    weekdayLabels: resolveActivityHeader(days, data.startDate),
    commitLegend,
    changesLegend,
    footer: { x: tree.centerX, y: legendY + 2.5 },
    activityDays: days,
    commitScale,
    countAnchors: {
      dirsSlotLeft: metadataLeft,
      dirsNumRight,
      dirsLabelX,
      filesNumRight,
      filesLabelX,
      sep1,
      sep2,
      shareRight,
    },
    maxCellCommits,
    maxAdditions,
    maxDeletions,
  };
}

/** Changes bar height (px) scaled to the max value, capped at the golden's 14px. */
export function changeBarHeight(value: number, maxValue: number): number {
  if (value <= 0) return 0;
  const h = maxValue > 0 ? (value / maxValue) * 14 : 0;
  return Math.max(2, Math.round(h));
}

/** Changes-bar opacity index 0..3 from the rendered height (SPEC §5, golden-matched). */
export function changeBarOpacityIndex(height: number): number {
  if (height >= 13) return 3;
  if (height >= 9) return 2;
  if (height >= 5) return 1;
  return 0;
}
