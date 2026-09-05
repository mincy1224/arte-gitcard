/**
 * P0 recovery staging hardening. journal.stagingRel is UNTRUSTED data like
 * relPath. Recovery must never rename/move a file the journal points at — even
 * when every hash matches. Coverage:
 *   - legal final + stagingRel = src/index.ts / package.json;
 *   - state.json recovery + malicious stagingRel;
 *   - staging is a symlink/junction and a directory (not a regular file);
 *   - staging not a sibling of the final;
 *   - staging basename not matching the arte-gitcard temp policy;
 *   - positive control: a legit sibling .agc-* staging IS recovered.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildJournal, writeJournal, readJournal } from "../../src/txn/journal.js";
import { recoverJournal } from "../../src/txn/recover.js";
import { buildManagedGuard } from "../../src/state/guards.js";
import { seedHealthyRepo } from "../helpers/repo.js";
import { sha256Content } from "../../src/fs/hash.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-recv-"));
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

function writeUserFiles(root: string): { src: string; pkg: string; srcRel: string; pkgRel: string; srcContent: string; pkgContent: string } {
  mkdirSync(path.join(root, "src"), { recursive: true });
  const srcRel = "src/index.ts";
  const pkgRel = "package.json";
  const srcContent = "export const secret = 1;\n";
  const pkgContent = '{ "name": "user-project" }\n';
  writeFileSync(path.join(root, srcRel), srcContent, "utf8");
  writeFileSync(path.join(root, pkgRel), pkgContent, "utf8");
  return {
    src: path.join(root, srcRel),
    pkg: path.join(root, pkgRel),
    srcRel,
    pkgRel,
    srcContent,
    pkgContent,
  };
}

function cardFixture(root: string) {
  const fixture = seedHealthyRepo(root);
  const cardRel = ".github/arte-git-card/codebase.svg";
  const cardAbs = path.join(root, cardRel);
  const beforeSha = sha256Content(readFileSync(cardAbs, "utf8"));
  const journalPath = path.join(root, ".txn.json");
  const guard = buildManagedGuard(root, { output: { directory: fixture.outputRel } });
  return { cardRel, cardAbs, beforeSha, journalPath, guard };
}

describe("recovery staging validation (P0) — stagingRel is untrusted", () => {
  it("legal final card + stagingRel = src/index.ts → preserved, user file untouched", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    // Journal claims it wants to complete a write of the card with content that
    // is EXACTLY the user's src/index.ts (all hashes match) — but stagingRel
    // points at the user file.
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.srcContent),
        stagingRel: users.srcRel,
        stagingSha256: sha256Content(users.srcContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(cardRel);
    expect(readFileSync(users.src, "utf8")).toBe(users.srcContent); // user file NOT moved/deleted
    expect(readFileSync(cardAbs, "utf8")).not.toBe(users.srcContent); // final untouched
    expect(readJournal(journalPath)).not.toBeNull(); // journal stays for doctor
  });

  it("legal final card + stagingRel = package.json → preserved, user file untouched", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.pkgContent),
        stagingRel: users.pkgRel,
        stagingSha256: sha256Content(users.pkgContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(cardRel);
    expect(readFileSync(users.pkg, "utf8")).toBe(users.pkgContent); // never moved
    expect(readFileSync(cardAbs, "utf8")).not.toBe(users.pkgContent);
  });

  it("state.json recovery + malicious stagingRel → preserved, user file untouched", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const fixture = seedHealthyRepo(root);
    const stateRel = ".arte-git-card/state.json";
    const stateAbs = path.join(root, stateRel);
    const beforeSha = sha256Content(readFileSync(stateAbs, "utf8"));
    const journalPath = path.join(root, ".txn.json");
    const guard = buildManagedGuard(root, { output: { directory: fixture.outputRel } });
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "state",
        rel: stateRel,
        op: "state",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.srcContent),
        stagingRel: users.srcRel,
        stagingSha256: sha256Content(users.srcContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(stateRel);
    expect(readFileSync(users.src, "utf8")).toBe(users.srcContent); // never moved into state.json
    expect(readFileSync(stateAbs, "utf8")).not.toBe(users.srcContent);
  });

  it("staging that is a symlink/junction is rejected (staging not a regular file)", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    const outDir = path.dirname(cardAbs);
    const stagingName = `.agc-${process.pid}-${"d".repeat(12)}`;
    const stagingAbs = path.join(outDir, stagingName);
    let linked = true;
    try {
      symlinkSync(path.join(root, "src"), stagingAbs, "junction");
    } catch {
      linked = false;
    }
    if (!linked) return; // no junction/symlink privilege
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.srcContent),
        stagingRel: `${path.relative(root, outDir).replace(/\\/g, "/")}/${stagingName}`,
        stagingSha256: sha256Content(users.srcContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(cardRel);
    expect(existsSync(stagingAbs)).toBe(true); // staging preserved, not consumed
  });

  it("staging that is a directory is rejected", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    const outDir = path.dirname(cardAbs);
    const stagingName = `.agc-${process.pid}-${"e".repeat(12)}`;
    mkdirSync(path.join(outDir, stagingName), { recursive: true });
    const stagingRel = `${path.relative(root, outDir).replace(/\\/g, "/")}/${stagingName}`;
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.srcContent),
        stagingRel,
        stagingSha256: sha256Content(users.srcContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(cardRel);
  });

  it("staging not in the final's sibling directory is rejected", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    // A compliant-looking temp name but at the REPO ROOT, not beside the card.
    const stagingName = `.agc-${process.pid}-${"f".repeat(12)}`;
    writeFileSync(path.join(root, stagingName), users.srcContent, "utf8");
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.srcContent),
        stagingRel: stagingName,
        stagingSha256: sha256Content(users.srcContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(cardRel);
    expect(readFileSync(cardAbs, "utf8")).not.toBe(users.srcContent);
    expect(existsSync(path.join(root, stagingName))).toBe(true); // preserved (not cleaned)
  });

  it("staging basename not matching the arte-gitcard temp policy is rejected", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    const outDir = path.dirname(cardAbs);
    const stagingRel = `${path.relative(root, outDir).replace(/\\/g, "/")}/notes.txt`;
    writeFileSync(path.join(outDir, "notes.txt"), users.srcContent, "utf8");
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content(users.srcContent),
        stagingRel,
        stagingSha256: sha256Content(users.srcContent),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toContain(cardRel);
    expect(readFileSync(cardAbs, "utf8")).not.toBe(users.srcContent);
    expect(readFileSync(path.join(outDir, "notes.txt"), "utf8")).toBe(users.srcContent); // untouched
  });

  it("positive control: a legit sibling .agc-* staging IS recovered and cleaned", () => {
    const root = temp();
    const users = writeUserFiles(root);
    const { cardRel, cardAbs, beforeSha, journalPath, guard } = cardFixture(root);
    const outDir = path.dirname(cardAbs);
    const stagingName = `.agc-${process.pid}-${"a".repeat(12)}`;
    const stagingRel = `${path.relative(root, outDir).replace(/\\/g, "/")}/${stagingName}`;
    writeFileSync(path.join(outDir, stagingName), "REGENERATED", "utf8");
    writeJournal(journalPath, buildJournal(root, [
      {
        kind: "card",
        rel: cardRel,
        op: "write",
        beforeSha256: beforeSha,
        afterSha256: sha256Content("REGENERATED"),
        stagingRel,
        stagingSha256: sha256Content("REGENERATED"),
      },
    ]));
    const result = recoverJournal(root, { repoRoot: root, journalPath, guard });
    expect(result.preserved).toEqual([]);
    expect(readFileSync(cardAbs, "utf8")).toBe("REGENERATED");
    expect(existsSync(path.join(outDir, stagingName))).toBe(false); // temp cleaned
  });
});
