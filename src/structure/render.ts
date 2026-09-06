/**
 * Structure card SVG renderer (plan.md M10). Pure: layout + resolved theme →
 * SVG string. Tree connectors, commit heatmap cells (intensity opacity),
 * changes microbars (baseline + opacity ramp), legends.
 */

import type { StructureLayout } from "../layout/structure.js";
import {
  HEADER_Y,
  DIVIDER_Y,
  WEEKDAY_Y,
  TREE_INDENT,
  ICON_SIZE,
  HEATMAP_CELL,
  HEATMAP_GAP,
  CHANGES_SLOT,
  CHANGES_BAR,
  TREE_FONT,
  DESC_FONT,
  DESC_FONT_WEIGHT,
  ROW_FONT_WEIGHT,
  ROOT_FONT_WEIGHT,
  changeBarHeight,
  changeBarOpacityIndex,
} from "../layout/structure.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { mixHex } from "../theme/color.js";
import { escapeXml, r1 } from "../render/svg.js";
import { shareLabel } from "./share.js";
import { levelOf, commitScaleLegendText } from "./commit-scale.js";

export function renderStructureCard(
  layout: StructureLayout,
  theme: ResolvedTheme,
  sourceFiles: number,
): string {
  const p = theme.palette;
  const st = theme.structure;
  const { cardWidth, cardHeight } = layout;
  // Descriptions are display-only metadata; their color is text mixed toward the
  // surface (NO new theme token) so it adapts. Only when ≥1 row has one.
  const hasDescriptions = layout.rows.some((r) => r.row.description !== undefined);
  const descFill = mixHex(p.text, p.surface, 0.55);
  const descStyle = hasDescriptions
    ? `\n    .desc{fill:${descFill};font-size:${DESC_FONT}px;font-weight:${DESC_FONT_WEIGHT}}`
    : "";
  const enabledCommits = layout.columns.commits.enabled;
  const enabledChanges = layout.columns.changes.enabled;
  // Theme style wiring (SPEC §4).
  const cardRadius = theme.style.card.radius;
  const cardBorderW = theme.style.card.border_width;
  const heatRadius = theme.style.heatmap.radius;
  // Border geometry: inset by borderWidth/2 so a border_width > 1 is never
  // clipped by the viewBox (SPEC §4). At border_width=1 this is byte-identical
  // to the historical x=0.5 / width=cardWidth-1.
  const borderInset = cardBorderW / 2;

  // ---- Column headers ----
  const headerItems: string[] = [];
  if (layout.columns.tree.enabled) headerItems.push(`<text x="${r1(layout.columns.tree.centerX)}" y="${HEADER_Y}" text-anchor="middle" class="label muted">DIRECTORY</text>`);
  if (enabledCommits) headerItems.push(`<text x="${r1(layout.columns.commits.centerX)}" y="${HEADER_Y}" text-anchor="middle" class="label muted">COMMITS</text>`);
  if (enabledChanges) headerItems.push(`<text x="${r1(layout.columns.changes.centerX)}" y="${HEADER_Y}" text-anchor="middle" class="label muted">CHANGES</text>`);

  const dividerX2 = enabledChanges
    ? layout.columns.changes.left + layout.columns.changes.width
    : enabledCommits
      ? layout.columns.commits.left + layout.columns.commits.width
      : layout.columns.tree.left + layout.columns.tree.width;
  const divider = `<line x1="${r1(layout.contentLeft)}" y1="${DIVIDER_Y}" x2="${r1(dividerX2)}" y2="${DIVIDER_Y}" stroke="${p.divider}"/>`;

  // ---- Weekday labels — one set per active column (Commits AND Changes) ----
  const labelX = (left: number, cellIndex: number): number =>
    left + cellIndex * (HEATMAP_CELL + HEATMAP_GAP) + HEATMAP_CELL / 2;
  const weekdayLabels = (enabledCommits || enabledChanges
    ? layout.weekdayLabels
        .map((l) => {
          const xs: string[] = [];
          if (enabledCommits) xs.push(`<text x="${r1(labelX(layout.columns.commits.left, l.cellIndex))}" y="${WEEKDAY_Y}" class="small muted" text-anchor="middle">${escapeXml(l.label)}</text>`);
          if (enabledChanges) xs.push(`<text x="${r1(labelX(layout.columns.changes.left, l.cellIndex))}" y="${WEEKDAY_Y}" class="small muted" text-anchor="middle">${escapeXml(l.label)}</text>`);
          return xs.join("\n    ");
        })
        .join("\n    ")
    : "");

  const sectionLabel = `<text x="${r1(layout.contentLeft)}" y="${WEEKDAY_Y - 3.25}" class="small muted">STRUCTURE</text>`;

  // ---- Tree connectors ----
  // A vertical rail belongs to ONE parent: from just below it (centerY + 6) to
  // its LAST direct child's row center, never past the last sibling — so a last
  // child with descendants doesn't drag an ancestor rail through its subtree.
  const trunkX = (depth: number): number => layout.contentLeft + depth * TREE_INDENT + ICON_SIZE / 2;
  const connectors: string[] = [];
  // Horizontal elbows from the parent-level rail to each node's icon.
  for (const row of layout.rows) {
    if (row.row.depth >= 1) {
      connectors.push(`M${r1(trunkX(row.row.depth - 1))} ${r1(row.centerY)} H${r1(row.iconLeft)}`);
    }
  }
  for (let i = 0; i < layout.rows.length; i++) {
    const row = layout.rows[i]!;
    const depth = row.row.depth;
    let lastChildCenter: number | null = null;
    for (let j = i + 1; j < layout.rows.length; j++) {
      const dj = layout.rows[j]!.row.depth;
      if (dj <= depth) break; // left this parent's subtree
      if (dj === depth + 1) lastChildCenter = layout.rows[j]!.centerY;
    }
    if (lastChildCenter !== null) {
      connectors.push(`M${r1(trunkX(depth))} ${r1(row.centerY + 6)} V${r1(lastChildCenter)}`);
    }
  }
  // With zero rows no connector is emitted (no dangling trunk) — an empty tree
  // group is harmless.
  const treeSvg = `<g class="tree">\n    ${connectors.map((d) => `<path d="${d}"/>`).join("\n    ")}\n  </g>`;

  // ---- Directory rows ----
  const dirRows = layout.rows
    .map((row) => {
      const descText =
        row.row.description !== undefined && row.descXLocal !== undefined
          ? `<text x="${r1(row.descXLocal)}" y="4.5" class="desc">${escapeXml(row.row.description)}</text>`
          : "";
      const dirsLabel = row.row.dirs === 1 ? "dir" : "dirs";
      const filesLabel = row.row.files === 1 ? "file" : "files";
      const share =
        row.row.codeShare != null
          ? `<text x="${r1(row.sep2XLocal)}" y="4.5" text-anchor="middle" class="small muted">·</text><text x="${r1(row.shareRightXLocal)}" y="4.5" text-anchor="end" class="small muted mono">${escapeXml(shareLabel(row.row.codeShare))}</text>`
          : "";
      return `<g transform="translate(${r1(row.iconLeft)} ${r1(row.centerY)})"><path d="M0 -6h4.5l1.8 2H16v10H0z" fill="${st.folderFill}" stroke="${st.folderStroke}" stroke-width="1"/><text x="24" y="4.5" class="row${row.row.depth === 0 ? " root" : ""}">${escapeXml(row.row.name)}</text>${descText}<text x="${r1(row.dirsNumRightLocal)}" y="4.5" text-anchor="end" class="small muted mono">${row.row.dirs}</text><text x="${r1(row.dirsLabelXLocal)}" y="4.5" class="small muted mono">${dirsLabel}</text><text x="${r1(row.sep1XLocal)}" y="4.5" text-anchor="middle" class="small muted">·</text><text x="${r1(row.filesNumRightLocal)}" y="4.5" text-anchor="end" class="small muted mono">${row.row.files}</text><text x="${r1(row.filesLabelXLocal)}" y="4.5" class="small muted mono">${filesLabel}</text>${share}</g>`;
    })
    .join("\n    ");

  // ---- Commit heatmaps ----
  const heatSvg = enabledCommits
    ? layout.rows
        .map((row) =>
          row.row.activity
            .map((day, di) => {
              const level = levelOf(layout.commitScale, day.commits);
              const x = layout.columns.commits.left + di * (HEATMAP_CELL + HEATMAP_GAP);
              const y = row.centerY - HEATMAP_CELL / 2;
              // fill-opacity from the theme's per-level intensity (SPEC §5).
              return `<rect x="${r1(x)}" y="${r1(y)}" width="${HEATMAP_CELL}" height="${HEATMAP_CELL}" rx="${r1(heatRadius)}" fill="${st.commitsColors[level]}" fill-opacity="${st.commitsIntensity[level]}" stroke="${st.commitsBorder}" stroke-width="1"/>`;
            })
            .join(""),
        )
        .join("")
    : "";

  // ---- Changes microbars (baseline + 4-level opacity ramp) ----
  const changesSvg = enabledChanges
    ? layout.rows
        .map((row) => {
          let bars = "";
          // baseline stroke under each row's microbars (SPEC §5)
          bars += `<path d="M${r1(layout.columns.changes.left)} ${r1(row.centerY)}H${r1(layout.columns.changes.left + layout.columns.changes.width)}" fill="none" stroke="${st.changesBaseline}" stroke-width="1"/>`;
          for (let di = 0; di < row.row.activity.length; di++) {
            const day = row.row.activity[di]!;
            const x = layout.columns.changes.left + di * CHANGES_SLOT + 2;
            const addH = changeBarHeight(day.additions, layout.maxAdditions);
            const delH = changeBarHeight(day.deletions, layout.maxDeletions);
            const addOp = st.changesOpacity[changeBarOpacityIndex(addH)]!;
            const delOp = st.changesOpacity[changeBarOpacityIndex(delH)]!;
            if (addH > 0) bars += `<rect x="${r1(x)}" y="${r1(row.centerY - addH)}" width="${CHANGES_BAR}" height="${r1(addH)}" rx="2" fill="${st.changesAdded}" fill-opacity="${addOp}"/>`;
            if (delH > 0) bars += `<rect x="${r1(x)}" y="${r1(row.centerY)}" width="${CHANGES_BAR}" height="${r1(delH)}" rx="2" fill="${st.changesDeleted}" fill-opacity="${delOp}"/>`;
          }
          return bars;
        })
        .join("")
    : "";

  // ---- Legends + footer ----
  const commitLegend = enabledCommits
    ? (() => {
        const scale = layout.commitScale;
        const n = scale.thresholds.length;
        const swatches = Array.from({ length: n }, (_, i) => {
          const level = scale.levels[i]!; // chips may skip unused palette shades
          return `<rect x="${r1(i * 14)}" y="-5" width="10" height="10" rx="${r1(heatRadius)}" fill="${st.commitsColors[level]}" fill-opacity="${st.commitsIntensity[level]}" stroke="${st.commitsBorder}" stroke-width="1"/>`;
        }).join("");
        return `<g transform="translate(${r1(layout.commitLegend.left)} ${r1(layout.commitLegend.y)})">${swatches}<text x="${r1((n - 1) * 14 + 20)}" y="2.5" class="small muted">${escapeXml(commitScaleLegendText(layout.commitScale))}</text></g>`;
      })()
    : "";
  const changesLegend = enabledChanges
    ? `<g transform="translate(${r1(layout.changesLegend.left)} ${r1(layout.changesLegend.y)})"><rect x="0" y="-5" width="10" height="10" rx="${r1(heatRadius)}" fill="${st.changesAdded}"/><text x="16" y="2.5" class="small muted">added</text><rect x="58" y="-5" width="10" height="10" rx="${r1(heatRadius)}" fill="${st.changesDeleted}"/><text x="74" y="2.5" class="small muted">deleted</text></g>`
    : "";
  const footer = `<text x="${r1(layout.footer.x)}" y="${r1(layout.footer.y)}" text-anchor="middle" class="small muted">${escapeXml(`${sourceFiles} source files`)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" role="img" aria-labelledby="st-title st-desc">
  <title id="st-title">arte-git-card · Structure</title>
  <desc id="st-desc">Directory tree with ${layout.activityDays}-day commit and change activity.</desc>
  <style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${p.text};text-rendering:geometricPrecision}
    .muted{fill:${p.text_muted}}
    .label{font-size:12px;font-weight:500;letter-spacing:0.08em}
    .small{font-size:11px}
    .row{font-size:${TREE_FONT}px;font-weight:${ROW_FONT_WEIGHT}}
    .root{font-weight:${ROOT_FONT_WEIGHT}}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .tree{stroke:${st.tree};stroke-width:1;fill:none}${descStyle}
  </style>

  <rect x="${r1(borderInset)}" y="${r1(borderInset)}" width="${r1(cardWidth - cardBorderW)}" height="${r1(cardHeight - cardBorderW)}" rx="${r1(cardRadius)}" stroke-width="${cardBorderW}" fill="${p.surface}" stroke="${p.border_muted}"/>

  <g class="label muted">
    ${headerItems.join("\n    ")}
  </g>

  ${divider}

  ${weekdayLabels}

  ${sectionLabel}

  ${treeSvg}

  <g>
    ${dirRows}
  </g>

  <g>
    ${heatSvg}
  </g>

  <g>
    ${changesSvg}
  </g>

  ${commitLegend}
  ${changesLegend}

  ${footer}
</svg>
`;
}
