/**
 * Deterministic text-width estimation (plan.md §73 / V0.2·J).
 *
 * No DOM/font probing/Intl: widths are stable *estimates* — actual width depends
 * on the user's font stack, so the structural layout absorbs the error.
 * Sans-serif text adds a fixed 2px safety margin (plan.md §57).
 */

export interface TextMeasureOptions {
  fontSize: number;
  mono: boolean;
  /**
   * CSS font-weight the text is rendered at (default 400). Heavier weights draw
   * wider glyphs, so the advance model scales per-glyph width — e.g. the
   * Structure card's directory names (.row 550 / .root 650) must not be measured
   * as if they were regular weight or they overflow into the metadata columns.
   */
  fontWeight?: number;
}

const COMBINING_START = 0x0300;
const COMBINING_END = 0x036f;
const WIDE_START = 0x2e80; // CJK radicals, full-width forms, CJK unified ideographs, emoji
const REGULAR_WEIGHT = 400;
const BOLD_WEIGHT = 700;
/** Proportional glyph-advance growth from regular (400) to bold (700). */
const MAX_WEIGHT_GROWTH = 0.12;

/** Per-glyph advance multiplier for a CSS font-weight (1 at ≤400, ~1.12 at 700). */
function weightScale(fontWeight: number): number {
  if (fontWeight <= REGULAR_WEIGHT) return 1;
  const t = Math.min(1, (fontWeight - REGULAR_WEIGHT) / (BOLD_WEIGHT - REGULAR_WEIGHT));
  return 1 + t * MAX_WEIGHT_GROWTH;
}

export function estimateTextWidth(text: string, opts: TextMeasureOptions): number {
  const em = opts.fontSize;
  const scale = weightScale(opts.fontWeight ?? REGULAR_WEIGHT);
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= COMBINING_START && cp <= COMBINING_END) continue;
    if (cp >= WIDE_START) {
      // Full-width glyphs keep their fixed 1em advance regardless of weight.
      width += em;
    } else if (opts.mono) {
      width += 0.6 * em * scale;
    } else if (ch === " " || ch === ".") {
      width += 0.28 * em * scale;
    } else if (ch === "·" || ch === "," || ch === "'" || ch === "(" || ch === ")") {
      width += 0.3 * em * scale;
    } else {
      width += 0.55 * em * scale;
    }
  }
  return width + (opts.mono ? 0 : 2);
}
