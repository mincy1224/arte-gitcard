/**
 * LOC lexer (plan.md §62/§63). A lightweight lexical state machine
 * (code / string / block-comment) — never `line.includes("//")`.
 *
 * Per-line classification is exclusive: Blank | Comment | Effective, and
 * `Total = Effective + Comments + Blank` always holds. Strings are tracked so
 * comment markers inside string literals are not miscounted.
 */

import type { LexerSyntax } from "./builtin.js";

export interface LineCounts {
  effective: number;
  comments: number;
  blank: number;
}

/** States carried across lines. */
type State = { kind: "code" } | { kind: "string"; delim: string } | { kind: "block"; end: string };

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\f" || ch === "\v";
}

/** Count lines of one source file; `content` is a decoded JS string split on \n. */
export function countSourceFile(content: string, syntax: LexerSyntax): LineCounts {
  const lineComments = syntax.lineComment ?? [];
  const blockComments = syntax.blockComment ?? [];
  const stringDelims = [...(syntax.strings ?? [])].sort((a, b) => b.length - a.length);
  // block start markers sorted by length desc so `"""` beats `"`-ish cases.
  const blockStarts = [...blockComments].sort((a, b) => b[0].length - a[0].length);

  let effective = 0;
  let comments = 0;
  let blank = 0;
  let state: State = { kind: "code" };

  const lines = content.split("\n");
  // A trailing newline produces a phantom "" element — it is not a line.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  for (const rawLine of lines) {
    // A line entered while inside a multi-line string is at least Effective
    // (JS template literals / Go raw strings must never count as Blank).
    let sawCode = state.kind === "string";
    let sawComment = state.kind === "block";
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    let i = 0;
    const len = line.length;

    while (i < len) {
      if (state.kind === "block") {
        if (line.startsWith(state.end, i)) {
          i += state.end.length;
          state = { kind: "code" };
        } else {
          sawComment = true;
          i += 1;
        }
        continue;
      }
      if (state.kind === "string") {
        if (line[i] === "\\") {
          i += 2; // escaped char — skip
        } else if (line.startsWith(state.delim, i)) {
          i += state.delim.length;
          state = { kind: "code" };
        } else {
          i += 1;
        }
        continue;
      }
      if (isSpace(line[i] ?? "")) {
        i += 1;
        continue;
      }
      let hit = false;
      for (const marker of lineComments) {
        if (line.startsWith(marker, i)) {
          sawComment = true;
          i = len; // the rest of the line is a comment
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const [start, end] of blockStarts) {
        if (line.startsWith(start, i)) {
          sawComment = true;
          state = { kind: "block", end };
          i += start.length;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const delim of stringDelims) {
        if (line.startsWith(delim, i)) {
          sawCode = true;
          state = { kind: "string", delim };
          i += delim.length;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      sawCode = true;
      i += 1;
    }

    if (sawCode) effective += 1;
    else if (sawComment) comments += 1;
    else blank += 1;
  }

  return { effective, comments, blank };
}

/** Counts plus the Total invariant (plan.md §62). */
export function totalOf(c: LineCounts): number {
  return c.effective + c.comments + c.blank;
}
