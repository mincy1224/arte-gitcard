/**
 * Kind-specific path guards (P0, path authority). Every managed operation's
 * target is computed by code; these tests lock that a source path / README /
 * arbitrary file matches NO guard — so neither state.json nor a forged journal
 * can authorize deleting or overwriting user source.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildManagedGuard } from "../../src/state/guards.js";
import { makeV2Repo } from "../helpers/repo.js";

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function guardFor(root: string): (ctx: { kind: string; rel: string }) => boolean {
  return buildManagedGuard(root, { output: { directory: ".github/arte-git-card" } });
}

const dirs: string[] = [];
function tempRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "agc-guard-"));
  dirs.push(root);
  makeV2Repo(root);
  return root;
}

describe("kind path guards", () => {
  const cardOk = [".github/arte-git-card/codebase.svg", ".github/arte-git-card/structure.svg"];
  const cardBad = [
    ".github/arte-git-card/preview.html", // preview is its own kind
    "src/index.ts",
    "README.md",
    "codebase.svg",
    "../outside.svg",
    ".github/arte-git-card/codebase2.svg",
  ];

  it.each(cardOk)("card guard accepts %s", (rel) => {
    const g = guardFor(tempRepo());
    expect(g({ kind: "card", rel })).toBe(true);
  });

  it.each(cardBad)("card guard refuses %s (no source paths allowed)", (rel) => {
    const g = guardFor(tempRepo());
    expect(g({ kind: "card", rel })).toBe(false);
  });

  it("preview is only <output>/preview.html", () => {
    const g = guardFor(tempRepo());
    expect(g({ kind: "preview", rel: ".github/arte-git-card/preview.html" })).toBe(true);
    expect(g({ kind: "preview", rel: ".github/arte-git-card/codebase.svg" })).toBe(false);
    expect(g({ kind: "preview", rel: "preview.html" })).toBe(false);
  });

  it("fixed tool paths match only their exact kind", () => {
    const g = guardFor(tempRepo());
    expect(g({ kind: "workflow", rel: ".github/workflows/arte-gitcard.yml" })).toBe(true);
    expect(g({ kind: "workflow", rel: ".github/workflows/other.yml" })).toBe(false);
    expect(g({ kind: "ci-action", rel: ".arte-git-card/ci/action.yml" })).toBe(true);
    expect(g({ kind: "ci-runtime", rel: ".arte-git-card/ci/main.cjs" })).toBe(true);
    expect(g({ kind: "ci-runtime", rel: ".arte-git-card/ci/main.js" })).toBe(false);
    expect(g({ kind: "state", rel: ".arte-git-card/state.json" })).toBe(true);
    expect(g({ kind: "config", rel: "arte-gitcard.yml" })).toBe(true);
    expect(g({ kind: "config", rel: "arte-git-card.yml" })).toBe(false); // legacy name not writable
  });

  it("theme guard allows safe installed names and rejects unsafe ones", () => {
    const g = guardFor(tempRepo());
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/tokyo-night.yml" })).toBe(true);
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/arte-theme.yml" })).toBe(true);
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/.hidden.yml" })).toBe(false);
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/a/b.yml" })).toBe(false);
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/tokyo.txt" })).toBe(false);
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/../x.yml" })).toBe(false);
    expect(g({ kind: "theme", rel: "src/theme.yml" })).toBe(false);
  });

  it("no guard matches a source file for ANY kind", () => {
    const g = guardFor(tempRepo());
    for (const kind of ["card", "preview", "workflow", "ci-action", "ci-runtime", "theme", "config", "state"]) {
      expect(g({ kind, rel: "src/index.ts" })).toBe(false);
      expect(g({ kind, rel: "README.md" })).toBe(false);
    }
  });

  it("without a config, card/preview match nothing (only fixed paths are writable)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "agc-guard-noconfig-"));
    dirs.push(root);
    const g = buildManagedGuard(root);
    expect(g({ kind: "card", rel: ".github/arte-git-card/codebase.svg" })).toBe(false);
    expect(g({ kind: "config", rel: "arte-gitcard.yml" })).toBe(true);
    expect(g({ kind: "theme", rel: ".arte-git-card/themes/x.yml" })).toBe(true);
    expect(g({ kind: "state", rel: ".arte-git-card/state.json" })).toBe(true);
  });
});
