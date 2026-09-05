/**
 * NEGATIVE fixture (never executed/registered): proves the architecture scanner
 * detects a forbidden `node:fs`/`node:child_process` import inside a `.tsx`
 * Display template. A real template may never import these.
 */

import { h } from "../../../../src/display/template/runtime.js";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export function BadTemplate(): ReturnType<typeof h> {
  return h("svg", null, String(readFileSync) + String(execFileSync));
}
