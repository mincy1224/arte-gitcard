/**
 * state.json ownership registry (P0). Coverage:
 *  - initial state, deterministic serialization (sorted entries/roots);
 *  - readState: missing / corrupt / forward-incompatible / malformed-path;
 *  - upsert/find/remove entries;
 *  - assertDeletable proof branches (ok / missing / modified / unsafe);
 *  - forged state is DATA not AUTHORITY: a src path entry parses, but the kind
 *    guard (state-guards.test.ts) + transaction engine refuse to act on it.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  initialState,
  readState,
  serializeState,
  upsertEntry,
  findEntry,
  removeEntry,
  assertDeletable,
} from "../../src/state/registry.js";
import { buildManagedGuard } from "../../src/state/guards.js";
import type { StateEntry } from "../../src/state/registry.js";
import { sha256Content } from "../../src/fs/hash.js";
import { VERSION } from "../../src/version.js";
import { makeV2Repo, okState } from "../helpers/repo.js";

const dirs: string[] = [];

function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-registry-"));
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

describe("state registry", () => {
  it("initial state serializes deterministically with sorted entries/roots", () => {
    const s = initialState();
    upsertEntry(s, { path: "b.svg", kind: "card", sha256: "0".repeat(64) });
    upsertEntry(s, { path: "a.svg", kind: "card", sha256: "1".repeat(64) });
    s.outputRoots = ["docs/cards", ".github/arte-git-card"];
    const text = serializeState(s);
    expect(text.indexOf('"path": "a.svg"')).toBeLessThan(text.indexOf('"path": "b.svg"'));
    // code-unit sort: "." (0x2e) < "d" → ".github/..." sorts before "docs/cards"
    expect(text.indexOf('".github/arte-git-card"')).toBeLessThan(text.indexOf('"docs/cards"'));
    expect(text).toContain('"schemaVersion": 2');
    expect(JSON.parse(text).toolVersion).toBeTruthy();
  });

  it("readState reports missing / corrupt / incompatible", () => {
    const root = makeV2Repo(temp()).root;

    // missing
    rmSync(path.join(root, ".arte-git-card", "state.json"));
    expect(readState(root).status).toBe("missing");

    // corrupt
    mkdirSync(path.join(root, ".arte-git-card"), { recursive: true });
    writeFileSync(path.join(root, ".arte-git-card", "state.json"), "{ not json", "utf8");
    expect(readState(root).status).toBe("corrupt");

    // incompatible (forward schema)
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({ schemaVersion: 99, toolVersion: "x", managedFiles: [], outputRoots: [] }),
      "utf8",
    );
    expect(readState(root).status).toBe("incompatible");

    // a malformed managed path is rejected as corrupt (forged path)
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({
        schemaVersion: 2,
        toolVersion: VERSION,
        managedFiles: [{ path: "../outside.txt", kind: "card", sha256: "0".repeat(64) }],
        outputRoots: [],
      }),
      "utf8",
    );
    expect(readState(root).status).toBe("corrupt");
  });

  it("compatibility is driven by schemaVersion, NOT toolVersion (older/newer tool readable)", () => {
    const root = makeV2Repo(temp()).root;
    const base = JSON.stringify({
      schemaVersion: 2,
      toolVersion: "9.9.9", // any tool version is tolerated
      managedFiles: [{ path: ".github/arte-git-card/codebase.svg", kind: "card", sha256: "0".repeat(64) }],
      outputRoots: [".github/arte-git-card"],
    });
    writeFileSync(path.join(root, ".arte-git-card", "state.json"), base, "utf8");
    const read = readState(root);
    expect(read.status).toBe("ok"); // older/future toolVersion + supported schemaVersion stays readable
  });

  it("upsert replaces by path; find/remove work", () => {
    const s = initialState();
    upsertEntry(s, { path: "a", kind: "card", sha256: "0".repeat(64) });
    upsertEntry(s, { path: "a", kind: "card", sha256: "1".repeat(64) });
    expect(s.managedFiles).toHaveLength(1);
    expect(findEntry(s, "a")?.sha256).toBe("1".repeat(64));
    removeEntry(s, "a");
    expect(findEntry(s, "a")).toBeUndefined();
  });

  it("assertDeletable: ok / missing / modified / unsafe", () => {
    const root = makeV2Repo(temp()).root;
    const outDir = path.join(root, ".github", "arte-git-card");
    mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, "codebase.svg");
    writeFileSync(file, "SVG", "utf8");
    const entry: StateEntry = { path: ".github/arte-git-card/codebase.svg", kind: "card", sha256: sha256Content("SVG") };

    expect(assertDeletable(root, entry)).toBe("ok");

    // missing
    rmSync(file);
    expect(assertDeletable(root, entry)).toBe("missing");

    // modified (recreate with different bytes)
    writeFileSync(file, "SVG-EDITED", "utf8");
    expect(assertDeletable(root, entry)).toBe("modified");

    // unsafe: replace file with a symlink pointing outside the repo
    rmSync(file);
    const outside = path.join(temp(), "outside");
    mkdirSync(outside, { recursive: true });
    let linked = true;
    try {
      symlinkSync(outside, file, "junction");
    } catch {
      linked = false;
    }
    if (!linked) return; // no symlink/junction privilege
    const st = lstatSync(file);
    expect(st.isSymbolicLink()).toBe(true);
    expect(assertDeletable(root, entry)).toBe("unsafe");
  });

  it("a forged src-path entry parses as state data but is NOT a delete authority", () => {
    const root = makeV2Repo(temp()).root;
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "index.ts"), "export = 1;\n", "utf8");
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({
        schemaVersion: 2,
        toolVersion: VERSION,
        managedFiles: [
          { path: "src/index.ts", kind: "card", sha256: sha256Content("export = 1;\n") },
        ],
        outputRoots: [],
      }),
      "utf8",
    );
    const read = okState(readState(root)); // state is data (parses fine)
    const entry = findEntry(read, "src/index.ts");
    expect(entry).toBeTruthy();
    // Even though the forged entry claims ownership, the KIND GUARD decides
    // whether arte-gitcard may touch it — and it rejects src/index.ts.
    const guard = buildManagedGuard(root, { output: { directory: ".github/arte-git-card" } });
    expect(guard({ kind: "card", rel: "src/index.ts" })).toBe(false);
  });

  it("duplicate managedFiles path (same kind) → corrupt state", () => {
    const root = makeV2Repo(temp()).root;
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({
        schemaVersion: 2,
        toolVersion: VERSION,
        managedFiles: [
          { path: ".github/arte-git-card/codebase.svg", kind: "card", sha256: sha256Content("a") },
          { path: ".github/arte-git-card/codebase.svg", kind: "card", sha256: sha256Content("b") },
        ],
        outputRoots: [],
      }),
      "utf8",
    );
    expect(readState(root).status).toBe("corrupt");
  });

  it("duplicate managedFiles path (conflicting kinds) → corrupt state", () => {
    const root = makeV2Repo(temp()).root;
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({
        schemaVersion: 2,
        toolVersion: VERSION,
        managedFiles: [
          { path: ".github/arte-git-card/codebase.svg", kind: "card", sha256: sha256Content("a") },
          { path: ".github/arte-git-card/codebase.svg", kind: "preview", sha256: sha256Content("a") },
        ],
        outputRoots: [],
      }),
      "utf8",
    );
    expect(readState(root).status).toBe("corrupt");
  });

  it("duplicate outputRoots → corrupt state", () => {
    const root = makeV2Repo(temp()).root;
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({
        schemaVersion: 2,
        toolVersion: VERSION,
        managedFiles: [],
        outputRoots: [".github/arte-git-card", ".github/arte-git-card"],
      }),
      "utf8",
    );
    expect(readState(root).status).toBe("corrupt");
  });

  it("a state.json path that is a DIRECTORY (unreadable, not ENOENT) is corrupt, never missing", () => {
    const root = makeV2Repo(temp()).root;
    rmSync(path.join(root, ".arte-git-card", "state.json"));
    mkdirSync(path.join(root, ".arte-git-card", "state.json")); // directory occupant
    expect(readState(root).status).toBe("corrupt");
  });
});

describe("assertDeletable special/non-regular classification (F3)", () => {
  it("a DIRECTORY at the managed path is unsafe (never 'missing'); a true ENOENT stays missing", () => {
    const root = makeV2Repo(temp()).root;
    const dirPath = path.join(root, ".github", "arte-git-card");
    mkdirSync(dirPath, { recursive: true });
    const dirEntry: StateEntry = { path: ".github/arte-git-card", kind: "card", sha256: sha256Content("x") };
    expect(assertDeletable(root, dirEntry)).toBe("unsafe");
    // a genuinely missing path is still 'missing'
    const missEntry: StateEntry = { path: ".github/arte-git-card/nope.svg", kind: "card", sha256: sha256Content("x") };
    expect(assertDeletable(root, missEntry)).toBe("missing");
  });
});
