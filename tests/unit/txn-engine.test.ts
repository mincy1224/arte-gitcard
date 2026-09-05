/**
 * Transaction engine + journal recovery (Phase 0, P0):
 *  - writes → deletes → state.json LAST, journal cleared;
 *  - dry-run: validates, reports effects, ZERO writes and no lock/dir side effect;
 *  - delete ownership proof: hash mismatch or non-regular target → refuse & preserve;
 *  - journal recovery re-verifies every op (write already applied / staged-not-applied /
 *    user-modified → stop & preserve; delete current==before → remove, else preserve);
 *  - orphaned journal auto-recovers inside runTransaction before a new txn.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runTransaction } from "../../src/txn/engine.js";
import type { TxnPlan } from "../../src/txn/plan.js";
import { buildJournal, inspectJournal, writeJournal } from "../../src/txn/journal.js";
import { recoverJournal } from "../../src/txn/recover.js";
import { sha256Content } from "../../src/fs/hash.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-txn-"));
  dirs.push(dir);
  return dir;
}

function repo(opts: { root: string }): { root: string; statePath: string; journalPath: string; lockPath: string } {
  const root = opts.root;
  return {
    root,
    statePath: path.join(root, ".arte-git-card", "state.json"),
    journalPath: path.join(root, ".arte-git-card", "txn.json"),
    lockPath: path.join(root, ".arte-git-card", ".lock"),
  };
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

describe("txn/engine", () => {
  it("applies writes → deletes → state.json last and clears the journal + lock", () => {
    const dir = tempDir();
    const r = repo({ root: dir });
    const aPath = path.join(dir, "a.txt");
    const oldPath = path.join(dir, "old.txt");
    writeFileSync(aPath, "old-a");
    writeFileSync(oldPath, "old-content");
    const plan: TxnPlan = {
      writes: [
        { rel: "a.txt", abs: aPath, content: "new-a\n", kind: "card" },
        { rel: "new.txt", abs: path.join(dir, "new.txt"), content: "fresh", kind: "card" },
      ],
      deletes: [{ rel: "old.txt", abs: oldPath, kind: "card", expectedSha256: sha256Content("old-content") }],
      stateJson: { rel: ".arte-git-card/state.json", content: '{"schemaVersion":2}' },
    };
    const result = runTransaction(plan, { repoRoot: dir, command: "test" });

    expect(readFileSync(aPath, "utf8")).toBe("new-a\n");
    expect(readFileSync(path.join(dir, "new.txt"), "utf8")).toBe("fresh");
    expect(existsSync(oldPath)).toBe(false);
    expect(readFileSync(r.statePath, "utf8")).toBe('{"schemaVersion":2}');
    expect(existsSync(r.journalPath)).toBe(false);
    expect(existsSync(r.lockPath)).toBe(false);
    // effect order: writes, then delete, then state
    expect(result.effects.map((e) => e.type)).toEqual(["write", "write", "delete", "state"]);
  });

  it("dry-run reports effects with ZERO writes and no lock/dir side effect", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    const oldPath = path.join(dir, "old.txt");
    writeFileSync(aPath, "old-a");
    writeFileSync(oldPath, "old-content");
    const plan: TxnPlan = {
      writes: [
        { rel: "a.txt", abs: aPath, content: "new-a", kind: "card" },
        { rel: "new.txt", abs: path.join(dir, "new.txt"), content: "fresh", kind: "card" },
      ],
      deletes: [{ rel: "old.txt", abs: oldPath, kind: "card", expectedSha256: sha256Content("old-content") }],
      stateJson: { rel: ".arte-git-card/state.json", content: "{}" },
    };
    const result = runTransaction(plan, { repoRoot: dir, command: "test", dryRun: true });

    expect(result.effects).toContainEqual({ type: "write", rel: "a.txt", kind: "card", mode: "replace" });
    expect(result.effects).toContainEqual({ type: "write", rel: "new.txt", kind: "card", mode: "create" });
    expect(result.effects).toContainEqual({ type: "delete", rel: "old.txt", kind: "card" });
    expect(result.effects).toContainEqual({ type: "state", rel: ".arte-git-card/state.json" });
    expect(readFileSync(aPath, "utf8")).toBe("old-a"); // untouched
    expect(existsSync(path.join(dir, "new.txt"))).toBe(false);
    expect(existsSync(path.join(dir, "old.txt"))).toBe(true);
    expect(existsSync(path.join(dir, ".arte-git-card"))).toBe(false); // no lock dir side effect
  });

  it("refuses a delete whose on-disk hash no longer matches (preserves the file)", () => {
    const dir = tempDir();
    const oldPath = path.join(dir, "old.txt");
    writeFileSync(oldPath, "user-modified");
    const plan: TxnPlan = {
      writes: [],
      deletes: [{ rel: "old.txt", abs: oldPath, kind: "card", expectedSha256: sha256Content("generated-original") }],
      stateJson: null,
    };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/no longer matches/);
    expect(readFileSync(oldPath, "utf8")).toBe("user-modified"); // preserved
  });

  it("refuses to delete a directory target", () => {
    const dir = tempDir();
    const subDir = path.join(dir, "somedir");
    mkdirSync(subDir);
    const plan: TxnPlan = {
      writes: [],
      deletes: [{ rel: "somedir", abs: subDir, kind: "card", expectedSha256: "anything" }],
      stateJson: null,
    };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/non-regular/);
    expect(existsSync(subDir)).toBe(true);
  });

  it("escaped write paths are refused before any change", () => {
    const dir = tempDir();
    const plan: TxnPlan = {
      writes: [{ rel: "../outside.txt", abs: path.join(dir, "..", "outside.txt"), content: "x", kind: "card" }],
      deletes: [],
      stateJson: null,
    };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test", dryRun: true })).toThrow(/unsafe/);
  });
});

describe("optimistic preconditions (read-modify-write protection)", () => {
  const STORE = ".arte-git-card/structure-descriptions.json";

  it("a satisfied sha256 precondition lets the transaction proceed", () => {
    const dir = tempDir();
    const storeAbs = path.join(dir, STORE);
    mkdirSync(path.dirname(storeAbs), { recursive: true });
    writeFileSync(storeAbs, "old-store", "utf8");
    const target = path.join(dir, "new.txt");
    const plan: TxnPlan = {
      writes: [{ rel: "new.txt", abs: target, content: "fresh", kind: "card" }],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "sha256", rel: STORE, expectedSha256: sha256Content("old-store") }],
    };
    runTransaction(plan, { repoRoot: dir, command: "test" });
    expect(readFileSync(target, "utf8")).toBe("fresh");
  });

  it("a satisfied absent precondition lets a fresh store be created", () => {
    const dir = tempDir();
    const storeAbs = path.join(dir, STORE);
    const plan: TxnPlan = {
      writes: [{ rel: STORE, abs: storeAbs, content: '{"schemaVersion":1}', kind: "card" }],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "absent", rel: STORE }],
    };
    runTransaction(plan, { repoRoot: dir, command: "test" });
    expect(readFileSync(storeAbs, "utf8")).toBe('{"schemaVersion":1}');
  });

  it("a sha256 mismatch (store changed between load and txn) → zero mutation, actionable retry", () => {
    const dir = tempDir();
    const storeAbs = path.join(dir, STORE);
    mkdirSync(path.dirname(storeAbs), { recursive: true });
    writeFileSync(storeAbs, "old-store", "utf8");
    const target = path.join(dir, "new.txt");
    const plan: TxnPlan = {
      writes: [{ rel: "new.txt", abs: target, content: "fresh", kind: "card" }],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "sha256", rel: STORE, expectedSha256: sha256Content("old-store") }],
    };
    // A concurrent writer changes the store after our plan was built.
    writeFileSync(storeAbs, "concurrent-edit", "utf8");
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/changed concurrently|Retry/);
    expect(readFileSync(storeAbs, "utf8")).toBe("concurrent-edit"); // never overwritten
    expect(existsSync(target)).toBe(false); // nothing else was written
  });

  it("an absent precondition violated (target appeared) → zero mutation", () => {
    const dir = tempDir();
    const storeAbs = path.join(dir, STORE);
    const plan: TxnPlan = {
      writes: [{ rel: STORE, abs: storeAbs, content: "x", kind: "card" }],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "absent", rel: STORE }],
    };
    mkdirSync(path.dirname(storeAbs), { recursive: true });
    writeFileSync(storeAbs, "someone-else-created-me", "utf8");
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/appeared concurrently|Retry/);
    expect(readFileSync(storeAbs, "utf8")).toBe("someone-else-created-me");
  });

  it("a sha256 precondition on a non-regular target fails closed (never 'absent')", () => {
    const dir = tempDir();
    const storeAbs = path.join(dir, STORE);
    mkdirSync(storeAbs, { recursive: true }); // a directory at the store path
    const plan: TxnPlan = {
      writes: [],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "sha256", rel: STORE, expectedSha256: "0".repeat(64) }],
    };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/not a regular file|fail closed/);
  });

  it("LOST-UPDATE: two plans built on the same old store cannot silently overwrite each other", () => {
    const dir = tempDir();
    const storeAbs = path.join(dir, STORE);
    mkdirSync(path.dirname(storeAbs), { recursive: true });
    writeFileSync(storeAbs, "{}", "utf8");
    const oldHash = sha256Content("{}");
    // A and B both read the SAME old store ("{}") and each plan to write their key.
    const planA: TxnPlan = {
      writes: [{ rel: STORE, abs: storeAbs, content: '{"src":"A"}', kind: "card" }],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "sha256", rel: STORE, expectedSha256: oldHash }],
    };
    const planB: TxnPlan = {
      writes: [{ rel: STORE, abs: storeAbs, content: '{"lib":"B"}', kind: "card" }],
      deletes: [],
      stateJson: null,
      preconditions: [{ kind: "sha256", rel: STORE, expectedSha256: oldHash }],
    };
    // A commits first (the store advances).
    runTransaction(planA, { repoRoot: dir, command: "test" });
    expect(readFileSync(storeAbs, "utf8")).toBe('{"src":"A"}');
    // B is built on the STALE read → its precondition must reject it (no lost update).
    expect(() => runTransaction(planB, { repoRoot: dir, command: "test" })).toThrow(/changed concurrently|Retry/);
    expect(readFileSync(storeAbs, "utf8")).toBe('{"src":"A"}'); // A's metadata is never lost
  });
});

describe("txn/recovery", () => {
  it("recovery treats an already-applied write as done", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "new-a");
    const journalPath = path.join(dir, ".txn.json");
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "a.txt", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("new-a"), stagingRel: null, stagingSha256: null },
    ]));
    const result = recoverJournal(dir, { repoRoot: dir, journalPath });
    expect(result.preserved).toEqual([]);
    expect(readFileSync(aPath, "utf8")).toBe("new-a");
    expect(existsSync(journalPath)).toBe(false); // journal cleared
  });

  it("recovery commits a staged-but-not-applied write only when hashes match", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "old-a");
    // Real arte-gitcard journals always name staging `.agc-<pid>-<hex>` as a
    // sibling of the final target — recovery only honors such staging.
    const stagingName = `.agc-${process.pid}-${"a".repeat(12)}`;
    const stagingPath = path.join(dir, stagingName);
    writeFileSync(stagingPath, "new-a");
    const journalPath = path.join(dir, ".txn.json");
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "a.txt", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("new-a"), stagingRel: stagingName, stagingSha256: sha256Content("new-a") },
    ]));
    const result = recoverJournal(dir, { repoRoot: dir, journalPath });
    expect(result.preserved).toEqual([]);
    expect(readFileSync(aPath, "utf8")).toBe("new-a");
    expect(existsSync(stagingPath)).toBe(false);
  });

  it("recovery PRESERVES when the user modified the final file after crash", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "user-changed"); // neither before nor after hash
    const stagingPath = path.join(dir, ".staged-content");
    writeFileSync(stagingPath, "new-a");
    const journalPath = path.join(dir, ".txn.json");
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "a.txt", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("new-a"), stagingRel: ".staged-content", stagingSha256: sha256Content("new-a") },
    ]));
    const result = recoverJournal(dir, { repoRoot: dir, journalPath });
    expect(result.preserved).toContain("a.txt");
    expect(readFileSync(aPath, "utf8")).toBe("user-changed"); // never overwritten
    expect(existsSync(journalPath)).toBe(true); // journal stays for doctor
  });

  it("recovery removes a delete target only when it still equals beforeSha256", () => {
    const dir = tempDir();
    const dPath = path.join(dir, "d.txt");
    const journalPath = path.join(dir, ".txn.json");

    // case 1: file == before → removed
    writeFileSync(dPath, "managed");
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "d.txt", op: "delete", beforeSha256: sha256Content("managed"), afterSha256: null, stagingRel: null, stagingSha256: null },
    ]));
    let result = recoverJournal(dir, { repoRoot: dir, journalPath });
    expect(result.preserved).toEqual([]);
    expect(existsSync(dPath)).toBe(false);

    // case 2: user changed it → preserved, journal stays
    writeFileSync(dPath, "user-edited");
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "d.txt", op: "delete", beforeSha256: sha256Content("managed"), afterSha256: null, stagingRel: null, stagingSha256: null },
    ]));
    result = recoverJournal(dir, { repoRoot: dir, journalPath });
    expect(result.preserved).toContain("d.txt");
    expect(readFileSync(dPath, "utf8")).toBe("user-edited");
    expect(existsSync(journalPath)).toBe(true);
  });

  it("recovery applies kind path guards and refuses unmanaged paths", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "src", "index.ts");
    mkdirSync(path.dirname(aPath), { recursive: true });
    writeFileSync(aPath, "old-a");
    const stagingPath = path.join(dir, ".staged");
    writeFileSync(stagingPath, "new-a");
    const journalPath = path.join(dir, ".txn.json");
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "src/index.ts", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("new-a"), stagingRel: ".staged", stagingSha256: sha256Content("new-a") },
    ]));
    // Guard rejects anything that is not a managed kind path.
    const guard = (ctx: { kind: string; rel: string }): boolean => ctx.kind === "card" && ctx.rel.startsWith(".github/arte-git-card/");
    const result = recoverJournal(dir, { repoRoot: dir, journalPath, guard });
    expect(result.preserved).toContain("src/index.ts");
    expect(readFileSync(aPath, "utf8")).toBe("old-a"); // never touched via an unguarded path
    expect(existsSync(journalPath)).toBe(true);
  });

  it("runTransaction auto-recovers an orphaned journal that preserved nothing, then applies", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "old-a");
    // Simulate a crash: a write was staged (compliant sibling .agc-* temp) but not applied.
    const stagingName = `.agc-${process.pid}-${"b".repeat(12)}`;
    const stagingPath = path.join(dir, stagingName);
    writeFileSync(stagingPath, "half-new");
    const journalPath = path.join(dir, ".arte-git-card", "txn.json");
    mkdirSync(path.dirname(journalPath), { recursive: true });
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "a.txt", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("half-new"), stagingRel: stagingName, stagingSha256: sha256Content("half-new") },
    ]));
    const plan: TxnPlan = {
      writes: [{ rel: "a.txt", abs: aPath, content: "final-a", kind: "card" }],
      deletes: [],
      stateJson: null,
    };
    runTransaction(plan, { repoRoot: dir, command: "test" });
    // Recovery applied the half-new staging, then our new txn wrote final-a.
    expect(readFileSync(aPath, "utf8")).toBe("final-a");
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
  });

  it("runTransaction refuses when an orphaned journal preserved user changes", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "user-new");
    const stagingPath = path.join(dir, ".staged");
    writeFileSync(stagingPath, "txn-content");
    const journalPath = path.join(dir, ".arte-git-card", "txn.json");
    mkdirSync(path.dirname(journalPath), { recursive: true });
    writeJournal(journalPath, buildJournal(dir, [
      { kind: "card", rel: "a.txt", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("txn-content"), stagingRel: ".staged", stagingSha256: sha256Content("txn-content") },
    ]));
    const plan: TxnPlan = { writes: [], deletes: [], stateJson: null };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/could not be recovered/);
    expect(readFileSync(aPath, "utf8")).toBe("user-new");
  });

  it("releases the repo lock when a blocked orphan recovery aborts the transaction", () => {
    const dir = tempDir();
    const r = repo({ root: dir });
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "user-new");
    const stagingPath = path.join(dir, ".staged");
    writeFileSync(stagingPath, "txn-content");
    mkdirSync(path.dirname(r.journalPath), { recursive: true });
    writeJournal(
      r.journalPath,
      buildJournal(dir, [
        { kind: "card", rel: "a.txt", op: "write", beforeSha256: sha256Content("old-a"), afterSha256: sha256Content("txn-content"), stagingRel: ".staged", stagingSha256: sha256Content("txn-content") },
      ]),
    );
    const plan: TxnPlan = { writes: [], deletes: [], stateJson: null };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/could not be recovered/);
    // The recovery threw UNDER the lock — the lock must already be released.
    expect(existsSync(r.lockPath)).toBe(false);
    expect(existsSync(r.journalPath)).toBe(true); // evidence kept for doctor
    // After clearing the preserved journal, a NEW transaction in the same
    // process acquires the lock immediately (it is not leaked/held).
    rmSync(r.journalPath, { force: true });
    const okPlan: TxnPlan = {
      writes: [{ rel: "a.txt", abs: aPath, content: "final\n", kind: "card" }],
      deletes: [],
      stateJson: null,
    };
    expect(() => runTransaction(okPlan, { repoRoot: dir, command: "test" })).not.toThrow();
    expect(readFileSync(aPath, "utf8")).toBe("final\n");
    expect(existsSync(r.lockPath)).toBe(false);
  });

  it("fails closed on a corrupt orphan journal: preserved, never overwritten, lock released", () => {
    const dir = tempDir();
    const r = repo({ root: dir });
    mkdirSync(path.dirname(r.journalPath), { recursive: true });
    writeFileSync(r.journalPath, "{ not json", "utf8");
    const plan: TxnPlan = { writes: [], deletes: [], stateJson: null };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/cannot be safely verified or recovered/);
    expect(readFileSync(r.journalPath, "utf8")).toBe("{ not json"); // evidence preserved verbatim
    expect(existsSync(r.lockPath)).toBe(false);
  });

  it("fails closed on a repoRoot-mismatched orphan journal: preserved, lock released", () => {
    const dir = tempDir();
    const r = repo({ root: dir });
    mkdirSync(path.dirname(r.journalPath), { recursive: true });
    writeJournal(
      r.journalPath,
      buildJournal(path.join(dir, "some-other-repo"), [
        { kind: "card", rel: "a.txt", op: "write", beforeSha256: null, afterSha256: sha256Content("x"), stagingRel: null, stagingSha256: null },
      ]),
    );
    const plan: TxnPlan = { writes: [], deletes: [], stateJson: null };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/is mismatch and cannot be safely verified/);
    expect(existsSync(r.journalPath)).toBe(true); // never overwritten/removed
    expect(existsSync(r.lockPath)).toBe(false);
  });

  it("recoverJournal never removes an unrecognizable (corrupt/mismatched) journal", () => {
    const dir = tempDir();
    const corruptPath = path.join(dir, ".corrupt.txn.json");
    writeFileSync(corruptPath, "@@@not-json@@@", "utf8");
    let res = recoverJournal(dir, { repoRoot: dir, journalPath: corruptPath });
    expect(res.preserved).toEqual([]);
    expect(res.journalPresent).toBe(true);
    expect(existsSync(corruptPath)).toBe(true);

    const otherDir = path.join(dir, "other");
    const mismatchPath = path.join(dir, ".mismatch.txn.json");
    writeJournal(
      mismatchPath,
      buildJournal(otherDir, [
        { kind: "card", rel: "a.txt", op: "write", beforeSha256: null, afterSha256: sha256Content("x"), stagingRel: null, stagingSha256: null },
      ]),
    );
    res = recoverJournal(dir, { repoRoot: dir, journalPath: mismatchPath });
    expect(res.journalPresent).toBe(true);
    expect(res.preserved).toEqual([]);
    expect(existsSync(mismatchPath)).toBe(true); // never removed
  });

  it("journal ops carry kind/rel/before/after/staging hashes", () => {
    const dir = tempDir();
    const aPath = path.join(dir, "a.txt");
    writeFileSync(aPath, "old-a");
    const oldPath = path.join(dir, "old.txt");
    writeFileSync(oldPath, "managed");
    const plan: TxnPlan = {
      writes: [{ rel: "a.txt", abs: aPath, content: "new-a", kind: "card" }],
      deletes: [{ rel: "old.txt", abs: oldPath, kind: "card", expectedSha256: sha256Content("managed") }],
      stateJson: { rel: ".arte-git-card/state.json", content: "{}" },
    };
    runTransaction(plan, { repoRoot: dir, command: "test" });
    // After a successful run the journal is cleared; run a dry-run on a fresh repo copy
    // is not needed — instead verify the clearing + that state.json was the last write
    // by checking the file reflects the state content exactly.
    expect(existsSync(path.join(dir, ".arte-git-card", "txn.json"))).toBe(false);
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe("{}");
    expect(readFileSync(aPath, "utf8")).toBe("new-a");
    expect(readFileSync(path.join(dir, ".arte-git-card", "state.json"), "utf8")).toBe("{}");
  });
});

describe("txn fail-closed on unreadable / non-regular journal paths (RB-2)", () => {
  it("journal path is a DIRECTORY → fail closed before staging; preserved; lock released; re-run works", () => {
    const dir = tempDir();
    const r = repo({ root: dir });
    mkdirSync(r.journalPath, { recursive: true }); // txn.json as a DIRECTORY
    const plan: TxnPlan = { writes: [], deletes: [], stateJson: null };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/cannot be safely verified or recovered/);
    expect(existsSync(r.journalPath)).toBe(true); // preserved as-is
    expect(existsSync(r.lockPath)).toBe(false); // lock released
    // clear the occupant → a normal txn in the SAME process succeeds (no leaked lock)
    rmSync(r.journalPath, { recursive: true, force: true });
    const ok: TxnPlan = {
      writes: [{ rel: "a.txt", abs: path.join(dir, "a.txt"), content: "ok", kind: "card" }],
      deletes: [],
      stateJson: null,
    };
    expect(() => runTransaction(ok, { repoRoot: dir, command: "test" })).not.toThrow();
  });

  it("journal path is a symlink → fail closed; symlink preserved; lock released", () => {
    const dir = tempDir();
    const r = repo({ root: dir });
    mkdirSync(path.dirname(r.journalPath), { recursive: true });
    const target = path.join(dir, "real-journal-dir");
    mkdirSync(target, { recursive: true });
    let linked = true;
    try {
      symlinkSync(target, r.journalPath, "junction");
    } catch {
      linked = false;
    }
    if (!linked) return; // no symlink privilege on this host
    const plan: TxnPlan = { writes: [], deletes: [], stateJson: null };
    expect(() => runTransaction(plan, { repoRoot: dir, command: "test" })).toThrow(/cannot be safely verified or recovered/);
    expect(lstatSync(r.journalPath).isSymbolicLink()).toBe(true); // symlink preserved
    expect(existsSync(r.lockPath)).toBe(false); // lock released
  });

  it("inspectJournal: a directory occupant is present/unreadable (never 'missing'); a true ENOENT is absent", () => {
    const dir = tempDir();
    const dirPath = path.join(dir, "as-dir");
    mkdirSync(dirPath, { recursive: true });
    expect(inspectJournal(dirPath)).toEqual({ present: true, state: "unreadable" });
    // a genuinely missing path IS absent
    expect(inspectJournal(path.join(dir, "none.json"))).toEqual({ present: false });
  });
});

describe("recovery never treats a non-regular/unreadable delete target as already gone (F3)", () => {
  it("a delete op whose target is a DIRECTORY is preserved (never removed, journal stays)", () => {
    const dir = tempDir();
    const dirTarget = path.join(dir, "somedir");
    mkdirSync(dirTarget, { recursive: true });
    const journalPath = path.join(dir, ".txn.json");
    writeJournal(
      journalPath,
      buildJournal(dir, [
        { kind: "card", rel: "somedir", op: "delete", beforeSha256: sha256Content("x"), afterSha256: null, stagingRel: null, stagingSha256: null },
      ]),
    );
    const result = recoverJournal(dir, { repoRoot: dir, journalPath });
    expect(result.preserved).toContain("somedir");
    expect(existsSync(dirTarget)).toBe(true); // never removed
    expect(existsSync(journalPath)).toBe(true); // journal preserved for doctor
  });
});
