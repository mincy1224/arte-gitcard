/**
 * Strict mutation/control path authority.
 *
 * Mutation/control paths must NEVER traverse an existing symlink/junction
 * component — even when the target stays inside the repo (a symlinked
 * `.arte-git-card` -> `src` could redirect a managed write onto a source path).
 * `realpathContained` is deliberately permissive and is NOT used for mutation
 * authority. Run this BEFORE any read/stage/create through the path.
 */

import path from "node:path";
import { resolveContained, pathHasNoSymlinkComponents } from "./pathguard.js";
import { acquireRepoLock } from "./lock.js";
import type { LockOptions } from "./lock.js";

export class PathAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathAuthorityError";
  }
}

/** Throws unless `relPosix` is contained AND has no existing symlink component. */
export function assertStrictContained(repoRoot: string, relPosix: string): void {
  const abs = resolveContained(repoRoot, relPosix);
  if (!abs) {
    throw new PathAuthorityError(`unsafe path (outside the repository): ${relPosix}`);
  }
  if (!pathHasNoSymlinkComponents(repoRoot, relPosix)) {
    throw new PathAuthorityError(
      `refusing to traverse a symlink/junction component: ${relPosix} — arte-gitcard never follows symlinks for mutation or control paths`,
    );
  }
}

/**
 * Single authority-safe repo-lock acquisition used by every caller (engine,
 * recover, …). Fails BEFORE creating/reading `.lock` through a redirected
 * control directory.
 */
export function acquireRepoLockAuthoritative(
  repoRoot: string,
  lockPath: string,
  command: string,
  opts: LockOptions = {},
) {
  const rel = path.relative(repoRoot, lockPath).split(path.sep).join("/");
  assertStrictContained(repoRoot, rel);
  return acquireRepoLock(lockPath, command, opts);
}
