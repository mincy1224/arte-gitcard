/**
 * Shared Phase-2+ fixtures: build a schema-valid v2 repo, and optionally run the
 * real generation pipeline so the repo is HEALTHY (cards + state entries).
 */

import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { initialState, serializeState } from "../../src/state/registry.js";
import type { StateRead, ArteGitcardState } from "../../src/state/registry.js";
import { loadConfig } from "../../src/config/load.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { generateEnabledCards } from "../../src/generate/manage.js";

/** Narrow a StateRead union to its ok branch (throws otherwise). */
export function okState(read: StateRead): ArteGitcardState {
  if (read.status !== "ok") throw new Error(`expected ok state.json, got: ${read.status}`);
  return read.state;
}

export interface RepoFixture {
  root: string;
  configPath: string;
  themeRel: string;
  statePath: string;
  outputRel: string;
}

export function makeV2Repo(root: string, opts: { outputDir?: string } = {}): RepoFixture {
  const outputRel = opts.outputDir ?? ".github/arte-git-card";
  const themeRel = ".arte-git-card/themes/arte-theme.yml";
  const config = {
    "schema-version": 2,
    cards: {
      codebase: { enabled: true, languages: { include_comments: false } },
      structure: {
        enabled: true,
        root: ".",
        max_depth: 3,
        activity_days: 7,
        commits: { enabled: true },
        changes: { enabled: true },
      },
    },
    theme: themeRel,
    output: { directory: outputRel },
    "auto-update": false,
  };
  mkdirSync(path.dirname(path.join(root, themeRel)), { recursive: true });
  mkdirSync(path.join(root, ".arte-git-card"), { recursive: true });
  writeFileSync(path.join(root, "arte-gitcard.yml"), YAML.stringify(config), "utf8");
  writeFileSync(path.join(root, themeRel), YAML.stringify(DEFAULT_THEME), "utf8");
  writeFileSync(
    path.join(root, ".arte-git-card", "state.json"),
    serializeState(initialState()),
    "utf8",
  );
  return {
    root,
    configPath: path.join(root, "arte-gitcard.yml"),
    themeRel,
    statePath: path.join(root, ".arte-git-card", "state.json"),
    outputRel,
  };
}

/** A HEALTHY repo: config + theme + state + generated cards with ownership entries. */
export function seedHealthyRepo(root: string, opts: { outputDir?: string } = {}): RepoFixture {
  const fixture = makeV2Repo(root, opts);
  const loaded = loadConfig(fixture.configPath);
  const theme = resolveTheme(loadTheme(loaded.config.theme, loaded.projectRoot));
  generateEnabledCards(loaded.projectRoot, loaded, theme);
  return fixture;
}
