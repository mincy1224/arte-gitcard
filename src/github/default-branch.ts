/**
 * GitHub default-branch resolution. GitHub is the authoritative source — never
 * the current checkout, a cached local origin/HEAD, or a guess at "main".
 *
 *   resolveDefaultBranch (enable/sync): read-only `git ls-remote --symref origin
 *   HEAD` → `ref: refs/heads/<name> HEAD`; if the lookup cannot complete we FAIL
 *   CLOSED with actionable guidance.
 *   cachedOriginHeadBranch (doctor only): local origin/HEAD, offline diagnostic
 *   only.
 *
 * All Git invocation is execFileSync; a branch name is never interpolated into a
 * shell command string.
 */

import { execFileSync } from "node:child_process";

export class DefaultBranchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefaultBranchError";
  }
}

/** Parse `git ls-remote --symref origin HEAD` stdout → `ref: refs/heads/<name> HEAD`, or null. */
export function parseLsRemoteDefaultBranch(stdout: string): string | null {
  for (const line of stdout.split("\n")) {
    const m = /^ref:\s+refs\/heads\/(\S+)\s+HEAD\s*$/.exec(line);
    if (m) return m[1]!;
  }
  return null;
}

export interface DefaultBranchResolution {
  branch: string;
  source: "ls-remote";
}

/** Resolve from the AUTHORITATIVE remote (read-only). Throws DefaultBranchError —
 * no fallback to "main", the current branch, or a stale cached origin/HEAD. */
export function resolveDefaultBranch(repoRoot: string): DefaultBranchResolution {
  let out: string;
  try {
    out = execFileSync("git", ["ls-remote", "--symref", "origin", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    });
  } catch {
    throw new DefaultBranchError(
      "Unable to determine the GitHub repository default branch.\n" +
        "arte-gitcard serves only the repository default branch (never your current branch).\n" +
        "Check that `origin` points at the GitHub repository and that your Git credentials " +
        "can read it, then run `arte-gitcard github enable` (or `github sync`) again.",
    );
  }
  const branch = parseLsRemoteDefaultBranch(out);
  if (!branch) {
    throw new DefaultBranchError(
      "The remote did not advertise a default branch (`git ls-remote --symref origin HEAD` returned no `ref:`).\n" +
        "Check that `origin` is a valid GitHub remote and that it has a default branch, then retry.",
    );
  }
  return { branch, source: "ls-remote" };
}

/** Local `refs/remotes/origin/HEAD` — offline DIAGNOSTIC ONLY (doctor); never
 * drives enable/sync (may be stale after a GitHub-side default-branch rename). */
export function cachedOriginHeadBranch(repoRoot: string): string | null {
  try {
    const out = execFileSync("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.startsWith("origin/") ? out.slice("origin/".length) : null;
  } catch {
    return null;
  }
}
