/**
 * Codebase card SVG renderer. Pure function: layout + resolved theme → SVG
 * string. Deterministic (fixed attribute order, round1, escaping).
 */

import type { CodebaseLayout } from "../layout/codebase.js";
import {
  SUMMARY_BAR_Y,
  BAR_HEIGHT,
  FAN_BOTTOM_Y,
  LANGUAGE_BAR_Y,
  NAME_FONT,
  VALUE_FONT,
} from "../layout/codebase.js";
import { MINI_BAR_HEIGHT, MINI_BAR_WIDTH, SWATCH_TEXT_OFFSET, legendItemGeometry } from "../layout/languages.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { el, escapeXml, r1, r2 } from "../render/svg.js";

export interface CodebaseChrome {
  text: string;
  muted: string;
  surface: string;
  border: string;
  divider: string;
  accent: string;
  accentSoft: string;
  neutral: string;
}

export function chromeOf(theme: ResolvedTheme): CodebaseChrome {
  return {
    text: theme.palette.text,
    muted: theme.palette.text_muted,
    surface: theme.palette.surface,
    border: theme.palette.border_muted,
    divider: theme.palette.divider,
    accent: theme.codebase.effective,
    accentSoft: theme.codebase.comments,
    neutral: theme.codebase.blank,
  };
}

/** Rounded-rect path helper for a bar segment with optional end rounding. */
function barSegment(x: number, width: number, y: number, h: number, radius: number, roundLeft: boolean, roundRight: boolean, fill: string): string {
  const r = Math.min(radius, width / 2);
  if (roundLeft && roundRight) {
    return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(width)}" height="${r1(h)}" rx="${r1(r)}" fill="${fill}"/>`;
  }
  if (roundLeft) {
    return `<path d="M${r1(x + r)} ${r1(y)}H${r1(x + width)}V${r1(y + h)}H${r1(x + r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x)} ${r1(y + h / 2)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + r)} ${r1(y)}Z" fill="${fill}"/>`;
  }
  if (roundRight) {
    return `<path d="M${r1(x)} ${r1(y)}H${r1(x + width - r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + width)} ${r1(y + h / 2)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + width - r)} ${r1(y + h)}H${r1(x)}Z" fill="${fill}"/>`;
  }
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(width)}" height="${r1(h)}" fill="${fill}"/>`;
}

export function renderCodebaseCard(layout: CodebaseLayout, theme: ResolvedTheme): string {
  const c = chromeOf(theme);
  const { cardWidth, cardHeight, contentLeft, contentRight, centerX } = layout;
  const edge = theme.codebase.fanEdgeStrokeOpacity;
  // Theme style wiring (SPEC §4 — every public style field is consumed here).
  const cardRadius = theme.style.card.radius;
  const cardBorderW = theme.style.card.border_width;
  const barRadius = theme.style.bar.radius;
  // Inset by borderWidth/2 so a wide border is never clipped by the viewBox (SPEC §4).
  const borderInset = cardBorderW / 2;

  // Metrics use the same legend component as the language rows: bar + label on
  // row 1, value on row 2 starting at the item's left edge (x=0).
  const metricItem = legendItemGeometry(-4.5); // label baseline inside the 32-translated row
  const metricsSvg = layout.metrics
    .map((m) => {
      const bar = m.barColorKey === "text" ? c.text : m.barColorKey === "accent" ? c.accent : m.barColorKey === "accentSoft" ? c.accentSoft : c.neutral;
      return `<g transform="translate(${r1(m.left)} 32)"><rect x="0" y="${r1(metricItem.barY)}" width="${MINI_BAR_WIDTH}" height="${MINI_BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${bar}"/><text x="${SWATCH_TEXT_OFFSET}" y="${metricItem.labelBaseline}" class="name">${escapeXml(m.name)}</text><text x="0" y="${metricItem.valueBaseline}" class="data">${escapeXml(m.value)}</text></g>`;
    })
    .join("\n    ");

  const s = layout.summary;
  const effW = s.effEnd - s.left;
  const comW = s.comEnd - s.effEnd;
  const blankW = s.blankEnd - s.comEnd;
  const summarySvg =
    `<rect x="${r1(s.left)}" y="${SUMMARY_BAR_Y}" width="${r1(s.width)}" height="${BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${c.divider}"/>` +
    (effW > 0 ? barSegment(s.left, effW, SUMMARY_BAR_Y, BAR_HEIGHT, barRadius, true, false, c.accent) : "") +
    (comW > 0 ? `<rect x="${r1(s.effEnd)}" y="${SUMMARY_BAR_Y}" width="${r1(comW)}" height="${BAR_HEIGHT}" fill="${c.accentSoft}"/>` : "") +
    (blankW > 0 ? barSegment(s.comEnd, blankW, SUMMARY_BAR_Y, BAR_HEIGHT, barRadius, false, true, c.neutral) : "");

  // Hidden when no language data — avoids a zero-width Effective triangle.
  const fan = theme.codebase;
  const fanSvg = layout.hasLanguageData
    ? [
        `<defs>`,
        `<linearGradient id="fanFill" x1="0" y1="${SUMMARY_BAR_Y + BAR_HEIGHT}" x2="0" y2="${FAN_BOTTOM_Y}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${fan.fanColor}" stop-opacity="${r2(fan.fanFillStart)}"/><stop offset="100%" stop-color="${fan.fanColor}" stop-opacity="${r2(fan.fanFillEnd)}"/></linearGradient>`,
        `<linearGradient id="fanStrokeL" x1="${r1(layout.fanTopLeft)}" y1="${SUMMARY_BAR_Y + BAR_HEIGHT}" x2="${r1(contentLeft)}" y2="${FAN_BOTTOM_Y}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/><stop offset="100%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/></linearGradient>`,
        `<linearGradient id="fanStrokeR" x1="${r1(layout.fanTopRight)}" y1="${SUMMARY_BAR_Y + BAR_HEIGHT}" x2="${r1(contentRight)}" y2="${FAN_BOTTOM_Y}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/><stop offset="100%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/></linearGradient>`,
        `</defs>`,
        `<path d="M${r1(layout.fanTopLeft)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(layout.fanTopRight)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(contentRight)} ${FAN_BOTTOM_Y}L${r1(contentLeft)} ${FAN_BOTTOM_Y}Z" fill="url(#fanFill)"/>`,
        `<path d="M${r1(layout.fanTopLeft)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(contentLeft)} ${FAN_BOTTOM_Y}" fill="none" stroke="url(#fanStrokeL)" stroke-width="1" stroke-linecap="round"/>`,
        `<path d="M${r1(layout.fanTopRight)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(contentRight)} ${FAN_BOTTOM_Y}" fill="none" stroke="url(#fanStrokeR)" stroke-width="1" stroke-linecap="round"/>`,
      ].join("\n    ")
    : "";

  // Segments are square; one rounded clip on the whole bar rounds only the outer
  // ends, so a trailing sliver never renders as an independent pill.
  const lb = layout.languageBar;
  const segs = lb.segments
    .map((seg) =>
      seg.width > 0
        ? `<rect x="${r1(seg.x)}" y="${LANGUAGE_BAR_Y}" width="${r1(seg.width)}" height="${BAR_HEIGHT}" fill="${seg.color}"/>`
        : "",
    )
    .join("");

  const items = layout.languageArea.items
    .map(
      (p) =>
        `<g>\n      <rect x="${r1(p.miniBarLeft)}" y="${r1(p.miniBarY)}" width="${MINI_BAR_WIDTH}" height="${MINI_BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${p.color}"/>\n      <text x="${r1(p.nameLeft)}" y="${r1(p.nameBaseline)}" class="name">${escapeXml(p.name)}</text>\n      <text x="${r1(p.valueLeft)}" y="${r1(p.valueBaseline)}" class="data">${escapeXml(p.value)}</text>\n    </g>`,
    )
    .join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" role="img" aria-labelledby="cb-title cb-desc">
  <title id="cb-title">arte-git-card · Codebase</title>
  <desc id="cb-desc">Total lines, effective lines, comments and blank lines with full language composition.</desc>
  <style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${c.text};text-rendering:geometricPrecision}
    .name{font-size:${NAME_FONT}px;font-weight:700}
    .data{font-size:${VALUE_FONT}px;fill:${c.muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  </style>
  <rect x="${r1(borderInset)}" y="${r1(borderInset)}" width="${r1(cardWidth - cardBorderW)}" height="${r1(cardHeight - cardBorderW)}" rx="${r1(cardRadius)}" stroke-width="${cardBorderW}" fill="${c.surface}" stroke="${c.border}"/>
  <g>
    ${metricsSvg}
  </g>
  ${summarySvg}
  ${fanSvg}
  <rect x="${r1(lb.left)}" y="${LANGUAGE_BAR_Y}" width="${r1(lb.width)}" height="${BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${c.divider}"/>
  <defs><clipPath id="agcLangBarClip"><rect x="${r1(lb.left)}" y="${LANGUAGE_BAR_Y}" width="${r1(lb.width)}" height="${BAR_HEIGHT}" rx="${r1(barRadius)}"/></clipPath></defs>
  <g clip-path="url(#agcLangBarClip)">${segs}</g>
  <g>
      ${items}
  </g>
</svg>
`;
}
