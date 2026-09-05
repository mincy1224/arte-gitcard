import { describe, expect, it } from "vitest";
import { countSourceFile, totalOf, type LineCounts } from "../../src/languages/lexer.js";
import type { LexerSyntax } from "../../src/languages/builtin.js";

const TS: LexerSyntax = { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'", "`"] };
const PY: LexerSyntax = { lineComment: ["#"], blockComment: [["'''", "'''"], ['"""', '"""']], strings: ["'", '"'] };
const SH: LexerSyntax = { lineComment: ["#"], strings: ['"', "'", "`"] };
const HTML: LexerSyntax = { blockComment: [["<!--", "-->"]], strings: ['"', "'"] };

const c = (counts: LineCounts): [number, number, number] => [counts.effective, counts.comments, counts.blank];

describe("lexer — line classification (plan.md §62/§63)", () => {
  it("a `//` inside a string is NOT a comment", () => {
    const r = countSourceFile('const s = "// not a comment";', TS);
    expect(c(r)).toEqual([1, 0, 0]);
  });

  it("line comment marker after code → effective; alone → comment", () => {
    expect(c(countSourceFile("x = 1; // trailing", TS))).toEqual([1, 0, 0]);
    expect(c(countSourceFile("// leading", TS))).toEqual([0, 1, 0]);
  });

  it("block comments span lines and consume them as comments", () => {
    expect(c(countSourceFile("/* open\nmid\nclose */", TS))).toEqual([0, 3, 0]);
    expect(c(countSourceFile("code\n/* c1\nc2 */\nmore", TS))).toEqual([2, 2, 0]);
  });

  it("code after a block comment on the same line → effective", () => {
    expect(c(countSourceFile("/* c */ x = 1;", TS))).toEqual([1, 0, 0]);
  });

  it("blank lines are blank; strings/escapes do not leak", () => {
    expect(c(countSourceFile('  \nlet a = "\\"quoted\\"";\n\n', TS))).toEqual([1, 0, 2]);
  });

  it("Python: # comments, triple-quoted strings are code, blank lines count", () => {
    expect(c(countSourceFile('x = """doc"""\n# c\ny = 1\n', PY))).toEqual([2, 1, 0]);
    expect(c(countSourceFile("# only", PY))).toEqual([0, 1, 0]);
  });

  it("Shell: # comments and quotes", () => {
    expect(c(countSourceFile('#!/bin/bash\necho "hi"  # done\n', SH))).toEqual([1, 1, 0]);
  });

  it("HTML: <!-- --> block comments", () => {
    expect(c(countSourceFile("<!-- header -->\n<div>hi</div>\n", HTML))).toEqual([1, 1, 0]);
  });

  it("trailing newline does not invent a blank line", () => {
    expect(c(countSourceFile("a\nb\n", TS))).toEqual([2, 0, 0]);
    expect(c(countSourceFile("a\n\nb\n", TS))).toEqual([2, 0, 1]);
    expect(c(countSourceFile("", TS))).toEqual([0, 0, 0]);
  });

  it("lines inside a multi-line string are Effective, never Blank (SPEC §8)", () => {
    // JS template literal spanning lines
    expect(c(countSourceFile("const t = `\nhello\nworld\n`;\n", TS))).toEqual([4, 0, 0]);
    // Go raw string
    const GO: LexerSyntax = { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "`"] };
    expect(c(countSourceFile("s := `\nline two\n`\n", GO))).toEqual([3, 0, 0]);
  });

  it("Total = Effective + Comments + Blank always", () => {
    const content = `code\n// c\n\n/* b\nb2 */\nmore\n`;
    const r = countSourceFile(content, TS);
    expect(totalOf(r)).toBe(content.split("\n").length - 1);
  });
});
