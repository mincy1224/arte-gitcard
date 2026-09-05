/**
 * Codebase analysis (plan.md §64): for each scanned file, sniff binary from
 * the first ~8 KiB (never reading a huge file into memory first), skip
 * binaries, detect language (name → ext → shebang → Other), lex, and aggregate
 * into per-language stats. `Effective = Σ language.effective` always holds.
 */

import { openSync, readSync, fstatSync, closeSync } from "node:fs";
import { isBinary } from "../scanner/binary.js";
import type { ScannedFile } from "../scanner/files.js";
import { detectByName, detectByShebang, OTHER_ID } from "../languages/detect.js";
import { countSourceFile } from "../languages/lexer.js";
import type { Registry } from "../languages/registry.js";
import type { LanguageStat } from "./model.js";

/** Fallback "Other" language: no comment/string syntax → everything counts. */
const OTHER_LANG = { id: OTHER_ID, name: "Other", syntax: { strings: [] } };

const SNIFF_BYTES = 8192;

export interface CodebaseData {
  totalLines: number;
  effectiveLines: number;
  commentLines: number;
  blankLines: number;
  /**
   * Source files past exclusion, binary filtering and a clean decode (no U+FFFD).
   * Never derived from scan.files.length (SPEC §3).
   */
  analyzedSourceFiles: number;
  languages: LanguageStat[];
  /**
   * Line counts per ancestor directory ("." = whole repo) accumulated in the
   * same pass, so each dir equals its whole subtree. Used by Structure code-share
   * tags, not by the codebase card.
   */
  countedByDir: Map<string, { effective: number; comments: number; blank: number }>;
}

/** Ancestor directory keys (repo-relative) of a file path, up to ".". */
function dirAncestors(fileRel: string): string[] {
  const parts = fileRel.split("/");
  parts.pop();
  const out: string[] = [];
  let cur = parts.join("/") || ".";
  for (;;) {
    out.push(cur);
    if (cur === ".") break;
    const idx = cur.lastIndexOf("/");
    cur = idx < 0 ? "." : cur.slice(0, idx);
  }
  return out;
}

/** Read `size` bytes from the open fd starting at `pos`; null on error. */
function readFromFd(fd: number, size: number, pos: number): Buffer | null {
  const buf = Buffer.alloc(size);
  let filled = 0;
  try {
    while (filled < size) {
      const n = readSync(fd, buf, filled, size - filled, pos + filled);
      if (n <= 0) break;
      filled += n;
    }
  } catch {
    return null;
  }
  return buf.subarray(0, filled);
}

export function analyzeCodebase(files: ScannedFile[], registry: Registry): CodebaseData {
  const per = new Map<string, { id: string; name: string; effective: number; comments: number; blank: number; files: number }>();
  const countedByDir = new Map<string, { effective: number; comments: number; blank: number }>();
  let totalLines = 0;
  let effectiveLines = 0;
  let commentLines = 0;
  let blankLines = 0;
  let analyzedSourceFiles = 0;

  for (const file of files) {
    let fd: number;
    try {
      fd = openSync(file.absolutePath, "r");
    } catch {
      continue;
    }

    let buf: Buffer;
    try {
      const head = Buffer.alloc(SNIFF_BYTES);
      const sniffed = readSync(fd, head, 0, SNIFF_BYTES, 0);
      if (sniffed <= 0) {
        buf = Buffer.alloc(0); // empty file — still counts as an analyzed source file
      } else {
        // Binary sniff on the head only; a full read happens just for text.
        if (isBinary(head.subarray(0, sniffed))) continue;
        const size = fstatSync(fd).size;
        const rest = readFromFd(fd, Math.max(0, size - sniffed), sniffed);
        if (rest === null) continue;
        buf = Buffer.concat([head.subarray(0, sniffed), rest]);
      }
    } catch {
      continue;
    } finally {
      closeSync(fd);
    }

    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    } catch {
      continue;
    }
    // Decode replacement chars → likely binary-ish; skip to stay deterministic.
    if (content.includes("�")) continue;

    let langId = detectByName(registry, file.relative);
    if (langId === undefined) {
      const firstLine = content.split("\n", 1)[0] ?? "";
      langId = detectByShebang(registry, firstLine);
    }
    const lang = (langId && registry.byId.get(langId)) || OTHER_LANG;
    const counts = countSourceFile(content, lang.syntax);

    totalLines += counts.effective + counts.comments + counts.blank;
    effectiveLines += counts.effective;
    commentLines += counts.comments;
    blankLines += counts.blank;
    analyzedSourceFiles += 1;
    // Add to every ancestor dir so each dir's value equals its whole subtree.
    for (const dir of dirAncestors(file.relative)) {
      const cur = countedByDir.get(dir) ?? { effective: 0, comments: 0, blank: 0 };
      cur.effective += counts.effective;
      cur.comments += counts.comments;
      cur.blank += counts.blank;
      countedByDir.set(dir, cur);
    }

    const id = lang.id;
    const cur = per.get(id);
    if (cur) {
      cur.effective += counts.effective;
      cur.comments += counts.comments;
      cur.blank += counts.blank;
      cur.files += 1;
    } else {
      per.set(id, { id, name: lang.name, effective: counts.effective, comments: counts.comments, blank: counts.blank, files: 1 });
    }
  }

  const languages: LanguageStat[] = [...per.values()].map((s) => ({
    id: s.id,
    name: s.name,
    effective: s.effective,
    comments: s.comments,
    files: s.files,
  }));

  return { totalLines, effectiveLines, commentLines, blankLines, analyzedSourceFiles, languages, countedByDir };
}
