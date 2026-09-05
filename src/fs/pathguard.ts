/**
 * Path containment / symlink safety (P0). state.json is ownership EVIDENCE,
 * never path AUTHORITY — every managed operation's target path is validated
 * here against the repository root before any write or delete. Journal
 * recovery re-runs these guards (journal content is untrusted).
 *
 * Windows: Node reports directory junctions / reparse points via
 * `lstat().isSymbolicLink()` on modern Node, so the same guard covers them.
 */

import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

/** Normalize + validate a POSIX repo-relative path. Returns null on any violation. */
export function normalizeRelPosix(rel: string): string | null {
  if (!rel || rel.length === 0) return null;
  if (rel.startsWith("/")) return null; // absolute POSIX
  if (rel.startsWith("\\")) return null; // absolute Windows
  if (/^[A-Za-z]:[\\/]/.test(rel)) return null; // Windows drive
  if (rel.includes("\\")) return null; // backslash separators rejected
  const segments = rel.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") return null;
  }
  return segments.join("/");
}

/** Lexical containment: is `child` === `parent` or inside it? */
export function isPathInside(child: string, parent: string): boolean {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  return c === p || c.startsWith(p + path.sep);
}

/**
 * Resolve a repo-relative POSIX path to an absolute path. Returns null when the
 * path violates containment (escape, absolute, backslash, drive letter, `..`).
 */
export function resolveContained(repoRoot: string, relPosix: string): string | null {
  const rel = normalizeRelPosix(relPosix);
  if (!rel) return null;
  const abs = path.resolve(repoRoot, rel);
  if (!isPathInside(abs, repoRoot)) return null;
  return abs;
}

/**
 * STRICT lexical+filesystem authority (P0 uninstall ancestor-symlink rule):
 * does `relPosix` reach its target without ANY existing component being a
 * symlink/junction? This is deliberately STRICTER than `realpathContained`,
 * which permits an intermediate symlink whose target stays inside the repo.
 * Ownership safety must not let a symlink redirect a managed path onto a
 * user/source file — even when the target is still inside repoRoot.
 *
 * Walks each EXISTING component from repoRoot down with lstatSync (never stat,
 * never follows): any symlink component → false; a non-directory intermediate
 * component → false. A missing component stops the walk (nothing below it can
 * exist, and nothing is followed); the final component's regular-file-ness is a
 * SEPARATE check (the transaction engine enforces it before deletion).
 */
export function pathHasNoSymlinkComponents(repoRoot: string, relPosix: string): boolean {
  const abs = resolveContained(repoRoot, relPosix);
  if (!abs) return false;
  const rel = path.relative(repoRoot, abs);
  if (rel === "") return true; // the repo root itself
  const parts = rel.split(path.sep);
  let cur = repoRoot;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    cur = path.join(cur, part);
    let st;
    try {
      st = lstatSync(cur);
    } catch (err) {
      // ONLY a true ENOENT means the component is genuinely absent (nothing below
      // it can exist or be followed); any other error is UNVERIFIABLE → FAIL CLOSED.
      const code = (err as NodeJS.ErrnoException)?.code;
      return code === "ENOENT";
    }
    if (st.isSymbolicLink()) return false; // a symlink NEVER redirects authority
    const last = i === parts.length - 1;
    if (!last && !st.isDirectory()) return false; // a file mid-path cannot be an ancestor
  }
  return true;
}

/**
 * For an EXISTING target: walk every existing ancestor component and verify none
 * is a symlink/junction redirecting outside the (realpath-resolved) repository
 * root. A missing final target is fine (nothing to follow). Returns the resolved
 * absolute path when safe, otherwise null.
 */
export function realpathContained(repoRoot: string, relPosix: string): string | null {
  const abs = resolveContained(repoRoot, relPosix);
  if (!abs) return null;
  let rootReal: string;
  try {
    rootReal = realpathSync(repoRoot);
  } catch {
    return null;
  }
  const rel = path.relative(repoRoot, abs);
  if (rel === "") return rootReal;
  let cur = rootReal;
  for (const part of rel.split(path.sep)) {
    if (!part) continue;
    cur = path.join(cur, part);
    let st;
    try {
      st = lstatSync(cur);
    } catch {
      // Missing component: nothing further to follow below it.
      return abs;
    }
    if (st.isSymbolicLink()) {
      let target: string;
      try {
        target = realpathSync(cur);
      } catch {
        return null;
      }
      if (!isPathInside(target, rootReal)) return null;
      cur = target;
    }
  }
  return abs;
}
