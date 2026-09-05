/**
 * Transaction engine (P0). Multi-file applies are staged + journaled +
 * crash-recoverable (NOT filesystem-atomic). Pipeline:
 *   lock → prepare/validate in memory → stage each write to a temp sibling →
 *   write journal (commit point) → apply writes → deletes (only where the
 *   on-disk hash still matches) → write state.json LAST → clear journal.
 *
 * A crash leaves old or new bytes per file (atomic rename), never torn content;
 * the journal lets the next run converge. A failed ownership check refuses
 * before any change. Dry-run validates the whole plan with zero writes, no lock.
 */

import { lstatSync } from "node:fs";
import path from "node:path";
import { atomicRemove, commitStaged, normalizeLf, stageFile } from "../fs/atomic.js";
import type { StagedFile } from "../fs/atomic.js";
import { sha256Content, sha256File } from "../fs/hash.js";
import { resolveContained } from "../fs/pathguard.js";
import { assertStrictContained, acquireRepoLockAuthoritative } from "../fs/authority.js";
import type { LockOptions, RepoLock } from "../fs/lock.js";
import { buildJournal, inspectJournal, removeJournal, writeJournal } from "./journal.js";
import type { JournalOp } from "./journal.js";
import type { TxnPlan, Precondition } from "./plan.js";
import type { ManagedKind } from "./plan.js";
import { recoverJournal } from "./recover.js";
import type { GuardContext } from "./recover.js";

export class TxnError extends Error {}

export interface TxnOptions {
  repoRoot: string;
  command: string;
  /** default true; forced false for dry-run */
  acquireLock?: boolean;
  dryRun?: boolean;
  lockPath?: string;
  journalPath?: string;
  /** kind-specific path guard (Phase 2+) */
  guard?: (ctx: GuardContext) => boolean;
  /** auto-recover an orphaned journal before applying (default true) */
  recoverFirst?: boolean;
  lock?: LockOptions;
}

export type EffectMode = "create" | "replace";

export type Effect =
  | { type: "write"; rel: string; kind: ManagedKind; mode: EffectMode }
  | { type: "delete"; rel: string; kind: ManagedKind }
  | { type: "state"; rel: string };

export interface TxnResult {
  effects: Effect[];
}

interface PreparedWrite {
  rel: string;
  abs: string;
  kind: ManagedKind;
  mode: EffectMode;
  beforeSha256: string | null;
  afterSha256: string;
  staged: StagedFile | null;
}

interface PreparedDelete {
  rel: string;
  abs: string;
  kind: ManagedKind;
  expectedSha256: string;
  missing: boolean;
}

function guardPath(opts: TxnOptions, kind: ManagedKind, rel: string): void {
  if (opts.guard && !opts.guard({ kind, rel })) {
    throw new TxnError(`path is not managed by arte-gitcard: ${rel}`);
  }
}

function prepareWrite(repoRoot: string, opts: TxnOptions, dryRun: boolean, stagingToClean: string[], writes: PreparedWrite[], w: TxnPlan["writes"][number]): void {
  guardPath(opts, w.kind, w.rel);
  const abs = resolveContained(repoRoot, w.rel);
  if (!abs || abs !== path.resolve(w.abs)) {
    throw new TxnError(`unsafe or inconsistent write path: ${w.rel}`);
  }
  // STRICT no-symlink authority BEFORE any sha read or staging through the path.
  assertStrictContained(repoRoot, w.rel);
  assertExpectedBefore(repoRoot, w);
  const beforeSha256 = sha256File(abs);
  const mode: EffectMode = beforeSha256 === null ? "create" : "replace";
  const afterSha256 = sha256Content(normalizeLf(w.content));
  // True no-op: target already holds exactly the bytes this write would place
  // (engine LF-normalizes every staged write). Skip staging/apply — no mtime
  // change, no stage file, no "wrote" effect.
  if (mode === "replace" && beforeSha256 === afterSha256) {
    return;
  }
  let staged: StagedFile | null = null;
  if (!dryRun) {
    staged = stageFile(abs, w.content);
    stagingToClean.push(staged.stagingAbs);
  }
  writes.push({ rel: w.rel, abs, kind: w.kind, mode, beforeSha256, afterSha256, staged });
}

function prepareDelete(repoRoot: string, opts: TxnOptions, d: TxnPlan["deletes"][number]): PreparedDelete {
  guardPath(opts, d.kind, d.rel);
  const abs = resolveContained(repoRoot, d.rel);
  if (!abs || abs !== path.resolve(d.abs)) {
    throw new TxnError(`unsafe or inconsistent delete path: ${d.rel}`);
  }
  // STRICT no-symlink authority BEFORE reading the target (P0-1).
  assertStrictContained(repoRoot, d.rel);
  let st;
  try {
    st = lstatSync(abs);
  } catch (err) {
    // ONLY a true ENOENT means the target is already gone (idempotent). An
    // unreadable existing target is NOT missing — fail closed, never delete.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { rel: d.rel, abs, kind: d.kind, expectedSha256: d.expectedSha256, missing: true };
    throw new TxnError(`cannot delete ${d.rel}: the target exists but could not be verified (preserving).`);
  }
  // symlink / directory / FIFO / socket / device / any non-regular → preserve.
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new TxnError(`refusing to delete a non-regular file (preserving): ${d.rel}`);
  }
  const cur = sha256File(abs);
  if (cur === null) {
    throw new TxnError(`cannot delete ${d.rel}: the file exists but could not be read/verified (preserving).`);
  }
  if (cur !== d.expectedSha256) {
    throw new TxnError(
      `cannot delete ${d.rel}: file no longer matches the arte-gitcard-managed hash (preserving). ` +
        `It was probably modified after generation.`,
    );
  }
  return { rel: d.rel, abs, kind: d.kind, expectedSha256: d.expectedSha256, missing: false };
}

function toRepoRel(repoRoot: string, abs: string): string {
  return path.relative(repoRoot, abs).split(path.sep).join("/");
}

/** Verify a write's expected-before under the lock, BEFORE staging (zero mutation on mismatch). */
function assertExpectedBefore(repoRoot: string, w: TxnPlan["writes"][number]): void {
  if (!w.expectedBefore) return; // manager policy: no expectation (e.g. explicit regeneration)
  const abs = resolveContained(repoRoot, w.rel);
  if (!abs) throw new TxnError(`unsafe write path: ${w.rel}`);
  if (w.expectedBefore.kind === "absent") {
    let exists = false;
    try {
      lstatSync(abs);
      exists = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        throw new TxnError(`cannot verify write target ${w.rel} (fail closed, preserving).`);
      }
    }
    if (exists) {
      throw new TxnError(
        `${w.rel} appeared after planning (expected absent) — preserved, not overwritten. Retry the command.`,
      );
    }
    return;
  }
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    throw new TxnError(`${w.rel} is missing though it was expected present — preserved (changed concurrently).`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new TxnError(`${w.rel} is not a regular file — preserved, not overwritten (changed concurrently).`);
  }
  const cur = sha256File(abs);
  if (cur === null) {
    throw new TxnError(`cannot verify write target ${w.rel} (fail closed, preserving).`);
  }
  if (cur !== w.expectedBefore.sha256) {
    throw new TxnError(`${w.rel} changed after planning — preserved, not overwritten. Retry the command.`);
  }
}

function concurrentError(rel: string, detail: string): never {
  throw new TxnError(
    `${rel} changed concurrently (${detail}) — no changes were made. Retry the command.`,
  );
}

/**
 * Optimistic precondition verification. Runs AFTER the repo lock is acquired and
 * journal recovery has completed, BEFORE staging/writing/deleting anything.
 *   - sha256: the target must be a regular file whose current hash matches the
 *     observed value (absent / non-regular / unreadable ⇒ fail closed, never "absent");
 *   - absent: the target must be positively ENOENT (unverifiable ⇒ fail closed).
 * A mismatch is a concurrent writer: zero mutation + actionable retry message.
 */
function verifyPrecondition(repoRoot: string, pc: Precondition): void {
  // Strict authority: an expected-sha / absence on a symlinked path is never
  // verifiable and must fail closed BEFORE any mutation.
  try {
    assertStrictContained(repoRoot, pc.rel);
  } catch (err) {
    throw new TxnError(`precondition path is unsafe: ${(err as Error).message}`);
  }
  const abs = resolveContained(repoRoot, pc.rel)!;
  if (pc.kind === "sha256") {
    let st;
    try {
      st = lstatSync(abs);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") concurrentError(pc.rel, "file is absent");
      throw new TxnError(`cannot verify ${pc.rel}: the target exists but could not be read (fail closed, preserving).`);
    }
    if (st.isSymbolicLink() || !st.isFile()) {
      throw new TxnError(`cannot verify ${pc.rel}: the target is not a regular file (fail closed, preserving).`);
    }
    const cur = sha256File(abs);
    if (cur === null) {
      throw new TxnError(`cannot verify ${pc.rel}: the file exists but could not be hashed (fail closed, preserving).`);
    }
    if (cur !== pc.expectedSha256) concurrentError(pc.rel, "hash mismatch");
    return;
  }
  // expected absence
  try {
    lstatSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return; // positively absent
    throw new TxnError(`cannot verify ${pc.rel}: absence could not be established (fail closed, preserving).`);
  }
  concurrentError(pc.rel, "target now exists");
}

/** Apply-time write preflight (P0 TOCTOU): re-run guard + containment + parent symlink checks. */
function assertWritableNow(opts: TxnOptions, w: PreparedWrite): void {
  guardPath(opts, w.kind, w.rel);
  const abs = resolveContained(opts.repoRoot, w.rel);
  if (!abs || abs !== path.resolve(w.abs)) {
    throw new TxnError(`write target changed or is unsafe at apply time: ${w.rel}`);
  }
  try {
    assertStrictContained(opts.repoRoot, w.rel);
  } catch (err) {
    throw new TxnError(`write target path became unsafe (symlink/junction component) at apply time: ${w.rel} (${(err as Error).message})`);
  }
  if (!w.staged) throw new TxnError(`staging missing at apply time for ${w.rel}`);
  let st;
  try {
    st = lstatSync(w.staged.stagingAbs);
  } catch {
    throw new TxnError(`staging file vanished at apply time for ${w.rel}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new TxnError(`staging file is no longer a regular file at apply time for ${w.rel}`);
  }
  // A non-cooperating editor must never be silently overwritten between prepare
  // and rename: the FINAL target must still be in the before-state observed
  // during transaction prepare (create ⇒ still absent; replace ⇒ same hash).
  if (w.mode === "create") {
    let exists = false;
    try {
      lstatSync(w.abs);
      exists = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        throw new TxnError(`cannot verify write target ${w.rel} at apply time (fail closed, preserving).`);
      }
    }
    if (exists) {
      throw new TxnError(`write race: ${w.rel} appeared between prepare and apply (preserving). Retry the command.`);
    }
  } else if (sha256File(w.abs) !== w.beforeSha256) {
    throw new TxnError(
      `write race: ${w.rel} changed between prepare and apply (preserving). ` +
        `It was not silently overwritten. Run "arte-gitcard doctor" to inspect.`,
    );
  }
}

/** Apply-time delete preflight (P0 TOCTOU): guard + containment + fresh hash proof. */
function assertDeletableNow(opts: TxnOptions, d: PreparedDelete): void {
  guardPath(opts, d.kind, d.rel);
  const abs = resolveContained(opts.repoRoot, d.rel);
  if (!abs || abs !== path.resolve(d.abs)) {
    throw new TxnError(`delete target changed or is unsafe at apply time: ${d.rel}`);
  }
  try {
    assertStrictContained(opts.repoRoot, d.rel);
  } catch (err) {
    throw new TxnError(`delete target became unsafe (symlink/junction component) at apply time: ${d.rel} (${(err as Error).message})`);
  }
  if (sha256File(d.abs) !== d.expectedSha256) {
    throw new TxnError(
      `delete race: ${d.rel} changed between prepare and apply (preserving). ` +
        `Run "arte-gitcard doctor" to inspect.`,
    );
  }
}

export function runTransaction(plan: TxnPlan, opts: TxnOptions): TxnResult {
  const repoRoot = path.resolve(opts.repoRoot);
  const dryRun = opts.dryRun === true;
  const acquire = !dryRun && opts.acquireLock !== false;
  const lockPath = opts.lockPath ?? path.join(repoRoot, ".arte-git-card", ".lock");
  const journalPath = opts.journalPath ?? path.join(repoRoot, ".arte-git-card", "txn.json");

  let lock: RepoLock | null = null;
  if (acquire) {
    // The lock/journal live under `.arte-git-card`: never establish them through
    // a redirected (symlinked) control directory.
    lock = acquireRepoLockAuthoritative(repoRoot, lockPath, opts.command, opts.lock);
  }

  // The lock is held from here on: recovery AND the whole mutation run inside
  // ONE try/finally so that a recovery throw can never leak the lock.
  try {
    // Recovery MUST run under the lock (it mutates the repo).
    if (lock && opts.recoverFirst !== false) {
      const inspection = inspectJournal(journalPath, repoRoot);
      if (inspection.present) {
        if (inspection.state !== "clean") {
          // A present-but-corrupt / incompatible / mismatched journal is
          // untrusted evidence: fail closed, PRESERVE it, never overwrite it.
          throw new TxnError(
            `An existing transaction journal at ${journalPath} is ${inspection.state} and cannot be ` +
              `safely verified or recovered. It was PRESERVED as evidence — arte-gitcard will not ` +
              `overwrite it. Inspect it (or remove it) manually, or run "arte-gitcard doctor".`,
          );
        }
        const result = recoverJournal(repoRoot, {
          repoRoot,
          journalPath,
          guard: opts.guard,
        });
        if (result.preserved.length > 0) {
          throw new TxnError(
            `Interrupted transaction could not be recovered safely. User changes detected — preserved paths:\n` +
              result.preserved.map((p) => `  ${p}`).join("\n") +
              `\nRun "arte-gitcard doctor" for details before retrying.`,
          );
        }
      }
    }

    // Preconditions are verified AFTER lock + recovery, BEFORE any mutation,
    // closing the read-modify-write gap: a stale plan fails here instead of
    // silently overwriting a concurrent write.
    for (const pc of plan.preconditions ?? []) {
      verifyPrecondition(repoRoot, pc);
    }

    const writes: PreparedWrite[] = [];
    const stagingToClean: string[] = [];
    const deletes: PreparedDelete[] = [];

    try {
      for (const w of plan.writes) {
        prepareWrite(repoRoot, opts, dryRun, stagingToClean, writes, w);
      }
      if (plan.stateJson) {
        prepareWrite(repoRoot, opts, dryRun, stagingToClean, writes, {
          rel: plan.stateJson.rel,
          abs: path.join(repoRoot, plan.stateJson.rel),
          content: plan.stateJson.content,
          kind: "state",
        });
      }
      for (const d of plan.deletes) {
        deletes.push(prepareDelete(repoRoot, opts, d));
      }
    } catch (err) {
      for (const s of stagingToClean) {
        try {
          atomicRemove(s);
        } catch {
          /* best-effort */
        }
      }
      throw err;
    }

    const effects: Effect[] = [];
    for (const w of writes) {
      if (w.kind === "state") continue;
      effects.push({ type: "write", rel: w.rel, kind: w.kind, mode: w.mode });
    }
    for (const d of deletes) {
      if (!d.missing) effects.push({ type: "delete", rel: d.rel, kind: d.kind });
    }
    // The state effect is emitted only when the state write was actually prepared
    // (an identical state.json is a no-op and yields no effect).
    if (plan.stateJson && writes.some((w) => w.kind === "state")) {
      effects.push({ type: "state", rel: plan.stateJson.rel });
    }
    if (dryRun) return { effects };

    // ---- Journal (commit point) ----
    const journalOps: JournalOp[] = [];
    for (const w of writes) {
      if (w.kind === "state") continue;
      journalOps.push(opToJournal(repoRoot, w, "write"));
    }
    for (const d of deletes) {
      if (d.missing) continue;
      journalOps.push({
        kind: d.kind,
        rel: d.rel,
        op: "delete",
        beforeSha256: d.expectedSha256,
        afterSha256: null,
        stagingRel: null,
        stagingSha256: null,
      });
    }
    for (const w of writes) {
      if (w.kind !== "state") continue;
      journalOps.push(opToJournal(repoRoot, w, "state"));
    }
    if (journalOps.length > 0) {
      writeJournal(journalPath, buildJournal(repoRoot, journalOps));
    }

    // ---- Apply: writes → deletes → state.json last ----
    // Apply-time TOCTOU hardening (P0): immediately before each commit/unlink,
    // re-run the kind guard + containment + parent-symlink checks and re-verify
    // the staging file is a regular non-symlink sibling. A residual same-instant
    // swap race cannot be fully eliminated in Node — documented residual risk;
    // "the path is managed" is never sufficient on its own.
    // If a concurrent-change failure happens BEFORE any final op applied, clean
    // THIS txn's own staging + journal (retryable). If ≥1 op applied, PRESERVE
    // the journal for crash recovery.
    let appliedAny = false;
    try {
      for (const w of writes) {
        if (w.kind === "state") continue;
        assertWritableNow(opts, w);
        commitStaged(w.staged!.stagingAbs, w.abs);
        appliedAny = true;
      }
      for (const d of deletes) {
        if (d.missing) continue;
        assertDeletableNow(opts, d);
        atomicRemove(d.abs);
        appliedAny = true;
      }
      for (const w of writes) {
        if (w.kind !== "state") continue;
        assertWritableNow(opts, w);
        commitStaged(w.staged!.stagingAbs, w.abs);
        appliedAny = true;
      }
    } catch (err) {
      if (!appliedAny) {
        for (const s of stagingToClean) {
          try {
            atomicRemove(s);
          } catch {
            /* best-effort */
          }
        }
        try {
          removeJournal(journalPath);
        } catch {
          /* best-effort */
        }
      }
      throw err;
    }

    removeJournal(journalPath);
    return { effects };
  } finally {
    if (lock) lock.release();
  }
}

function opToJournal(repoRoot: string, w: PreparedWrite, op: "write" | "state"): JournalOp {
  return {
    kind: w.kind,
    rel: w.rel,
    op,
    beforeSha256: w.beforeSha256,
    afterSha256: w.afterSha256,
    stagingRel: w.staged ? toRepoRel(repoRoot, w.staged.stagingAbs) : null,
    stagingSha256: w.staged ? w.staged.sha256 : null,
  };
}
