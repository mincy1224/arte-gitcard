/**
 * INTERNAL legacy seam (FC-3): hands a DeepReadonly statistics result (or the
 * readonly DisplayContext theme) to a TRUSTED byte-locked legacy consumer whose
 * historical types are mutable but which only reads. New Displays MUST NOT
 * import this module (architecture-tested). Allowed users are the existing
 * Codebase/Structure legacy presenters and built-ins calling mutable-typed
 * legacy analyzers. Returns the SAME object — never cloned/recomputed.
 */

import type { DeepReadonly } from "../util/readonly.js";

export function legacyView<T>(value: DeepReadonly<T>): T {
  return value as unknown as T;
}
