/**
 * Single-file atomic write primitives (Phase 0): temp-sibling + rename, LF
 * normalization, staging in the same directory, idempotent remove.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { atomicRemove, commitStaged, normalizeLf, stageFile, writeFileAtomic } from "../../src/fs/atomic.js";
import { sha256Content } from "../../src/fs/hash.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-atomic-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("fs/atomic", () => {
  it("writeFileAtomic writes LF-normalized content and leaves no temp files", () => {
    const dir = tempDir();
    const target = path.join(dir, "sub", "a.txt");
    writeFileAtomic(target, "line1\r\nline2\nline3");
    expect(readFileSync(target, "utf8")).toBe("line1\nline2\nline3");
    // no .agc-* leftovers in the target directory
    const leftovers = readdirSync(path.dirname(target)).filter((f) => f.startsWith(".agc-"));
    expect(leftovers).toHaveLength(0);
  });

  it("stageFile writes a temp sibling in the same directory with a content hash", () => {
    const dir = tempDir();
    const target = path.join(dir, "x.txt");
    const staged = stageFile(target, "hello\r\nworld");
    expect(path.dirname(staged.stagingAbs)).toBe(dir); // same volume → atomic rename
    expect(staged.sha256).toBe(sha256Content("hello\nworld"));
    expect(readFileSync(staged.stagingAbs, "utf8")).toBe("hello\nworld");
    commitStaged(staged.stagingAbs, target);
    expect(readFileSync(target, "utf8")).toBe("hello\nworld");
    expect(existsSync(staged.stagingAbs)).toBe(false);
  });

  it("atomicRemove is idempotent for missing files", () => {
    const dir = tempDir();
    const target = path.join(dir, "gone.txt");
    expect(() => atomicRemove(target)).not.toThrow();
    writeFileSync(target, "x");
    atomicRemove(target);
    expect(existsSync(target)).toBe(false);
  });

  it("normalizeLf only normalizes CRLF", () => {
    expect(normalizeLf("a\r\nb\nc\r\n")).toBe("a\nb\nc\n");
  });
});
