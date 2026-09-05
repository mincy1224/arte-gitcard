/**
 * Transaction plan types (P0). A mutation builds the complete desired state in
 * memory first: the exact writes, the exact deletes (each carrying its expected
 * on-disk sha256 as the ownership proof), and the new state.json content that is
 * written LAST. Paths are repo-relative POSIX; absolute paths are derived by the
 * engine through containment guards.
 */

export type ManagedKind =
  | "config"
  | "card"
  | "preview"
  | "workflow"
  | "ci-action"
  | "ci-runtime"
  | "theme"
  | "state"
  | "structure-descriptions";

/** Plan-time expected BEFORE state of a write target (checked under the lock
 * before staging). A manager sets this from its own preflight observation so a
 * user file that appears/edits after preflight is preserved, never silently
 * converted from an expected create into a replace. Leave UNSET when the
 * operation deliberately reclaims owned content (e.g. regenerate). */
export type ExpectedBefore = { kind: "absent" } | { kind: "sha256"; sha256: string };

export interface WriteOp {
  rel: string;
  abs: string;
  content: string;
  kind: ManagedKind;
  /** Optional observed before-state to assert under the lock before staging. */
  expectedBefore?: ExpectedBefore;
}

export interface DeleteOp {
  rel: string;
  abs: string;
  kind: ManagedKind;
  /** sha256 we believe is currently on disk (ownership proof). Delete only if it still matches. */
  expectedSha256: string;
}

/**
 * Optimistic precondition (default-branch pass). The repo lock is acquired
 * INSIDE runTransaction, after callers have already loaded data and built a
 * plan — so the lock alone does NOT protect a read-modify-write. A plan may
 * assert the observed before-state of a target (expected regular-file SHA-256,
 * or expected ABSENCE); the engine verifies every precondition AFTER acquiring
 * the lock and completing journal recovery, BEFORE staging/writing/deleting
 * anything. A mismatch means a concurrent writer moved the file — fail with
 * ZERO mutation and an actionable "changed concurrently; retry" error.
 */
export type Precondition = { kind: "sha256"; rel: string; expectedSha256: string } | { kind: "absent"; rel: string };

export interface TxnPlan {
  writes: WriteOp[];
  deletes: DeleteOp[];
  /** Desired state.json content, written LAST. */
  stateJson: { rel: string; content: string } | null;
  /** Optimistic before-state assertions verified after lock+recovery (optional). */
  preconditions?: Precondition[];
}

export function emptyPlan(): TxnPlan {
  return { writes: [], deletes: [], stateJson: null, preconditions: [] };
}
