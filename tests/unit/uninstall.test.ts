/**
 * `arte-gitcard uninstall` hostile-state / collision regressions (unit).
 *
 * THE invariant under test:
 *   CODE DEFINES PATH AUTHORITY.  STATE ONLY PROVES OWNERSHIP.
 *   DIRECTORIES NEVER GRANT RECURSIVE DELETE AUTHORITY.
 *
 * "uninstall 能尽量清除 arte-gitcard，但误删用户文件在设计上是不可能通过
 *  state forgery / outputRoots / directory ownership 推导实现的。"
 *
 * Covered hostile scenarios (spec A–J + crash recovery):
 *   A  user files mixed into the output dir stay byte-identical (no dir delete);
 *   B  foreign workflows (.github/workflows/ci.yml, deploy.yml) are untouched;
 *   C  a modified managed Card is preserved (never force-deleted);
 *   D  forged state (kind=card path=src/index.ts / README / package.json,
 *      kind=workflow path=ci.yml, hashes MATCHING) still deletes nothing;
 *   E  forged outputRoots never grant authority over code files;
 *   F  a managed path that became a symlink is never followed/deleted;
 *   G  unknown files under .arte-git-card are preserved (no recursive delete);
 *   H  theme matrix: builtin materialized+unchanged removed; modified / custom /
 *      unowned themes preserved;
 *   I  a config that became a symlink fails closed (target untouched);
 *   J  --dry-run leaves a byte-identical tree with no lock / journal / temps;
 *   recovery: an interrupted uninstall only finishes the authorized plan, and a
 *      user file modified after the crash is never deleted.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { uninstallRepository } from "../../src/lifecycle/uninstall.js";
import { initRepository } from "../../src/lifecycle/init.js";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { seedHealthyRepo } from "../helpers/repo.js";
import { buildJournal, writeJournal } from "../../src/txn/journal.js";
import type { JournalOp } from "../../src/txn/journal.js";
import { sha256Content } from "../../src/fs/hash.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-uninst-"));
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

function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      // lstat FIRST (never stat) so a symlink is recorded as a link and never
      // followed/read through (its target may be outside the snapshot root).
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        out.set(path.relative(root, abs).split(path.sep).join("/"), `LINK:${readlinkSync(abs)}`);
      } else if (st.isDirectory()) walk(abs);
      else out.set(path.relative(root, abs).split(path.sep).join("/"), readFileSync(abs, "utf8"));
    }
  };
  walk(root);
  return out;
}

function readStateDoc(root: string): {
  managedFiles: Array<{ path: string; kind: string; sha256: string }>;
  outputRoots: string[];
} {
  return JSON.parse(readFileSync(path.join(root, ".arte-git-card", "state.json"), "utf8"));
}
function writeStateDoc(root: string, doc: unknown): void {
  writeFileSync(path.join(root, ".arte-git-card", "state.json"), JSON.stringify(doc, null, 2), "utf8");
}

/** Record ownership of `.arte-git-card/themes/arte-theme.yml` (as init would). */
function ownDefaultTheme(root: string): void {
  const themeAbs = path.join(root, ".arte-git-card", "themes", "arte-theme.yml");
  const doc = readStateDoc(root);
  const themeRel = ".arte-git-card/themes/arte-theme.yml";
  if (!doc.managedFiles.some((e) => e.path === themeRel)) {
    doc.managedFiles.push({ path: themeRel, kind: "theme", sha256: sha256Content(readFileSync(themeAbs, "utf8")) });
  }
  writeStateDoc(root, doc);
}

describe("uninstallRepository: full remove + lifecycle closure", () => {
  it("removes owned cards + config + state last; status uninitialized; repo can init again", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    ownDefaultTheme(root);
    const codebase = path.join(root, f.outputRel, "codebase.svg");
    expect(existsSync(codebase)).toBe(true);

    const res = uninstallRepository(root);
    expect(res.status).toBe("uninitialized");
    expect(res.removed).toContain(`${f.outputRel}/codebase.svg`);
    expect(res.removed).toContain(`${f.outputRel}/structure.svg`);
    expect(res.removed).toContain(".arte-git-card/themes/arte-theme.yml");
    expect(res.removed).toContain("arte-gitcard.yml");
    expect(res.removed).toContain(".arte-git-card/state.json");

    expect(existsSync(path.join(root, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "state.json"))).toBe(false);
    expect(existsSync(codebase)).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "txn.json"))).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", ".lock"))).toBe(false);

    // The repo is back to (essentially) UNINITIALIZED: a fresh init succeeds.
    initRepository(root);
    expect(existsSync(path.join(root, "arte-gitcard.yml"))).toBe(true);
  });

  it("preserves user files mixed into the output dir and never deletes the dir (Test A)", () => {
    const root = temp();
    const f = seedHealthyRepo(root, { outputDir: "cards" });
    const user = {
      "cards/logo.svg": "<svg>user logo</svg>",
      "cards/architecture.svg": "<svg>user architecture</svg>",
      "cards/custom.svg": "<svg>user custom</svg>",
    };
    for (const [rel, content] of Object.entries(user)) {
      const abs = path.join(root, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
    const res = uninstallRepository(root);
    expect(res.removed).toContain("cards/codebase.svg");
    // the three user files are byte-identical; cards/ still exists (not empty).
    for (const [rel, content] of Object.entries(user)) {
      expect(readFileSync(path.join(root, rel), "utf8")).toBe(content);
    }
    expect(existsSync(path.join(root, "cards"))).toBe(true);
    expect(existsSync(path.join(root, "cards", "logo.svg"))).toBe(true);
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(false);
  });

  it("touches only arte-gitcard's own workflow; foreign workflows untouched (Test B)", () => {
    const root = temp();
    seedHealthyRepo(root);
    // Simulate an enabled GitHub integration (owned workflow + ci runtime).
    const gh: Array<{ rel: string; kind: string }> = [
      { rel: ".github/workflows/arte-gitcard.yml", kind: "workflow" },
      { rel: ".arte-git-card/ci/action.yml", kind: "ci-action" },
      { rel: ".arte-git-card/ci/main.cjs", kind: "ci-runtime" },
    ];
    const foreign = {
      ".github/workflows/ci.yml": "name: user-ci\n",
      ".github/workflows/deploy.yml": "name: deploy\n",
    };
    for (const { rel, kind } of gh) {
      const abs = path.join(root, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, `managed-${path.basename(rel)}`, "utf8");
      const doc = readStateDoc(root);
      doc.managedFiles.push({ path: rel, kind, sha256: sha256Content(`managed-${path.basename(rel)}`) });
      writeStateDoc(root, doc);
    }
    for (const [rel, content] of Object.entries(foreign)) {
      const abs = path.join(root, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
    const res = uninstallRepository(root);
    expect(res.removed).toContain(".github/workflows/arte-gitcard.yml");
    expect(res.removed).toContain(".arte-git-card/ci/action.yml");
    expect(res.removed).toContain(".arte-git-card/ci/main.cjs");
    for (const [rel, content] of Object.entries(foreign)) {
      expect(readFileSync(path.join(root, rel), "utf8")).toBe(content);
    }
  });

  it("a modified managed Card is preserved; config/state still removed (Test C)", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    const structure = path.join(root, f.outputRel, "structure.svg");
    const hacked = readFileSync(structure, "utf8") + "<!-- user hacked -->";
    writeFileSync(structure, hacked, "utf8");

    const res = uninstallRepository(root);
    expect(res.preserved.some((p) => p.path === `${f.outputRel}/structure.svg` && p.reason === "modified")).toBe(true);
    expect(readFileSync(structure, "utf8")).toBe(hacked); // preserved, not force-deleted
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(false);
    expect(existsSync(path.join(root, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "state.json"))).toBe(false);
  });

  it("forged state can NEVER authorize deleting code/user files, even with a MATCHING hash (Test D)", () => {
    const root = temp();
    seedHealthyRepo(root);
    const code = {
      "src/index.ts": "export const secret = 1;\n",
      "README.md": "# my readme\n",
      "package.json": '{ "name": "user-project" }\n',
      ".github/workflows/ci.yml": "name: user-ci\n",
    };
    const forged: Array<{ path: string; kind: string }> = [
      { path: "src/index.ts", kind: "card" },
      { path: "README.md", kind: "card" },
      { path: "package.json", kind: "card" },
      { path: ".github/workflows/ci.yml", kind: "workflow" },
    ];
    for (const [rel, content] of Object.entries(code)) {
      const abs = path.join(root, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
    const doc = readStateDoc(root);
    for (const fg of forged) {
      doc.managedFiles.push({ path: fg.path, kind: fg.kind, sha256: sha256Content(code[fg.path as keyof typeof code]!) });
    }
    writeStateDoc(root, doc);

    const res = uninstallRepository(root); // succeeds, but never touches the forged targets
    for (const rel of Object.keys(code)) {
      expect(existsSync(path.join(root, rel))).toBe(true); // never deleted
      expect(readFileSync(path.join(root, rel), "utf8")).toBe(code[rel as keyof typeof code]);
    }
    // The forged source-like entries are reported preserved (path not managed).
    for (const fg of forged) {
      expect(res.preserved.some((p) => p.path === fg.path)).toBe(true);
    }
  });

  it("forged outputRoots=['src'] never grants authority over code files (Test E)", () => {
    const root = temp();
    seedHealthyRepo(root);
    const src = path.join(root, "src", "codebase.svg");
    mkdirSync(path.dirname(src), { recursive: true });
    writeFileSync(src, "export const x = 1;\n", "utf8");
    const doc = readStateDoc(root);
    doc.outputRoots = ["src"];
    doc.managedFiles.push({ path: "src/codebase.svg", kind: "card", sha256: sha256Content("export const x = 1;\n") });
    writeStateDoc(root, doc);

    const res = uninstallRepository(root);
    expect(existsSync(src)).toBe(true); // never deleted
    expect(res.preserved.some((p) => p.path === "src/codebase.svg")).toBe(true);
  });
});

describe("uninstallRepository: symlink / unsafe targets fail closed", () => {
  function validFileSymlinkAt(linkAbs: string, targetAbs: string): boolean {
    try {
      mkdirSync(path.dirname(linkAbs), { recursive: true });
      symlinkSync(targetAbs, linkAbs, "file");
      return lstatSync(linkAbs).isSymbolicLink();
    } catch {
      return false; // no symlink privilege on this host
    }
  }

  it("a managed Card that became a symlink is never followed; its target survives (Test F)", () => {
    const root = temp();
    const f = seedHealthyRepo(root, { outputDir: "cards" });
    const target = path.join(root, "src", "index.ts");
    mkdirSync(path.dirname(target), { recursive: true });
    const targetContent = "export const secret = 1;\n";
    writeFileSync(target, targetContent, "utf8");
    rmSync(path.join(root, "cards", "codebase.svg"), { force: true });
    const link = path.join(root, "cards", "codebase.svg");
    if (!validFileSymlinkAt(link, target)) return; // no symlink privilege

    const res = uninstallRepository(root);
    expect(readFileSync(target, "utf8")).toBe(targetContent); // NOT followed/deleted
    expect(lstatSync(link).isSymbolicLink()).toBe(true); // symlink preserved
    expect(res.preserved.some((p) => p.path === "cards/codebase.svg" && p.reason === "unsafe")).toBe(true);
  });

  it("a config that became a symlink fails closed; target + config untouched (Test I)", () => {
    const root = temp();
    seedHealthyRepo(root);
    const target = path.join(root, "package.json");
    writeFileSync(target, '{ "name": "user-project" }\n', "utf8");
    rmSync(path.join(root, "arte-gitcard.yml"), { force: true });
    const link = path.join(root, "arte-gitcard.yml");
    if (!validFileSymlinkAt(link, target)) return; // no symlink privilege

    const before = snapshot(root);
    expect(() => uninstallRepository(root)).toThrow(/not a regular file|symlink/i);
    // nothing was deleted or followed
    expect(snapshot(root)).toEqual(before);
    expect(readFileSync(target, "utf8")).toBe('{ "name": "user-project" }\n');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
  });
});

describe("uninstallRepository: unknown files under .arte-git-card are preserved (Test G)", () => {
  it("keeps user-notes.txt, removes owned ci runtime, never recursive-deletes .arte-git-card", () => {
    const root = temp();
    seedHealthyRepo(root);
    // user note next to owned ci runtime
    const noteRel = ".arte-git-card/user-notes.txt";
    writeFileSync(path.join(root, noteRel), "mine\n", "utf8");
    const ciRel = ".arte-git-card/ci/main.cjs";
    mkdirSync(path.join(root, ".arte-git-card", "ci"), { recursive: true });
    writeFileSync(path.join(root, ciRel), "runtime bytes", "utf8");
    const doc = readStateDoc(root);
    doc.managedFiles.push({ path: ciRel, kind: "ci-runtime", sha256: sha256Content("runtime bytes") });
    writeStateDoc(root, doc);

    const res = uninstallRepository(root);
    expect(res.removed).toContain(ciRel); // owned + unchanged ci runtime removed
    expect(readFileSync(path.join(root, noteRel), "utf8")).toBe("mine\n"); // preserved
    expect(existsSync(path.join(root, ".arte-git-card"))).toBe(true); // dir kept (still holds the note)
    expect(res.preserved.some((p) => p.path === noteRel && p.reason === "unowned")).toBe(true);
  });
});

describe("uninstallRepository: theme rules are conservative (Test H)", () => {
  const customTheme = 'name: company\npalette:\n  accent: "#112233"\n';

  function installCustom(root: string, name: string, body: string): string {
    const rel = `.arte-git-card/themes/${name}.yml`;
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
    const doc = readStateDoc(root);
    if (!doc.managedFiles.some((e) => e.path === rel)) {
      doc.managedFiles.push({ path: rel, kind: "theme", sha256: sha256Content(body) });
    }
    writeStateDoc(root, doc);
    return rel;
  }

  it("a builtin preset arte-gitcard materialized, UNCHANGED → removable", () => {
    const root = temp();
    seedHealthyRepo(root);
    ownDefaultTheme(root); // arte-theme.yml recorded as owned (as init would)
    const rel = ".arte-git-card/themes/arte-theme.yml";
    const res = uninstallRepository(root);
    expect(res.removed).toContain(rel);
    expect(existsSync(path.join(root, rel))).toBe(false);
  });

  it("a builtin preset that was MODIFIED after materialization → preserved", () => {
    const root = temp();
    seedHealthyRepo(root);
    ownDefaultTheme(root);
    const rel = ".arte-git-card/themes/arte-theme.yml";
    const abs = path.join(root, rel);
    writeFileSync(abs, readFileSync(abs, "utf8") + '\npalette:\n  accent: "#ff0000"\n', "utf8"); // user edit

    const res = uninstallRepository(root);
    expect(existsSync(abs)).toBe(true); // preserved
    expect(res.preserved.some((p) => p.path === rel && p.reason === "modified")).toBe(true);
  });

  it("a CUSTOM (user-installed, owned) theme → preserved, not removed", () => {
    const root = temp();
    seedHealthyRepo(root);
    const rel = installCustom(root, "company", customTheme);
    const res = uninstallRepository(root);
    expect(existsSync(path.join(root, rel))).toBe(true);
    expect(res.preserved.some((p) => p.path === rel && p.reason === "custom-theme")).toBe(true);
  });

  it("an UNOWNED theme file on disk → preserved, never claimed/removed", () => {
    const root = temp();
    seedHealthyRepo(root);
    const rel = ".arte-git-card/themes/company.yml";
    writeFileSync(path.join(root, rel), customTheme, "utf8"); // no state entry
    const res = uninstallRepository(root);
    expect(existsSync(path.join(root, rel))).toBe(true);
    expect(res.preserved.some((p) => p.path === rel && p.reason === "unowned")).toBe(true);
  });
});

describe("uninstallRepository: preconditions fail closed (zero writes)", () => {
  it("UNINITIALIZED (no config) → throws; nothing created", () => {
    const root = temp();
    expect(() => uninstallRepository(root)).toThrow(/nothing to uninstall/i);
  });

  it("a legacy v1 config → throws (never deletes the legacy file)", () => {
    const root = temp();
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "arte-git-card.yml"), "cards: {}\n", "utf8");
    expect(() => uninstallRepository(root)).toThrow(/legacy/i);
    expect(existsSync(path.join(root, "arte-git-card.yml"))).toBe(true);
  });

  it("a DAMAGED config → throws (no output-dir authority), zero writes", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    writeFileSync(path.join(root, "arte-gitcard.yml"), "schema-version: 2\ncards: [broken\n", "utf8");
    const before = snapshot(root);
    expect(() => uninstallRepository(root)).toThrow();
    expect(snapshot(root)).toEqual(before);
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(true);
  });

  it("missing state.json → throws (no ownership proof), zero writes", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    rmSync(path.join(root, ".arte-git-card", "state.json"), { force: true });
    const before = snapshot(root);
    expect(() => uninstallRepository(root)).toThrow(/state\.json is missing/i);
    expect(snapshot(root)).toEqual(before);
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(true);
  });

  it("corrupt state.json → throws, zero writes", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    writeFileSync(path.join(root, ".arte-git-card", "state.json"), "{ corrupt", "utf8");
    const before = snapshot(root);
    expect(() => uninstallRepository(root)).toThrow(/state\.json is corrupt/i);
    expect(snapshot(root)).toEqual(before);
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(true);
  });
});

describe("uninstallRepository: --dry-run is read-only (Test J)", () => {
  it("dry-run: byte-identical tree, no lock/journal/temps", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    ownDefaultTheme(root);
    // mixed user content, so the tree keeps non-artefact files
    const note = path.join(root, ".arte-git-card", "user-notes.txt");
    writeFileSync(note, "mine\n", "utf8");
    const before = snapshot(root);

    const res = uninstallRepository(root, { dryRun: true });
    expect(res.removed.length).toBeGreaterThan(0);
    expect(res.removed).toContain("arte-gitcard.yml");
    // nothing changed
    expect(snapshot(root)).toEqual(before);
    expect(existsSync(path.join(root, ".arte-git-card", ".lock"))).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "txn.json"))).toBe(false);
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(true);
    expect(existsSync(note)).toBe(true);
  });
});

describe("uninstallRepository: crash-recoverable, state last (spec §13)", () => {
  it("an interrupted uninstall only finishes the authorized plan; a file changed after the crash is never deleted", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    const cardRel = (file: string) => `${f.outputRel}/${file}`;
    const codebaseAbs = path.join(root, cardRel("codebase.svg"));
    const structureAbs = path.join(root, cardRel("structure.svg"));
    const codebaseSha = sha256Content(readFileSync(codebaseAbs, "utf8"));
    const structureSha = sha256Content(readFileSync(structureAbs, "utf8"));
    const configAbs = path.join(root, "arte-gitcard.yml");
    const stateAbs = path.join(root, ".arte-git-card", "state.json");
    const configSha = sha256Content(readFileSync(configAbs, "utf8"));
    const stateSha = sha256Content(readFileSync(stateAbs, "utf8"));

    // Simulate a crash mid-uninstall AFTER the first delete applied (codebase gone),
    // with the structure card then user-modified.
    rmSync(codebaseAbs, { force: true });
    writeFileSync(structureAbs, readFileSync(structureAbs, "utf8") + "<!-- user after crash -->", "utf8");
    const journalPath = path.join(root, ".arte-git-card", "txn.json");
    writeJournal(
      journalPath,
      buildJournal(root, [
        { kind: "card", rel: cardRel("codebase.svg"), op: "delete", beforeSha256: codebaseSha, afterSha256: null, stagingRel: null, stagingSha256: null },
        { kind: "card", rel: cardRel("structure.svg"), op: "delete", beforeSha256: structureSha, afterSha256: null, stagingRel: null, stagingSha256: null },
        { kind: "config", rel: "arte-gitcard.yml", op: "delete", beforeSha256: configSha, afterSha256: null, stagingRel: null, stagingSha256: null },
        { kind: "state", rel: ".arte-git-card/state.json", op: "delete", beforeSha256: stateSha, afterSha256: null, stagingRel: null, stagingSha256: null },
      ]),
    );

    // The next uninstall run triggers recovery, which refuses the user-modified
    // structure card and therefore stops before config/state.
    expect(() => uninstallRepository(root)).toThrow(/preserved/i);
    expect(existsSync(codebaseAbs)).toBe(false); // already-gone op is idempotent
    expect(existsSync(structureAbs)).toBe(true); // user-modified → preserved
    expect(readFileSync(structureAbs, "utf8")).toContain("<!-- user after crash -->");
    expect(existsSync(configAbs)).toBe(true); // recovery stopped before config
    expect(existsSync(stateAbs)).toBe(true); // and before state (state last)
    expect(existsSync(journalPath)).toBe(true); // journal kept for doctor
  });
});

describe("U-1: uninstall recovers after the config delete (orphan tail journal)", () => {
  function writeTailJournal(
    root: string,
    f: { outputRel: string },
    h: { codebase: string; structure: string; config: string; state: string },
  ): string {
    const journalPath = path.join(root, ".arte-git-card", "txn.json");
    const del = (rel: string, kind: string, sha: string): JournalOp =>
      ({ kind, rel, op: "delete", beforeSha256: sha, afterSha256: null, stagingRel: null, stagingSha256: null });
    writeJournal(journalPath, buildJournal(root, [
      del(`${f.outputRel}/codebase.svg`, "card", h.codebase),
      del(`${f.outputRel}/structure.svg`, "card", h.structure),
      del("arte-gitcard.yml", "config", h.config),
      del(".arte-git-card/state.json", "state", h.state),
    ]));
    return journalPath;
  }

  function hashesOf(root: string, f: { outputRel: string }) {
    return {
      codebase: sha256Content(readFileSync(path.join(root, f.outputRel, "codebase.svg"), "utf8")),
      structure: sha256Content(readFileSync(path.join(root, f.outputRel, "structure.svg"), "utf8")),
      config: sha256Content(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")),
      state: sha256Content(readFileSync(path.join(root, ".arte-git-card", "state.json"), "utf8")),
    };
  }

  it("A: config delete applied, state unchanged, journal remains → rerun completes state removal + clears journal", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    const h = hashesOf(root, f);
    const journalPath = writeTailJournal(root, f, h);
    // Simulate the terminal crash window: cards + config are already gone, state unchanged.
    rmSync(path.join(root, f.outputRel, "codebase.svg"));
    rmSync(path.join(root, f.outputRel, "structure.svg"));
    rmSync(path.join(root, "arte-gitcard.yml"));

    const res = uninstallRepository(root); // must NOT throw despite the missing config
    expect(res.status).toBe("uninitialized");
    expect(res.removed).toContain(".arte-git-card/state.json");
    expect(existsSync(path.join(root, ".arte-git-card", "state.json"))).toBe(false);
    expect(existsSync(journalPath)).toBe(false); // journal cleared after clean completion
    expect(detectRepositoryState(root).state).toBe("UNINITIALIZED");
  });

  it("B: ALL deletes including state applied, journal remains → rerun verifies + removes journal only", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    const h = hashesOf(root, f);
    const journalPath = writeTailJournal(root, f, h);
    rmSync(path.join(root, f.outputRel, "codebase.svg"));
    rmSync(path.join(root, f.outputRel, "structure.svg"));
    rmSync(path.join(root, "arte-gitcard.yml"));
    rmSync(path.join(root, ".arte-git-card", "state.json"));

    const res = uninstallRepository(root);
    expect(res.status).toBe("uninitialized");
    expect(res.removed).toEqual([]); // nothing left to remove now
    expect(existsSync(journalPath)).toBe(false); // journal removed only
    expect(detectRepositoryState(root).state).toBe("UNINITIALIZED");
  });

  it("C: config gone but an earlier card target still exists → recovery must NOT delete it (preserve/stop)", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    const h = hashesOf(root, f);
    const journalPath = writeTailJournal(root, f, h);
    // Crash at the journal commit point (nothing applied yet), then the config is gone.
    // The owned card is STILL on disk and even matches the recorded hash — but the
    // config (output authority) is gone, so it must not be deleted on journal evidence.
    const codebase = path.join(root, f.outputRel, "codebase.svg");
    expect(sha256Content(readFileSync(codebase, "utf8"))).toBe(h.codebase);
    rmSync(path.join(root, "arte-gitcard.yml"));

    expect(() => uninstallRepository(root)).toThrow(/preserved|interrupted|appeared/i);
    expect(existsSync(codebase)).toBe(true); // NOT deleted
    expect(existsSync(path.join(root, ".arte-git-card", "state.json"))).toBe(true); // untouched
    expect(existsSync(journalPath)).toBe(true); // journal preserved for doctor
  });

  it("D: config gone + state MODIFIED after the crash → state preserved, journal remains", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    const h = hashesOf(root, f);
    const journalPath = writeTailJournal(root, f, h);
    rmSync(path.join(root, f.outputRel, "codebase.svg"));
    rmSync(path.join(root, f.outputRel, "structure.svg"));
    rmSync(path.join(root, "arte-gitcard.yml"));
    // user modified the ownership file after the crash
    const stateAbs = path.join(root, ".arte-git-card", "state.json");
    writeFileSync(stateAbs, readFileSync(stateAbs, "utf8") + "\n", "utf8");

    expect(() => uninstallRepository(root)).toThrow(/preserved|interrupted|state/i);
    expect(existsSync(stateAbs)).toBe(true); // preserved (modified)
    expect(existsSync(journalPath)).toBe(true); // journal kept
  });
});

describe("U-4: uninstall NEVER deletes directories", () => {
  it("leaves even an emptied output directory and .arte-git-card in place", () => {
    const root = temp();
    const f = seedHealthyRepo(root, { outputDir: "cards" });
    const cardsDir = path.join(root, "cards");
    expect(existsSync(cardsDir)).toBe(true);

    uninstallRepository(root);

    // The directory that held the cards still exists (now empty) — never rmdir'd.
    expect(existsSync(cardsDir)).toBe(true);
    expect(readdirSync(cardsDir).length).toBe(0);
    // .arte-git-card (holding the preserved, unowned arte-theme.yml) remains too.
    expect(existsSync(path.join(root, ".arte-git-card"))).toBe(true);
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(false);
  });
});

describe("U-5: occupied unowned code-derived candidates are reported + preserved", () => {
  it("unowned card/preview/workflow candidate files remain and are listed", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    // Unowned files at EXACT code-derived candidate paths (no state entries):
    const unownedCandidates: Array<[string, string]> = [
      [`${f.outputRel}/preview.html`, "<html>preview</html>"],
      [".github/workflows/arte-gitcard.yml", "name: unowned-workflow\n"],
    ];
    for (const [rel, content] of unownedCandidates) {
      const abs = path.join(root, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }

    const res = uninstallRepository(root);
    // Owned cards removed; unowned candidate files are preserved AND reported.
    expect(res.removed).toContain(`${f.outputRel}/codebase.svg`);
    for (const [rel] of unownedCandidates) {
      expect(existsSync(path.join(root, rel))).toBe(true);
      expect(res.preserved.some((p) => p.path === rel && p.reason === "unowned")).toBe(true);
    }
    // The candidate paths were NOT force-deleted just for looking like managed paths.
    expect(readFileSync(path.join(root, `${f.outputRel}/preview.html`), "utf8")).toBe("<html>preview</html>");
    expect(readFileSync(path.join(root, ".github/workflows/arte-gitcard.yml"), "utf8")).toBe("name: unowned-workflow\n");
  });

  it("a symlink/special entry under .arte-git-card is reported unsafe without being followed", () => {
    const root = temp();
    seedHealthyRepo(root);
    const target = path.join(root, "src", "secret.ts");
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "export const secret = 1;\n", "utf8");
    const linkRel = ".arte-git-card/ci/link.cjs";
    const linkAbs = path.join(root, linkRel);
    mkdirSync(path.dirname(linkAbs), { recursive: true });
    let linked = true;
    try {
      symlinkSync(target, linkAbs, "file");
    } catch {
      linked = false;
    }
    if (!linked) return; // no symlink privilege on this host

    const res = uninstallRepository(root);
    expect(readFileSync(target, "utf8")).toBe("export const secret = 1;\n"); // never followed
    expect(lstatSync(linkAbs).isSymbolicLink()).toBe(true); // the link itself is preserved
    expect(res.preserved.some((p) => p.path === linkRel && p.reason === "unsafe")).toBe(true);
  });
});

describe("P0: no symlink ancestor may redirect managed-path authority", () => {
  /** Directory symlink (junction fallback). Returns false when unsupported. */
  function dirSymlink(linkAbs: string, targetAbs: string): boolean {
    try {
      mkdirSync(path.dirname(linkAbs), { recursive: true });
      symlinkSync(targetAbs, linkAbs, "junction");
      return lstatSync(linkAbs).isSymbolicLink();
    } catch {
      /* junction unsupported → try a plain dir symlink */
    }
    try {
      symlinkSync(targetAbs, linkAbs, "dir");
      return lstatSync(linkAbs).isSymbolicLink();
    } catch {
      return false;
    }
  }

  function subSnapshot(dirAbs: string): Map<string, string> {
    const root = dirAbs;
    const out = new Map<string, string>();
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        const st = lstatSync(abs);
        if (st.isSymbolicLink()) out.set(path.relative(root, abs).split(path.sep).join("/"), `LINK:${readlinkSync(abs)}`);
        else if (st.isDirectory()) walk(abs);
        else out.set(path.relative(root, abs).split(path.sep).join("/"), readFileSync(abs, "utf8"));
      }
    };
    walk(root);
    return out;
  }

  it("A/F: .arte-git-card/ci -> ../src (INSIDE the repo) can never claim src/main.cjs, even with a matching forged hash", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    // Build the symlinked ci dir pointing at src/ (inside repoRoot).
    const ciLink = path.join(root, ".arte-git-card", "ci");
    if (!dirSymlink(ciLink, path.join(root, "src"))) return; // no dir-symlink privilege on this host
    const target = path.join(root, "src", "main.cjs");
    mkdirSync(path.dirname(target), { recursive: true });
    const content = "export const main = 1;\n";
    writeFileSync(target, content, "utf8");
    // Forge an ownership entry whose lexical path goes THROUGH the symlink.
    const doc = readStateDoc(root);
    doc.managedFiles.push({ path: ".arte-git-card/ci/main.cjs", kind: "ci-runtime", sha256: sha256Content(content) });
    writeStateDoc(root, doc);

    const res = uninstallRepository(root);
    expect(readFileSync(target, "utf8")).toBe(content); // NEVER deleted/modified
    expect(existsSync(target)).toBe(true);
    expect(res.preserved.some((p) => p.path === ".arte-git-card/ci/main.cjs" && p.reason === "unsafe")).toBe(true);
    expect(res.removed).toContain(`${f.outputRel}/codebase.svg`); // real owned files still removed
  });

  it("B: .github/workflows -> ../user-workflows never lets a forged workflow entry claim the target", () => {
    const root = temp();
    seedHealthyRepo(root);
    const wfLink = path.join(root, ".github", "workflows");
    if (!dirSymlink(wfLink, path.join(root, "user-workflows"))) return;
    const targetRel = "user-workflows/arte-gitcard.yml";
    const target = path.join(root, targetRel);
    mkdirSync(path.dirname(target), { recursive: true });
    const content = "name: user-workflow\n";
    writeFileSync(target, content, "utf8");
    const doc = readStateDoc(root);
    doc.managedFiles.push({
      path: ".github/workflows/arte-gitcard.yml",
      kind: "workflow",
      sha256: sha256Content(content),
    });
    writeStateDoc(root, doc);

    uninstallRepository(root);
    expect(readFileSync(target, "utf8")).toBe(content); // byte-identical
    expect(existsSync(target)).toBe(true); // never deleted
  });

  it("C: .arte-git-card/themes -> ../user-themes never lets a builtin-looking theme be deleted through the link", () => {
    const root = temp();
    seedHealthyRepo(root);
    const themesLink = path.join(root, ".arte-git-card", "themes");
    rmSync(themesLink, { recursive: true, force: true });
    const targetDir = path.join(root, "user-themes");
    mkdirSync(targetDir, { recursive: true });
    const themeFile = path.join(targetDir, "arte-theme.yml");
    const content = 'name: user-arte\npalette:\n  accent: "#112233"\n';
    writeFileSync(themeFile, content, "utf8");
    if (!dirSymlink(themesLink, targetDir)) return;
    // Simulate an OWNED builtin-looking theme whose path is redirected by the link.
    const doc = readStateDoc(root);
    doc.managedFiles.push({
      path: ".arte-git-card/themes/arte-theme.yml",
      kind: "theme",
      sha256: sha256Content(content),
    });
    writeStateDoc(root, doc);

    const res = uninstallRepository(root);
    expect(readFileSync(themeFile, "utf8")).toBe(content); // user theme survives unchanged
    expect(res.preserved.some((p) => p.path === ".arte-git-card/themes/arte-theme.yml" && p.reason === "unsafe")).toBe(true);
  });

  it("D: .arte-git-card itself is a symlink → fresh uninstall fails closed with ZERO writes", () => {
    const root = temp();
    seedHealthyRepo(root);
    const userData = path.join(root, "user-data");
    mkdirSync(userData, { recursive: true });
    const stateAbs = path.join(userData, "state.json");
    const stateContent = JSON.stringify({ schemaVersion: 2, toolVersion: "1.0.0", managedFiles: [], outputRoots: [] }, null, 2);
    writeFileSync(stateAbs, stateContent, "utf8");
    rmSync(path.join(root, ".arte-git-card"), { recursive: true, force: true });
    if (!dirSymlink(path.join(root, ".arte-git-card"), userData)) return;

    const before = subSnapshot(userData);
    expect(() => uninstallRepository(root)).toThrow(/symlink|\.arte-git-card/i);
    // ZERO writes: user-data byte-identical, no lock/journal inside the link target.
    expect(subSnapshot(userData)).toEqual(before);
    expect(existsSync(path.join(userData, ".lock"))).toBe(false);
    expect(existsSync(path.join(userData, "txn.json"))).toBe(false);
    // Real (non-symlink) tool files are untouched too — nothing ran.
    expect(existsSync(path.join(root, "arte-gitcard.yml"))).toBe(true);
  });

  it("E: config-less uninstall tail + symlinked .arte-git-card → never follows; state + journal survive", () => {
    const root = temp();
    const f = seedHealthyRepo(root);
    rmSync(path.join(root, "arte-gitcard.yml"), { force: true }); // config absent
    const userData = path.join(root, "user-data");
    mkdirSync(userData, { recursive: true });
    const stateAbs = path.join(userData, "state.json");
    writeFileSync(stateAbs, '{"schemaVersion":2,"toolVersion":"1.0.0","managedFiles":[],"outputRoots":[]}\n', "utf8");
    const journalPath = path.join(userData, "txn.json");
    writeJournal(journalPath, buildJournal(root, [
      { kind: "config", rel: "arte-gitcard.yml", op: "delete", beforeSha256: "a".repeat(64), afterSha256: null, stagingRel: null, stagingSha256: null },
      { kind: "state", rel: ".arte-git-card/state.json", op: "delete", beforeSha256: "b".repeat(64), afterSha256: null, stagingRel: null, stagingSha256: null },
    ]));
    rmSync(path.join(root, ".arte-git-card"), { recursive: true, force: true });
    if (!dirSymlink(path.join(root, ".arte-git-card"), userData)) return;

    const before = subSnapshot(userData);
    expect(() => uninstallRepository(root)).toThrow(/symlink|\.arte-git-card/i);
    expect(readFileSync(stateAbs, "utf8")).toContain("schemaVersion"); // state survives
    expect(existsSync(journalPath)).toBe(true); // journal survives
    expect(existsSync(path.join(userData, ".lock"))).toBe(false); // no lock created in the target
    expect(subSnapshot(userData)).toEqual(before); // zero writes/deletes
    expect(existsSync(path.join(root, f.outputRel, "codebase.svg"))).toBe(true); // untouched
  });
});
