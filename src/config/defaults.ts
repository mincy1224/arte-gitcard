import type { ArteGitCardConfig } from "./types.js";

/**
 * Default scan exclusions — the user-editable list. Names match exactly at any
 * depth; `*.suffix` entries are filename patterns. Tool-correctness hard
 * excludes are applied by the scanner regardless and cannot be removed here.
 */
export const DEFAULT_EXCLUDE: string[] = [
  "node_modules", "vendor", "dist", "build", "coverage", ".next", ".nuxt",
  "target", "out", ".cache", ".github",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
  "Cargo.lock", "Gemfile.lock", "go.sum", "poetry.lock",
  "*.min.js", "*.min.css", "*.map", "*.lock",
];

/**
 * v2 default config. Used ONLY by init/migrate to materialize a fresh config —
 * never by loading an existing one (loadConfig is strict, no silent repair).
 */
export const DEFAULT_CONFIG_V2: ArteGitCardConfig = {
  "schema-version": 2,
  cards: {
    codebase: {
      enabled: true,
      languages: {
        include_comments: false,
      },
    },
    structure: {
      enabled: true,
      root: ".",
      max_depth: 3,
      activity_days: 7,
      commits: { enabled: true },
      changes: { enabled: true },
    },
  },
  exclude: DEFAULT_EXCLUDE,
  // Unified theme model: config points at the materialized YAML, never at a
  // "virtual builtin name". Builtin presets are materialization sources.
  theme: ".arte-git-card/themes/arte-theme.yml",
  output: {
    directory: ".github/arte-git-card",
  },
  "auto-update": false,
};

/** Deep-copy the v2 default (arrays/objects must not be shared/mutated). */
export function buildDefaultConfig(): ArteGitCardConfig {
  return {
    ...DEFAULT_CONFIG_V2,
    cards: {
      codebase: {
        enabled: true,
        languages: { include_comments: false },
      },
      structure: {
        enabled: true,
        root: ".",
        max_depth: 3,
        activity_days: 7,
        commits: { enabled: true },
        changes: { enabled: true },
      },
    },
    exclude: [...(DEFAULT_CONFIG_V2.exclude ?? [])],
    output: { directory: DEFAULT_CONFIG_V2.output.directory },
  };
}
