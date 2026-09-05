import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { GITHUB_THEME } from "../../src/theme/github-theme.js";
import { themeSchema, isConcreteHex, isColorRef } from "../../src/theme/schema.js";
import { resolveTheme, assignLanguageColors, HUE_INTERLEAVE_ORDER } from "../../src/theme/resolve.js";
import { deriveTone } from "../../src/theme/color.js";
import { loadTheme, BUILTIN_THEMES } from "../../src/theme/load.js";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("theme data palette (12 families × 3 tones = 36 resolved colors)", () => {
  it("the default theme ships exactly 12 families with a base color each", () => {
    const families = DEFAULT_THEME.palette.data_palette.families;
    expect(families).toHaveLength(12);
    for (const family of families) {
      expect(family.name).toBeTruthy();
      expect(family.base).toMatch(HEX);
    }
  });

  it("HUE_INTERLEAVE_ORDER is a permutation of 0..11", () => {
    expect(HUE_INTERLEAVE_ORDER).toHaveLength(12);
    expect([...HUE_INTERLEAVE_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i),
    );
  });

  it("the schema is strict: unknown keys / wrong lengths are rejected", () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
    // unknown top-level key
    expect(themeSchema.safeParse({ ...DEFAULT_THEME, foo: 1 }).success).toBe(false);
    // unknown palette key
    expect(
      themeSchema.safeParse({ ...DEFAULT_THEME, palette: { ...DEFAULT_THEME.palette, data: ["#000"] } })
        .success,
    ).toBe(false);
    // wrong family count
    expect(
      themeSchema.safeParse({
        ...DEFAULT_THEME,
        palette: {
          ...DEFAULT_THEME.palette,
          data_palette: { families: DEFAULT_THEME.palette.data_palette.families.slice(0, 11) },
        },
      }).success,
    ).toBe(false);
  });

  it("color contract: palette slots are concrete hex, refs are token-or-hex (SPEC §4)", () => {
    // concrete hex (palette slots / family bases): #RGB / #RRGGBB only
    expect(isConcreteHex("#A86D76")).toBe(true);
    expect(isConcreteHex("#A86")).toBe(true);
    expect(isConcreteHex("#A86D76AA")).toBe(false); // no alpha
    expect(isConcreteHex("accent")).toBe(false); // no semantic token
    expect(isConcreteHex("rgb(1,2,3)")).toBe(false);
    // component-level refs: semantic token OR concrete hex (alpha allowed)
    expect(isColorRef("#A86D76")).toBe(true);
    expect(isColorRef("#A86D76AA")).toBe(true);
    expect(isColorRef("accent_soft")).toBe(true);
    expect(isColorRef("rgb(1,2,3)")).toBe(false);
    expect(isColorRef('" onload="')).toBe(false);
  });

  it("resolves 36 colors: base 12 (interleaved) → deep 12 → lift 12, OKLCH-derived", () => {
    const resolved = resolveTheme(DEFAULT_THEME);
    expect(resolved.dataColors).toHaveLength(36);
    // rank 1 = first interleaved family (Rose base)
    expect(resolved.dataColors[0]).toBe("#A86D76");
    // deep/lift are derived from the SAME base hue via OKLCH (never HSL, never rotated)
    expect(resolved.dataColors[12]).toBe(deriveTone(resolved.dataColors[0]!, "deep"));
    expect(resolved.dataColors[24]).toBe(deriveTone(resolved.dataColors[0]!, "lift"));
    expect(resolved.dataColors[12]).not.toBe(resolved.dataColors[0]);
  });

  it("palette slots reject semantic tokens (would be a silent no-op otherwise)", () => {
    expect(
      themeSchema.safeParse({ ...DEFAULT_THEME, palette: { ...DEFAULT_THEME.palette, text: "accent" } }).success,
    ).toBe(false);
  });

  it("family bases reject semantic tokens and alpha — deep/lift derive from concrete hex", () => {
    const fam = (base: string) => ({
      ...DEFAULT_THEME,
      palette: {
        ...DEFAULT_THEME.palette,
        data_palette: {
          families: DEFAULT_THEME.palette.data_palette.families.map((f, i) =>
            i === 0 ? { ...f, base } : f,
          ),
        },
      },
    });
    expect(themeSchema.safeParse(fam("accent")).success).toBe(false); // token
    expect(themeSchema.safeParse(fam("#A86D76AA")).success).toBe(false); // alpha
    expect(themeSchema.safeParse(fam("#A86D76")).success).toBe(true); // concrete hex ok
  });

  it("component refs to an unknown/removed palette slot fail resolution (never emitted)", () => {
    expect(
      () =>
        resolveTheme({
          ...DEFAULT_THEME,
          codebase: { ...DEFAULT_THEME.codebase, effective: "accent_muted" },
        }),
    ).toThrow(/Unknown theme token/);
  });
});

describe("github-theme — GitHub-native light theme", () => {
  it("is a built-in theme named github-theme with GitHub chrome", () => {
    expect(GITHUB_THEME.name).toBe("github-theme");
    expect(GITHUB_THEME.palette.surface).toBe("#FFFFFF");
    expect(GITHUB_THEME.palette.text).toBe("#1F2328");
    expect(GITHUB_THEME.palette.text_muted).toBe("#656D76");
    expect(GITHUB_THEME.palette.accent).toBe("#0969DA");
    expect(GITHUB_THEME.palette.positive).toBe("#2DA44E");
    expect(GITHUB_THEME.palette.negative).toBe("#E5534B");
  });

  it("has its own 12-family palette (bright, GitHub language-bar style)", () => {
    const families = GITHUB_THEME.palette.data_palette.families;
    expect(families).toHaveLength(12);
    expect(families.map((f) => f.base)).not.toEqual(
      DEFAULT_THEME.palette.data_palette.families.map((f) => f.base),
    );
    // first family is TypeScript blue (Blue base)
    expect(resolveTheme(GITHUB_THEME).dataColors[0]).toBe("#3178C6");
  });

  it("uses GitHub's contribution-green ramp for the commit heatmap", () => {
    expect(GITHUB_THEME.structure.commits.colors).toEqual([
      "#EFF2F5", "#ACEEBB", "#4AC26B", "#2DA44E", "#116329",
    ]);
    expect(GITHUB_THEME.structure.commits.intensity).toEqual([1, 1, 1, 1, 1]);
    expect(GITHUB_THEME.structure.commits.border).toBe("#E5E8EB");
  });

  it("arte-theme's commit-cell border comes from the theme palette (border_muted)", () => {
    expect(DEFAULT_THEME.structure.commits.border).toBe("border_muted");
    expect(resolveTheme(DEFAULT_THEME).structure.commitsBorder).toBe("#C8C1B5");
  });

  it("hides the fan's side edge strokes in both built-in themes", () => {
    expect(DEFAULT_THEME.codebase.fan.edge_stroke_opacity).toBe(0);
    expect(GITHUB_THEME.codebase.fan.edge_stroke_opacity).toBe(0);
    // resolved contract exposes it for the renderer
    expect(resolveTheme(GITHUB_THEME).codebase.fanEdgeStrokeOpacity).toBe(0);
  });

  it("passes the schema", () => {
    expect(themeSchema.safeParse(GITHUB_THEME).success).toBe(true);
  });
});

describe("built-in theme resolution (loadTheme by name)", () => {
  it("selects arte-theme / github-theme by name without touching the filesystem", () => {
    expect(loadTheme("arte-theme", "/nonexistent").name).toBe("arte-theme");
    expect(loadTheme("github-theme", "/nonexistent").name).toBe("github-theme");
    expect(Object.keys(BUILTIN_THEMES).sort()).toEqual(["arte-theme", "github-theme"]);
  });

  it("unknown names fall through to the file-path loader (throws a ThemeError)", () => {
    expect(() => loadTheme("no-such-theme", "/nonexistent")).toThrow(/cannot read theme file/);
  });

  it("monochrome mode takes effect through dataColors (wired, not dead config)", () => {
    const resolved = resolveTheme({ ...DEFAULT_THEME, codebase: { ...DEFAULT_THEME.codebase, languages: { color_mode: "monochrome" } } });
    expect(resolved.dataColors).toHaveLength(36);
    // accent-derived ramp: entry 0 equals the accent base; all entries differ from the palette ramp
    expect(resolved.dataColors[0]).not.toBe(resolveTheme(DEFAULT_THEME).dataColors[0]);
    for (const c of resolved.dataColors) expect(c).toMatch(HEX);
  });
});

describe("assignLanguageColors — ranking-driven", () => {
  const dataColors = resolveTheme(DEFAULT_THEME).dataColors;

  it("maps the i-th ranked id to dataColors[i]", () => {
    const ranked = ["ts", "py", "rs", "js", "go", "sh"];
    const colors = assignLanguageColors(ranked, dataColors);
    expect(colors.get("ts")).toBe(dataColors[0]);
    expect(colors.get("sh")).toBe(dataColors[5]);
  });

  it("wraps past 36 ranks (never runs out of colors)", () => {
    const ranked = Array.from({ length: 40 }, (_, i) => `lang${i}`);
    const colors = assignLanguageColors(ranked, dataColors);
    expect(colors.get("lang36")).toBe(dataColors[0]);
    expect(colors.get("lang39")).toBe(dataColors[3]);
  });

  it("monochrome uses the runtime (i/35)*0.6 accent ramp — a single algorithm", () => {
    const resolved = resolveTheme({
      ...DEFAULT_THEME,
      codebase: { ...DEFAULT_THEME.codebase, languages: { color_mode: "monochrome" } },
    });
    expect(resolved.dataColors).toHaveLength(36);
    expect(resolved.dataColors[0]).toBe(resolved.codebase.fanColor); // starts at the accent
    for (const c of resolved.dataColors) expect(c).toMatch(HEX);
  });
});
