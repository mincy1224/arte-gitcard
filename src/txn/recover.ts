/**
 * Crash recovery (P0). A txn that crashed between the journal commit point and
 * journal clear is completed or abandoned from CURRENT disk state — the journal
 * (both relPath and stagingRel) is UNTRUSTED.
 *
 * Final path: already == afterSha256 → done; a write continues only if the final
 * is still beforeSha256/missing; a delete only if the file still equals
 * beforeSha256; any user modification meanwhile → STOP and PRESERVE.
 *
 * Staging path (as untrusted as relPath): must pass INDEPENDENT validation —
 * repo-contained, a sibling of the final target with the arte-gitcard temp
 * basename, a regular non-symlink file (no symlink/junction ancestor), and
 * content hashing to afterSha256. Completion READS staging content and writes
 * the final via writeFileAtomic — NEVER rename(staging, final) — so a journal
 * pointing at a user file can never move it. Staging is unlinked only when
 * PROVEN to be a transaction temp; otherwise it is preserved.
 *
 * Recovery re-acquires the repo lock and re-runs kind guards + containment on
 * every op — a formal foundational capability, not optional hardening.
 */

import path from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import { atomicRemove, isAgcTempName, writeFileAtomic } from "../fs/atomic.js";
import { resolveContained } from "../fs/pathguard.js";
import { assertStrictContained } from "../fs/authority.js";
import { sha256Content, sha256File } from "../fs/hash.js";
import { acquireRepoLockAuthoritative } from "../fs/authority.js";
import type { LockOptions } from "../fs/lock.js";
import { inspectJournal, readJournal, removeJournal } from "./journal.js";

export interface GuardContext {
  kind: string;
  rel: string;
}

export interface RecoverOptions {
  /** used only for cross-checking journal.repoRoot; positional repoRoot is authoritative */
  repoRoot?: string;
  lockPath?: string;
  journalPath?: string;
  /** kind-specific path guard (Phase 2+) */
  guard?: (ctx: GuardContext) => boolean;
  lock?: LockOptions;
}

export interface RecoverResult {
  recovered: boolean;
  preserved: string[];
  journalPresent: boolean;
}

interface ValidStaged {
  abs: string;
}

/**
 * Independent staging validation. Returns null when the journal's stagingRel is
 * not something arte-gitcard may move content from: it must be a repo-contained,
 * regular, non-symlink file that is a SIBLING of the final target with the
 * arte-gitcard transaction temp basename — and its content must hash to
 * `afterSha256`.
 */
function validateStaged(
  repoRoot: string,
  finalAbs: string,
  stagingRel: string,
  afterSha256: string,
): ValidStaged | null {
  if (!resolveContained(repoRoot, stagingRel)) return null;
  try {
    assertStrictContained(repoRoot, stagingRel);
  } catch {
    return null; // staging path traverses a symlink/junction → never act on it
  }
  const stagingAbs = path.resolve(repoRoot, stagingRel);
  if (path.dirname(stagingAbs) !== path.dirname(finalAbs)) return null; // must be a sibling temp
  if (!isAgcTempName(path.basename(stagingAbs))) return null; // temp naming policy
  let st;
  try {
    st = lstatSync(stagingAbs);
  } catch {
    return null;
  }
  if (st.isSymbolicLink() || !st.isFile()) return null; // regular file, not a symlink/dir
  if (sha256File(stagingAbs) !== afterSha256) return null;
  return { abs: stagingAbs };
}

type DiskProbe =
  | { kind: "absent" }
  | { kind: "file"; sha: string }
  | { kind: "unreadable" };

/**
 * Tri-state disk probe for a journal op target (P0). Only a true ENOENT is
 * "absent"; a directory / symlink / FIFO / other non-regular, or a regular file
 * whose read/hash fails, is "unreadable" — recovery must NEVER treat it as
 * "already gone" (that would silently drop a delete, or overwrite a user file).
 */
function probeDisk(abs: string): DiskProbe {
  let st;
  try {
    st = lstatSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === "ENOENT" ? { kind: "absent" } : { kind: "unreadable" };
  }
  if (st.isSymbolicLink() || !st.isFile()) return { kind: "unreadable" };
  const sha = sha256File(abs);
  return sha === null ? { kind: "unreadable" } : { kind: "file", sha };
}

/** Recover assuming the lock is already held (used by runTransaction). */
export function recoverJournal(repoRoot: string, opts: RecoverOptions = {}): RecoverResult {
  const journalPath = opts.journalPath ?? path.join(repoRoot, ".arte-git-card", "txn.json");
  const inspection = inspectJournal(journalPath, repoRoot);
  if (!inspection.present) return { recovered: false, preserved: [], journalPresent: false };
  if (inspection.state !== "clean") {
    // A present-but-corrupt / incompatible / mismatched journal is untrusted
    // evidence: never act on it, never remove it, never overwrite it.
    return { recovered: false, preserved: [], journalPresent: true };
  }
  const journal = readJournal(journalPath)!;

  const preserved: string[] = [];

  for (const op of journal.ops) {
    const abs = resolveContained(repoRoot, op.rel);
    if (!abs) {
      preserved.push(op.rel);
      break;
    }
    if (opts.guard && !opts.guard({ kind: op.kind, rel: op.rel })) {
      preserved.push(op.rel);
      break;
    }
    try {
      assertStrictContained(repoRoot, op.rel);
    } catch {
      preserved.push(op.rel); // any symlink/junction component → never act
      break;
    }
    const probe = probeDisk(abs);
    if (probe.kind === "unreadable") {
      // An existing-but-unreadable / non-regular target is NEVER "already gone":
      // never overwrite it, never delete it, never drop it silently.
      preserved.push(op.rel);
      break;
    }
    const current = probe.kind === "absent" ? null : probe.sha;

    if (op.op === "write" || op.op === "state") {
      if (current === op.afterSha256) continue; // already applied
      const finalStillBefore =
        current === op.beforeSha256 || (op.beforeSha256 === null && current === null);
      if (finalStillBefore && op.stagingRel && op.afterSha256 !== null) {
        const staged = validateStaged(repoRoot, abs, op.stagingRel, op.afterSha256);
        if (staged) {
          // Read the (untrusted) staging content, re-verify, then write the final
          // through a controlled atomic write — never move the staging file itself.
          let content: string;
          try {
            content = readFileSync(staged.abs, "utf8");
          } catch {
            content = "";
          }
          if (sha256Content(content) === op.afterSha256) {
            writeFileAtomic(abs, content);
            // Staging was proven to be an arte-gitcard transaction temp → safe to clean.
            try {
              atomicRemove(staged.abs);
            } catch {
              /* best-effort */
            }
            continue;
          }
        }
      }
      // Staging invalid/gone or final changed → user interfered or unknown state.
      preserved.push(op.rel);
      break;
    } else {
      // delete
      if (current === null) continue; // already gone (idempotent)
      if (current === op.beforeSha256) {
        atomicRemove(abs);
        continue;
      }
      preserved.push(op.rel);
      break;
    }
  }

  if (preserved.length === 0) {
    removeJournal(journalPath);
    return { recovered: true, preserved: [], journalPresent: false };
  }
  return { recovered: true, preserved, journalPresent: true };
}

/** Public entry: re-acquire the lock (authority-safe), recover, release. */
export function recoverTransaction(repoRoot: string, opts: RecoverOptions = {}): RecoverResult {
  const lockPath = opts.lockPath ?? path.join(repoRoot, ".arte-git-card", ".lock");
  const lock = acquireRepoLockAuthoritative(repoRoot, lockPath, "recover", opts.lock);
  try {
    return recoverJournal(repoRoot, opts);
  } finally {
    lock.release();
  }
}
