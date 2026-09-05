/**
 * Repository mutation lock (.arte-git-card/.lock).
 *
 * Stale policy (P0): on the SAME host, a live pid is never broken by age — a
 * long-running mutation keeps its lock. Age is used only as a fallback when the
 * holder cannot be probed (different host, or an unreadable lock file). Release
 * only removes the lock when it still holds OUR {pid,host} token.
 *
 * The lock parent directory is created lazily; when we created it and it is
 * empty at release (or on early failure), it is removed so that acquiring a
 * lock never leaves a `.arte-git-card/` side effect behind (relevant for
 * `init` on an UNINITIALIZED repo).
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { sleepSync } from "../util/sleep.js";

export interface LockToken {
  pid: number;
  host: string;
  time: number;
  command: string;
}

export interface RepoLock {
  token: LockToken;
  release(): void;
}

export interface LockOptions {
  /** how long to poll for a held (non-stale) lock before failing */
  waitMs?: number;
  pollMs?: number;
  /** age threshold used ONLY as a cross-host / unreadable-holder fallback */
  staleMs?: number;
}

const DEFAULT_STALE_MS = 10 * 60 * 1000;
const DEFAULT_WAIT_MS = 10 * 1000;
const DEFAULT_POLL_MS = 200;

export function acquireRepoLock(
  lockPath: string,
  command: string,
  opts: LockOptions = {},
): RepoLock {
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;

  const dir = path.dirname(lockPath);
  // Stop point when removing lock dirs WE created (never leave a
  // `.arte-git-card/` side effect on early failure or release).
  const anchor = findExistingAnchor(dir);
  if (anchor !== dir) mkdirSync(dir, { recursive: true });

  const token: LockToken = { pid: process.pid, host: os.hostname(), time: Date.now(), command };
  const tokenJson = JSON.stringify(token);
  const deadline = Date.now() + waitMs;

  for (;;) {
    try {
      const fd = openSync(lockPath, "wx");
      writeFileSync(fd, tokenJson);
      closeSync(fd);
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") {
        cleanupCreatedDirs(dir, anchor);
        throw err;
      }
      const holder = readHolder(lockPath);
      const mtime = statMtime(lockPath);
      if (isStale(holder, mtime, staleMs)) {
        try {
          unlinkSync(lockPath);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException)?.code;
          if (code === "ENOENT") {
            // Raced with another releaser — retry acquisition.
          } else {
            // A stale lock that cannot be removed (a DIRECTORY, permission, etc.)
            // must fail closed with an actionable error — never loop forever.
            cleanupCreatedDirs(dir, anchor);
            throw new Error(
              `Repository lock at ${lockPath} is stale but could not be removed ` +
                `(${code ?? "unknown error"}). It may be a directory or otherwise protected. ` +
                `Remove it manually and retry.`,
            );
          }
        }
        continue;
      }
      if (Date.now() >= deadline) {
        cleanupCreatedDirs(dir, anchor);
        const info = holder
          ? `pid ${holder.pid} on host "${holder.host}" since ${new Date(holder.time).toISOString()} (${holder.command})`
          : "an unreadable lock file";
        throw new Error(
          `Repository is locked (${info}). Stale locks are auto-broken after ${
            Math.round(staleMs / 60000)
          } minutes. ` +
            `Wait for the other arte-gitcard process to finish, or remove the lock file manually.`,
        );
      }
      sleepSync(pollMs);
    }
  }

  return {
    token,
    release: () => releaseRepoLock(lockPath, token, dir, anchor),
  };
}

function readHolder(lockPath: string): LockToken | null {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as Partial<LockToken>;
    if (parsed && typeof parsed.pid === "number" && typeof parsed.host === "string") {
      return {
        pid: parsed.pid,
        host: parsed.host,
        time: typeof parsed.time === "number" ? parsed.time : 0,
        command: typeof parsed.command === "string" ? parsed.command : "unknown",
      };
    }
  } catch {
    /* unreadable/corrupt */
  }
  return null;
}

function statMtime(lockPath: string): number | null {
  try {
    return statSync(lockPath).mtimeMs;
  } catch {
    return null;
  }
}

function isStale(holder: LockToken | null, mtime: number | null, staleMs: number): boolean {
  if (holder) {
    if (holder.host === os.hostname()) {
      // Same host: trust pid liveness only. Never break a live pid by age.
      return !pidAlive(holder.pid);
    }
    // Different host: cannot probe the pid → age fallback.
    return Date.now() - holder.time > staleMs;
  }
  // Unreadable/corrupt lock: age fallback on the file mtime.
  return mtime !== null && Date.now() - mtime > staleMs;
}

function pidAlive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: process exists but we cannot signal it → alive. ESRCH/EINVAL → dead/invalid.
    return (err as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

function releaseRepoLock(lockPath: string, token: LockToken, dir: string, anchor: string): void {
  try {
    const current = readHolder(lockPath);
    if (current && current.pid === token.pid && current.host === token.host) {
      unlinkSync(lockPath);
    }
  } catch {
    /* already gone */
  }
  cleanupCreatedDirs(dir, anchor);
}

function findExistingAnchor(dir: string): string {
  let cur = dir;
  for (;;) {
    if (existsSync(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return cur;
    cur = parent;
  }
}

/** Remove the chain of lock dirs WE created, stopping at the pre-existing anchor. */
function cleanupCreatedDirs(dir: string, anchor: string): void {
  let cur = dir;
  while (cur !== anchor && path.dirname(cur) !== cur) {
    try {
      if (readdirSync(cur).length === 0) rmdirSync(cur);
      else break;
    } catch {
      break;
    }
    cur = path.dirname(cur);
  }
}
