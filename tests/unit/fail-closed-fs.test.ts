/**
 * SEC-LAST: filesystem verification errors FAIL CLOSED.
 *
 * A deletion-authority check must treat ONLY `ENOENT` as "genuinely absent".
 * Every other filesystem error from lstat (EACCES / EPERM / EIO / ENOTDIR / …)
 * makes the component UNVERIFIABLE → unsafe / false / DAMAGED — never a silent
 * "safe". Covered:
 *   - pathHasNoSymlinkComponents: ENOENT stays allowed, EACCES/EPERM → false;
 *   - toolDirSafe / uninstallRepository: an unverifiable `.arte-git-card`
 *     lstat → ZERO writes;
 *   - repo/detect.ts: an unverifiable `.arte-git-card` → DAMAGED (tool-dir-unsafe),
 *     never UNINITIALIZED, and state/journal are NOT read through it.
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Injectable seam: make node:fs.lstatSync throw a specific errno for ONE exact
// path. Every other call passes through to the real implementation, so the rest
// of the tooling (seedHealthyRepo, config/state IO, …) behaves normally.
const fsMock = vi.hoisted(() => ({ path: null as string | null, code: "EACCES" }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    lstatSync: (...args: unknown[]) => {
      if (fsMock.path && typeof args[0] === "string" && args[0] === fsMock.path) {
        const err = new Error(`mock lstat ${fsMock.code}`) as NodeJS.ErrnoException;
        err.code = fsMock.code;
        throw err;
      }
      return (actual.lstatSync as unknown as (...a: unknown[]) => unknown)(...args);
    },
  };
});

import { pathHasNoSymlinkComponents } from "../../src/fs/pathguard.js";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { uninstallRepository } from "../../src/lifecycle/uninstall.js";
import { seedHealthyRepo } from "../helpers/repo.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-failclosed-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  fsMock.path = null;
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
      // flag is null here → the node:fs mock passes through to the real lstat.
      const st = lstatSync(abs);
      if (st.isDirectory()) walk(abs);
      else out.set(path.relative(root, abs).split(path.sep).join("/"), readFileSync(abs, "utf8"));
    }
  };
  walk(root);
  return out;
}

describe("SEC-LAST: pathHasNoSymlinkComponents fails closed on fs errors", () => {
  it("ENOENT is genuine absence → allowed", () => {
    const root = temp();
    mkdirSync(path.join(root, "a"), { recursive: true });
    writeFileSync(path.join(root, "a", "f.txt"), "x", "utf8");
    // present, no symlink → safe
    expect(pathHasNoSymlinkComponents(root, "a/f.txt")).toBe(true);
    // genuinely absent path (first missing component throws ENOENT) → allowed
    expect(pathHasNoSymlinkComponents(root, "nope/x.txt")).toBe(true);
  });

  it("EACCES on an ancestor component → unsafe (false)", () => {
    const root = temp();
    fsMock.path = path.join(root, "a");
    fsMock.code = "EACCES";
    expect(pathHasNoSymlinkComponents(root, "a/f.txt")).toBe(false);
  });

  it("EPERM on an ancestor component → unsafe (false)", () => {
    const root = temp();
    fsMock.path = path.join(root, "a");
    fsMock.code = "EPERM";
    expect(pathHasNoSymlinkComponents(root, "a/f.txt")).toBe(false);
  });
});

describe("SEC-LAST: uninstall tool-dir verification error → ZERO writes", () => {
  it("an unverifiable .arte-git-card lstat fails closed before any transaction", () => {
    const root = temp();
    seedHealthyRepo(root);
    const before = snapshot(root);

    fsMock.path = path.join(root, ".arte-git-card");
    fsMock.code = "EACCES";
    expect(() => uninstallRepository(root)).toThrow(/\.arte-git-card|unsafe|symlink|fail/i);
    fsMock.path = null;

    // ZERO writes: byte-identical tree, no lock/journal created.
    expect(snapshot(root)).toEqual(before);
    const dirsHere = readdirSync(path.join(root, ".arte-git-card"));
    expect(dirsHere.includes(".lock")).toBe(false);
    expect(dirsHere.includes("txn.json")).toBe(false);
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toBeTruthy();
  });
});

describe("SEC-LAST: detector tool-dir verification error → DAMAGED, never UNINITIALIZED", () => {
  it("an unverifiable .arte-git-card lstat is DAMAGED (tool-dir-unsafe), not UNINITIALIZED", () => {
    const root = temp();
    // no config; a leftover tool dir + state exists (but must NOT be read through)
    mkdirSync(path.join(root, ".arte-git-card"), { recursive: true });
    writeFileSync(path.join(root, ".arte-git-card", "state.json"), "{}", "utf8");

    fsMock.path = path.join(root, ".arte-git-card");
    fsMock.code = "EACCES";
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DAMAGED");
    expect(d.state).not.toBe("UNINITIALIZED");
    expect(d.diagnoses.some((x) => x.code === "tool-dir-unsafe")).toBe(true);
    // detection did NOT treat the unreadable tool dir as an empty repo
    expect(d.diagnoses.some((x) => x.code === "orphan-state")).toBe(false);
  });
});
