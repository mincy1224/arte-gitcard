/**
 * Repository lock semantics (Phase 0, P0 stale policy):
 *  - exclusive acquire (wx);
 *  - same-host LIVE pid is NEVER broken by age (long-task protection);
 *  - same-host DEAD pid → stale, broken;
 *  - different host / unreadable holder → age fallback only;
 *  - bounded wait then a clear error;
 *  - release only removes OUR {pid,host} token;
 *  - acquiring a lock in a brand-new directory leaves no directory behind.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { acquireRepoLock } from "../../src/fs/lock.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-lock-"));
  dirs.push(dir);
  return dir;
}

function deadPid(): number {
  const r = spawnSync(process.execPath, ["-e", ""]);
  if (r.pid === undefined) throw new Error("spawnSync returned no pid");
  return r.pid;
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("fs/lock", () => {
  it("acquires and releases an exclusive lock; release removes only our token", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, ".arte-git-card", ".lock");
    const lock = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10 });
    expect(readFileSync(lockPath, "utf8")).toContain(`"pid":${process.pid}`);
    lock.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("a held lock by a LIVE same-host pid is never broken by age — waits then fails", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, "lock");
    // Old lock owned by OUR live pid (same host, same pid).
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, host: hostname(), time: Date.now() - 3_600_000, command: "x" }),
    );
    expect(() => acquireRepoLock(lockPath, "test", { waitMs: 120, pollMs: 10, staleMs: 50 })).toThrow(/locked/);
    // The live pid lock was NOT broken.
    expect(existsSync(lockPath)).toBe(true);
  });

  it("a lock held by a DEAD same-host pid is stale and broken", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, "lock");
    writeFileSync(
      lockPath,
      JSON.stringify({
        pid: deadPid(),
        host: hostname(),
        time: Date.now(),
        command: "x",
      }),
    );
    const lock = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10 });
    lock.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("a lock from a different host is broken only by age", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, "lock");
    // Old age → stale.
    writeFileSync(lockPath, JSON.stringify({ pid: 12345, host: "some-other-host", time: Date.now() - 3_600_000, command: "x" }));
    const lock1 = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10, staleMs: 60_000 });
    lock1.release();

    // Recent age → not stale → waits then fails.
    writeFileSync(lockPath, JSON.stringify({ pid: 12345, host: "some-other-host", time: Date.now() - 1000, command: "x" }));
    expect(() => acquireRepoLock(lockPath, "test", { waitMs: 120, pollMs: 10, staleMs: 60_000 })).toThrow(/locked/);
  });

  it("an unreadable/corrupt lock is broken only when its mtime is old", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, "lock");
    writeFileSync(lockPath, "not-json-at-all");

    // Recent mtime → not stale → waits then fails.
    expect(() => acquireRepoLock(lockPath, "test", { waitMs: 120, pollMs: 10, staleMs: 60_000 })).toThrow(/locked/);

    // Old mtime → stale → broken.
    const past = new Date(Date.now() - 3_600_000);
    utimesSync(lockPath, past, past);
    const lock = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10, staleMs: 60_000 });
    lock.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("release never removes a lock that now belongs to a different token", () => {
    const dir = tempDir();
    const lockPath = path.join(dir, "lock");
    const lock = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10 });
    // Simulate another holder taking over.
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid + 1000, host: "other", time: Date.now(), command: "y" }));
    lock.release();
    expect(existsSync(lockPath)).toBe(true); // not ours anymore → preserved
  });

  it("acquiring a lock in a brand-new directory leaves no directory behind on release", () => {
    const dir = tempDir();
    const nested = path.join(dir, "a", "b");
    const lockPath = path.join(nested, ".lock");
    const lock = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10 });
    lock.release();
    expect(existsSync(path.join(dir, "a"))).toBe(false);
  });

  it("release without creating the parent works when the parent pre-exists", () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, "pre"));
    const lockPath = path.join(dir, "pre", ".lock");
    const lock = acquireRepoLock(lockPath, "test", { waitMs: 200, pollMs: 10 });
    lock.release();
    expect(existsSync(path.join(dir, "pre"))).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });
});

describe("stale lock that cannot be removed fails closed (F5 — no infinite loop)", () => {
  it("a stale DIRECTORY at the lock path returns an error promptly, never hangs", () => {
    const dir = tempDir();
    const lockDir = path.join(dir, ".arte-git-card");
    const lockPath = path.join(lockDir, ".lock");
    // .lock occupied by a DIRECTORY: unreadable holder + old-mtime-stale policy
    mkdirSync(lockPath, { recursive: true });
    const started = Date.now();
    expect(() => acquireRepoLock(lockPath, "test", { staleMs: -1, waitMs: 5000 })).toThrow(/could not be removed|manually/i);
    expect(Date.now() - started).toBeLessThan(5000); // prompt — never spun until deadline
    expect(existsSync(lockPath)).toBe(true); // the directory is preserved, not deleted
  });
});
