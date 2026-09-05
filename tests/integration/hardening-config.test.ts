/**
 * FH-2 integration: `config reset` on an already-default semantic value is a
 * TRUE zero-write — no transaction, no lock/journal, and the config file (with
 * comments/formatting) is byte-identical.
 */

import { describe, expect, it, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runCli, tempDir, cleanup } from "./util.js";

const dirs: string[] = [];
function repo(): string {
  const dir = tempDir();
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

describe("FH-2 config reset zero-write", () => {
  it("resetting output.directory while it is already the default is byte-identical + no lock/journal", () => {
    const dir = repo();
    runCli(dir, "init");
    const cfg = path.join(dir, "arte-gitcard.yml");
    const before = readFileSync(cfg, "utf8");
    expect(before).toContain("#"); // the template keeps comments/formatting

    const out = runCli(dir, "config reset", "output.directory");
    expect(out).toMatch(/already at its default/i);
    expect(readFileSync(cfg, "utf8")).toBe(before); // EXACT bytes preserved
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(existsSync(path.join(dir, ".arte-git-card", ".lock"))).toBe(false);
  });

  it("resetting a persisted setting already at its default is also a byte-identical no-op", () => {
    const dir = repo();
    runCli(dir, "init");
    const cfg = path.join(dir, "arte-gitcard.yml");
    const before = readFileSync(cfg, "utf8");

    const out = runCli(dir, "config reset", "structure.max-depth");
    expect(out).toMatch(/already at its default/i);
    expect(readFileSync(cfg, "utf8")).toBe(before);
  });
});
