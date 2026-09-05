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
}

const COMBINING_START = 0x0300;
const COMBINING_END = 0x036f;
const WIDE_START = 0x2e80; // CJK radicals, full-width forms, CJK unified ideographs, emoji

export function estimateTextWidth(text: string, opts: TextMeasureOptions): number {
  const em = opts.fontSize;
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= COMBINING_START && cp <= COMBINING_END) continue;
    if (cp >= WIDE_START) {
      width += em;
    } else if (opts.mono) {
      width += 0.6 * em;
    } else if (ch === " " || ch === ".") {
      width += 0.28 * em;
    } else if (ch === "·" || ch === "," || ch === "'" || ch === "(" || ch === ")") {
      width += 0.3 * em;
    } else {
      width += 0.55 * em;
    }
  }
  return width + (opts.mono ? 0 : 2);
}
