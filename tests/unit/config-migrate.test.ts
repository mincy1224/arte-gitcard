/**
 * Pure v1 → v2 migration transform (P0). The legacy config is validated against
 * the strict v1 schema first; only known v1 keys are mapped, and a builtin theme
 * name is converted to the materialized YAML path (reported for writing by the
 * transactional migrate). Invalid v1 → migration refused.
 */

import { describe, expect, it } from "vitest";
import { migrateV1Config } from "../../src/config/migrate.js";
import { ConfigError } from "../../src/config/load.js";

const V1_PATH_THEME = `cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: "src", max_depth: 5, activity_days: 14,
    commits: { enabled: false }, changes: { enabled: true } }
exclude: ["out"]
theme: ".arte-git-card/themes/custom.yml"
output: { directory: "docs/cards" }
`;

describe("migrateV1Config", () => {
  it("maps v1 keys to v2 and adds schema-version/auto-update (no github branch); preserves a theme path", () => {
    const { config, materializeThemes } = migrateV1Config(V1_PATH_THEME, "/repo/arte-git-card.yml");
    expect(config["schema-version"]).toBe(2);
    expect(config["auto-update"]).toBe(false);
    expect(config).not.toHaveProperty("github");
    expect(config.theme).toBe(".arte-git-card/themes/custom.yml"); // kept verbatim
    expect(config.output.directory).toBe("docs/cards");
    expect(config.cards.structure.max_depth).toBe(5);
    expect(config.cards.structure.activity_days).toBe(14);
    expect(config.exclude).toEqual(["out"]);
    expect(materializeThemes).toEqual([]);
  });

  it("converts a builtin theme name to the materialized path and requests materialization", () => {
    const v1 = V1_PATH_THEME.replace("theme: \".arte-git-card/themes/custom.yml\"", 'theme: "arte-theme"');
    const { config, materializeThemes } = migrateV1Config(v1, "/repo/arte-git-card.yml");
    expect(config.theme).toBe(".arte-git-card/themes/arte-theme.yml");
    expect(materializeThemes).toEqual(["arte-theme"]);
  });

  it("github-theme is also materialized under the unified YAML model", () => {
    const v1 = V1_PATH_THEME.replace("theme: \".arte-git-card/themes/custom.yml\"", 'theme: "github-theme"');
    const { config, materializeThemes } = migrateV1Config(v1, "/repo/arte-git-card.yml");
    expect(config.theme).toBe(".arte-git-card/themes/github-theme.yml");
    expect(materializeThemes).toEqual(["github-theme"]);
  });

  it("refuses an invalid legacy config (migration must not repair silently)", () => {
    const bad = V1_PATH_THEME.replace("max_depth: 5", "max_depth: many");
    expect(() => migrateV1Config(bad, "/repo/arte-git-card.yml")).toThrow(ConfigError);
  });

  it("refuses invalid YAML in the legacy config", () => {
    expect(() => migrateV1Config("cards: [unclosed\n", "/repo/arte-git-card.yml")).toThrow(ConfigError);
  });
});
