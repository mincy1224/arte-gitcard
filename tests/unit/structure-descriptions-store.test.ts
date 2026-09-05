/**
 * Structure description STORE + prune + path UX (default-branch pass).
 * Strict validation (no silent repair/drop), deterministic serialization,
 * fail-closed filesystem safety, repo-relative keys, prototype safety, and
 * prune that only fires on genuine repository-tree disappearance.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  descriptionValueError,
  readStructureDescriptions,
  serializeStructureDescriptions,
} from "../../src/structure/descriptions.js";
import { pruneStructureKeys } from "../../src/structure/scope.js";
import { canonicalRelArg } from "../../src/structure/manage.js";
import { STRUCTURE_DESCRIPTIONS_REL as STORE_REL } from "../../src/managed/paths.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-store-"));
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
function storePath(root: string): string {
  return path.join(root, STORE_REL);
}
function writeStore(root: string, content: string): void {
  mkdirSync(path.dirname(storePath(root)), { recursive: true });
  writeFileSync(storePath(root), content, "utf8");
}

describe("description value rules", () => {
  it("accepts CJK + 20 code points; rejects >20, empty, whitespace, tab, line breaks, XML-illegal", () => {
    expect(descriptionValueError("核心源码")).toBeNull();
    expect(descriptionValueError("😀".repeat(20))).toBeNull();
    expect(descriptionValueError("😀".repeat(21))).not.toBeNull();
    expect(descriptionValueError("")).not.toBeNull();
    expect(descriptionValueError(" padded ")).not.toBeNull();
    expect(descriptionValueError("a\tb")).not.toBeNull();
    expect(descriptionValueError("a\nb")).not.toBeNull();
    expect(descriptionValueError("a\uFFFEb")).not.toBeNull();
  });
});

describe("store reading is STRICT (no silent repair/drop)", () => {
  it("absent file ⇒ empty metadata", () => {
    const r = temp();
    expect(readStructureDescriptions(r)).toEqual({ status: "absent" });
  });

  it("rejects malformed JSON / wrong top-level type / bad schemaVersion / unknown field", () => {
    const bad = temp();
    writeStore(bad, "{ not json");
    expect(() => readStructureDescriptions(bad)).toThrow(/not valid JSON/);
    const badType = temp();
    writeStore(badType, "[1,2]");
    expect(() => readStructureDescriptions(badType)).toThrow(/must be a JSON object/);
    const badVersion = temp();
    writeStore(badVersion, '{"schemaVersion":9,"descriptions":{}}');
    expect(() => readStructureDescriptions(badVersion)).toThrow(/schemaVersion/);
    const unknownField = temp();
    writeStore(unknownField, '{"schemaVersion":1,"descriptions":{},"extra":1}');
    expect(() => readStructureDescriptions(unknownField)).toThrow(/unknown top-level field/);
    const missing = temp();
    writeStore(missing, '{"descriptions":{}}');
    expect(() => readStructureDescriptions(missing)).toThrow(/schemaVersion/);
  });

  it("rejects invalid keys and invalid values; prototype-named keys stay own data", () => {
    const badKey = temp();
    writeStore(badKey, '{"schemaVersion":1,"descriptions":{"../src":"x"}}');
    expect(() => readStructureDescriptions(badKey)).toThrow(/invalid description key/);
    const badVal = temp();
    writeStore(badVal, '{"schemaVersion":1,"descriptions":{"src":""}}');
    expect(() => readStructureDescriptions(badVal)).toThrow(/invalid description for/);
    const proto = temp();
    writeStore(proto, '{"schemaVersion":1,"descriptions":{"__proto__":"p","constructor":"c"}}');
    const read = readStructureDescriptions(proto);
    if (read.status === "ok") {
      // A literal "__proto__" key is stored as an OWN data property — the object's
      // prototype is never mutated.
      expect(Object.hasOwn(read.map, "__proto__")).toBe(true);
      expect(read.map.__proto__).toBe("p");
      expect(Object.getPrototypeOf(read.map)).toBe(Object.prototype);
      expect(Object.hasOwn({}, "__proto__")).toBe(false); // Object.prototype never mutated
      expect(Object.hasOwn(read.map, "constructor")).toBe(true);
      expect(read.map.constructor).toBe("c");
    }
  });

  it("a directory at the store path fails closed (never treated as absent)", () => {
    const r = temp();
    mkdirSync(path.dirname(storePath(r)), { recursive: true });
    mkdirSync(storePath(r), { recursive: true });
    expect(() => readStructureDescriptions(r)).toThrow(/non-regular|directory/i);
  });
});

describe("serializeStructureDescriptions is deterministic", () => {
  it("sorts keys lexically and emits the versioned document", () => {
    const out = serializeStructureDescriptions({ z: "1", a: "2" });
    expect(out).toBe('{\n  "schemaVersion": 1,\n  "descriptions": {\n    "a": "2",\n    "z": "1"\n  }\n}\n');
  });
});

describe("pruneStructureKeys — whole-repository existence, fail-closed", () => {
  function gitRepo(root: string, files: Array<[string, string]>): void {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["config", "user.email", "t@e.c"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["config", "user.name", "T"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    for (const [rel, content] of files) {
      const abs = path.join(root, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
    execFileSync("git", ["add", "-A"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
  }

  it("keeps metadata for repo-tree directories, prunes only genuine disappearance", () => {
    const root = temp();
    gitRepo(root, [["src/a.ts", "x"], ["lib/b.ts", "y"]]);
    const map = { src: "源码", lib: "库", docs: "gone", "deep/er": "gone" };
    const out = pruneStructureKeys(root, map);
    expect(out.status).toBe("ok");
    expect(out.pruned).toEqual({ src: "源码", lib: "库" });
    expect(out.removed.sort()).toEqual(["deep/er", "docs"]);
  });

  it("prunes a tracked directory that was PHYSICALLY deleted with `rm` (no staging needed)", () => {
    const root = temp();
    gitRepo(root, [
      ["src/kept.ts", "x"],
      ["src/gone/a.ts", "y"],
    ]);
    // Physical deletion — NOT staged / committed.
    rmSync(path.join(root, "src", "gone", "a.ts"), { force: true });
    const map = { src: "kept", "src/gone": "gone" };
    const out = pruneStructureKeys(root, map);
    expect(out.status).toBe("ok");
    expect(out.pruned).toEqual({ src: "kept" });
    expect(out.removed).toEqual(["src/gone"]);
  });

  it("is UNVERIFIABLE (preserve everything) outside a git repository", () => {
    const root = temp();
    const map = { src: "x" };
    const out = pruneStructureKeys(root, map);
    expect(out.status).toBe("unverifiable");
    expect(out.pruned).toEqual({ src: "x" });
    expect(out.removed).toEqual([]);
  });
});

describe("Windows-friendly CLI path UX (canonicalRelArg)", () => {
  it("normalizes ./x, x/, backslash and nested forms; rejects absolute/UNC/..", () => {
    expect(canonicalRelArg("./src")).toBe("src");
    expect(canonicalRelArg("src/")).toBe("src");
    expect(canonicalRelArg("src\\components")).toBe("src/components");
    expect(canonicalRelArg("src/components/")).toBe("src/components");
    expect(() => canonicalRelArg("/abs")).toThrow(/absolute/);
    expect(() => canonicalRelArg("C:\\x")).toThrow(/drive/);
    expect(() => canonicalRelArg("\\\\server\\share")).toThrow(/UNC/);
    expect(() => canonicalRelArg("../x")).toThrow(/invalid/);
    expect(() => canonicalRelArg("")).toThrow(/expected/);
  });
});
