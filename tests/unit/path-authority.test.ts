/**
 * Path authority end-to-end (P0). state.json / txn.json are DATA, never
 * AUTHORITY. Even when a forged state entry or forged journal CLAIMS a source
 * path, the transaction engine's kind guard + recovery re-validation refuse to
 * delete or overwrite it. Also covers generate ownership: never overwrite an
 * unowned file; reclaim owned (even user-modified) cards on explicit generate.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runTransaction } from "../../src/txn/engine.js";
import { emptyPlan } from "../../src/txn/plan.js";
import { buildJournal, writeJournal } from "../../src/txn/journal.js";
import { recoverJournal } from "../../src/txn/recover.js";
import { buildManagedGuard } from "../../src/state/guards.js";
import { makeV2Repo, seedHealthyRepo } from "../helpers/repo.js";
import { loadConfig } from "../../src/config/load.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { generateEnabledCards } from "../../src/generate/manage.js";
import { readState } from "../../src/state/registry.js";
import { sha256Content } from "../../src/fs/hash.js";
import { okState } from "../helpers/repo.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-pa-"));
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

function seedSrc(root: string): string {
  mkdirSync(path.join(root, "src"), { recursive: true });
  const src = path.join(root, "src", "index.ts");
  writeFileSync(src, "export const x = 1;\n", "utf8");
  return src;
}

describe("path authority — forged state/journal cannot touch source", () => {
  it("a delete targeting src/index.ts is refused by the kind guard even with a 'matching' forged entry", () => {
    const root = makeV2Repo(temp()).root;
    const src = seedSrc(root);
    const guard = buildManagedGuard(root, { output: { directory: ".github/arte-git-card" } });
    const txn = emptyPlan();
    txn.deletes.push({
      rel: "src/index.ts",
      abs: src,
      kind: "card",
      expectedSha256: sha256Content("export const x = 1;\n"), // forged ownership proof
    });
    expect(() => runTransaction(txn, { repoRoot: root, command: "test", guard })).toThrow(/not managed/);
    expect(readFileSync(src, "utf8")).toBe("export const x = 1;\n"); // untouched
  });

  it("a forged journal claiming a src write is never recovered onto source", () => {
    const root = makeV2Repo(temp()).root;
    const src = seedSrc(root);
    const staging = path.join(root, ".staged-forged");
    writeFileSync(staging, "MALICIOUS CONTENT", "utf8");
    const journalPath = path.join(root, ".forged-txn.json");
    writeJournal(
      journalPath,
      buildJournal(root, [
        {
          kind: "card",
          rel: "src/index.ts",
          op: "write",
          beforeSha256: sha256Content("export const x = 1;\n"),
          afterSha256: sha256Content("MALICIOUS CONTENT"),
          stagingRel: ".staged-forged",
          stagingSha256: sha256Content("MALICIOUS CONTENT"),
        },
      ]),
    );
    const guard = buildManagedGuard(root, { output: { directory: ".github/arte-git-card" } });
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain("src/index.ts");
    expect(readFileSync(src, "utf8")).toBe("export const x = 1;\n"); // never overwritten
    expect(readFileSync(staging, "utf8")).toBe("MALICIOUS CONTENT"); // staging left alone
  });
});

describe("generate ownership (generate/manage)", () => {
  function load(root: string) {
    const loaded = loadConfig(path.join(root, "arte-gitcard.yml"));
    return { loaded, theme: resolveTheme(loadTheme(loaded.config.theme, loaded.projectRoot)) };
  }

  it("refuses to overwrite an unowned file at a managed output path (COLLISION, fail closed)", () => {
    const root = makeV2Repo(temp()).root;
    const card = path.join(root, ".github", "arte-git-card", "codebase.svg");
    mkdirSync(path.dirname(card), { recursive: true });
    writeFileSync(card, "<svg>not ours</svg>", "utf8"); // no state entry
    const { loaded, theme } = load(root);
    expect(() => generateEnabledCards(root, loaded, theme)).toThrow(/no ownership record/);
    expect(readFileSync(card, "utf8")).toBe("<svg>not ours</svg>"); // preserved
  });

  it("generate after init refuses when state.json is missing (fail closed)", () => {
    const root = makeV2Repo(temp()).root;
    rmSync(path.join(root, ".arte-git-card", "state.json"));
    const { loaded, theme } = load(root);
    expect(() => generateEnabledCards(root, loaded, theme)).toThrow(/state.json is missing/);
  });

  it("generate reclaims an OWNED card even after the user edited it (explicit regeneration)", () => {
    const root = seedHealthyRepo(temp()).root;
    const card = path.join(root, ".github", "arte-git-card", "codebase.svg");
    writeFileSync(card, "user hacked this up", "utf8"); // owned entry still exists → drift
    const { loaded, theme } = load(root);
    const before = okState(readState(root));
    expect(before.managedFiles.some((e) => e.path.endsWith("codebase.svg"))).toBe(true);
    generateEnabledCards(root, loaded, theme); // explicit regeneration reclaims
    expect(readFileSync(card, "utf8")).not.toBe("user hacked this up");
    // state entry hash now matches the regenerated content
    const after = okState(readState(root));
    const entry = after.managedFiles.find((e) => e.path.endsWith("codebase.svg"));
    expect(sha256Content(readFileSync(card, "utf8"))).toBe(entry!.sha256);
  });
});
