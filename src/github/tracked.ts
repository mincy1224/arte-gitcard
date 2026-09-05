/**
 * Read-only Git tracking helpers for integration/metadata files.
 *
 * Git is invoked via execFileSync; paths are passed as literal `--` arguments
 * and never interpolated into a shell string.
 */

import { execFileSync } from "node:child_process";
import { CI_ACTION_REL, CI_RUNTIME_REL, WORKFLOW_REL } from "../managed/paths.js";

export const INTEGRATION_RELS: string[] = [WORKFLOW_REL, CI_ACTION_REL, CI_RUNTIME_REL];

function isTracked(root: string, rel: string): boolean {
  try {
    return execFileSync("git", ["ls-files", "-z", "--", rel], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).length > 0;
  } catch {
    return false;
  }
}

/** True when `rel` matches a gitignore rule (path-based, works for absent files). */
function isIgnored(root: string, rel: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", rel], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true; // exit 0 = ignored
  } catch {
    return false; // exit 1 = not ignored; 128 = unverifiable → do not claim ignored
  }
}

/** Git integration rels that are untracked AND ignored (would be skipped by git add). */
export function integrationIgnoredRels(projectRoot: string): string[] {
  const ignored: string[] = [];
  for (const rel of INTEGRATION_RELS) {
    if (isTracked(projectRoot, rel)) continue;
    if (isIgnored(projectRoot, rel)) ignored.push(rel);
  }
  return ignored;
}

/** True when a single repo-relative path is untracked AND ignored (metadata warning). */
export function isUntrackedAndIgnored(projectRoot: string, rel: string): boolean {
  if (isTracked(projectRoot, rel)) return false;
  return isIgnored(projectRoot, rel);
}
