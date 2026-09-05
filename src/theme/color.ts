/** Deterministic color utilities (no browser, no Intl). */

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number): number => Math.round(Math.max(0, Math.min(255, n)));
  const to2 = (n: number): string => clamp(n).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Linear mix of two hex colors. t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** OKLCH → sRGB hex (plan.md §46; used to calibrate the data palette). */
export function oklchToHex(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const conv = (c: number): number => {
    const cc = Math.min(1, Math.max(0, c));
    return cc <= 0.0031308 ? 12.92 * cc : 1.055 * Math.pow(cc, 1 / 2.4) - 0.055;
  };
  return rgbToHex(conv(r) * 255, conv(g) * 255, conv(bb) * 255);
}

export interface Oklch {
  /** Lightness 0..1. */
  L: number;
  /** Chroma >= 0. */
  C: number;
  /** Hue in degrees. */
  H: number;
}

/** sRGB hex → OKLCH (deterministic; the forward direction of `oklchToHex`). */
export function rgbToOklch(hex: string): Oklch {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rl = lin(r);
  const gl = lin(g);
  const bl = lin(b);
  // OKLab linear-LMS matrix (same constants as `oklchToHex`).
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const cb = (v: number): number => (v <= 0 ? 0 : Math.cbrt(v));
  const l_ = cb(l);
  const m_ = cb(m);
  const s_ = cb(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  const H = (Math.atan2(bb, a) * 180) / Math.PI;
  return { L, C, H };
}

/** Calibrated OKLCH deltas for the deep/lift tones (v1 palette, deterministic). */
export const TONE_DEEP = { lDelta: -0.11, cFactor: 0.88 };
export const TONE_LIFT = { lDelta: 0.09, cFactor: 0.94 };

/**
 * Derive a deep/lift tone from a base hex via deterministic OKLCH: shift
 * lightness and scale chroma, then map back into sRGB (gamut-clamped by
 * `oklchToHex`). Same input → same output on every platform.
 */
export function deriveTone(hex: string, dir: "deep" | "lift"): string {
  const { L, C, H } = rgbToOklch(hex);
  const { lDelta, cFactor } = dir === "deep" ? TONE_DEEP : TONE_LIFT;
  const lClamped = Math.min(0.95, Math.max(0.04, L + lDelta));
  return oklchToHex(lClamped, C * cFactor, H);
}

/** FNV-1a 32-bit hash — stable across platforms (plan.md §74 / V0.2). */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
