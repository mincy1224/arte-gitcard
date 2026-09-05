import { deriveTone, mixHex } from "./color.js";
import type { ThemeSchema } from "./schema.js";

const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/;

export interface ResolvedTheme {
  name: string;
  palette: ThemeSchema["palette"];
  style: ThemeSchema["style"];
  codebase: {
    effective: string;
    comments: string;
    blank: string;
    colorMode: "palette" | "monochrome";
    fanColor: string;
    fanFillStart: number;
    fanFillEnd: number;
    /** Opacity of the fan's side edge strokes (0 hides them; theme-controlled). */
    fanEdgeStrokeOpacity: number;
  };
  structure: {
    tree: string;
    folderFill: string;
    folderStroke: string;
    /** 5 commit-cell colors (GitHub ramp when solid). */
    commitsColors: string[];
    commitsIntensity: number[];
    commitsBorder: string;
    changesAdded: string;
    changesDeleted: string;
    changesBaseline: string;
    /** 4-level changes-bar opacity ramp. */
    changesOpacity: number[];
  };
  /** The 36-color data palette (base 12 interleaved → deep 12 → lift 12). */
  dataColors: string[];
}

/**
 * Resolve a semantic palette token to a concrete color (raw hex passes
 * through). An unknown token throws — never emitted into an SVG verbatim.
 */
export function resolveToken(
  token: string,
  palette: ThemeSchema["palette"],
): string {
  const value = (palette as Record<string, unknown>)[token];
  if (typeof value === "string") return value;
  if (HEX_RE.test(token)) return token;
  throw new Error(`Unknown theme token: "${token}"`);
}

/**
 * Fixed permutation of the 12 data-palette families used for hue-interleaved
 * assignment. The `families` order in a theme is display-only; this constant
 * maps family index → assignment slot so the same rule holds for every theme.
 */
export const HUE_INTERLEAVE_ORDER = [0, 6, 3, 9, 1, 5, 10, 2, 7, 11, 4, 8];

export function resolveTheme(theme: ThemeSchema): ResolvedTheme {
  const p = theme.palette;
  const families = p.data_palette.families;

  // Family bases are concrete hex by schema — no token resolution needed, and
  // deep/lift always derive from a concrete base via OKLCH.
  const base12 = HUE_INTERLEAVE_ORDER.map((i) => families[i]!.base);
  // deep/lift derived deterministically via OKLCH (SPEC §4, never HSL).
  const deep12 = base12.map((hex) => deriveTone(hex, "deep"));
  const lift12 = base12.map((hex) => deriveTone(hex, "lift"));

  return {
    name: theme.name ?? "theme",
    palette: p,
    style: theme.style,
    codebase: {
      effective: resolveToken(theme.codebase.effective, p),
      comments: resolveToken(theme.codebase.comments, p),
      blank: resolveToken(theme.codebase.blank, p),
      colorMode: theme.codebase.languages.color_mode,
      fanColor: resolveToken(theme.codebase.fan.color, p),
      fanFillStart: theme.codebase.fan.fill_opacity.start,
      fanFillEnd: theme.codebase.fan.fill_opacity.end,
      fanEdgeStrokeOpacity: theme.codebase.fan.edge_stroke_opacity,
    },
    structure: {
      tree: resolveToken(theme.structure.tree, p),
      folderFill: resolveToken(theme.structure.folder.fill, p),
      folderStroke: resolveToken(theme.structure.folder.stroke, p),
      commitsColors: theme.structure.commits.colors.map((c) => resolveToken(c, p)),
      commitsIntensity: theme.structure.commits.intensity,
      commitsBorder: resolveToken(theme.structure.commits.border, p),
      changesAdded: resolveToken(theme.structure.changes.added, p),
      changesDeleted: resolveToken(theme.structure.changes.deleted, p),
      changesBaseline: resolveToken(theme.structure.changes.baseline, p),
      changesOpacity: theme.structure.changes.opacity ?? [0.45, 0.65, 0.85, 1],
    },
    dataColors: dataColorsFor(theme),
  };
}

/**
 * Renderer-facing 36-color palette. Palette mode: base 12 → deep 12 → lift 12
 * (each hue-interleaved). Monochrome mode: a deterministic accent-derived ramp
 * — this is where `color_mode: monochrome` takes effect.
 */
function dataColorsFor(theme: ThemeSchema): string[] {
  const mode = theme.codebase.languages.color_mode;
  if (mode === "monochrome") {
    const accent = resolveToken(theme.codebase.fan.color, theme.palette);
    return Array.from({ length: 36 }, (_, i) => mixHex(accent, "#4A4742", (i / 35) * 0.6));
  }
  const families = theme.palette.data_palette.families;
  const base12 = HUE_INTERLEAVE_ORDER.map((i) => families[i]!.base);
  const deep12 = base12.map((hex) => deriveTone(hex, "deep"));
  const lift12 = base12.map((hex) => deriveTone(hex, "lift"));
  return [...base12, ...deep12, ...lift12];
}

/**
 * Palette mode (final spec §21–§23): ranking-driven, not id-hash. `rankedIds`
 * MUST be the canonical sorted array (percentage DESC); its i-th entry takes
 * dataColors[i]. The palette is ordered base → deep → lift, so adjacent
 * high-ranking languages are spread across hue families by construction.
 */
export function assignLanguageColors(
  rankedIds: string[],
  dataColors: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  rankedIds.forEach((id, i) => {
    const color = dataColors[i % dataColors.length];
    if (color) result.set(id, color);
  });
  return result;
}

