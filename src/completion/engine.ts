/**
 * Dynamic completion engine shared by all four shells (P0). Shell functions
 * forward typed words to `arte-gitcard __complete` and parse the printed lines.
 *
 * STRICTLY READ-ONLY: no writes, locks, network, GitHub mutations, or executing
 * repository code; stdout carries only machine-readable candidates. A candidate
 * may never carry newline/CR/NUL — such values are dropped before the stream.
 * Damaged configs degrade safely to static/empty candidates.
 */

import path from "node:path";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolveProjectRoot } from "../repo/resolve.js";
import { loadConfigWithSchema } from "../config/load.js";
import { listConfigKeys, tuningKeys } from "../config/registry.js";
import { THEME_PRESETS } from "../thememgr/index.js";
import { BUILTIN_LANGUAGES } from "../languages/builtin.js";
import { THEMES_DIR_REL } from "../managed/paths.js";
import { displayEnabledIn } from "../display/definition.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";

export const GLOBAL_FLAGS = [
  "--repo", "--json", "--quiet", "--verbose", "--no-color", "--dry-run", "-h", "--help", "-v", "--version",
];

/** Options that consume a value (skipped along with the following token). */
const VALUE_OPTS = new Set([
  "--repo", "--name", "--extensions", "--filenames", "--shebang", "--line-comment", "--block-comment",
]);

export const GROUPS: Record<string, string[]> = {
  card: ["list"],
  config: ["list", "get", "set", "reset", "path"],
  exclude: ["list", "add", "remove", "reset"],
  language: ["list", "show", "add", "remove"],
  theme: ["list", "install", "select", "show", "validate", "remove"],
  github: ["enable", "disable", "status", "sync"],
  structure: ["list", "describe", "remove"],
  completion: ["bash", "zsh", "fish", "powershell"],
};

export const TOP_LEAVES = ["init", "reset", "migrate", "uninstall", "status", "doctor", "validate", "generate", "add", "remove", "snippet"];

/** Remove option flags (and their values) while preserving word order. Empty tokens are kept. */
export function nonOptionWords(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w === "") {
      out.push(w);
      continue;
    }
    if (w.startsWith("-")) {
      if (VALUE_OPTS.has(w)) i += 1; // skip the flag's value too
      continue;
    }
    out.push(w);
  }
  return out;
}

export function isSafeCandidate(c: string): boolean {
  for (const ch of c) {
    const cc = ch.codePointAt(0) ?? 0;
    if (cc === 10 || cc === 13 || cc === 0) return false;
  }
  return true;
}

function configOf(projectRoot: string, schema: ArteRuntime["config"]["v2Schema"]): ReturnType<typeof loadConfigWithSchema> | null {
  try {
    return loadConfigWithSchema(path.join(projectRoot, "arte-gitcard.yml"), schema);
  } catch {
    return null;
  }
}

function installedThemes(projectRoot: string): string[] {
  try {
    return readdirSync(path.join(projectRoot, THEMES_DIR_REL))
      .filter((f) => f.endsWith(".yml"))
      .map((f) => f.slice(0, -4))
      .sort();
  } catch {
    return [];
  }
}

function cardEnabled(config: NonNullable<ReturnType<typeof configOf>>["config"], id: string): boolean {
  return displayEnabledIn(config, id);
}

/** Resolve the repo root, honoring a preceding `--repo <path>` in the words. */
export function resolveRootFor(words: string[]): string {
  let start = process.cwd();
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === "--repo") {
      const v = words[i + 1];
      if (v && !v.startsWith("-")) start = v;
      break;
    }
  }
  return resolveProjectRoot(start, { repo: start !== process.cwd() ? start : undefined }).root;
}

const PREFIX = (list: string[], partial: string): string[] =>
  list.filter((c) => isSafeCandidate(c) && c.startsWith(partial)).sort();

export function candidates(
  words: string[],
  explicitRoot?: string,
  opts?: { runtime?: ArteRuntime },
): string[] {
  const runtime = opts?.runtime ?? DEFAULT_RUNTIME;
  const partial = words.length > 0 ? words[words.length - 1]! : "";
  const completed = words.length > 0 ? words.slice(0, words.length - 1) : [];

  if (partial.startsWith("-") && partial !== "-") {
    return PREFIX(GLOBAL_FLAGS, partial);
  }

  const seq = nonOptionWords(completed);
  const projectRoot = explicitRoot ?? resolveRootFor(words);

  const g0 = seq[0];
  const g1 = seq[1];

  if (!g0) {
    return PREFIX([...TOP_LEAVES, ...Object.keys(GROUPS)], partial);
  }
  if (Object.keys(GROUPS).includes(g0)) {
    const leaves = GROUPS[g0]!;
    if (!g1 || !leaves.includes(g1)) {
      // completing the group leaf
      return PREFIX(leaves, partial);
    }
    const leafArgs = seq.slice(2);
    const leafArg = leafArgs[0] ?? "";
    const argCandidates = argCandidatesFor(g0, g1, projectRoot, leafArg, runtime);
    return PREFIX(argCandidates, partial);
  }
  if (TOP_LEAVES.includes(g0)) {
    const leafArgs = seq.slice(1);
    const leafArg = leafArgs[0] ?? "";
    return PREFIX(argCandidatesFor(undefined, g0, projectRoot, leafArg, runtime), partial);
  }
  return [];
}

function argCandidatesFor(
  group: string | undefined,
  leaf: string,
  projectRoot: string,
  current: string,
  runtime: ArteRuntime,
): string[] {
  // The config is validated against THIS runtime's schema so an optional display
  // block in the config loads under the matching runtime only.
  const loaded = configOf(projectRoot, runtime.config.v2Schema); // null when damaged → safe static/empty fallback

  // Top-level card lifecycle (`arte-gitcard add|remove <card>`). Card identity
  // ALWAYS comes from the compiled runtime registry — never a hardcoded list.
  if (group === undefined) {
    if (leaf === "add") return loaded ? runtime.cardIds.filter((c) => !cardEnabled(loaded.config, c)) : [];
    if (leaf === "remove") return loaded ? runtime.cardIds.filter((c) => cardEnabled(loaded.config, c)) : [];
  }

  if (group === "theme") {
    const installed = installedThemes(projectRoot);
    const selected = loaded ? selectedThemeName(loaded.config.theme) : null;
    if (leaf === "remove") return installed.filter((t) => t !== selected);
    if (leaf === "select" || leaf === "show") {
      return [...new Set([...installed, ...Object.keys(THEME_PRESETS)])];
    }
    if (leaf === "install") return current ? [current] : [];
    return [];
  }

  if (group === "config") {
    if (leaf === "get") return listConfigKeys(runtime).map((k) => k.key);
    if (leaf === "set" || leaf === "reset") return tuningKeys(runtime).map((k) => k.key);
    return [];
  }

  if (group === "exclude") {
    if (leaf === "remove") return loaded ? (loaded.config.exclude ?? []) : [];
    return [];
  }

  if (group === "language") {
    const custom = new Set((loaded?.config.languages ?? []).map((l) => l.id));
    const builtin = BUILTIN_LANGUAGES.map((l) => l.id);
    if (leaf === "show") return [...builtin, ...custom];
    if (leaf === "remove") return [...custom]; // built-ins can NEVER be removed
    return [];
  }

  return [];
}

function selectedThemeName(ref: string): string {
  const base = path.posix.basename(ref.replace(/\\/g, "/"));
  return base.endsWith(".yml") ? base.slice(0, -4) : base;
}
