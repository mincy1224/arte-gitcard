/**
 * Optimistic read-set helpers (transaction-concurrency closure).
 *
 * Config/state are loaded and plans built BEFORE runTransaction takes the repo
 * lock, so two mutations can each build stale plans and apply sequentially. Any
 * mutation deriving its plan from a source must assert the OBSERVED source bytes
 * as preconditions (verified under the lock) so the stale second op fails with a
 * retry instead of overwriting the first. A manager NEVER re-reads a source to
 * manufacture a later hash — it pins the exact snapshot it consumed, or builds
 * the precondition inline from bytes read once at plan time.
 */

import { CONFIG_FILENAME } from "../config/paths.js";
import { STATE_REL } from "../managed/paths.js";
import type { Precondition } from "./plan.js";
import type { LoadedConfig } from "../config/types.js";

/**
 * Config precondition derived from the EXACT bytes a LoadedConfig parsed — never
 * a re-read. Absent for in-memory/fabricated configs (nothing to pin).
 */
export function configSourcePrecondition(loaded: LoadedConfig): Precondition[] {
  return loaded.sourceSha256
    ? [{ kind: "sha256", rel: CONFIG_FILENAME, expectedSha256: loaded.sourceSha256 }]
    : [];
}

/** State precondition derived from the StateRead a manager actually consumed. */
export function stateSourcePrecondition(stateRead: {
  status: "ok";
  sha256: string;
}): Precondition {
  return { kind: "sha256", rel: STATE_REL, expectedSha256: stateRead.sha256 };
}
