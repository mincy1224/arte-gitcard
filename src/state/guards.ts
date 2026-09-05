/**
 * Kind-specific path guards (P0). Every managed target path is computed by CODE
 * (kind + command + valid config / fixed tool paths), then matched against a
 * state entry — never the reverse.
 *
 *   card      → <output.directory>/{codebase.svg,structure.svg}   (config-derived)
 *   preview   → <output.directory>/preview.html                    (config-derived)
 *   config    → arte-gitcard.yml                                   (fixed)
 *   workflow  → .github/workflows/arte-gitcard.yml                 (fixed)
 *   ci-action → .arte-git-card/ci/action.yml                       (fixed)
 *   ci-runtime→ .arte-git-card/ci/main.cjs                         (fixed)
 *   theme     → .arte-git-card/themes/<safe-name>.yml              (fixed dir + safe basename)
 *   state     → .arte-git-card/state.json                          (fixed)
 *
 * SOURCE paths (src files, README.md, ...) match NO guard, so a transaction or
 * a forged state.json/journal can never delete or overwrite them. Journal
 * recovery also runs every op through this guard on top of containment.
 */

import path from "node:path";
import { CONFIG_FILENAME } from "../config/paths.js";
import type { ManagedKind } from "../txn/plan.js";
import { normalizeRelPosix } from "../fs/pathguard.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import {
  CI_ACTION_REL,
  CI_RUNTIME_REL,
  PREVIEW_FILENAME,
  STATE_REL,
  STRUCTURE_DESCRIPTIONS_REL,
  THEMES_DIR_REL,
  WORKFLOW_REL,
} from "../managed/paths.js";

export interface ManagedGuardContext {
  kind: string;
  rel: string;
}
export type ManagedGuard = (ctx: ManagedGuardContext) => boolean;

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function isThemeRel(rel: string): boolean {
  const prefix = `${THEMES_DIR_REL}/`;
  if (!rel.startsWith(prefix) || !rel.endsWith(".yml")) return false;
  const name = rel.slice(prefix.length, rel.length - 4); // strip ".yml"
  if (!name) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.startsWith(".")) return false;
  return true;
}

function underAnyDir(rel: string, dirs: Set<string>, file: string): boolean {
  for (const dir of dirs) {
    if (rel === `${dir}/${file}`) return true;
  }
  return false;
}

function isCardRel(rel: string, dirs: Set<string>, filenames: readonly string[]): boolean {
  return filenames.some((f) => underAnyDir(rel, dirs, f));
}

function isPreviewRel(rel: string, dirs: Set<string>): boolean {
  return underAnyDir(rel, dirs, PREVIEW_FILENAME);
}

export interface ManagedGuardOptions {
  /**
   * Additional repo-relative card/preview output dirs to allow. These may ONLY
   * come from code / a current strict-valid config transition — e.g. output
   * relocation moves old-dir cards out of the CURRENT config's previous output
   * dir; reset authorizes deletes under the current valid config's output dir.
   * state.outputRoots is NEVER passed here: state is ownership/activity
   * metadata, not path authority (a forged state must never expand this set).
   * Card paths are still constrained to exact card filenames — a source path
   * never matches.
   */
  outputDirs?: string[];
  /**
   * The compiled runtime whose registered card filenames are the authority
   * (default: production DEFAULT_RUNTIME). A state entry may only grant
   * card-delete/overwrite authority for a filename the RUNTIME registers.
   */
  runtime?: ArteRuntime;
}

/**
 * Build the guard from the project root + (valid) config + compiled runtime.
 * Card filenames come ONLY from `runtime.cardFilenames` (path authority) —
 * never from state.json or the config. When `config` is omitted (e.g.
 * migrate/reset have no v2 config yet), card/preview paths match nothing unless
 * `outputDirs` grants the exact recorded output roots, while
 * config/theme/state/workflow/ci paths still resolve against their fixed
 * locations.
 */
export function buildManagedGuard(
  projectRoot: string,
  config?: { output: { directory: string } },
  opts: ManagedGuardOptions = {},
): ManagedGuard {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const cardFilenames = runtime.cardFilenames;
  const dirs = new Set<string>();
  const add = (dir: string): void => {
    const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized && normalizeRelPosix(normalized)) dirs.add(normalized);
  };
  if (config) {
    const abs = path.isAbsolute(config.output.directory)
      ? config.output.directory
      : path.resolve(projectRoot, config.output.directory);
    add(toPosix(path.relative(projectRoot, abs)));
  }
  for (const d of opts.outputDirs ?? []) add(d);

  return (ctx) => {
    const rel = normalizeRelPosix(ctx.rel);
    if (!rel) return false;
    const kind = ctx.kind as ManagedKind;
    switch (kind) {
      case "config":
        return rel === CONFIG_FILENAME;
      case "state":
        return rel === STATE_REL;
      case "workflow":
        return rel === WORKFLOW_REL;
      case "ci-action":
        return rel === CI_ACTION_REL;
      case "ci-runtime":
        return rel === CI_RUNTIME_REL;
      case "structure-descriptions":
        return rel === STRUCTURE_DESCRIPTIONS_REL;
      case "theme":
        return isThemeRel(rel);
      case "card":
        return isCardRel(rel, dirs, cardFilenames);
      case "preview":
        return isPreviewRel(rel, dirs);
      default:
        return false;
    }
  };
}
