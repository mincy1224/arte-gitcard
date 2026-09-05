/**
 * Repository resolver (P0). Mutation commands must NEVER cross a Git repository
 * boundary while searching for a config — otherwise a `reset`/`config set` in a
 * nested repo could act on the wrong parent repository.
 *
 * Resolution: `--repo <path>` → that path is the project root (GitHub commands
 * additionally require it to be inside a Git repo); else inside a Git work tree
 * → root is `git rev-parse --show-toplevel` and config discovery STOPS at the
 * git root; else walk up for a config (fallback: `start`).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME } from "../config/paths.js";

export interface ResolveResult {
  root: string;
  gitRoot: string | null;
  configPath: string | null;
}

export interface ResolveOptions {
  repo?: string;
}

/** `git rev-parse --show-toplevel` for dir, or null when not in a work tree. */
export function gitTopLevel(dir: string): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = out.trim();
    return trimmed ? path.resolve(trimmed) : null;
  } catch {
    return null;
  }
}

/** True when `dir` itself is a git work-tree root (has a .git entry). */
export function isGitRoot(dir: string): boolean {
  return existsSync(path.join(dir, ".git"));
}

/** Walk up from `start` to `boundary` (inclusive) looking for a config file. */
function findConfigUpTo(start: string, boundary: string): string | null {
  let dir = path.resolve(start);
  for (;;) {
    for (const name of [CONFIG_FILENAME, LEGACY_CONFIG_FILENAME]) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    if (path.resolve(dir) === path.resolve(boundary)) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolveProjectRoot(start: string, opts: ResolveOptions = {}): ResolveResult {
  if (opts.repo) {
    const root = path.resolve(opts.repo);
    if (!existsSync(root)) {
      throw new Error(`--repo path does not exist: ${root}`);
    }
    const gitRoot = gitTopLevel(root);
    const boundary = gitRoot ?? root;
    const configPath = findConfigUpTo(root, boundary);
    return { root, gitRoot, configPath };
  }

  const startAbs = path.resolve(start);
  const gitRoot = gitTopLevel(startAbs);
  if (gitRoot) {
    const configPath = findConfigUpTo(startAbs, gitRoot);
    return { root: gitRoot, gitRoot, configPath };
  }

  let dir = startAbs;
  for (;;) {
    for (const name of [CONFIG_FILENAME, LEGACY_CONFIG_FILENAME]) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return { root: dir, gitRoot: null, configPath: candidate };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return { root: startAbs, gitRoot: null, configPath: null };
    dir = parent;
  }
}
