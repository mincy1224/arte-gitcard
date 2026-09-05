/**
 * Branch validity + GitHub Actions branch-filter encoding (default-branch pass).
 *
 * Validity is decided by git itself (`git check-ref-format`); the empty/too-long
 * guard only turns garbage into a clear error before any exec.
 *
 * `on.push.branches[0]` is a GitHub Actions GLOB PATTERN, not a literal: every
 * metachar is backslash-escaped (`githubActionsBranchLiteral`) and the ENCODED
 * value is YAML-quoted so the backslashes survive — the parsed scalar is the
 * pattern GitHub evaluates.
 *
 * All Git invocation is execFile/execFileSync — a branch name is NEVER
 * interpolated into a shell command string.
 */

import { execFileSync } from "node:child_process";

/** Pure pre-check → error message or null when OK (authority = git check-ref-format). */
export function branchError(branch: string): string | null {
  if (!branch) return "branch must not be empty";
  if (branch.length > 1024) return "branch name is too long";
  return null;
}

export function assertBranchValid(branch: string): string {
  const err = branchError(branch);
  if (err) throw new Error(err);
  return branch;
}

/** `git check-ref-format refs/heads/<branch>` (read-only). Throws on invalid. */
export function assertGitRefFormat(branch: string, cwd: string): void {
  try {
    execFileSync("git", ["check-ref-format", `refs/heads/${branch}`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(`invalid git branch ref: "${branch}"`);
  }
}

export function assertBranchRef(branch: string, cwd: string): string {
  assertBranchValid(branch);
  assertGitRefFormat(branch, cwd);
  return branch;
}

/**
 * Backslash-escape GitHub Actions branch-filter metachars (`\ * ? [ ] ! +`):
 * `branches:` is a glob pattern (leading `!` = exclusion), so a literal branch
 * like `release+prod`/`!hotfix`/`*` would otherwise be misread. Git already
 * forbids `? * [ \ ~ ^ :` + space, so co-occurring chars are `+ ] !`; escaping
 * the full documented set is safe for any name.
 */
export function githubActionsBranchLiteral(branch: string): string {
  let out = "";
  for (const ch of branch) {
    if (ch === "\\" || ch === "*" || ch === "?" || ch === "[" || ch === "]" || ch === "!" || ch === "+") {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Single-quote the ENCODED pattern so literal backslashes survive parsing
 * (embedded `'` doubled per YAML). Never quote the raw branch.
 */
export function yamlQuoteBranch(encoded: string): string {
  return `'${encoded.replace(/'/g, "''")}'`;
}
