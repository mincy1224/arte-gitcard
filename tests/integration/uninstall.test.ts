/**
 * `arte-gitcard uninstall` CLI UX (integration, spawns dist/cli.js).
 *   - non-interactive without --yes FAILS CLOSED (never guesses "yes");
 *   - --yes removes config/state/cards and the repo reports UNINITIALIZED;
 *   - --dry-run --yes is read-only and --json emits the documented shape;
 *   - help + completion include the new lifecycle command.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli, runCliFail, makeSrcRepo, cleanup } from "./util.js";

const dirs: string[] = [];
function repo(): string {
  const d = makeSrcRepo();
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

describe("uninstall CLI", () => {
  it("requires --yes when not interactive (fails closed, nothing removed)", () => {
    const dir = repo();
    runCli(dir, "init");
    const fail = runCliFail(dir, "uninstall");
    expect(fail.stdout + fail.stderr).toMatch(/--yes/);
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
  });

  it("removes the arte-gitcard installation and status reports UNINITIALIZED", () => {
    const dir = repo();
    runCli(dir, "init");
    const out = runCli(dir, "uninstall", "--yes");
    expect(out).toContain("removed arte-gitcard.yml");
    expect(out).toContain("removed .arte-git-card/state.json");
    expect(out).toContain("uninstalled");
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(false);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(false);
    expect(JSON.parse(runCli(dir, "status", "--json")).state).toBe("UNINITIALIZED");
  });

  it("preserves a user-modified managed card (and reports it, not an uninstall failure)", () => {
    const dir = repo();
    runCli(dir, "init");
    const card = path.join(dir, ".github", "arte-git-card", "structure.svg");
    const hacked = readFileSync(card, "utf8") + "<!-- user -->";
    writeFileSync(card, hacked, "utf8");
    const out = runCli(dir, "uninstall", "--yes");
    expect(out).toMatch(/preserved .*structure\.svg/i);
    expect(readFileSync(card, "utf8")).toBe(hacked); // still on disk
    // config + state + the OTHER card are gone
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(false);
  });

  it("--dry-run --yes leaves every file in place and --json emits the documented shape", () => {
    const dir = repo();
    runCli(dir, "init");
    const doc = JSON.parse(runCli(dir, "uninstall", "--dry-run", "--yes", "--json")) as {
      command: string;
      dryRun: boolean;
      removed: string[];
      preserved: Array<{ path: string; reason: string }>;
      status: string;
    };
    expect(doc.command).toBe("uninstall");
    expect(doc.dryRun).toBe(true);
    expect(doc.removed).toContain("arte-gitcard.yml");
    expect(doc.removed).toContain(".arte-git-card/state.json");
    expect(Array.isArray(doc.preserved)).toBe(true);
    expect(doc.status).toBe("uninitialized");
    // nothing actually removed, no lock/journal
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(true);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(true);
    expect(existsSync(path.join(dir, ".arte-git-card", ".lock"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
  });

  it("UNINITIALIZED → refuses with an actionable message", () => {
    const dir = repo();
    const fail = runCliFail(dir, "uninstall", "--yes");
    expect(fail.stdout + fail.stderr).toMatch(/nothing to uninstall|No arte-gitcard\.yml/i);
  });

  it("appears in --help and dynamic completion", () => {
    const dir = repo();
    expect(runCli(dir, "--help")).toContain("uninstall");
    expect(runCli(dir, "__complete", "")).toContain("uninstall");
  });
});

describe("U-2: orphan metadata is never reported UNINITIALIZED (status + init)", () => {
  function orphanStateRepo(): string {
    const dir = repo();
    runCli(dir, "init");
    // remove ONLY the config → orphaned ownership state remains
    rmSync(path.join(dir, "arte-gitcard.yml"), { force: true });
    return dir;
  }

  it("status reports DAMAGED (not UNINITIALIZED) when only state.json remains", () => {
    const dir = orphanStateRepo();
    const doc = JSON.parse(runCli(dir, "status", "--json")) as { state: string };
    expect(doc.state).toBe("DAMAGED");
  });

  it("init refuses orphaned state (status and init never disagree)", () => {
    const dir = orphanStateRepo();
    const fail = runCliFail(dir, "init");
    expect(fail.stdout + fail.stderr).toMatch(/no config/i);
    expect(existsSync(path.join(dir, ".arte-git-card", "state.json"))).toBe(true); // untouched
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(false);
  });
});
