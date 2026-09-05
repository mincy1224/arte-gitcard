/**
 * F1 — packed POSIX smoke. `npm install -g --prefix` on POSIX links
 * `<prefix>/bin/arte-gitcard -> ../lib/node_modules/arte-gitcard/dist/cli.js`,
 * so `process.argv[1]` is a SYMLINK. The CLI must locate the vendored
 * `dist/ci/main.cjs` from the PACKAGE (real module dir), not from argv[1].
 *
 * This exercises the INSTALLED binary (not an injected ciBundlePath) and
 * verifies the vendored runtime bytes equal the packed package's main.cjs.
 *
 * Runs on Linux/macOS only (Windows uses .cmd shims where argv[1] is the real
 * file, so the bug does not reproduce there — the Windows packed smoke is
 * exercised separately).
 */

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isPosix = process.platform === "linux" || process.platform === "darwin";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function sh(cmd: string, args: string[], opts: { cwd: string; env?: Record<string, string> }): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, encoding: "utf8" });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

describe.skipIf(!isPosix)("packed POSIX global-install symlink smoke (F1)", () => {
  it("installed arte-gitcard, invoked through the npm bin symlink, vendors package dist/ci/main.cjs", () => {
    const base = mkdtempSync(path.join(tmpdir(), "agc-posix-"));
    const prefix = path.join(base, "prefix");
    const cache = path.join(base, "npm-cache");
    const work = path.join(base, "work");
    const env = { npm_config_cache: cache };
    let tgzAbs = "";
    try {
      // 1) npm pack into a DEDICATED dir; discover the one generated tarball by
      //    directory enumeration (never by parsing npm's human stdout, which can
      //    carry prepack build logs).
      const packDir = path.join(base, "pack");
      mkdirSync(packDir, { recursive: true });
      const pack = sh("npm", ["pack", "--silent", "--pack-destination", packDir], { cwd: repoRoot });
      expect(pack.status, `npm pack failed: ${pack.stderr}`).toBe(0);
      const tgz = readdirSync(packDir).filter((n) => n.endsWith(".tgz"));
      expect(tgz).toHaveLength(1);
      tgzAbs = path.join(packDir, tgz[0]!);
      expect(tgzAbs).toMatch(/arte-gitcard-1\.0\.0\.tgz$/);

      // 2) npm install -g --prefix (POSIX bin SYMLINK)
      const inst = sh("npm", ["install", "-g", "--prefix", prefix, tgzAbs], { cwd: repoRoot, env });
      expect(inst.status, `npm install failed: ${inst.stderr}`).toBe(0);
      const bin = path.join(prefix, "bin", "arte-gitcard");
      expect(existsSync(bin)).toBe(true);
      // lstatSync — statSync would FOLLOW the symlink and report the real file.
      expect(lstatSync(bin).isSymbolicLink(), "expected npm POSIX bin symlink").toBe(true);
      expect(readlinkSync(bin)).toContain("lib/node_modules/arte-gitcard/dist/cli.js");

      const pkgMain = path.join(prefix, "lib", "node_modules", "arte-gitcard", "dist", "ci", "main.cjs");
      expect(existsSync(pkgMain)).toBe(true);

      // 3) temp git repo → init → enable (run through the installed bin).
      // `enable` resolves the default branch AUTHORITATIVELY (ls-remote), so the
      // origin must advertise a real default branch before enabling.
      mkdirSync(path.join(work, "src"), { recursive: true });
      writeFileSync(path.join(work, "src", "main.ts"), "const x = 1;\n", "utf8");
      expect(sh("git", ["init", "-q", "-b", "main"], { cwd: work }).status).toBe(0);
      sh("git", ["config", "user.email", "smoke@e.c"], { cwd: work });
      sh("git", ["config", "user.name", "Smoke"], { cwd: work });
      const bareDir = path.join(base, "remote.git");
      expect(sh("git", ["init", "--bare", "-q", "-b", "main", "remote.git"], { cwd: base }).status).toBe(0);
      sh("git", ["add", "-A"], { cwd: work });
      sh("git", ["commit", "-q", "-m", "seed"], { cwd: work });
      sh("git", ["remote", "add", "origin", bareDir], { cwd: work });
      sh("git", ["push", "-q", "-u", "origin", "main"], { cwd: work });

      const init = sh(bin, ["init"], { cwd: work });
      expect(init.status, init.stderr).toBe(0);
      const enable = sh(bin, ["github", "enable"], { cwd: work });
      expect(enable.status, enable.stderr).toBe(0);

      // 4) vendored runtime bytes == packed package bytes
      const vendored = path.join(work, ".arte-git-card", "ci", "main.cjs");
      expect(existsSync(vendored)).toBe(true);
      expect(readFileSync(vendored)).toEqual(readFileSync(pkgMain));
    } finally {
      if (tgzAbs) {
        try {
          rmSync(tgzAbs, { force: true });
        } catch {
          /* best-effort */
        }
      }
      try {
        rmSync(base, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  }, 120_000);
});
