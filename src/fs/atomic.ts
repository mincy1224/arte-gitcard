/**
 * Single-file atomic writes: stage a temp file in the target's own directory
 * (same volume → `renameSync` is atomic), then rename over the target. Windows
 * transient EPERM/EACCES/EBUSY (AV scan / file-in-use) is retried a few times;
 * never fall back to unlink-first.
 */

import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { sha256Content } from "./hash.js";

export function normalizeLf(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

/** arte-gitcard transaction temp filename policy: `.agc-<pid>-<12-hex>`. */
export const AGC_TEMP_NAME_RE = /^\.agc-\d+-[0-9a-f]{12}$/;
export function isAgcTempName(basename: string): boolean {
  return AGC_TEMP_NAME_RE.test(basename);
}

/**
 * SHA-256 of the EXACT bytes a transaction write will place on disk: engine
 * writes are LF-normalized (`normalizeLf`) before staging, so an ownership
 * entry must hash those canonical bytes, never the pre-normalization source.
 */
export function sha256WrittenContent(content: string): string {
  return sha256Content(normalizeLf(content));
}

export interface StagedFile {
  stagingAbs: string;
  sha256: string;
}

/** Write `content` to a temp sibling of `targetAbs`. Returns staging path + content hash. */
export function stageFile(targetAbs: string, content: string): StagedFile {
  mkdirSync(path.dirname(targetAbs), { recursive: true });
  const stagingAbs = path.join(
    path.dirname(targetAbs),
    `.agc-${process.pid}-${randomBytes(6).toString("hex")}`,
  );
  const lf = normalizeLf(content);
  writeFileSync(stagingAbs, lf, { encoding: "utf8" });
  return { stagingAbs, sha256: sha256Content(lf) };
}

export function commitStaged(stagingAbs: string, targetAbs: string): void {
  renameWithRetry(stagingAbs, targetAbs);
}

/** Single-file atomic write (stage + rename). Cleans staging on failure. */
export function writeFileAtomic(abs: string, content: string): void {
  const staged = stageFile(abs, content);
  try {
    commitStaged(staged.stagingAbs, abs);
  } catch (err) {
    try {
      unlinkSync(staged.stagingAbs);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

function renameWithRetry(src: string, dest: string): void {
  const attempts = 3;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      renameSync(src, dest);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      const transient = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      if (!transient || i === attempts - 1) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw lastErr;
}

/** Remove a single file; missing file is a no-op (idempotent). */
export function atomicRemove(abs: string): void {
  try {
    unlinkSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return;
    throw err;
  }
}
