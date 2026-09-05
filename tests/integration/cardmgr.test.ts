/**
 * Card lifecycle integration (Phase 3): add enables+generates; remove disables
 * and deletes the owned SVG only when unmodified; a user-modified SVG is
 * preserved with a warning (never deleted); remove --all; add --all.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli, runCliFail, makeSrcRepo, cleanup } from "./util.js";

const dirs: string[] = [];
function repo(): string {
  const d = makeSrcRepo();
  dirs.push(d);
  runCli(d, "init");
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

function cardPath(dir: string, file: string): string {
  return path.join(dir, ".github", "arte-git-card", file);
}

describe("remove", () => {
  it("disables the card and deletes the owned SVG when unmodified", () => {
    const dir = repo();
    expect(existsSync(cardPath(dir, "structure.svg"))).toBe(true);
    const out = runCli(dir, "remove", "structure");
    expect(out).toContain("disabled structure");
    expect(existsSync(cardPath(dir, "structure.svg"))).toBe(false); // owned + unmodified → deleted
    expect(existsSync(cardPath(dir, "codebase.svg"))).toBe(true);
    expect(runCli(dir, "config get", "structure.enabled")).toContain("false");
  });

  it("PRESERVES a user-modified SVG and warns (never deletes user changes)", () => {
    const dir = repo();
    const svg = cardPath(dir, "structure.svg");
    writeFileSync(svg, "user hand-edited this card", "utf8");
    const out = runCli(dir, "remove", "structure");
    expect(out).toContain("preserved to avoid deleting user changes");
    expect(readFileSync(svg, "utf8")).toBe("user hand-edited this card");
    expect(runCli(dir, "config get", "structure.enabled")).toContain("false");
  });

  it("remove --all disables + deletes both owned cards", () => {
    const dir = repo();
    runCli(dir, "remove", "--all");
    expect(runCli(dir, "config get", "codebase.enabled")).toContain("false");
    expect(runCli(dir, "config get", "structure.enabled")).toContain("false");
    expect(existsSync(cardPath(dir, "codebase.svg"))).toBe(false);
    expect(existsSync(cardPath(dir, "structure.svg"))).toBe(false);
  });

  it("an UNOWNED SVG at a managed path is never deleted by remove (COLLISION → refused, preserved)", () => {
    const dir = repo();
    // drop the codebase ownership entry but keep the file → file is now unowned
    const statePath = path.join(dir, ".arte-git-card", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.managedFiles = state.managedFiles.filter((e: { path: string }) => !e.path.endsWith("codebase.svg"));
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    const svg = cardPath(dir, "codebase.svg");
    const before = readFileSync(svg, "utf8");
    // COLLISION state → remove refuses BEFORE touching anything
    const fail = runCliFail(dir, "remove", "codebase");
    expect(fail.stdout + fail.stderr).toMatch(/collision|not owned/i);
    expect(readFileSync(svg, "utf8")).toBe(before); // never deleted
    expect(runCli(dir, "config get", "codebase.enabled")).toContain("true"); // config untouched
  });

  it("rejects an unknown card", () => {
    const dir = repo();
    const fail = runCliFail(dir, "remove", "wat");
    expect(fail.stdout + fail.stderr).toContain("unknown card");
  });
});

describe("add", () => {
  it("re-enables a removed card and regenerates it", () => {
    const dir = repo();
    runCli(dir, "remove", "structure");
    expect(existsSync(cardPath(dir, "structure.svg"))).toBe(false);
    const out = runCli(dir, "add", "structure");
    expect(out).toContain("enabled structure");
    expect(existsSync(cardPath(dir, "structure.svg"))).toBe(true);
    expect(runCli(dir, "config get", "structure.enabled")).toContain("true");
  });

  it("add --all enables everything", () => {
    const dir = repo();
    runCli(dir, "remove", "--all");
    runCli(dir, "add", "--all");
    expect(runCli(dir, "config get", "structure.enabled")).toContain("true");
    expect(existsSync(cardPath(dir, "structure.svg"))).toBe(true);
  });

  it("an already-enabled card is reported as already enabled", () => {
    const dir = repo();
    const out = runCli(dir, "add", "codebase");
    expect(out).toContain("already enabled");
  });
});
