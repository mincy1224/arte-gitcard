/**
 * Uninstall-tail journal classifier (U-1). A real uninstall is journaled as a
 * DELETE-ONLY plan (exact managed deletes in apply order) ending with
 * `state.json` LAST. After a crash the config may be gone, so recovery cannot
 * re-derive output-directory authority — it may only act on a journal it can
 * STRUCTURALLY prove is an uninstall delete-only tail, and even then never
 * re-delete card/workflow/theme paths on journal evidence alone.
 *
 * The journal is UNTRUSTED: this classifier only answers "does this look like an
 * uninstall tail?" — it never grants deletion authority. Actual recovery
 * (lifecycle/uninstall.ts) still requires the target to be absent, or to be the
 * fixed, unchanged `.arte-git-card/state.json` regular file.
 */
import { CONFIG_FILENAME } from "../config/paths.js";
import { STATE_REL } from "../managed/paths.js";
import type { JournalOp } from "../txn/journal.js";

const MANAGED_DELETE_KINDS = new Set(["card", "preview", "workflow", "ci-action", "ci-runtime", "theme"]);

/**
 * True when `ops` is structurally consistent with an uninstall delete tail:
 *   - every op is a `delete` (no write / state-write / unexpected mutation);
 *   - `.arte-git-card/state.json` is the LAST op (kind `state`);
 *   - `arte-gitcard.yml` appears exactly once as a `config` delete;
 *   - every other op is a managed generated/theme delete;
 *   - no op other than the final one touches the state path.
 */
export function isUninstallTailJournal(journal: { ops: readonly JournalOp[] }): boolean {
  const ops = journal.ops;
  if (!Array.isArray(ops) || ops.length === 0) return false;
  const last = ops[ops.length - 1];
  if (!last || last.op !== "delete" || last.kind !== "state" || last.rel !== STATE_REL) return false;

  let configSeen = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.op !== "delete") return false; // uninstall is delete-only
    if (op.rel === CONFIG_FILENAME) {
      if (op.kind !== "config") return false;
      configSeen++;
    } else if (op.rel === STATE_REL) {
      if (i !== ops.length - 1 || op.kind !== "state") return false; // state is only ever LAST
    } else if (!MANAGED_DELETE_KINDS.has(op.kind)) {
      return false; // an unexpected path/kind is not an uninstall tail
    }
  }
  return configSeen === 1;
}
