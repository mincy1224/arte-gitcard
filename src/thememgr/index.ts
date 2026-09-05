/**
 * Theme manager (P0). SINGLE selectable model: `.arte-git-card/themes/*.yml`.
 * Builtin presets are materialization SOURCES only — never a second source of
 * truth. A theme YAML may be PARTIAL: `deepMerge(DEFAULT_THEME, parsed)` then
 * strict schema (same semantics as loadTheme).
 *
 * install : local file/preset only; duplicates refused (never overwrite).
 * select  : materialize preset if needed, then update config AND regenerate
 *           enabled cards in ONE transaction — a failed regeneration never
 *           leaves the config switched.
 * remove  : refuses the currently selected theme; deletes only when owned +
 *           unmodified (user-modified themes are preserved).
 * show/validate: read-only. All writes go through containment + kind guards.
 */

import path from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import YAML from "yaml";
import { pathOccupied } from "../fs/presence.js";
import type { LoadedConfig, ArteGitCardConfig } from "../config/types.js";
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { cloneConfig } from "../config/registry.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { DEFAULT_THEME } from "../theme/default-theme.js";
import { GITHUB_THEME } from "../theme/github-theme.js";
import { themeSchema } from "../theme/schema.js";
import { deepMerge } from "../util/merge.js";
import { planGenerateTxn } from "../generate/manage.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { emptyPlan } from "../txn/plan.js";
import type { TxnPlan } from "../txn/plan.js";
import { configSourcePrecondition, stateSourcePrecondition } from "../txn/sources.js";
import { buildManagedGuard } from "../state/guards.js";
import {
  assertDeletable,
  findEntry,
  readState,
  removeEntry,
  serializeState,
  upsertEntry,
} from "../state/registry.js";
import type { ArteGitcardState } from "../state/registry.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { entryPresence } from "../fs/presence.js";
import { STATE_REL, THEMES_DIR_REL } from "../managed/paths.js";

export class ThemeInstallError extends Error {}
export class ThemeNotInstalledError extends Error {}

/** Builtin presets — materialization sources only. */
export const THEME_PRESETS: Record<string, object> = {
  "arte-theme": DEFAULT_THEME,
  "github-theme": GITHUB_THEME,
};

export const THEME_SIZE_LIMIT = 1024 * 1024; // 1 MiB

export function isPreset(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(THEME_PRESETS, name);
}

export function themeRelFor(name: string): string {
  return `${THEMES_DIR_REL}/${name}.yml`;
}

export function themeAbsFor(projectRoot: string, name: string): string {
  return resolveFromProject(projectRoot, themeRelFor(name));
}

/** Validate a safe installed-theme basename (mirrors the theme path guard). */
export function validThemeName(name: string): boolean {
  if (!name) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.startsWith(".")) return false;
  if (name === "." || name === "..") return false;
  return true;
}

/** Selected theme name from a config theme ref (path or legacy builtin name). */
export function selectedName(ref: string): string {
  const base = path.posix.basename(ref.replace(/\\/g, "/"));
  return base.endsWith(".yml") ? base.slice(0, -4) : base;
}

/** Merge + strict-validate a theme file body (partial allowed). */
function validateThemeBody(body: string, label: string): { schema: unknown; merged: unknown } {
  let parsed: unknown;
  try {
    parsed = YAML.parse(body) ?? {};
  } catch {
    throw new ThemeInstallError(`invalid YAML in ${label}`);
  }
  const merged = deepMerge(DEFAULT_THEME, parsed);
  const result = themeSchema.safeParse(merged);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `\`${i.path.join(".") || "theme"}\`: ${i.message}`)
      .join("\n");
    throw new ThemeInstallError(`Invalid theme (${label}):\n${msg}`);
  }
  return { schema: result.data, merged };
}

/** List installed themes in .arte-git-card/themes/. */
export function installedThemes(projectRoot: string): string[] {
  try {
    return readdirSafe(path.join(projectRoot, THEMES_DIR_REL))
      .filter((f) => f.endsWith(".yml"))
      .map((f) => f.slice(0, -4))
      .sort();
  } catch {
    return [];
  }
}

function readdirSafe(dir: string): string[] {
  return readdirSync(dir);
}

/**
 * Install gate (P0): only install into a repo whose ownership registry is
 * provable. UNINITIALIZED → init; LEGACY → migrate; initialized with
 * missing/corrupt/incompatible state → fail closed, ZERO writes (never leave an
 * unowned theme that cannot later be removed). Returns the one state snapshot
 * to use for BOTH the mutation and its transaction precondition.
 */
function assertInstallable(projectRoot: string): { status: "ok"; state: ArteGitcardState; path: string; sha256: string } {
  const hasV2 = existsSync(path.join(projectRoot, CONFIG_FILENAME));
  if (!hasV2) {
    const hasLegacy = existsSync(path.join(projectRoot, LEGACY_CONFIG_FILENAME));
    throw new ThemeInstallError(
      hasLegacy
        ? "Found a legacy v1 config. Run `arte-gitcard migrate` first, then install themes."
        : 'arte-gitcard is not initialized here. Run "arte-gitcard init" first.',
    );
  }
  const r = readState(projectRoot);
  if (r.status !== "ok") {
    throw new ThemeInstallError(
      `state.json is ${r.status} — arte-gitcard cannot prove ownership, so the theme was NOT installed ` +
        `(fail closed, nothing written). Run "arte-gitcard doctor" for diagnostics.`,
    );
  }
  return r;
}

export interface ThemeInstallResult {
  name: string;
  rel: string;
  effects: Effect[];
}

export function installTheme(
  projectRoot: string,
  source: string,
  opts: { dryRun?: boolean } = {},
): ThemeInstallResult {
  if (isPreset(source)) {
    const { plan, name, rel } = buildThemeInstallPlan(projectRoot, source, YAML.stringify(THEME_PRESETS[source]));
    const result = runTransaction(plan, {
      repoRoot: projectRoot,
      command: "theme-install",
      dryRun: opts.dryRun === true,
      guard: buildManagedGuard(projectRoot),
    });
    return { name, rel, effects: result.effects };
  }
  const abs = path.resolve(source);
  let st;
  try {
    st = statSync(abs);
  } catch {
    throw new ThemeInstallError(`cannot read theme file: ${source}`);
  }
  if (!st.isFile()) throw new ThemeInstallError(`theme source is not a file: ${source}`);
  if (st.size > THEME_SIZE_LIMIT) {
    throw new ThemeInstallError(`theme file exceeds the ${Math.round(THEME_SIZE_LIMIT / 1024)} KiB size limit`);
  }
  const body = readFileSync(abs, "utf8");
  const name = path.basename(abs).replace(/\.yml$/i, "");
  const { plan, rel } = buildThemeInstallPlan(projectRoot, name, body);
  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: "theme-install",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot),
  });
  return { name, rel, effects: result.effects };
}

/**
 * Build the install plan WITHOUT applying it (test seam). Reads state EXACTLY
 * ONCE (the snapshot is both mutation basis and transaction precondition) and
 * pins the theme target absent — a file appearing after planning is preserved,
 * never overwritten. Two installs from the same state S0 cannot both write:
 * the second to apply fails the state precondition.
 */
export function buildThemeInstallPlan(
  projectRoot: string,
  name: string,
  body: string,
): { plan: TxnPlan; name: string; rel: string } {
  const stateRead = assertInstallable(projectRoot);
  if (!validThemeName(name)) throw new ThemeInstallError(`invalid theme name "${name}"`);
  validateThemeBody(body, name);
  const rel = themeRelFor(name);
  const abs = resolveFromProject(projectRoot, rel);
  if (pathOccupied(abs)) {
    // Occupied includes a broken symlink / directory → never install over it.
    throw new ThemeInstallError(`Theme "${name}" is already installed.\nNothing was changed.`);
  }
  const txn = emptyPlan();
  txn.writes.push({ rel, abs, content: body, kind: "theme", expectedBefore: { kind: "absent" } });
  const state = stateRead.state;
  upsertEntry(state, { path: rel, kind: "theme", sha256: sha256WrittenContent(body) }); // LF bytes actually written
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  txn.preconditions = [stateSourcePrecondition(stateRead)];
  return { plan: txn, name, rel };
}

export interface ThemeSelectResult {
  effects: Effect[];
  nextConfig: ArteGitCardConfig;
  rel: string;
  materializedPreset: boolean;
}

export function selectTheme(
  projectRoot: string,
  loaded: LoadedConfig,
  name: string,
  opts: { dryRun?: boolean } = {},
): ThemeSelectResult {
  if (!validThemeName(name)) throw new ThemeNotInstalledError(`invalid theme name "${name}"`);
  const rel = themeRelFor(name);
  const abs = resolveFromProject(projectRoot, rel);
  let materializedPreset = false;

  // An EXISTING theme (regular file) is never auto-claimed and its hash is
  // never re-recorded — that would let `remove` delete the user's edits. Only a
  // preset THIS command materializes is recorded as owned.
  let nextThemeBody: string | null = null;
  let schema: ReturnType<typeof loadTheme>;
  const presence = entryPresence(abs);
  if (presence === "file") {
    schema = loadTheme(rel, projectRoot); // throws if the installed file is invalid
  } else if (presence === "absent" && isPreset(name)) {
    nextThemeBody = YAML.stringify(THEME_PRESETS[name]);
    schema = validateThemeBody(nextThemeBody, name).schema as ReturnType<typeof loadTheme>;
    materializedPreset = true;
  } else if (presence === "absent") {
    throw new ThemeNotInstalledError(
      `Theme "${name}" is not installed. Install it first:\n  arte-gitcard theme install <file.yml>\nPresets: arte-theme, github-theme`,
    );
  } else {
    // symlink (valid or broken), directory, or unreadable occupant → fail closed.
    throw new ThemeNotInstalledError(
      `Theme path "${rel}" is not a regular file (symlink/directory/…) — refusing to use it. Nothing was changed.`,
    );
  }
  const nextTheme: ResolvedTheme = resolveTheme(schema);

  const nextConfig = cloneConfig(loaded.config);
  nextConfig.theme = rel;
  const nextLoaded: LoadedConfig = { ...loaded, config: nextConfig };

  const { plan, state } = planGenerateTxn(projectRoot, nextLoaded, nextTheme, {
    dryRun: opts.dryRun === true,
    writeConfig: true,
  });

  if (materializedPreset && nextThemeBody !== null) {
    // This theme was WRITTEN in the same transaction → record ownership over the
    // LF bytes actually written (existing themes: never). The write is a fresh
    // create (presence verified absent above) → pin absent.
    plan.writes.push({
      rel,
      abs,
      content: nextThemeBody,
      kind: "theme",
      expectedBefore: { kind: "absent" },
    });
    upsertEntry(state, { path: rel, kind: "theme", sha256: sha256WrittenContent(nextThemeBody) });
    plan.stateJson = { rel: STATE_REL, content: serializeState(state) };
  }

  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: "theme-select",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, nextConfig),
  });
  return { effects: result.effects, nextConfig, rel, materializedPreset };
}

export interface ThemeRemoveResult {
  effects: Effect[];
  preserved: boolean;
}

export function removeTheme(
  projectRoot: string,
  loaded: LoadedConfig,
  name: string,
  opts: { dryRun?: boolean } = {},
): ThemeRemoveResult {
  if (!validThemeName(name)) throw new ThemeNotInstalledError(`invalid theme name "${name}"`);
  if (isPreset(name) && !pathOccupied(themeAbsFor(projectRoot, name))) {
    throw new ThemeNotInstalledError(
      `Preset "${name}" is not installed (materialize it with "arte-gitcard theme select ${name}"). Nothing to remove.`,
    );
  }
  const rel = themeRelFor(name);
  const abs = resolveFromProject(projectRoot, rel);
  if (!pathOccupied(abs)) throw new ThemeNotInstalledError(`Theme "${name}" is not installed.`);

  // The selected-theme check is a CONFIG decision pinned as a config
  // precondition on the caller's EXACT LoadedConfig, so a concurrent config
  // change between planning and apply fails with a retry instead of deleting a
  // theme that just became selected.
  if (selectedName(loaded.config.theme) === name) {
    throw new ThemeNotInstalledError(
      `Cannot remove currently selected theme "${name}". Select another theme first.`,
    );
  }

  // ONE state snapshot for both the ownership decision and the precondition — a
  // concurrent install/remove must fail with a retry, not drop/clobber entries.
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") {
    throw new ThemeNotInstalledError(
      `Cannot prove arte-gitcard installed "${name}" — file preserved. Run "arte-gitcard doctor" to inspect.`,
    );
  }
  const state = stateRead.state;
  const entry = findEntry(state, rel);
  if (!entry) {
    throw new ThemeNotInstalledError(
      `Cannot prove arte-gitcard installed "${name}" — file preserved. Run "arte-gitcard doctor" to inspect.`,
    );
  }
  const status = assertDeletable(projectRoot, entry);
  if (status === "modified") {
    throw new ThemeNotInstalledError(
      `Theme "${name}" was modified after installation — file preserved to avoid deleting your changes.`,
    );
  }
  if (status === "unsafe") {
    throw new ThemeNotInstalledError(`Theme "${name}" is at an unsafe path — preserved.`);
  }
  // ok or missing (missing = entry stale; drop it, no file to delete)

  const txn = emptyPlan();
  if (status === "ok") {
    txn.deletes.push({ rel, abs, kind: "theme", expectedSha256: entry.sha256 });
  }
  removeEntry(state, rel);
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  txn.preconditions = [...configSourcePrecondition(loaded), stateSourcePrecondition(stateRead)];
  const result = runTransaction(txn, {
    repoRoot: projectRoot,
    command: "theme-remove",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, loaded.config),
  });
  return { effects: result.effects, preserved: false };
}

export function themeBodyFor(projectRoot: string, name: string): { body: string; preset: boolean } {
  const abs = themeAbsFor(projectRoot, name);
  if (pathOccupied(abs)) return { body: readFileSync(abs, "utf8"), preset: false };
  if (isPreset(name)) return { body: YAML.stringify(THEME_PRESETS[name]), preset: true };
  throw new ThemeNotInstalledError(`Theme "${name}" is not installed (and is not a preset).`);
}

export function validateThemeFile(file: string): { ok: boolean; error?: string } {
  try {
    const abs = path.resolve(file);
    const body = readFileSync(abs, "utf8");
    validateThemeBody(body, file);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
