/**
 * structure.root path-hardening (explicit acceptance).
 *
 *  - nested structure.root: the CLI `rel` (display-relative), the persisted
 *    `repoRel` (repo-relative store key) and the rendered row's path semantics
 *    all agree (root prefix stripped for display, kept for the store key);
 *  - a symlink/junction at structure.root itself is rejected;
 *  - a symlink/junction ANCESTOR of structure.root is rejected.
 *
 * Tests that need symlink privilege skip with an explicit reason when the host
 * cannot create one — they are never silently omitted.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeStructureRoot } from "../../src/config/root.js";
import { buildStructureScope } from "../../src/structure/scope.js";
import type { ArteGitCardConfig } from "../../src/config/types.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-root-"));
  dirs.push(d);
  return d;
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

function configWithRoot(root: string): ArteGitCardConfig {
  return {
    "schema-version": 2,
    cards: {
      codebase: { enabled: true, languages: { include_comments: false } },
      structure: {
        enabled: true,
        root,
        max_depth: 3,
        activity_days: 7,
        commits: { enabled: true },
        changes: { enabled: true },
      },
    },
    theme: ".arte-git-card/themes/arte-theme.yml",
    output: { directory: ".github/arte-git-card" },
    "auto-update": false,
  };
}

/** Try to create a symlink; junction on Windows. Returns false when unsupported. */
function tryLink(target: string, link: string): boolean {
  try {
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch {
    return false;
  }
}

describe("structure.root normalization accepts a real nested root and rejects symlinks", () => {
  it("accepts a nested real directory (normalized POSIX, no ./ or trailing /)", () => {
    const root = temp();
    mkdirSync(path.join(root, "packages", "app", "src"), { recursive: true });
    expect(normalizeStructureRoot("./packages/app/", root)).toBe("packages/app");
    expect(normalizeStructureRoot(".", root)).toBeNull();
  });

  it("nested root scope: CLI rel is display-relative and the persisted repoRel keeps the root prefix", () => {
    const root = temp();
    mkdirSync(path.join(root, "packages", "app", "src"), { recursive: true });
    writeFileSync(path.join(root, "packages", "app", "src", "a.ts"), "x\n", "utf8");
    const config = configWithRoot("packages/app");
    const scope = buildStructureScope(root, config);
    expect(scope.rootRel).toBe("packages/app");
    const src = scope.dirs.find((d) => d.rel === "src");
    expect(src).toBeDefined();
    expect(src!.rel).toBe("src"); // CLI surface is display-relative
    expect(src!.repoRel).toBe("packages/app/src"); // store key keeps the root prefix
    expect(scope.dirs.find((d) => d.rel === "packages")).toBeUndefined(); // no root-relative leakage
  });

  it("rejects structure.root that IS a symlink/junction", (ctx) => {
    const root = temp();
    const real = path.join(root, "real-target");
    mkdirSync(real, { recursive: true });
    writeFileSync(path.join(real, "a.txt"), "x\n", "utf8");
    const link = path.join(root, "linked-root");
    if (!tryLink(real, link)) {
      process.stderr.write("[structure-root] skipping: symlink privilege unavailable on this host\n");
      ctx.skip();
      return;
    }
    expect(() => normalizeStructureRoot("linked-root", root)).toThrow(/symbolic link/);
  });

  it("rejects structure.root whose ANCESTOR is a symlink/junction", (ctx) => {
    const root = temp();
    const realPkg = path.join(root, "realpkg");
    mkdirSync(path.join(realPkg, "app", "src"), { recursive: true });
    writeFileSync(path.join(realPkg, "app", "src", "a.ts"), "x\n", "utf8");
    const link = path.join(root, "packages");
    if (!tryLink(realPkg, link)) {
      process.stderr.write("[structure-root] skipping: symlink privilege unavailable on this host\n");
      ctx.skip();
      return;
    }
    expect(() => normalizeStructureRoot("packages/app", root)).toThrow(/symbolic link/);
  });
});
