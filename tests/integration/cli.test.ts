/**
 * CLI integration (v2): spawn the BUILT CLI (dist/cli.js).
 * The dist is built in `beforeAll` if missing — the suite NEVER silently
 * passes just because dist isn't there.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CLI = path.resolve("dist/cli.js");

beforeAll(() => {
  if (!existsSync(CLI)) {
    execFileSync("npm", ["run", "build"], { stdio: "pipe", encoding: "utf8" });
  }
  if (!existsSync(CLI)) {
    throw new Error(`dist/cli.js is missing and could not be built. Run "npm run build" first.`);
  }
});

function run(args: string[], cwd: string): string {
  return execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
}

function makeRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "arte-cli-"));
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "main.ts"), "const x = 1;\n// c\n\n", "utf8");
  return dir;
}

/** Minimal schema-valid v2 config YAML with a customizable output.directory. */
function v2ConfigYaml(outputDir: string): string {
  return `schema-version: 2
cards:
  codebase:
    enabled: true
    languages:
      include_comments: false
  structure:
    enabled: true
    root: "."
    max_depth: 3
    activity_days: 7
    commits:
      enabled: true
    changes:
      enabled: true
theme: ".arte-git-card/themes/arte-theme.yml"
output:
  directory: "${outputDir}"
auto-update: false
`;
}

describe("CLI (dist)", () => {
  it("init → generate → validate round-trip works end to end (v2 config)", () => {
    const dir = makeRepo();
    const initOut = run(["init"], dir);
    expect(initOut).toContain("created");
    expect(existsSync(path.join(dir, "arte-gitcard.yml"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "codebase.svg"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "structure.svg"))).toBe(true);
    // no package.json / node_modules in the target repo
    expect(existsSync(path.join(dir, "package.json"))).toBe(false);
    expect(existsSync(path.join(dir, "node_modules"))).toBe(false);

    const validateOut = run(["validate"], dir);
    expect(validateOut).toContain("config ok");

    const genOut = run(["generate", "--preview"], dir);
    expect(genOut).toContain("preview.html");
    expect(existsSync(path.join(dir, ".github", "arte-git-card", "preview.html"))).toBe(true);
  }, 30000);

  it("generate without init reports an actionable error", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "arte-cli-noconfig-"));
    expect(() => run(["generate"], dir)).toThrow(/arte-gitcard init/);
  });

  it("generate refuses an output.directory that escapes the project root (no writes outside)", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "arte-escape-"));
    const dir = path.join(parent, "repo");
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "main.ts"), "const x = 1;\n// c\n\n", "utf8");
    try {
      run(["init"], dir); // scaffold the default config first
      const outside = path.join(parent, "outside");
      writeFileSync(path.join(dir, "arte-gitcard.yml"), v2ConfigYaml("../outside"), "utf8");
      try {
        run(["generate"], dir);
        expect.fail("generate should have refused the escaping output.directory");
      } catch (err) {
        const e = err as { stderr?: string };
        expect(e.stderr ?? "").toContain("inside the project root");
      }
      expect(existsSync(path.join(outside, "codebase.svg"))).toBe(false);
      expect(existsSync(path.join(outside, "structure.svg"))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 30000);

  it("generate refuses an output.directory whose in-repo component is a symlink to outside", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "arte-symlink-"));
    const dir = path.join(parent, "repo");
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "main.ts"), "const x = 1;\n", "utf8");
    const outside = path.join(parent, "outside");
    mkdirSync(outside, { recursive: true });
    let linked = true;
    try {
      symlinkSync(outside, path.join(dir, "link"), "junction");
    } catch {
      linked = false;
    }
    try {
      run(["init"], dir); // scaffold the default config first
      if (!linked) return; // no symlink/junction privilege — nothing to assert
      writeFileSync(path.join(dir, "arte-gitcard.yml"), v2ConfigYaml("./link/out"), "utf8");
      try {
        run(["generate"], dir);
        expect.fail("generate should have refused the symlinked output.directory");
      } catch (err) {
        const e = err as { stderr?: string };
        expect(e.stderr ?? "").toContain("symbolic link");
      }
      expect(existsSync(path.join(outside, "codebase.svg"))).toBe(false);
      expect(existsSync(path.join(outside, "structure.svg"))).toBe(false);
      expect(existsSync(path.join(outside, "out", "codebase.svg"))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 30000);
});
