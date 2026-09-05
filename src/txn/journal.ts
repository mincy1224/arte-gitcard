/**
 * Transaction journal (P0). Written ATOMICALLY immediately before the first
 * visible change (the commit point) and removed after state.json is written.
 * Journal content is UNTRUSTED persisted data — recovery re-runs path guards
 * and re-verifies every hash against the current disk before acting. Each op
 * records kind, the validated relative path, expected before/after hashes, and
 * staging metadata so recovery never needs to re-derive the desired state.
 */

import { randomBytes } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "../fs/atomic.js";
import { atomicRemove } from "../fs/atomic.js";

export interface JournalOp {
  kind: string;
  rel: string;
  op: "write" | "delete" | "state";
  /** hash of the final target before apply (null = file was missing) */
  beforeSha256: string | null;
  /** hash the final target should have after apply (null for deletes) */
  afterSha256: string | null;
  /** repo-relative staging path (write/state ops) */
  stagingRel: string | null;
  /** hash of the staging file — must equal afterSha256 for a valid staged write */
  stagingSha256: string | null;
}

export interface TxnJournal {
  schemaVersion: 1;
  id: string;
  repoRoot: string;
  ops: JournalOp[];
}

export function buildJournal(repoRoot: string, ops: JournalOp[]): TxnJournal {
  return { schemaVersion: 1, id: randomBytes(8).toString("hex"), repoRoot, ops };
}

export function writeJournal(journalPath: string, journal: TxnJournal): void {
  writeFileAtomic(journalPath, JSON.stringify(journal, null, 2) + "\n");
}

const JOURNAL_SCHEMA_VERSION = 1;
const JOURNAL_OPS = new Set(["write", "delete", "state"]);

/** Structural (top-level) parse. Returns null when absent OR not parseable as a journal object. */
function parseJournalTop(raw: string): TxnJournal | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TxnJournal>;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.schemaVersion === JOURNAL_SCHEMA_VERSION &&
      typeof parsed.repoRoot === "string" &&
      Array.isArray(parsed.ops)
    ) {
      return parsed as TxnJournal;
    }
  } catch {
    /* corrupt */
  }
  return null;
}

/** Per-op shape validation. A journal with malformed ops is untrustworthy → incompatible. */
function validJournalOps(ops: unknown): ops is JournalOp[] {
  if (!Array.isArray(ops)) return false;
  for (const op of ops) {
    if (!op || typeof op !== "object") return false;
    const o = op as Record<string, unknown>;
    if (typeof o.kind !== "string") return false;
    if (typeof o.rel !== "string") return false;
    if (typeof o.op !== "string" || !JOURNAL_OPS.has(o.op)) return false;
    for (const k of ["beforeSha256", "afterSha256", "stagingRel", "stagingSha256"]) {
      const v = o[k];
      if (v !== null && typeof v !== "string") return false; // undefined/missing also rejected
    }
  }
  return true;
}

/**
 * Journal inspection that distinguishes "file absent" from every kind of
 * "file present but not safely recoverable". A present-but-corrupt /
 * incompatible / mismatched journal MUST be treated as fail-closed evidence —
 * never overwritten, never silently ignored.
 *
 *   corrupt      → file exists but is not parseable as a journal object;
 *   incompatible → parseable but schemaVersion/op structure is not supported;
 *   mismatch     → structurally valid but repoRoot differs from the expected root;
 *   unreadable   → an entry exists but is NOT a readable regular non-symlink file
 *                  (directory / symlink / EACCES / other non-ENOENT error). It is
 *                  never treated as absent.
 */
export type JournalInspection =
  | { present: false }
  | { present: true; state: "clean" }
  | { present: true; state: "corrupt" }
  | { present: true; state: "incompatible" }
  | { present: true; state: "mismatch" }
  | { present: true; state: "unreadable" };

export function inspectJournal(journalPath: string, expectedRepoRoot?: string): JournalInspection {
  // ONLY a true ENOENT means "no journal". Any other lstat error (EACCES on the
  // parent, ENOTDIR because a path component is a file, …) is an unverifiable
  // present entry → fail closed.
  let st;
  try {
    st = lstatSync(journalPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { present: false };
    return { present: true, state: "unreadable" };
  }
  // The journal path itself must be a regular, non-symlink file to be recoverable.
  if (st.isSymbolicLink() || !st.isFile()) return { present: true, state: "unreadable" };
  let raw: string;
  try {
    raw = readFileSync(journalPath, "utf8");
  } catch {
    return { present: true, state: "unreadable" };
  }
  const parsed = parseJournalTop(raw);
  if (!parsed) return { present: true, state: "corrupt" };
  if (!validJournalOps(parsed.ops)) return { present: true, state: "incompatible" };
  if (expectedRepoRoot !== undefined && path.resolve(parsed.repoRoot) !== path.resolve(expectedRepoRoot)) {
    return { present: true, state: "mismatch" };
  }
  return { present: true, state: "clean" };
}

/**
 * Read + structurally validate a journal. Returns null when absent, corrupt, or
 * top-level-incompatible. NOTE: does NOT distinguish "missing" from
 * "present but unreadable/unparsable" — use `inspectJournal` when that
 * distinction drives a fail-closed decision.
 */
export function readJournal(journalPath: string): TxnJournal | null {
  let raw: string;
  try {
    raw = readFileSync(journalPath, "utf8");
  } catch {
    return null;
  }
  return parseJournalTop(raw);
}

export function removeJournal(journalPath: string): void {
  atomicRemove(journalPath);
}
