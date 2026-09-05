/** Git file listing (plan.md §58/§60): `git ls-files --cached --others
 * --exclude-standard -z` → NUL-safe list of tracked + untracked files. */

import { execFileSync } from "node:child_process";

export function isGitRepo(root: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all files git tracks or would track (honoring .gitignore), NUL-safe.
 * Returns null if git fails (fall back to the filesystem walker).
 */
export function listGitFiles(root: string): string[] | null {
  try {
    const buf = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
    return buf.split("\0").filter((p) => p.length > 0);
  } catch {
    return null;
  }
}
