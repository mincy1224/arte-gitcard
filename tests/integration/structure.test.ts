/**
 * Structure description CLI integration (dist). Exercises the real command
 * surface: describe/list/remove round trip (metadata only — never regenerating),
 * `--json` purity + `description: ""` for none, generation embedding the
 * description, stale-metadata prune on generate after a directory leaves the
 * repository tree, and the preserved-user-metadata classification on uninstall.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli, runCliFail, makeSrcRepo, cleanup, CLI } from "./util.js";

const dirs: string[] = [];
function dirFor(): string {
  const d = makeSrcRepo();
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

const STORE = path.join(".arte-git-card", "structure-descriptions.json");
const STRUCTURE_SVG = path.join(".github", "arte-git-card", "structure.svg");

function storeDoc(root: string): { schemaVersion: number; descriptions: Record<string, string> } {
  return JSON.parse(readFileSync(path.join(root, STORE), "utf8"));
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}

describe("structure describe/list/remove (metadata only, never regenerates)", () => {
  it("describe → list (json purity + empty-string for none) → no-op → remove", () => {
    const d = dirFor();
    runCli(d, "init");

    const describe = runCli(d, "structure", "describe", "src", "核心源码");
    expect(describe).toContain('run "arte-gitcard generate" to refresh cards');
    expect(describe).toContain("updated description for \"src\"");

    const doc = storeDoc(d);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.descriptions).toEqual({ src: "核心源码" });

    const jsonOut = runCli(d, "--json", "structure", "list");
    const parsed = JSON.parse(jsonOut) as { root: string; depth: number; entries: Array<{ path: string; description: string }> };
    expect(parsed.entries.some((e) => e.path === "src" && e.description === "核心源码")).toBe(true);

    const listHuman = runCli(d, "structure", "list", "1");
    expect(listHuman).toContain("核心源码");

    // no-op describe does NOT claim generation is required
    const noop = runCli(d, "structure", "describe", "src", "核心源码");
    expect(noop).toContain("unchanged");
    expect(noop).not.toContain('run "arte-gitcard generate"');

    const remove = runCli(d, "structure", "remove", "src");
    expect(remove).toContain('run "arte-gitcard generate" to refresh cards');
    // Removing the last description deletes the store file entirely.
    expect(existsSync(path.join(d, STORE))).toBe(false);
    // `--json` uses "" for "no description" (never a null/omitted field)
    const after = JSON.parse(runCli(d, "--json", "structure", "list")) as {
      entries: Array<{ path: string; description: string }>;
    };
    expect(after.entries.some((e) => e.path === "src" && e.description === "")).toBe(true);
  });

  it("Windows-friendly path forms normalize to the same key", () => {
    const d = dirFor();
    runCli(d, "init");
    expect(runCli(d, "structure", "describe", "./src", "一")).toContain('run "arte-gitcard generate"');
    runCli(d, "structure", "remove", "src\\");
    expect(existsSync(path.join(d, STORE))).toBe(false);
  });

  it("a path outside the current structure scope is rejected (no mutation)", () => {
    const d = dirFor();
    runCli(d, "init");
    const fail = runCliFail(d, "structure", "describe", "does-not-exist", "x");
    expect(fail.stdout + fail.stderr).toMatch(/not a directory in the current structure scope|deeper/);
    expect(existsSync(path.join(d, STORE))).toBe(false);
  });
});

describe("generation renders descriptions and prunes stale metadata", () => {
  it("generate embeds the description; a removed directory's description is pruned on the next generate", () => {
    const d = dirFor();
    git(d, ["init", "-q", "-b", "main"]);
    git(d, ["config", "user.email", "t@e.c"]);
    git(d, ["config", "user.name", "T"]);
    git(d, ["add", "-A"]);
    git(d, ["commit", "-q", "-m", "seed"]);
    runCli(d, "init");
    runCli(d, "structure", "describe", "src", "核心源码");
    runCli(d, "generate");
    expect(readFileSync(path.join(d, STRUCTURE_SVG), "utf8")).toContain("核心源码");

    // The described directory leaves the repository tree (git rm + commit) →
    // the next generate prunes its description and still regenerates cleanly.
    git(d, ["rm", "-r", "-q", "src"]);
    git(d, ["commit", "-q", "-m", "remove src"]);
    runCli(d, "generate");
    // The last description was pruned → the store file is deleted, not emptied.
    expect(existsSync(path.join(d, STORE))).toBe(false);
    expect(runCli(d, "--json", "structure", "list")).not.toContain('"src"');
  });

  it("an inline cards.structure.descriptions key is a strict config error", () => {
    const d = dirFor();
    runCli(d, "init");
    const cfgPath = path.join(d, "arte-gitcard.yml");
    const raw = readFileSync(cfgPath, "utf8");
    const bad = raw.replace("    commits:", "    descriptions:\n      src: \"bad\"\n    commits:");
    writeFileSync(cfgPath, bad, "utf8");
    const fail = runCliFail(d, "validate");
    expect(fail.stdout + fail.stderr).toContain("descriptions");
  });
});

describe("validate + uninstall treat the store as preserved user metadata", () => {
  it("validate reports a healthy store; a malformed store fails validation", () => {
    const d = dirFor();
    runCli(d, "init");
    runCli(d, "structure", "describe", "src", "x");
    expect(runCli(d, "validate")).toContain("structure descriptions: present, valid, 1 entries");

    writeFileSync(path.join(d, STORE), "{ broken", "utf8");
    const fail = runCliFail(d, "validate");
    expect(fail.stdout + fail.stderr).toContain("not valid JSON");
  });

  it("uninstall classifies the store as preserved user metadata", () => {
    const d = dirFor();
    runCli(d, "init");
    runCli(d, "structure", "describe", "src", "x");
    const out = runCli(d, "uninstall", "--yes");
    expect(out).toContain("preserved user metadata");
    expect(out).toContain("structure-descriptions.json");
    expect(existsSync(path.join(d, STORE))).toBe(true);
  });
});

describe("nested structure.root: CLI rel / persisted repoRel / rendered rows agree", () => {
  it("describes a directory under a nested root with repo-relative keys and renders it", () => {
    const d = dirFor();
    mkdirSync(path.join(d, "packages", "app", "src"), { recursive: true });
    writeFileSync(path.join(d, "packages", "app", "src", "a.ts"), "x\n", "utf8");
    runCli(d, "init");
    runCli(d, "config", "set", "structure.root", "packages/app");
    runCli(d, "structure", "describe", "src", "核心");

    // persisted key is REPO-relative (keeps the root prefix)
    const doc = storeDoc(d);
    expect(doc.descriptions).toEqual({ "packages/app/src": "核心" });

    // CLI surface is display-relative
    const listed = JSON.parse(runCli(d, "--json", "structure", "list")) as {
      entries: Array<{ path: string; description: string }>;
    };
    expect(listed.entries.some((e) => e.path === "src" && e.description === "核心")).toBe(true);

    // rendered card carries the description (matched via the repo-relative key)
    runCli(d, "generate");
    expect(readFileSync(path.join(d, STRUCTURE_SVG), "utf8")).toContain("核心");
  });
});

describe("ignored description store warns that GitHub auto-update will not see it", () => {
  function gitRepo(d: string): void {
    git(d, ["init", "-q", "-b", "main"]);
    git(d, ["config", "user.email", "t@e.c"]);
    git(d, ["config", "user.name", "T"]);
    writeFileSync(path.join(d, "a.txt"), "x\n", "utf8");
    git(d, ["add", "-A"]);
    git(d, ["commit", "-q", "-m", "seed"]);
  }
  function enableAutoUpdate(d: string): void {
    const cfg = path.join(d, "arte-gitcard.yml");
    writeFileSync(cfg, readFileSync(cfg, "utf8").replace("auto-update: false", "auto-update: true"), "utf8");
  }

  it("a changed describe warns on stderr while --json stdout stays pure; no-op and tracked do not warn", () => {
    const d = dirFor();
    gitRepo(d);
    writeFileSync(path.join(d, ".gitignore"), ".arte-git-card/\n", "utf8");
    runCli(d, "init");
    enableAutoUpdate(d);

    const sp = spawnSync(process.execPath, [CLI, "--json", "structure", "describe", "src", "x"], {
      cwd: d,
      encoding: "utf8",
    });
    expect(sp.status).toBe(0);
    // stdout is pure JSON (no log pollution)
    const parsed = JSON.parse(sp.stdout ?? "") as { changed: boolean };
    expect(parsed.changed).toBe(true);
    // warning goes to stderr
    expect(sp.stderr ?? "").toContain("git-ignored");
    expect(sp.stderr ?? "").toContain("structure-descriptions.json");
    expect(sp.stderr ?? "").toContain("GitHub auto-update will not receive");

    // NO-OP does not warn.
    const noop = spawnSync(process.execPath, [CLI, "--json", "structure", "describe", "src", "x"], {
      cwd: d,
      encoding: "utf8",
    });
    expect(JSON.parse(noop.stdout ?? "").changed).toBe(false);
    expect(noop.stderr ?? "").not.toContain("git-ignored");

    // Once the file is TRACKED (git add -f), a further CHANGE does not warn.
    git(d, ["add", "-f", "--", ".arte-git-card/structure-descriptions.json"]);
    const tracked = spawnSync(process.execPath, [CLI, "--json", "structure", "describe", "src", "yy"], {
      cwd: d,
      encoding: "utf8",
    });
    expect(JSON.parse(tracked.stdout ?? "").changed).toBe(true);
    expect(tracked.stderr ?? "").not.toContain("git-ignored");
  });

  it("untracked-but-NOT-ignored store does not warn", () => {
    const d = dirFor();
    gitRepo(d);
    runCli(d, "init");
    enableAutoUpdate(d);
    const sp = spawnSync(process.execPath, [CLI, "--json", "structure", "describe", "src", "x"], {
      cwd: d,
      encoding: "utf8",
    });
    expect(sp.status).toBe(0);
    expect(JSON.parse(sp.stdout ?? "").changed).toBe(true);
    expect(sp.stderr ?? "").not.toContain("git-ignored");
  });
});

describe("P1-1 prune reflects the working tree; config hiding never prunes", () => {
  function gitSeed(d: string, files: string[]): void {
    git(d, ["init", "-q", "-b", "main"]);
    git(d, ["config", "user.email", "t@e.c"]);
    git(d, ["config", "user.name", "T"]);
    for (const f of files) {
      mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
      writeFileSync(path.join(d, f), "x\n", "utf8");
    }
    git(d, ["add", "-A"]);
    git(d, ["commit", "-q", "-m", "seed"]);
  }

  it("a PHYSICALLY rm'd (not staged) directory's description is pruned on generate", () => {
    const d = dirFor();
    gitSeed(d, ["src/kept/a.ts", "src/gone/a.ts"]);
    runCli(d, "init");
    runCli(d, "structure", "describe", "src/kept", "kept");
    runCli(d, "structure", "describe", "src/gone", "gone");
    expect(storeDoc(d).descriptions).toEqual({ "src/kept": "kept", "src/gone": "gone" });
    // Physical deletion — DO NOT git add / rm / commit.
    rmSync(path.join(d, "src", "gone", "a.ts"), { force: true });
    runCli(d, "generate");
    expect(storeDoc(d).descriptions).toEqual({ "src/kept": "kept" }); // gone pruned immediately
  });

  it("excluding a dir, changing structure.root or lowering max_depth never prunes its metadata", () => {
    const d = dirFor();
    gitSeed(d, ["lib/a.ts", "packages/app/src/x.ts"]);
    runCli(d, "init");
    runCli(d, "structure", "describe", "lib", "库");
    runCli(d, "structure", "describe", "packages/app/src", "深层");

    // exclude 'lib' then generate → still kept (physically present).
    runCli(d, "exclude", "add", "lib");
    runCli(d, "generate");
    expect(storeDoc(d).descriptions).toMatchObject({ lib: "库", "packages/app/src": "深层" });

    // change structure.root + lower max_depth → still kept.
    runCli(d, "config", "set", "structure.root", "packages/app");
    runCli(d, "config", "set", "structure.max-depth", "1");
    runCli(d, "generate");
    expect(storeDoc(d).descriptions).toMatchObject({ lib: "库", "packages/app/src": "深层" });
  });
});

describe("P1-2 structure list depth semantics match the card; parsing is strict", () => {
  function treeRepo(): string {
    const d = dirFor();
    mkdirSync(path.join(d, "one"), { recursive: true });
    writeFileSync(path.join(d, "one", "a.ts"), "x\n", "utf8");
    mkdirSync(path.join(d, "two", "deep", "nested"), { recursive: true });
    writeFileSync(path.join(d, "two", "deep", "nested", "x.ts"), "x\n", "utf8");
    runCli(d, "init");
    return d;
  }
  function listEntries(d: string, depth?: string): Array<{ path: string; depth: number }> {
    const args = depth === undefined ? ["--json", "structure", "list"] : ["--json", "structure", "list", depth];
    return (JSON.parse(runCli(d, ...args)) as { entries: Array<{ path: string; depth: number }> }).entries;
  }

  it("structure list 1 shows only first-level rows (depth === 0), like a max_depth=1 card", () => {
    const d = treeRepo();
    const one = listEntries(d, "1");
    expect(one.length).toBeGreaterThan(0);
    expect(one.every((e) => e.depth === 0)).toBe(true);
    expect(one.map((e) => e.path).sort()).toEqual(["one", "src", "two"]); // src is the makeSrcRepo fixture dir
    const two = listEntries(d, "2");
    expect(two.some((e) => e.path === "two/deep")).toBe(true);
    expect(two.some((e) => e.path === "two/deep/nested")).toBe(false); // depth 2 excluded
    // default == config max_depth (3) → every listed row has depth < 3
    expect(listEntries(d).every((e) => e.depth < 3)).toBe(true);
  });

  it("strict depth parsing rejects junk (2x, 2.5, -1, 0, 21, empty)", () => {
    const d = treeRepo();
    for (const bad of ["2x", "2.5", "-1", "0", "21", ""]) {
      const fail = runCliFail(d, "structure", "list", bad);
      // `-1` is rejected by commander as an unknown option; everything else by
      // the strict depth parser. Either way it must FAIL (never silently → 2).
      expect(fail.stdout + fail.stderr, `depth="${bad}"`).toMatch(/(depth must be an integer 1\.\.20|unknown option)/);
    }
  });
});
