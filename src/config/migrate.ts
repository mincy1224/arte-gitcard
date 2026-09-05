/**
 * Pure v1 → v2 migration transform. Validates the legacy config against the
 * STRICT v1 schema first (an invalid legacy config → DAMAGED, migration refused).
 * A v1 `theme` naming a builtin preset is mapped to its materialized YAML path
 * and reported via `materializeThemes` so migrate writes the theme file.
 */

import YAML from "yaml";
import { arteGitCardConfigSchema } from "./schema.js";
import { ConfigError } from "./load.js";
import type { ArteGitCardConfig } from "./types.js";

export interface MigratePlan {
  config: ArteGitCardConfig;
  /** builtin preset names that must be materialized to .arte-git-card/themes/<name>.yml */
  materializeThemes: string[];
}

export function migrateV1Config(raw: string, configPath: string): MigratePlan {
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw) ?? {};
  } catch (err) {
    throw new ConfigError(`invalid YAML in legacy config ${configPath}`, configPath, "invalid-yaml");
  }

  const result = arteGitCardConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(
      `Legacy config is not a valid v1 config; migration refused. Fix it first:\n` +
        result.error.issues
          .map((issue) => `\`${issue.path.join(".") || "config"}\`: ${issue.message}`)
          .join("\n"),
      configPath,
      "strict-fail",
    );
  }

  const v1 = result.data;
  const materializeThemes: string[] = [];
  let theme = v1.theme;
  if (theme === "arte-theme" || theme === "github-theme") {
    materializeThemes.push(theme);
    theme = `.arte-git-card/themes/${theme}.yml`;
  }

  return {
    config: {
      "schema-version": 2,
      cards: v1.cards,
      languages: v1.languages,
      exclude: v1.exclude,
      theme,
      output: v1.output,
      "auto-update": false,
    },
    materializeThemes,
  };
}
