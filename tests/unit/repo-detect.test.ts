/**
 * Repository state detector (P0). Every command branches on this one detector.
 * Matrix covered:
 *   UNINITIALIZED / LEGACY / HEALTHY
 *   DAMAGED: config strict-fail · semantic invalid · theme unresolvable ·
 *            state missing · state corrupt · state incompatible
 *   DRIFTED: generated file modified · generated file missing · github no workflow
 *   COLLISION: unowned file at an expected output path · unsafe managed entry
 *   theme entry edited is NOT DRIFTED/DAMAGED (user-editable input)
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { makeV2Repo, okState, seedHealthyRepo } from "../helpers/repo.js";
import { readState, serializeState, upsertEntry } from "../../src/state/registry.js";
import { sha256Content } from "../../src/fs/hash.js";
import { buildJournal, writeJournal } from "../../src/txn/journal.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-detect-"));
  dirs.push(dir);
  return dir;
}

function stateFile(root: string): string {
  return path.join(root, ".arte-git-card", "state.json");
}

function saveState(root: string): void {
  const read = readState(root);
  if (read.status === "ok") writeFileSync(stateFile(root), serializeState(read.state), "utf8");
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

describe("repo state detector", () => {
  it("UNINITIALIZED when no config/state/journal exist", () => {
    expect(detectRepositoryState(temp()).state).toBe("UNINITIALIZED");
  });

  it("U-2: config absent + orphan state.json → DAMAGED (never UNINITIALIZED)", () => {
    const root = temp();
    const stateAbs = path.join(root, ".arte-git-card", "state.json");
    mkdirSync(path.dirname(stateAbs), { recursive: true });
    writeFileSync(
      stateAbs,
      JSON.stringify({ schemaVersion: 2, toolVersion: "1.0.0", managedFiles: [], outputRoots: [] }, null, 2),
      "utf8",
    );
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DAMAGED");
    expect(d.diagnoses.some((x) => x.code === "orphan-state")).toBe(true);
  });

  it("U-2: config absent + orphan uninstall-tail journal → DAMAGED, points to uninstall --yes", () => {
    const root = temp();
    const journalPath = path.join(root, ".arte-git-card", "txn.json");
    mkdirSync(path.dirname(journalPath), { recursive: true });
    writeJournal(journalPath, buildJournal(root, [
      { kind: "config", rel: "arte-gitcard.yml", op: "delete", beforeSha256: "a".repeat(64), afterSha256: null, stagingRel: null, stagingSha256: null },
      { kind: "state", rel: ".arte-git-card/state.json", op: "delete", beforeSha256: "b".repeat(64), afterSha256: null, stagingRel: null, stagingSha256: null },
    ]));
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DAMAGED");
    expect(d.diagnoses.some((x) => x.code === "uninstall-interrupted")).toBe(true);
    expect(d.diagnoses.some((x) => x.message.includes("uninstall --yes"))).toBe(true);
  });

  it("U-2: config absent + orphan NON-tail journal → DAMAGED (orphan-journal)", () => {
    const root = temp();
    const journalPath = path.join(root, ".arte-git-card", "txn.json");
    mkdirSync(path.dirname(journalPath), { recursive: true });
    // a card WRITE op is not an uninstall delete tail
    writeJournal(journalPath, buildJournal(root, [
      { kind: "card", rel: ".github/arte-git-card/codebase.svg", op: "write", beforeSha256: null, afterSha256: "c".repeat(64), stagingRel: null, stagingSha256: null },
    ]));
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DAMAGED");
    expect(d.diagnoses.some((x) => x.code === "orphan-journal")).toBe(true);
    expect(d.diagnoses.some((x) => x.code === "uninstall-interrupted")).toBe(false);
  });

  it("LEGACY when only the v1 config exists", () => {
    const root = temp();
    writeFileSync(
      path.join(root, "arte-git-card.yml"),
      "cards:\n  codebase: { enabled: true, languages: { include_comments: false } }\n",
      "utf8",
    );
    const d = detectRepositoryState(root);
    expect(d.state).toBe("LEGACY");
    expect(d.configPath).toBe(path.join(root, "arte-git-card.yml"));
  });

  it("HEALTHY after a real generate (cards + ownership entries)", () => {
    const root = seedHealthyRepo(temp()).root;
    expect(detectRepositoryState(root).state).toBe("HEALTHY");
  });

  describe("DAMAGED", () => {
    it("config strict-fail (missing required field) is NOT silently repaired", () => {
      const root = makeV2Repo(temp()).root;
      const raw = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8").replace("auto-update: false\n", "");
      writeFileSync(path.join(root, "arte-gitcard.yml"), raw, "utf8");
      expect(detectRepositoryState(root).state).toBe("DAMAGED");
    });

    it("semantic-invalid config (schema-valid, path invalid) is DAMAGED", () => {
      const root = makeV2Repo(temp(), { outputDir: "../outside" }).root;
      const d = detectRepositoryState(root);
      expect(d.state).toBe("DAMAGED");
      expect(d.diagnoses.some((x) => x.code === "config-semantic")).toBe(true);
    });

    it("unresolvable selected theme is DAMAGED", () => {
      const root = makeV2Repo(temp()).root;
      // Point config at a theme file that does not exist (quotes-independent rewrite).
      const raw = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8").replace(
        "arte-theme.yml",
        "missing.yml",
      );
      writeFileSync(path.join(root, "arte-gitcard.yml"), raw, "utf8");
      expect(detectRepositoryState(root).state).toBe("DAMAGED");
    });

    it("state missing is DAMAGED (no ownership proof → fail closed)", () => {
      const root = seedHealthyRepo(temp()).root;
      rmSync(stateFile(root));
      expect(detectRepositoryState(root).state).toBe("DAMAGED");
    });

    it("state corrupt is DAMAGED", () => {
      const root = seedHealthyRepo(temp()).root;
      writeFileSync(stateFile(root), "{ nope", "utf8");
      expect(detectRepositoryState(root).state).toBe("DAMAGED");
    });

    it("state forward-incompatible schemaVersion is DAMAGED", () => {
      const root = seedHealthyRepo(temp()).root;
      const s = readState(root);
      const compat = JSON.parse(JSON.stringify(s));
      // schemaVersion 3 (forward) — even with otherwise-valid shape
      writeFileSync(stateFile(root), JSON.stringify({ ...compat, schemaVersion: 3 }), "utf8");
      // readState marks incompatible regardless of shape; detector reports DAMAGED
      expect(detectRepositoryState(root).state).toBe("DAMAGED");
    });
  });

  describe("DRIFTED", () => {
    it("a generated card modified after generation → DRIFTED (owned, reclaimable)", () => {
      const root = seedHealthyRepo(temp()).root;
      const card = path.join(root, ".github", "arte-git-card", "codebase.svg");
      writeFileSync(card, readFileSync(card, "utf8") + "\n<!-- touched -->", "utf8");
      const d = detectRepositoryState(root);
      expect(d.state).toBe("DRIFTED");
      expect(d.diagnoses.some((x) => x.code === "entry-drift")).toBe(true);
    });

    it("a generated card deleted after generation → DRIFTED", () => {
      const root = seedHealthyRepo(temp()).root;
      rmSync(path.join(root, ".github", "arte-git-card", "structure.svg"));
      expect(detectRepositoryState(root).state).toBe("DRIFTED");
    });

    it("auto-update enabled but workflow missing → DRIFTED", () => {
      const root = seedHealthyRepo(temp()).root;
      const loaded = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8").replace(
        "auto-update: false",
        "auto-update: true",
      );
      writeFileSync(path.join(root, "arte-gitcard.yml"), loaded, "utf8");
      const d = detectRepositoryState(root);
      expect(d.state).toBe("DRIFTED");
      expect(d.diagnoses.some((x) => x.code === "github-enabled-no-workflow")).toBe(true);
    });
  });

  describe("COLLISION", () => {
    it("an unowned file at an expected output path → COLLISION (never overwritten)", () => {
      const root = makeV2Repo(temp()).root;
      const card = path.join(root, ".github", "arte-git-card", "codebase.svg");
      mkdirSync(path.dirname(card), { recursive: true });
      writeFileSync(card, "<svg>user-made</svg>", "utf8"); // no ownership entry
      const d = detectRepositoryState(root);
      expect(d.state).toBe("COLLISION");
      expect(d.diagnoses.some((x) => x.code === "unowned-output-file")).toBe(true);
    });

    it("a managed entry whose file became a symlink to outside → COLLISION (unsafe)", () => {
      const root = seedHealthyRepo(temp()).root;
      const outside = temp();
      mkdirSync(outside, { recursive: true });
      const card = path.join(root, ".github", "arte-git-card", "codebase.svg");
      rmSync(card);
      let linked = true;
      try {
        symlinkSync(outside, card, "junction");
      } catch {
        linked = false;
      }
      if (!linked) return;
      const d = detectRepositoryState(root);
      expect(d.state).toBe("COLLISION");
      expect(d.diagnoses.some((x) => x.code === "entry-unsafe")).toBe(true);
    });
  });

  it("editing an installed THEME file does NOT drift/damage the repo (user-editable input)", () => {
    const root = seedHealthyRepo(temp()).root;
    // register the theme file as an installed theme entry, then edit it
    const state = okState(readState(root));
    const themeRel = ".arte-git-card/themes/arte-theme.yml";
    const themeAbs = path.join(root, themeRel);
    upsertEntry(state, { path: themeRel, kind: "theme", sha256: sha256Content(readFileSync(themeAbs, "utf8")) });
    saveState(root);
    expect(detectRepositoryState(root).state).toBe("HEALTHY");

    // user edits the theme (still valid YAML) → still HEALTHY, NOT DRIFTED
    writeFileSync(themeAbs, readFileSync(themeAbs, "utf8") + "\n# my tweak\n", "utf8");
    expect(detectRepositoryState(root).state).toBe("HEALTHY");

    // contrast: editing a GENERATED card is DRIFTED
    const card = path.join(root, ".github", "arte-git-card", "structure.svg");
    writeFileSync(card, readFileSync(card, "utf8") + "\n", "utf8");
    expect(detectRepositoryState(root).state).toBe("DRIFTED");
  });

  it("a theme config pointing at a file that user DELETED → DAMAGED (unresolvable)", () => {
    const root = seedHealthyRepo(temp()).root;
    rmSync(path.join(root, ".arte-git-card", "themes", "arte-theme.yml"));
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DAMAGED");
    expect(d.diagnoses.some((x) => x.code === "theme-invalid")).toBe(true);
  });
});
