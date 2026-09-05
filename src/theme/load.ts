import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { deepMerge } from "../util/merge.js";
import { DEFAULT_THEME } from "./default-theme.js";
import { GITHUB_THEME } from "./github-theme.js";
import { themeSchema, type ThemeSchema } from "./schema.js";

export class ThemeError extends Error {
  readonly themePath: string;
  constructor(message: string, themePath: string) {
    super(message);
    this.name = "ThemeError";
    this.themePath = themePath;
  }
}

/** Built-in themes selectable by name from the config (`theme: "github-theme"`). */
export const BUILTIN_THEMES: Readonly<Record<string, ThemeSchema>> = {
  "arte-theme": DEFAULT_THEME,
  "github-theme": GITHUB_THEME,
};

/**
 * Resolve a theme: a known built-in name returns the built-in directly;
 * anything else is a YAML file path merged over the arte-theme default
 * (plan.md §52/§53, partial overrides).
 */
export function loadTheme(themePath: string, projectRoot: string): ThemeSchema {
  const builtin = BUILTIN_THEMES[themePath];
  if (builtin) return builtin;

  const resolved = path.isAbsolute(themePath)
    ? themePath
    : path.resolve(projectRoot, themePath);

  let raw: string;
  try {
    raw = readFileSync(resolved, "utf8");
  } catch (err) {
    throw new ThemeError(`cannot read theme file: ${resolved}`, resolved);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw) ?? {};
  } catch (err) {
    throw new ThemeError(`invalid YAML in ${resolved}`, resolved);
  }

  const merged = deepMerge(DEFAULT_THEME, parsed);
  const result = themeSchema.safeParse(merged);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `\`${i.path.join(".") || "theme"}\`: ${i.message}`)
      .join("\n");
    throw new ThemeError(`Invalid theme (${resolved}):\n${msg}`, resolved);
  }
  return result.data;
}
