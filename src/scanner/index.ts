/** Unified repository scan: git when available, filesystem walker otherwise. */

import path from "node:path";
import { lstatSync } from "node:fs";
import { isExcludedFile, type ExcludeOptions } from "./exclude.js";
import { walkFilesystem, type ScannedFile } from "./files.js";
import { isGitRepo, listGitFiles } from "./git.js";

export interface ScanResult {
  files: ScannedFile[];
  /** true when the git index was the source of truth. */
  git: boolean;
}

/**
 * Scan `root`, applying the hard tool-correctness excludes plus the
 * user-editable `exclude` list. `outputDir` is the resolved output directory
 * as a POSIX path relative to `root` (same path space as scanned paths).
 */
export function scanRepository(
  root: string,
  opts: ExcludeOptions = {},
): ScanResult {
  const git = isGitRepo(root);
  if (git) {
    const rels = listGitFiles(root);
    if (rels) {
      const files: ScannedFile[] = [];
      for (const rel of rels) {
        const posix = rel.split("\\").join("/");
        if (isExcludedFile(posix, opts)) continue;
        const abs = path.join(root, ...posix.split("/"));
        // Skip symlinks (SPEC §7): a tracked link must never be read through —
        // it could point outside the repository (mirrors the filesystem walker).
        let st;
        try {
          st = lstatSync(abs);
        } catch {
          continue; // vanished between git listing and stat — skip it
        }
        if (st.isSymbolicLink()) continue;
        files.push({ absolutePath: abs, relative: posix });
      }
      return { files, git: true };
    }
  }
  return { files: walkFilesystem(root, opts), git };
}
