/**
 * PRODUCTION-level deterministic transaction-race tests (closure acceptance).
 *
 * Every scenario exercises REAL manager/planner code (never a synthetic TxnPlan):
 * the plan is built from the exact snapshot the manager consumed, then the disk
 * is changed to the concurrent value, then the plan/command is applied. The
 * optimistic precondition / expected-before pin must make the stale operation
 * fail with ZERO mutation and preserve the concurrent value.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";

import { makeV2Repo, seedHealthyRepo } from "../helpers/repo.js";
import { loadConfig } from "../../src/config/load.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { buildDefaultConfig } from "../../src/config/defaults.js";
import { cloneConfig } from "../../src/config/registry.js";
import { writeConfigTxn } from "../../src/config/commit.js";
import { addCard } from "../../src/cardmgr/index.js";
import { buildThemeInstallPlan, removeTheme, selectTheme } from "../../src/thememgr/index.js";
import { planGenerateTxn } from "../../src/generate/manage.js";
import { buildGithubEnablePlan } from "../../src/github/manage.js";
import { buildInitRepositoryPlan } from "../../src/lifecycle/init.js";
import { buildMigrateRepositoryPlan } from "../../src/lifecycle/migrate.js";
import { buildUninstallPlan } from "../../src/lifecycle/uninstall.js";
import { buildResetRepositoryPlan } from "../../src/lifecycle/reset.js";
import { structureDescribe, structureRemove } from "../../src/structure/manage.js";
import { runTransaction } from "../../src/txn/engine.js";
import { buildManagedGuard } from "../../src/state/guards.js";
import { DEFAULT_RUNTIME } from "../../src/runtime.js";
import { CONFIG_FILENAME } from "../../src/config/paths.js";
import { STATE_REL, STRUCTURE_DESCRIPTIONS_REL, WORKFLOW_REL } from "../../src/managed/paths.js";
import type { ArteGitCardConfig } from "../../src/config/types.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-txnrace-"));
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

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}
function writeFile(p: string, content: string): void {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
}
function themeBody(): string {
  return YAML.stringify(DEFAULT_THEME);
}
function cfgPath(root: string): string {
  return path.join(root, CONFIG_FILENAME);
}
/** Write `cfg` to disk (the concurrent "B" value). */
function writeConfigOnDisk(root: string, cfg: ArteGitCardConfig): void {
  writeFileSync(cfgPath(root), YAML.stringify(cfg), "utf8");
}
function readConfigYaml(root: string): ArteGitCardConfig {
  return loadConfig(cfgPath(root)).config;
}
/** Disk config with an added `exclude` entry (a distinct, valid B). */
function configB(root: string): ArteGitCardConfig {
  const cfg = cloneConfig(readConfigYaml(root));
  cfg.exclude = ["vendor-b"];
  return cfg;
}

/** A seeded repo whose config has structure DISABLED (a valid baseline A). */
function repoWithStructureDisabled(): { root: string; loadedA: ReturnType<typeof loadConfig> } {
  const root = temp();
  makeV2Repo(root);
  const cfg = readConfigYaml(root);
  (cfg.cards as { structure: { enabled: boolean } }).structure.enabled = false;
  writeConfigOnDisk(root, cfg);
  return { root, loadedA: loadConfig(cfgPath(root)) };
}

describe("1. config mid-plan race", () => {
  it("writeConfigTxn derived from config A fails when disk changed to B; B is preserved", () => {
    const root = temp();
    makeV2Repo(root);
    const loadedA = loadConfig(cfgPath(root));
    writeConfigOnDisk(root, configB(root)); // concurrent B

    const next = cloneConfig(loadedA.config);
    next.exclude = ["vendor-a"];
    expect(() => writeConfigTxn(root, loadedA, next, { command: "race-config-set" })).toThrow(
      /changed concurrently|Retry/,
    );
    expect(readConfigYaml(root).exclude).toEqual(["vendor-b"]); // B intact
  });
});

describe("2. card add config mid-plan race", () => {
  it("a card-add derived from config A fails when disk changed to B; B is preserved", () => {
    const { root, loadedA } = repoWithStructureDisabled();
    const theme = resolveTheme(loadTheme(loadedA.config.theme, root));
    // disk → B: structure enabled again (differs from A).
    const b = cloneConfig(readConfigYaml(root));
    (b.cards as { structure: { enabled: boolean } }).structure.enabled = true;
    writeConfigOnDisk(root, b);

    // addCard consumes the A snapshot (structure disabled → would enable + write config).
    expect(() => addCard(root, loadedA, theme, "structure", {})).toThrow(/changed concurrently|Retry/);
    expect((readConfigYaml(root).cards as { structure: { enabled: boolean } }).structure.enabled).toBe(true);
  });
});

describe("3. theme select config mid-plan race", () => {
  it("a theme-select derived from config A fails when disk changed to B; B is preserved", () => {
    const root = temp();
    makeV2Repo(root);
    const loadedA = loadConfig(cfgPath(root));
    writeConfigOnDisk(root, configB(root)); // disk → B

    expect(() => selectTheme(root, loadedA, "arte-theme", {})).toThrow(/changed concurrently|Retry/);
    expect(readConfigYaml(root).exclude).toEqual(["vendor-b"]); // B intact
  });
});

describe("4. two theme installs from the same state S0", () => {
  it("the second S0-derived install cannot lose the first's ownership entry", () => {
    const root = temp();
    makeV2Repo(root); // state S0
    // Both plans originate from S0 (state read before either applies).
    const a = buildThemeInstallPlan(root, "alpha", themeBody());
    const b = buildThemeInstallPlan(root, "beta", themeBody());
    const opts = { repoRoot: root, command: "theme-install", guard: buildManagedGuard(root) };

    runTransaction(a.plan, opts); // A applies → state S1 with alpha
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "alpha.yml"))).toBe(true);

    expect(() => runTransaction(b.plan, opts)).toThrow(/changed concurrently|Retry/); // stale S0 plan
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "beta.yml"))).toBe(false);
    const state = JSON.parse(readFileSync(path.join(root, STATE_REL), "utf8")) as {
      managedFiles: Array<{ path: string }>;
    };
    expect(state.managedFiles.some((e) => e.path.endsWith("alpha.yml"))).toBe(true); // A's entry intact
  });
});

describe("5. theme install target race", () => {
  it("a theme target absent at preflight but present at apply is preserved", () => {
    const root = temp();
    makeV2Repo(root);
    const { plan } = buildThemeInstallPlan(root, "race-theme", themeBody());
    writeFile(path.join(root, ".arte-git-card", "themes", "race-theme.yml"), "# user\n");
    expect(() =>
      runTransaction(plan, { repoRoot: root, command: "theme-install", guard: buildManagedGuard(root) }),
    ).toThrow(/appeared after planning/);
    expect(readFileSync(path.join(root, ".arte-git-card", "themes", "race-theme.yml"), "utf8")).toBe("# user\n");
  });
});

describe("6. generate fresh-target race", () => {
  it("a card target absent at preflight but created before apply is preserved; generation fails", () => {
    const root = temp();
    const fixture = seedHealthyRepo(root);
    const loaded = loadConfig(fixture.configPath);
    const theme = resolveTheme(loadTheme(loaded.config.theme, root));
    // Make structure.svg a FRESH target: remove the generated file (entry stays).
    const structAbs = path.join(root, fixture.outputRel, "structure.svg");
    rmSync(structAbs, { force: true });
    const { plan } = planGenerateTxn(root, loaded, theme);
    writeFile(structAbs, "USER-CONTENT\n"); // appears between planning and the transaction
    expect(() =>
      runTransaction(plan, {
        repoRoot: root,
        command: "generate",
        guard: buildManagedGuard(root, loaded.config),
      }),
    ).toThrow(/appeared after planning|changed concurrently|Retry/);
    expect(readFileSync(structAbs, "utf8")).toBe("USER-CONTENT\n"); // preserved
    expect(existsSync(cfgPath(root))).toBe(true); // zero collateral damage
  });
});

describe("7. github enable target race", () => {
  function enableRepo(): { work: string; bundle: string } {
    const work = temp();
    const bare = temp();
    git(bare, ["init", "--bare", "-q", "-b", "main"]);
    git(work, ["init", "-q", "-b", "main"]);
    git(work, ["config", "user.email", "t@e.c"]);
    git(work, ["config", "user.name", "T"]);
    mkdirSync(path.join(work, "src"), { recursive: true });
    writeFileSync(path.join(work, "src", "a.ts"), "x\n", "utf8");
    git(work, ["add", "-A"]);
    git(work, ["commit", "-q", "-m", "seed"]);
    git(work, ["remote", "add", "origin", bare]);
    git(work, ["push", "-q", "-u", "origin", "main"]);
    makeV2Repo(work);
    const bundle = path.join(temp(), "main.cjs");
    writeFileSync(bundle, "// runtime-bundle\n", "utf8");
    return { work, bundle };
  }

  it("a workflow that appears after preflight is preserved; no partial integration", () => {
    const { work, bundle } = enableRepo();
    const loaded = loadConfig(cfgPath(work));
    const { plan } = buildGithubEnablePlan(work, loaded, { ciBundlePath: bundle });
    const wfAbs = path.join(work, WORKFLOW_REL);
    writeFile(wfAbs, "# user workflow\n"); // appears between planning and the transaction
    expect(() =>
      runTransaction(plan, { repoRoot: work, command: "github-enable", guard: buildManagedGuard(work, loaded.config) }),
    ).toThrow(/appeared after planning/);
    // No partial integration.
    expect(readFileSync(wfAbs, "utf8")).toBe("# user workflow\n");
    expect(existsSync(path.join(work, ".arte-git-card", "ci", "action.yml"))).toBe(false);
    expect(existsSync(path.join(work, ".arte-git-card", "ci", "main.cjs"))).toBe(false);
    expect((readConfigYaml(work) as ArteGitCardConfig & { "auto-update": boolean })["auto-update"]).toBe(false);
  });
});

describe("8/9. init absence pins", () => {
  it("8: a card target that appears after init planning → zero mutation, file preserved", () => {
    const root = temp();
    const { plan } = buildInitRepositoryPlan(root);
    const cardAbs = path.join(root, ".github", "arte-git-card", "codebase.svg");
    writeFile(cardAbs, "USER\n"); // appears between planning and the transaction
    expect(() =>
      runTransaction(plan, { repoRoot: root, command: "init", guard: buildManagedGuard(root, buildDefaultConfig()) }),
    ).toThrow(/appeared after planning|changed concurrently|Retry/);
    expect(readFileSync(cardAbs, "utf8")).toBe("USER\n");
    expect(existsSync(cfgPath(root))).toBe(false); // zero mutation
    expect(existsSync(path.join(root, STATE_REL))).toBe(false);
  });

  it("9: state observed absent but appearing before the transaction → stale init fails", () => {
    const root = temp();
    const { plan } = buildInitRepositoryPlan(root);
    writeFile(
      path.join(root, STATE_REL),
      '{"schemaVersion":2,"toolVersion":"1.0.0","managedFiles":[],"outputRoots":[]}\n',
    );
    expect(() =>
      runTransaction(plan, { repoRoot: root, command: "init", guard: buildManagedGuard(root, buildDefaultConfig()) }),
    ).toThrow(/changed concurrently|Retry/);
    expect(existsSync(cfgPath(root))).toBe(false); // zero mutation
    expect(existsSync(path.join(root, STATE_REL))).toBe(true); // concurrent state preserved
  });
});

describe("10/11. migrate source + destination pins", () => {
  const LEGACY = `cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7,
    commits: { enabled: true }, changes: { enabled: true } }
theme: "arte-theme"
output: { directory: ".github/arte-git-card" }
`;

  it("10: v2-config/state absence that becomes present before apply → stale migrate fails", () => {
    const root = temp();
    writeFile(path.join(root, "arte-git-card.yml"), LEGACY);
    const built = buildMigrateRepositoryPlan(root);
    writeFile(cfgPath(root), "schema-version: 2\n"); // destination no longer absent
    expect(() =>
      runTransaction(built.plan, { repoRoot: root, command: "migrate", guard: buildManagedGuard(root, built.config) }),
    ).toThrow(/changed concurrently|Retry/);
    expect(readFileSync(cfgPath(root), "utf8")).toBe("schema-version: 2\n"); // concurrent config preserved
    expect(readFileSync(path.join(root, "arte-git-card.yml"), "utf8")).toBe(LEGACY);
  });

  it("11: legacy source A parsed, then changed to B → A-derived migrate fails", () => {
    const root = temp();
    writeFile(path.join(root, "arte-git-card.yml"), LEGACY);
    const built = buildMigrateRepositoryPlan(root);
    writeFile(path.join(root, "arte-git-card.yml"), LEGACY + 'exclude: ["new"]\n'); // source A → B
    expect(() =>
      runTransaction(built.plan, { repoRoot: root, command: "migrate", guard: buildManagedGuard(root, built.config) }),
    ).toThrow(/changed concurrently|Retry/);
    expect(existsSync(cfgPath(root))).toBe(false); // zero mutation: no v2 config written
    expect(readFileSync(path.join(root, "arte-git-card.yml"), "utf8")).toBe(LEGACY + 'exclude: ["new"]\n');
  });
});

describe("12. uninstall state snapshot race", () => {
  it("state A drives the delete plan, then state becomes B → stale uninstall fails, B remains", () => {
    const root = temp();
    const fixture = seedHealthyRepo(root);
    const built = buildUninstallPlan(root, DEFAULT_RUNTIME);
    const stateAbs = path.join(root, STATE_REL);
    const stateB = JSON.parse(readFileSync(stateAbs, "utf8")) as {
      managedFiles: Array<{ path: string; kind: string; sha256: string }>;
    };
    stateB.managedFiles.push({ path: "zzz-b-user.svg", kind: "card", sha256: "0".repeat(64) });
    writeFileSync(stateAbs, JSON.stringify(stateB, null, 2) + "\n", "utf8"); // state A → B

    expect(() =>
      runTransaction(built.plan, { repoRoot: root, command: "uninstall", guard: built.guard }),
    ).toThrow(/changed concurrently|Retry/);

    // B and its files remain (zero deletion).
    expect(existsSync(cfgPath(root))).toBe(true);
    expect(existsSync(path.join(root, fixture.outputRel, "codebase.svg"))).toBe(true);
    expect(readFileSync(stateAbs, "utf8")).toContain("zzz-b-user.svg");
  });
});

// ---------------------------------------------------------------------------
// Follow-up review closure: theme-remove config concurrency; structure
// describe/remove config concurrency; reset damaged/corrupt single-observation.
// ---------------------------------------------------------------------------

function installThemeBody(root: string, name: string): void {
  runTransaction(buildThemeInstallPlan(root, name, themeBody()).plan, {
    repoRoot: root,
    command: "theme-install",
    guard: buildManagedGuard(root),
  });
}

describe("1b. theme remove config concurrency (selected-theme invariant is a config source)", () => {
  it("remove derived from config A fails when config changes to B; beta + B are preserved", () => {
    const root = temp();
    makeV2Repo(root);
    installThemeBody(root, "alpha");
    installThemeBody(root, "beta");

    // config A selects alpha (beta removable under A).
    const a = cloneConfig(readConfigYaml(root));
    a.theme = ".arte-git-card/themes/alpha.yml";
    writeConfigOnDisk(root, a);
    const loadedA = loadConfig(cfgPath(root));

    // config → B selecting beta (state kept identical).
    const b = cloneConfig(a);
    b.theme = ".arte-git-card/themes/beta.yml";
    writeConfigOnDisk(root, b);

    expect(() => removeTheme(root, loadedA, "beta")).toThrow(/changed concurrently|Retry/);
    // beta preserved; config B intact.
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "beta.yml"))).toBe(true);
    expect(readConfigYaml(root).theme).toBe(".arte-git-card/themes/beta.yml");
    const state = JSON.parse(readFileSync(path.join(root, STATE_REL), "utf8")) as {
      managedFiles: Array<{ path: string }>;
    };
    expect(state.managedFiles.some((e) => e.path.endsWith("beta.yml"))).toBe(true); // entry intact
  });
});

describe("2a. structure describe config concurrency (structure.root is a config source)", () => {
  function structureRepoWithRoot(rootRel: string): string {
    const root = temp();
    git(root, ["init", "-q", "-b", "main"]);
    git(root, ["config", "user.email", "t@e.c"]);
    git(root, ["config", "user.name", "T"]);
    mkdirSync(path.join(root, "packages", "a", "src"), { recursive: true });
    mkdirSync(path.join(root, "packages", "b", "src"), { recursive: true });
    writeFileSync(path.join(root, "packages", "a", "src", "x.ts"), "x\n", "utf8");
    writeFileSync(path.join(root, "packages", "b", "src", "y.ts"), "y\n", "utf8");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "seed"]);
    makeV2Repo(root);
    const cfg = readConfigYaml(root);
    (cfg.cards as { structure: { root: string } }).structure.root = rootRel;
    writeConfigOnDisk(root, cfg);
    return root;
  }

  it("describe derived from root A fails when config changes to root B; no packages/a metadata is written", () => {
    const root = structureRepoWithRoot("packages/a");
    const loadedA = loadConfig(cfgPath(root)); // config A: structure.root=packages/a
    // config → B: structure.root=packages/b (store untouched → absent).
    const b = cloneConfig(readConfigYaml(root));
    (b.cards as { structure: { root: string } }).structure.root = "packages/b";
    writeConfigOnDisk(root, b);

    expect(() => structureDescribe(root, loadedA, "src", "desc-under-a")).toThrow(/changed concurrently|Retry/);
    // no packages/a/src metadata may exist after B became current.
    expect(existsSync(path.join(root, STRUCTURE_DESCRIPTIONS_REL))).toBe(false);
    expect((readConfigYaml(root).cards as { structure: { root: string } }).structure.root).toBe("packages/b");
  });

  it("remove derived from root A fails when config changes to root B; both roots' metadata is preserved", () => {
    const root = structureRepoWithRoot("packages/a");
    const storeAbs = path.join(root, STRUCTURE_DESCRIPTIONS_REL);
    writeFile(
      storeAbs,
      JSON.stringify({ schemaVersion: 1, descriptions: { "packages/a/src": "A", "packages/b/src": "B" } }) + "\n",
    );
    const loadedA = loadConfig(cfgPath(root)); // config A: structure.root=packages/a
    // config → B: structure.root=packages/b (store unchanged).
    const b = cloneConfig(readConfigYaml(root));
    (b.cards as { structure: { root: string } }).structure.root = "packages/b";
    writeConfigOnDisk(root, b);

    expect(() => structureRemove(root, loadedA, "src")).toThrow(/changed concurrently|Retry/);
    const store = JSON.parse(readFileSync(storeAbs, "utf8")) as { descriptions: Record<string, string> };
    expect(store.descriptions).toEqual({ "packages/a/src": "A", "packages/b/src": "B" }); // both preserved
    expect((readConfigYaml(root).cards as { structure: { root: string } }).structure.root).toBe("packages/b");
  });
});

describe("3. reset single-observation (no late source re-read)", () => {
  it("damaged config A observed, then valid B replaces it → stale reset fails, B unchanged", () => {
    const root = temp();
    makeV2Repo(root);
    const good = readConfigYaml(root); // the future "B"
    writeFileSync(cfgPath(root), "::: not yaml [", "utf8"); // damaged A
    const built = buildResetRepositoryPlan(root);
    writeFileSync(cfgPath(root), YAML.stringify(good), "utf8"); // config A → B (valid) before apply

    expect(() =>
      runTransaction(built.plan, { repoRoot: root, command: "reset", guard: built.guard }),
    ).toThrow(/changed concurrently|Retry/);
    // B remains unchanged (reset never overwrote the repaired config).
    const disk = YAML.parse(readFileSync(cfgPath(root), "utf8")) as { "schema-version": number };
    expect(disk["schema-version"]).toBe(2);
    expect(existsSync(path.join(root, ".github", "arte-git-card", "codebase.svg"))).toBe(false);
  });

  it("corrupt state A observed, then valid B replaces it → stale reset fails, state B unchanged", () => {
    const root = temp();
    makeV2Repo(root);
    const stateAbs = path.join(root, STATE_REL);
    writeFileSync(stateAbs, "{ corrupt", "utf8"); // corrupt A
    const built = buildResetRepositoryPlan(root);
    const validB = '{"schemaVersion":2,"toolVersion":"1.0.0","managedFiles":[],"outputRoots":[]}\n';
    writeFileSync(stateAbs, validB, "utf8"); // state A → B (valid) before apply

    expect(() =>
      runTransaction(built.plan, { repoRoot: root, command: "reset", guard: built.guard }),
    ).toThrow(/changed concurrently|Retry/);
    expect(readFileSync(stateAbs, "utf8")).toBe(validB); // state B unchanged
    expect(readConfigYaml(root)["schema-version"]).toBe(2); // config untouched
    expect(existsSync(path.join(root, ".github", "arte-git-card", "codebase.svg"))).toBe(false); // zero mutation
  });
});
