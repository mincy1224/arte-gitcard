/** Filesystem walker (non-git repositories and fallback). Plan.md §58/§60. */

import { readdirSync, type Dirent } from "node:fs";
import path from "node:path";
import { isExcludedDir, isExcludedFile, type ExcludeOptions } from "./exclude.js";

export interface ScannedFile {
  /** Absolute path on disk. */
  absolutePath: string;
  /** POSIX-style path relative to the scan root. */
  relative: string;
}

/**
 * Recursively walk `root`, pruning excluded dirs/files. Deterministic order
 * (sorted). Symlinks are skipped (never followed outside the repository).
 */
export function walkFilesystem(root: string, opts: ExcludeOptions = {}): ScannedFile[] {
  const out: ScannedFile[] = [];

  const walk = (dir: string, rel: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const childAbs = path.join(dir, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (isExcludedDir(childRel, opts)) continue;
        walk(childAbs, childRel);
      } else if (entry.isFile()) {
        if (isExcludedFile(childRel, opts)) continue;
        out.push({ absolutePath: childAbs, relative: childRel });
      }
      // Symlinks (and anything else) are intentionally skipped.
    }
  };

  walk(root, "");
  return out;
}
