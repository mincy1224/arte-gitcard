import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildRegistryIndex, buildRegistry } from "../../src/languages/registry.js";
import { detectByName, detectByShebang } from "../../src/languages/detect.js";
import { walkFilesystem } from "../../src/scanner/files.js";
import { analyzeCodebase } from "../../src/codebase/analyze.js";
import { sortLanguages, countedLines } from "../../src/codebase/model.js";
import { DEFAULT_EXCLUDE } from "../../src/config/defaults.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "arte-test-"));
});

function write(rel: string, content: string): void {
  const p = path.join(dir, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
}

describe("language detection (plan.md §61)", () => {
  const reg = buildRegistryIndex(buildRegistry(undefined));

  it("detects by filename, then extension, then shebang", () => {
    expect(detectByName(reg, "Dockerfile")).toBe("dockerfile");
    expect(detectByName(reg, "CMakeLists.txt")).toBe("cmake");
    expect(detectByName(reg, "src/app.ts")).toBe("typescript");
    expect(detectByName(reg, "app.UNKNOWN")).toBeUndefined();
  });

  it("detects by shebang", () => {
    expect(detectByShebang(reg, "#!/usr/bin/env python3")).toBe("python");
    expect(detectByShebang(reg, "#!/bin/bash")).toBe("shell");
    expect(detectByShebang(reg, "// not a shebang")).toBeUndefined();
  });

  it("custom languages override built-ins", () => {
    const reg2 = buildRegistryIndex(
      buildRegistry([{ id: "typescript", name: "MyTS", extensions: [".ts"], comments: { line: ["//"] } }]),
    );
    expect(reg2.byId.get("typescript")?.name).toBe("MyTS");
  });

  it("overriding only name/comments keeps the built-in extensions (P0-8)", () => {
    const reg3 = buildRegistryIndex(
      buildRegistry([{ id: "typescript", name: "MyTS", comments: { line: ["//", "///"] } }]),
    );
    const ts = reg3.byId.get("typescript")!;
    expect(ts.name).toBe("MyTS");
    expect(ts.extensions).toEqual([".ts", ".tsx", ".mts", ".cts"]); // inherited, not dropped
    expect(ts.syntax.lineComment).toEqual(["//", "///"]);
    // .ts detection still resolves to the overridden language
    expect(detectByName(reg3, "src/app.ts")).toBe("typescript");
  });

  it("an explicit empty extensions array still clears them (override semantics)", () => {
    const reg4 = buildRegistryIndex(
      buildRegistry([{ id: "typescript", name: "MyTS", extensions: [], comments: { line: ["//"] } }]),
    );
    expect(reg4.byId.get("typescript")?.extensions).toEqual([]);
  });
});

describe("filesystem walk + binary sniff (SPEC §7)", () => {
  it("applies hard excludes (.git) + binary guard + the default exclude list", () => {
    write("src/a.ts", "x = 1;\n");
    write("node_modules/lib.js", "ignore me\n");
    write("dist/bundle.js", "ignore\n");
    write("src/logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("binary"));
    write(".git/config", "ignore\n");
    write("arte-git-card.yml", "cards: {}\n"); // legacy config name hard-excluded
    write("arte-gitcard.yml", "schema-version: 2\n"); // v2 config name hard-excluded
    const files = walkFilesystem(dir, { exclude: DEFAULT_EXCLUDE });
    const rels = files.map((f) => f.relative);
    expect(rels).toEqual(["src/a.ts"]);
  });

  it("dotfiles are NOT blanket-excluded (SPEC §7); user can add them to exclude", () => {
    write(".eslintrc.js", "module.exports = {};\n");
    const included = walkFilesystem(dir);
    expect(included.map((f) => f.relative)).toEqual([".eslintrc.js"]);

    // user adds the dotfile to the editable exclude list → it disappears
    const excluded = walkFilesystem(dir, { exclude: [".eslintrc.js"] });
    expect(excluded.map((f) => f.relative)).toEqual([]);
  });

  it("a custom output directory is excluded in the same path space (no self-counting)", () => {
    write("docs/cards/codebase.svg", "<svg></svg>\n");
    write("docs/cards/preview.html", "<html></html>\n");
    const files = walkFilesystem(dir, { outputDirs: ["docs/cards"], exclude: DEFAULT_EXCLUDE });
    expect(files.map((f) => f.relative)).toEqual([]);
  });

  it("skips symlinks (never follows outside the repository)", () => {
    write("real.txt", "x\n");
    try {
      symlinkSync(path.join(dir, "real.txt"), path.join(dir, "link.txt"));
    } catch {
      return; // symlink unsupported on this platform — skip
    }
    const files = walkFilesystem(dir);
    expect(files.map((f) => f.relative)).toEqual(["real.txt"]);
  });
});

describe("codebase analysis (plan.md §64)", () => {
  const reg = buildRegistryIndex(buildRegistry(undefined));

  it("aggregates per-language effective/comments/blanks and invariants hold", () => {
    write("a.ts", "const x = 1;\n// c\n\n");
    write("b.py", "x = 1\n# c\n");
    write("run.sh", "#!/bin/bash\necho hi\n");
    const files = walkFilesystem(dir);
    const data = analyzeCodebase(files, reg);
    expect(data.analyzedSourceFiles).toBe(3);
    expect(data.effectiveLines).toBe(data.languages.reduce((a, l) => a + l.effective, 0));
    expect(data.totalLines).toBe(data.effectiveLines + data.commentLines + data.blankLines);
    // all three tie at 1 effective line → name ASC
    const sorted = sortLanguages(data.languages, false);
    expect(sorted.map((l) => l.id)).toEqual(["python", "shell", "typescript"]);
  });

  it("include_comments changes ranking via countedLines", () => {
    write("a.ts", "x = 1;\n".repeat(10) + "// c\n".repeat(5));
    write("b.py", "y = 1\n".repeat(6) + "# c\n".repeat(20));
    const data = analyzeCodebase(walkFilesystem(dir), reg);
    expect(countedLines(data.languages[0]!, false)).toBe(10);
    expect(countedLines(data.languages[0]!, true)).toBe(15);
  });
});

describe("countedByDir (Structure code-share source)", () => {
  const reg = buildRegistryIndex(buildRegistry(undefined));

  it("accumulates each analyzed file to every ancestor; subtree totals are consistent", () => {
    write("share_cb/src/a.ts", "// c1\nconst x = 1;\n\n");
    write("share_cb/src/deep/b.ts", "// c2\nconst y = 2;\n");
    write("share_cb/docs/d.md", "plain text\n");
    const data = analyzeCodebase(walkFilesystem(dir), reg);

    const dot = data.countedByDir.get(".");
    expect(dot).toBeDefined();
    expect(dot!.effective).toBe(data.effectiveLines);
    expect(dot!.comments).toBe(data.commentLines);
    expect(dot!.blank).toBe(data.blankLines);

    const root = data.countedByDir.get("share_cb")!;
    const src = data.countedByDir.get("share_cb/src")!;
    const deep = data.countedByDir.get("share_cb/src/deep")!;
    expect(src.effective).toBeGreaterThan(0);
    expect(src.effective + src.comments).toBeLessThan(root.effective + root.comments); // docs excluded from src
    expect(deep.effective).toBeGreaterThan(0);
    expect(deep.effective + deep.comments).toBeLessThan(src.effective + src.comments);
    // docs subtree exists
    expect(data.countedByDir.get("share_cb/docs")).toBeDefined();
  });
});
