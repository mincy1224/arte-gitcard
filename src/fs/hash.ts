/** SHA-256 helpers for ownership proofs and journal verification. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256Content(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** sha256 of a file on disk; null when the file does not exist or cannot be read. */
export function sha256File(abs: string): string | null {
  try {
    return sha256Content(readFileSync(abs));
  } catch {
    return null;
  }
}
