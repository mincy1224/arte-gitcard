/**
 * Config schema + structure.root normalization (SPEC §5/§7, P0-7/P1-2/P1-3).
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { arteGitCardConfigSchema } from "../../src/config/schema.js";
import { normalizeStructureRoot, assertOutputDirInside } from "../../src/config/root.js";

const base = {
  cards: {
    codebase: { enabled: true, languages: { include_comments: false } },
    structure: {
      enabled: true,
      root: ".",
      max_depth: 3,
      activity_days: 7,
      commits: { enabled: true },
      changes: { enabled: true },
    },
  },
  exclude: [],
  theme: "arte-theme",
  output: { directory: "./.github/arte-git-card" },
};

describe("config schema — comment markers must be non-empty (P0-7)", () => {
  it("accepts valid line/block comment markers", () => {
    const ok = {
      ...base,
      languages: [
        { id: "custom", name: "Custom", extensions: [".cx"], comments: { line: ["//"], block: [["/*", "*/"]] } },
      ],
    };
    expect(arteGitCardConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects an empty line-comment marker", () => {
    const bad = {
      ...base,
      languages: [{ id: "custom", name: "Custom", extensions: [".cx"], comments: { line: [""] } }],
    };
    expect(arteGitCardConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty block-comment pair (would stall the lexer)", () => {
    const bad = {
      ...base,
      languages: [{ id: "custom", name: "Custom", extensions: [".cx"], comments: { block: [["", ""]] } }],
    };
    expect(arteGitCardConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe("normalizeStructureRoot (SPEC §5)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "arte-root-"));
    mkdirSync(path.join(root, "src"));
    mkdirSync(path.join(root, "packages", "foo"), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('returns null for the whole repo (".", "", "./")', () => {
    expect(normalizeStructureRoot(".", root)).toBeNull();
    expect(normalizeStructureRoot("", root)).toBeNull();
    expect(normalizeStructureRoot("./", root)).toBeNull();
  });

  it("normalizes ./prefix and trailing slashes to a POSIX relative path", () => {
    expect(normalizeStructureRoot("./src/", root)).toBe("src");
    expect(normalizeStructureRoot("src", root)).toBe("src");
    expect(normalizeStructureRoot("packages/foo", root)).toBe("packages/foo");
  });

  it("rejects absolute paths and ../ escapes", () => {
    expect(() => normalizeStructureRoot("/etc", root)).toThrow(/project-relative/);
    expect(() => normalizeStructureRoot("C:/Windows", root)).toThrow(/project-relative/);
    expect(() => normalizeStructureRoot("../outside", root)).toThrow(/escape the project root/);
  });

  it("rejects nonexistent roots", () => {
    expect(() => normalizeStructureRoot("nope", root)).toThrow(/does not exist/);
  });
});

describe("assertOutputDirInside (SPEC §7)", () => {
  const proj = "E:/proj";
  it("accepts a nested relative directory", () => {
    expect(() => assertOutputDirInside(proj, "./.github/arte-git-card")).not.toThrow();
  });
  it("rejects an absolute path outside the project", () => {
    expect(() => assertOutputDirInside(proj, "C:/outside")).toThrow(/inside the project root/);
  });
  // Config paths are portable across OSes: any rooted/absolute spelling must be
  // rejected on EVERY host (not just the one whose semantics match).
  it.each([
    "C:/outside", // Windows drive absolute (forward slash)
    "C:\\outside", // Windows drive absolute (backslash)
    "C:outside", // Windows drive-relative (special meaning on Windows)
    "/outside", // POSIX absolute
    "\\outside", // Windows-rooted (current-drive)
    "\\\\server\\share", // UNC
    "//server/share", // UNC (forward-slash form)
  ])("rejects rooted/absolute path form host-independently: %s", (dir) => {
    expect(() => assertOutputDirInside(proj, dir)).toThrow(/inside the project root/);
  });
  it("rejects .. escapes", () => {
    expect(() => assertOutputDirInside(proj, "../outside")).toThrow(/inside the project root/);
  });
  it("rejects the project root itself (empty relative output breaks self-exclusion)", () => {
    expect(() => assertOutputDirInside(proj, ".")).toThrow(/not be the project root/);
    expect(() => assertOutputDirInside(proj, "./")).toThrow(/not be the project root/);
  });

  it("rejects an in-repo output component that is a symlink/junction to outside", () => {
    const root = mkdtempSync(path.join(tmpdir(), "arte-symlink-"));
    const outside = path.join(root, "outside");
    mkdirSync(outside, { recursive: true });
    let linked = true;
    try {
      // junction works without admin on Windows; lstat reports it as a symlink
      symlinkSync(outside, path.join(root, "link"), "junction");
    } catch {
      linked = false;
    }
    try {
      if (!linked) return; // no symlink/junction privilege — nothing to assert
      // ./link/out is lexically inside root, but link → outside
      expect(() => assertOutputDirInside(root, "./link/out")).toThrow(/symbolic link/);
      expect(() => assertOutputDirInside(root, "./link")).toThrow(/symbolic link/);
      // a normal (even nonexistent) nested path still passes
      expect(() => assertOutputDirInside(root, "./.github/arte-git-card")).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
