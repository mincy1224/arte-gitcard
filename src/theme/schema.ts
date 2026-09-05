import { z } from "zod";

/** Concrete hex ONLY: #RGB / #RRGGBB — no semantic token, no alpha (SPEC §4). */
const HEX_NO_ALPHA_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
/** Concrete hex including alpha (component-level refs may carry it). */
const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/;
/** Semantic palette-slot token name (e.g. "accent", "surface_muted"). */
const TOKEN_RE = /^[a-z][a-z0-9_]*$/;

export function isConcreteHex(value: string): boolean {
  return HEX_NO_ALPHA_RE.test(value);
}

/**
 * True for a component-level color ref: a semantic palette token or concrete
 * hex. Unknown tokens fail at resolution (never emitted into SVG verbatim).
 */
export function isColorRef(value: string): boolean {
  return HEX_RE.test(value) || TOKEN_RE.test(value);
}

const concreteHex = z.string().refine(isConcreteHex, {
  message: "must be a concrete #RGB / #RRGGBB hex color (no semantic token, no alpha)",
});
const colorRef = z.string().refine(isColorRef, {
  message: "must be a semantic palette token or #RGB / #RRGGBB / #RRGGBBAA hex",
});

const opacity = z.number().min(0).max(1);
const nonNegative = z.number().min(0);

const familySchema = z
  .object({
    name: z.string().min(1),
    base: concreteHex,
  })
  .strict();

/**
 * Exactly 12 data-palette families, each with ONLY a concrete base color;
 * deep/lift derive deterministically via OKLCH in the resolver (never HSL), so
 * the base is never a semantic token. Order is display-only; renderer
 * assignment uses the resolver's fixed HUE_INTERLEAVE_ORDER.
 */
const dataPaletteSchema = z
  .object({
    families: z.array(familySchema).length(12),
  })
  .strict();

/**
 * Strict theme schema. Every public field is consumed by a production renderer
 * or rejected here — no "validates but does nothing" configuration. Unknown
 * keys are rejected (typos fail loudly instead of being silently stripped).
 *
 * Color contract (SPEC §4):
 *  - palette.* slots .................. concrete #RGB/#RRGGBB only (no token, no alpha)
 *  - data_palette.families[].base .... concrete #RGB/#RRGGBB only (deep/lift derive from it)
 *  - component-level refs (codebase.* / structure.* / fan.*) ... semantic token OR concrete hex
 */
export const themeSchema = z
  .object({
    name: z.string().optional(),
    palette: z
      .object({
        surface: concreteHex,
        surface_muted: concreteHex,
        text: concreteHex,
        text_muted: concreteHex,
        border_muted: concreteHex,
        divider: concreteHex,
        accent: concreteHex,
        accent_soft: concreteHex,
        neutral: concreteHex,
        positive: concreteHex,
        negative: concreteHex,
        data_palette: dataPaletteSchema,
      })
      .strict(),
    style: z
      .object({
        card: z
          .object({ radius: nonNegative, border_width: nonNegative })
          .strict(),
        bar: z.object({ radius: nonNegative }).strict(),
        heatmap: z.object({ radius: nonNegative }).strict(),
      })
      .strict(),
    codebase: z
      .object({
        effective: colorRef,
        comments: colorRef,
        blank: colorRef,
        languages: z
          .object({
            color_mode: z.union([z.literal("palette"), z.literal("monochrome")]),
          })
          .strict(),
        fan: z
          .object({
            color: colorRef,
            fill_opacity: z.object({ start: opacity, end: opacity }).strict(),
            /** Opacity of the fan's side edge strokes; 0 hides them (built-in default). */
            edge_stroke_opacity: opacity,
          })
          .strict(),
      })
      .strict(),
    structure: z
      .object({
        tree: colorRef,
        folder: z.object({ fill: colorRef, stroke: colorRef }).strict(),
        commits: z
          .object({
            colors: z.array(colorRef).length(5),
            /** Per-level opacity (GitHub solid; arte: one hue shaded by opacity). */
            intensity: z.array(opacity).length(5),
            border: colorRef,
          })
          .strict(),
        changes: z
          .object({
            added: colorRef,
            deleted: colorRef,
            baseline: colorRef,
            /** 4-level bar opacity ramp (value/max bucketed). */
            opacity: z.array(opacity).length(4).optional(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type ThemeSchema = z.infer<typeof themeSchema>;
