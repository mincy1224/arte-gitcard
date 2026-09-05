/**
 * Repository lifecycle integration (Phase 3): init (zero-modify when already
 * initialized / damaged config refused), migrate, reset (never deletes unknown
 * or user-modified files; keeps custom themes), semantic-invalid configs fail
 * closed for mutations/generate.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli, runCliFail, runCliInput, makeSrcRepo, cleanup } from "./util.js";
import { sha256Content } from "../../src/fs/hash.js";

/** Create a BROKEN symlink at `linkAbs` (target created then removed). */
function brokenSymlinkAt(linkAbs: string): boolean {
  try {
    mkdirSync(path.dirname(linkAbs), { recursive: true });
    const real = path.join(path.dirname(linkAbs), `.agc-link-${Math.random().toString(36).slice(2)}`);
    mkdirSync(real, { recursive: true });
    symlinkSync(real, linkAbs, "junction");
    rmSync(real, { recursive: true, force: true }); // break the link
    return lstatSync(linkAbs).isSymbolicLink();
  } catch {
    return false; // no symlink privilege on this host
  }
}

const dirs: string[] = [];
function repo(): string {
  const d = makeSrcRepo();
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

describe("init", () => {
  it("initializes a fresh repo: config + theme + state + generated cards; status HEALTHY", () => {
    const dir = repo();
    const out = runCli(dir, "init");
    expect(out).toContain("created arte-gitcard.yml");
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(true);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBe(true);
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("refuses to re-initialize an already-initialized repo (zero modify)", () => {
    const dir = repo();
    runCli(dir, "init");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toContain("already initialized");
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
  });

  it("refuses when a legacy v1 config exists (points to migrate)", () => {
    const dir = repo();
    writeFileSync(
      path.join(dir, "arte-git-card.yml"),
      "cards:\n  codebase: { enabled: true, languages: { include_comments: false } }\n  structure: { enabled: true, root: '.', max_depth: 3, activity_days: 7, commits: { enabled: true }, changes: { enabled: true } }\ntheme: 'arte-theme'\noutput: { directory: '.github/arte-git-card' }\n",
      "utf8",
    );
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toContain("migrate");
  });

  it("aborts init with ZERO changes when an unowned file sits at a default-card target", () => {
    const dir = repo();
    const svg = path.join(dir, ".github", "arte-git-card", "codebase.svg");
    mkdirSync(path.dirname(svg), { recursive: true });
    writeFileSync(svg, "<svg>user file</svg>", "utf8");
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/exists|cannot init|not owned/i);
    // init is a single transaction: NOTHING was written (config/theme/state).
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card"))).toBe(false);
    expect(readFileSync(svg, "utf8")).toBe("<svg>user file</svg>"); // untouched
  });

  it("fresh init records the materialized theme provenance, so theme remove can delete it later", () => {
    const dir = repo();
    runCli(dir, "init");
    const state = JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")) as {
      managedFiles: Array<{ kind: string; path: string }>;
    };
    const themeEntry = state.managedFiles.find(
      (e) => e.kind === "theme" && e.path === ".arte-git-card/themes/arte-theme.yml",
    );
    expect(themeEntry).toBeTruthy(); // the tool created it → it owns it
    // Switch away, then the tool-created arte preset is removable as OWNED.
    runCli(dir, "theme select", "github-theme");
    runCli(dir, "theme remove", "arte-theme");
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "arte-theme.yml"))).toBe(false);
  });

  it("init preserves a pre-existing valid theme and does NOT auto-claim ownership", () => {
    const dir = repo();
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    mkdirSync(path.dirname(themePath), { recursive: true });
    const custom = 'name: custom-arte\npalette:\n  accent: "#112233"\n';
    writeFileSync(themePath, custom, "utf8");
    runCli(dir, "init");
    expect(readFileSync(themePath, "utf8")).toBe(custom); // bytes preserved
    const state = JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")) as {
      managedFiles: Array<{ kind: string }>;
    };
    expect(state.managedFiles.filter((e) => e.kind === "theme")).toEqual([]); // never fabricated
  });

  it("init fails closed (zero mutation) when a pre-existing arte-theme.yml is invalid", () => {
    const dir = repo();
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    mkdirSync(path.dirname(themePath), { recursive: true });
    writeFileSync(themePath, "palette:\n  accent: \"not-a-color\"\n", "utf8");
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/theme/i);
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(false);
    expect(existsSync(path.join(dir, ".github", "arte-git-card"))).toBe(false);
  });
});

describe("migrate", () => {
  it("migrates a legacy config to v2, preserves the legacy file, then generate works", () => {
    const dir = repo();
    writeFileSync(
      path.join(dir, "arte-git-card.yml"),
      "cards:\n  codebase: { enabled: true, languages: { include_comments: false } }\n  structure: { enabled: true, root: '.', max_depth: 3, activity_days: 7, commits: { enabled: true }, changes: { enabled: true } }\ntheme: 'arte-theme'\noutput: { directory: '.github/arte-git-card' }\n",
      "utf8",
    );
    const out = runCli(dir, "migrate");
    expect(out).toContain("arte-gitcard.yml");
    expect(existsSync(path.join(dir, "arte-git-card.yml"))).toBe(true); // preserved
    expect(existsSync(path.join(dir, ".arte-git-card", "themes", "arte-theme.yml"))).toBe(true); // materialized
    const cfg = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    expect(cfg).toContain("schema-version: 2");
    runCli(dir, "generate");
    expect(runCli(dir, "status")).toContain("OK");
  });
});

describe("reset", () => {
  it("resets a healthy repo to defaults in ONE transaction (owned cards reclaimed, not left half-reset)", () => {
    const dir = repo();
    runCli(dir, "init");
    // customize, then reset
    runCli(dir, "config set", "structure.max-depth", "4");
    const out = runCli(dir, "reset", "--yes");
    expect(out).toContain("wrote arte-gitcard.yml");
    // Card bytes were already at the defaults here (config set did not regenerate),
    // so their identical rewrites are true no-ops: not reported, still present.
    expect(out).not.toContain("wrote .github/arte-git-card/codebase.svg");
    // defaults restored + no partial state
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(runCli(dir, "config get", "structure.max-depth")).toContain("3");
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("reset preflight fail: state.json missing + unowned file → abort with ZERO changes", () => {
    const dir = repo();
    runCli(dir, "init");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    // state lost → cannot prove ownership
    rmSync(path.join(dir, ".arte-git-card", "state.json"));
    // an unowned file sits where reset would write
    const card = path.join(dir, ".github", "arte-git-card", "codebase.svg");
    const content = "<svg>user-owned content</svg>";
    writeFileSync(card, content, "utf8");
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/no changes were made/i);
    expect(fail.stdout + fail.stderr).toMatch(/preserved/i);
    expect(readFileSync(card, "utf8")).toBe(content); // untouched
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore); // config untouched
  });

  it("reset preflight fail: a user-modified managed file → abort with ZERO changes", () => {
    const dir = repo();
    runCli(dir, "init");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const card = path.join(dir, ".github", "arte-git-card", "structure.svg");
    writeFileSync(card, "user hacked this", "utf8");
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/no changes were made/i);
    expect(readFileSync(card, "utf8")).toBe("user hacked this");
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
  });

  it("reset COLLISION (state ok, unowned file at a write target) → abort, file preserved, zero changes", () => {
    const dir = repo();
    runCli(dir, "init");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    // make codebase.svg an UNOWNED collision: drop its ownership entry but keep the file
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.managedFiles = state.managedFiles.filter(
      (e: { path: string }) => !e.path.endsWith("codebase.svg"),
    );
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    const card = path.join(dir, ".github", "arte-git-card", "codebase.svg");
    const content = readFileSync(card, "utf8");
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/no changes were made/i);
    expect(readFileSync(card, "utf8")).toBe(content); // never force-deleted
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
  });

  it("reset DAMAGED config (corrupt YAML) recovers to a HEALTHY default repo", () => {
    const dir = repo();
    runCli(dir, "init");
    writeFileSync(path.join(dir, "arte-gitcard.yml"), "schema-version: 2\ncards: [broken\n", "utf8");
    const out = runCli(dir, "reset", "--yes");
    expect(out).toContain("wrote arte-gitcard.yml");
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(true);
    expect(runCli(dir, "status")).toContain("OK");
    // both default cards enabled again
    expect(runCli(dir, "config get", "structure.enabled")).toContain("true");
  });

  it("reset with state.json corrupt → aborts (no ownership proof, no delete/overwrite of unknown)", () => {
    const dir = repo();
    runCli(dir, "init");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    writeFileSync(path.join(dir, ".arte-git-card", "state.json"), "{ corrupt", "utf8");
    const fail = runCliFail(dir, "reset", "--yes");
    // unowned leftovers at the default output paths become blockers → zero changes
    expect(fail.stdout + fail.stderr).toMatch(/no changes were made/i);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
  });

  it("requires confirmation without --yes (aborts on 'n')", () => {
    const dir = repo();
    runCli(dir, "init");
    const fail = runCliInput(dir, "n\n", "reset");
    expect(fail.status).not.toBe(0);
    expect(fail.stderr + fail.stdout).toContain("Aborted");
  });

  it("P0: forged outputRoots can NEVER authorize deleting source files (reset)", () => {
    const scenarios = [
      { roots: ["src"], path: "src/codebase.svg", content: "export const a = 1;\n" },
      { roots: ["src"], path: "src/structure.svg", content: "export const b = 2;\n" },
      { roots: ["docs"], path: "docs/codebase.svg", content: "export const c = 3;\n" },
    ];
    for (const sc of scenarios) {
      const dir = repo();
      runCli(dir, "init");
      const abs = path.join(dir, sc.path);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, sc.content, "utf8");
      // forge: outputRoots grant the dir + an owned-looking entry for that path
      const statePath = path.join(dir, ".arte-git-card", "state.json");
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        outputRoots: string[];
        managedFiles: Array<Record<string, string>>;
      };
      state.outputRoots = sc.roots;
      state.managedFiles.push({ path: sc.path, kind: "card", sha256: sha256Content(sc.content) });
      writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");

      const out = runCli(dir, "reset", "--yes");
      // The source-like file is never deleted or modified by the reset.
      expect(readFileSync(abs, "utf8")).toBe(sc.content);
      expect(existsSync(abs)).toBe(true);
      // Default cards are still regenerated and the repo is healthy.
      expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
      expect(runCli(dir, "status")).toContain("OK");
      expect(out).toContain("outside arte-gitcard reset authority"); // warned + preserved
    }
  });

  it("P0: forged outputRoots=['.'] is not a valid root → reset aborts, source preserved (zero change)", () => {
    const dir = repo();
    runCli(dir, "init");
    const srcFile = path.join(dir, "src", "codebase.svg");
    mkdirSync(path.dirname(srcFile), { recursive: true });
    writeFileSync(srcFile, "export const x = 1;\n", "utf8");
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      outputRoots: string[];
      managedFiles: Array<Record<string, string>>;
    };
    state.outputRoots = ["."];
    state.managedFiles.push({ path: "src/codebase.svg", kind: "card", sha256: sha256Content("export const x = 1;\n") });
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/no changes were made/i);
    expect(readFileSync(srcFile, "utf8")).toBe("export const x = 1;\n"); // never deleted
  });

  it("reset preserves a custom installed theme WITH provenance (theme remove still works as owned)", () => {
    const dir = repo();
    runCli(dir, "init");
    // install + select a custom non-default theme (installed name = file basename)
    const themeFile = path.join(dir, "tokyo-night.yml");
    writeFileSync(themeFile, 'name: tokyo-night\npalette:\n  accent: "#123456"\n', "utf8");
    runCli(dir, "theme install", themeFile);
    runCli(dir, "theme select", "tokyo-night");
    const themeRel = ".arte-git-card/themes/tokyo-night.yml";
    expect(existsSync(path.join(dir, themeRel))).toBe(true);
    // reset returns to the default arte theme
    runCli(dir, "reset", "--yes");
    expect(existsSync(path.join(dir, themeRel))).toBe(true); // still installed
    const state = JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")) as {
      managedFiles: Array<{ kind: string; path: string }>;
    };
    expect(state.managedFiles.some((e) => e.kind === "theme" && e.path === themeRel)).toBe(true); // provenance kept
    // and `theme remove` on the preserved custom theme still works as an OWNED theme
    runCli(dir, "theme remove", "tokyo-night");
    expect(existsSync(path.join(dir, themeRel))).toBe(false);
  });

  it("reset keeps historical outputRoots (activity metadata) AND cleans the old owned cards", () => {
    const dir = repo();
    runCli(dir, "init");
    // A → B (default dir → docs/cards)
    runCli(dir, "config set", "output.directory", "docs/cards");
    const docsCard = path.join(dir, "docs", "cards", "codebase.svg");
    expect(existsSync(docsCard)).toBe(true);
    // reset back to the default config
    runCli(dir, "reset", "--yes");
    const state = JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")) as {
      outputRoots: string[];
      managedFiles: Array<{ kind: string; path: string }>;
    };
    // historical roots survive as Activity-exclusion metadata
    const roots = [...state.outputRoots].sort();
    expect(roots).toEqual([".github/arte-git-card", "docs/cards"]);
    // the old owned cards are safely cleaned; default cards are regenerated
    expect(existsSync(docsCard)).toBe(false);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(runCli(dir, "status")).toContain("OK");
  });

  it("reset fails closed (zero mutation) when the default theme file is invalid", () => {
    const dir = repo();
    runCli(dir, "init");
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const stateBefore = readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8");
    const codebaseBefore = readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8");
    writeFileSync(themePath, 'palette:\n  accent: "not-a-color"\n', "utf8");
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/theme|fail/i);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe(stateBefore);
    expect(readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8")).toBe(codebaseBefore);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
  });

  it("reset re-materializes a missing default theme and records its provenance", () => {
    const dir = repo();
    runCli(dir, "init");
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    expect(existsSync(themePath)).toBe(true);
    rmSync(themePath); // theme was removed; config now selects a missing theme (DAMAGED)
    runCli(dir, "reset", "--yes");
    expect(existsSync(themePath)).toBe(true); // re-materialized
    const state = JSON.parse(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")) as {
      managedFiles: Array<{ kind: string; path: string }>;
    };
    expect(state.managedFiles.some((e) => e.kind === "theme" && e.path === ".arte-git-card/themes/arte-theme.yml")).toBe(true);
    expect(runCli(dir, "status")).toContain("OK");
  });
});

describe("status / doctor distinguish states and blocked recovery", () => {
  it("status reports DAMAGED for a broken config with an actionable message", () => {
    const dir = repo();
    runCli(dir, "init");
    writeFileSync(path.join(dir, "arte-gitcard.yml"), "schema-version: 2\ncards: [broken\n", "utf8");
    const out = runCli(dir, "status");
    expect(out).toContain("DAMAGED");
    expect(out).toMatch(/doctor|reset/);
  });

  it("status reports DRIFTED when an owned generated card was modified (reclaimable)", () => {
    const dir = repo();
    runCli(dir, "init");
    const card = path.join(dir, ".github", "arte-git-card", "structure.svg");
    writeFileSync(card, readFileSync(card, "utf8") + "\n<!-- edited -->", "utf8");
    const out = runCli(dir, "status");
    expect(out).toContain("DRIFTED");
    expect(out).toMatch(/generate/);
  });

  it("status reports COLLISION for an unowned file at a managed path", () => {
    const dir = repo();
    runCli(dir, "init");
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.managedFiles = state.managedFiles.filter((e: { path: string }) => !e.path.endsWith("codebase.svg"));
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    expect(runCli(dir, "status")).toContain("COLLISION");
  });

  it("doctor surfaces an interrupted transaction (orphan txn.json) with an actionable message", () => {
    const dir = repo();
    runCli(dir, "init");
    const journal = {
      schemaVersion: 1,
      id: "orphan",
      repoRoot: dir,
      ops: [
        { kind: "card", rel: ".github/arte-git-card/codebase.svg", op: "write", beforeSha256: null, afterSha256: "0".repeat(64), stagingRel: null, stagingSha256: null },
      ],
    };
    writeFileSync(path.join(dir, ".arte-git-card", "txn.json"), JSON.stringify(journal), "utf8");
    const out = runCli(dir, "doctor");
    expect(out).toContain("blocked recovery");
    expect(out).toMatch(/orphaned txn\.json/i);
  });
});

describe("fail-closed on damaged config", () => {
  it("generate refuses a semantic-invalid config (escaping output) with zero writes", () => {
    const dir = repo();
    runCli(dir, "init");
    writeFileSync(
      path.join(dir, "arte-gitcard.yml"),
      `schema-version: 2
cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7, commits: { enabled: true }, changes: { enabled: true } }
theme: ".arte-git-card/themes/arte-theme.yml"
output: { directory: "../outside" }
auto-update: false
`,
      "utf8",
    );
    const before = readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8");
    const fail = runCliFail(dir, "generate");
    expect(fail.stdout + fail.stderr).toContain("damaged");
    expect(readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8")).toBe(before);
  });

  it("config set refuses when the config is damaged (fail closed before any write)", () => {
    const dir = repo();
    runCli(dir, "init");
    writeFileSync(path.join(dir, "arte-gitcard.yml"), "schema-version: 2\ncards: broken [\n", "utf8");
    const before = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const fail = runCliFail(dir, "config set", "structure.max-depth", "5");
    expect(fail.stdout + fail.stderr).toContain("damaged");
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(before);
  });
});

describe("init orphan-state gate (RB-4)", () => {
  it("no config + VALID state.json → init refuses; state bytes unchanged", () => {
    const dir = repo();
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    mkdirSync(path.dirname(statePath), { recursive: true });
    const doc = JSON.stringify({ schemaVersion: 2, toolVersion: "1.0.0", managedFiles: [], outputRoots: [] }, null, 2);
    writeFileSync(statePath, doc, "utf8");
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/state\.json already exists|no config|back it up/i);
    expect(readFileSync(statePath, "utf8")).toBe(doc); // never overwritten
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false); // nothing created
  });

  it("no config + CORRUPT state.json → init refuses; nothing created", () => {
    const dir = repo();
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, "{ corrupt", "utf8");
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/state\.json already exists|no config|back it up/i);
    expect(readFileSync(statePath, "utf8")).toBe("{ corrupt"); // preserved
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
  });
});

describe("broken symlink at a managed path is a preflight collision (RB-3)", () => {
  it("init fails closed when the selected theme path is a broken symlink (symlink preserved, zero writes)", () => {
    const dir = repo();
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    if (!brokenSymlinkAt(themePath)) return; // no symlink privilege on this host
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/theme|cannot read|fail/i);
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(false);
    expect(lstatSync(themePath).isSymbolicLink()).toBe(true); // symlink NOT replaced
  });

  it("reset fails closed when the default theme path is a broken symlink (nothing touched)", () => {
    const dir = repo();
    runCli(dir, "init");
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const stateBefore = readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8");
    const codebaseBefore = readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8");
    rmSync(themePath, { force: true });
    if (!brokenSymlinkAt(themePath)) return; // no symlink privilege on this host
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/theme|cannot read|fail/i);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe(stateBefore);
    expect(readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8")).toBe(codebaseBefore);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(lstatSync(themePath).isSymbolicLink()).toBe(true); // symlink preserved
  });
});

describe("selected default theme as a VALID symlink → fail closed, zero mutation (final patch)", () => {
  function validFileSymlinkAt(linkAbs: string, targetAbs: string): boolean {
    try {
      mkdirSync(path.dirname(linkAbs), { recursive: true });
      if (!existsSync(targetAbs)) writeFileSync(targetAbs, "x", "utf8");
      symlinkSync(targetAbs, linkAbs, "file");
      return lstatSync(linkAbs).isSymbolicLink();
    } catch {
      return false; // no file-symlink privilege on this host
    }
  }

  it("init fails closed when the default theme path is a VALID symlink (zero writes, symlink preserved)", () => {
    const dir = repo();
    const real = path.join(dir, "real-theme.yml");
    writeFileSync(real, 'name: real\npalette:\n  accent: "#111111"\n', "utf8");
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    if (!validFileSymlinkAt(themePath, real)) return;
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/not a regular file|symlink/i);
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(false);
    expect(lstatSync(themePath).isSymbolicLink()).toBe(true); // symlink preserved
    expect(readFileSync(real, "utf8")).toBe('name: real\npalette:\n  accent: "#111111"\n');
  });

  it("reset fails closed when the default theme path is a VALID symlink (nothing touched)", () => {
    const dir = repo();
    runCli(dir, "init");
    const real = path.join(dir, "real-theme.yml");
    writeFileSync(real, 'name: real\npalette:\n  accent: "#111111"\n', "utf8");
    const themePath = path.join(dir, ".arte-git-card", "themes", "arte-theme.yml");
    const configBefore = readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8");
    const stateBefore = readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8");
    const codebaseBefore = readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8");
    rmSync(themePath, { force: true });
    if (!validFileSymlinkAt(themePath, real)) return;
    const fail = runCliFail(dir, "reset", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/not a regular file|symlink/i);
    expect(readFileSync(path.join(dir, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe(stateBefore);
    expect(readFileSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"), "utf8")).toBe(codebaseBefore);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(lstatSync(themePath).isSymbolicLink()).toBe(true);
  });
});
