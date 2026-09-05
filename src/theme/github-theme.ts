import type { ThemeSchema } from "./schema.js";

/**
 * Built-in "github-theme" — a GitHub-native light theme. UI palette mirrors
 * GitHub's default light scheme (white surface, near-black text, blue accent,
 * softer green/red for additions/deletions). The data palette is 12 bright
 * linguist-style families with a base color each; deep/lift derive via OKLCH
 * in the resolver (SPEC §4). `families` order is display-only.
 */
export const GITHUB_THEME: ThemeSchema = {
  name: "github-theme",
  palette: {
    surface: "#FFFFFF",
    surface_muted: "#F6F8FA",
    text: "#1F2328",
    text_muted: "#656D76",
    border_muted: "#D0D7DE",
    divider: "#D8DEE4",
    accent: "#0969DA",
    accent_soft: "#54AEFF",
    neutral: "#6E7781",
    positive: "#2DA44E",
    negative: "#E5534B",
    data_palette: {
      families: [
        { name: "Blue", base: "#3178C6" },
        { name: "Yellow", base: "#F1E05A" },
        { name: "Cyan", base: "#00ADD8" },
        { name: "Tan", base: "#DEA584" },
        { name: "Brown", base: "#B07219" },
        { name: "Pink", base: "#F34B7D" },
        { name: "Green", base: "#178600" },
        { name: "Maroon", base: "#701516" },
        { name: "Vermilion", base: "#F05138" },
        { name: "Violet", base: "#A97BFF" },
        { name: "Indigo", base: "#563D7C" },
        { name: "Teal", base: "#384D54" },
      ],
    },
  },
  style: {
    card: { radius: 16, border_width: 1 },
    bar: { radius: 2 },
    heatmap: { radius: 3 },
  },
  codebase: {
    effective: "accent",
    comments: "accent_soft",
    blank: "neutral",
    languages: { color_mode: "palette" },
    fan: {
      color: "accent",
      fill_opacity: { start: 0.16, end: 0.03 },
      // Hide the fan's side edges by default (theme-controlled visibility).
      edge_stroke_opacity: 0,
    },
  },
  structure: {
    tree: "border_muted",
    folder: { fill: "surface_muted", stroke: "text_muted" },
    commits: {
      // GitHub contribution-graph green ramp (solid cells, GitHub palette).
      colors: ["#EFF2F5", "#ACEEBB", "#4AC26B", "#2DA44E", "#116329"],
      intensity: [1, 1, 1, 1, 1],
      border: "#E5E8EB",
    },
    changes: {
      added: "positive",
      deleted: "negative",
      baseline: "border_muted",
      opacity: [0.45, 0.65, 0.85, 1],
    },
  },
};
