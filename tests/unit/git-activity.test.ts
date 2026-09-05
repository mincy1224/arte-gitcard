import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseGitLogNumstat, runGitActivity } from "../../src/structure/activity.js";

/** 7-day window 2026-08-25 … 2026-08-31 (UTC). */
const START = "2026-08-25";
const DAYS = 7;
const HASH = "0123456789abcdef0123456789abcdef01234567"; // 40 hex

/**
 * A commit record mirroring real `git log --numstat -z`: `<hash>\n<iso>\0`
 * then each numstat entry prefixed with "\n" and NUL-separated.
 */
function commit(iso: string, ...numstats: string[]): string {
  return `${HASH}\n${iso}\0${numstats.map((r) => `\n${r}`).join("\0")}\0`;
}

describe("parseGitLogNumstat — NUL-safe token parser", () => {
  it("normal files aggregate additions/deletions to the file's dir + ancestors", () => {
    const out = commit("2026-08-25T10:00:00Z", "1\t2\tsrc/a.ts", "3\t4\tsrc/b.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.totalCommits).toBe(1);
    expect(m.byDir.get("src")![0]!.additions).toBe(4);
    expect(m.byDir.get("src")![0]!.deletions).toBe(6);
    // ancestor "."
    expect(m.byDir.get(".")![0]!.additions).toBe(4);
    expect(m.byDir.get(".")![0]!.commits).toBe(1);
  });

  it("rename records aggregate against the NEW path (not the old)", () => {
    // git emits `A\tD\t\0<old>\0<new>` — after NUL-splitting that is
    // ["A\tD\t", "<old>", "<new>"].
    const out = commit(
      "2026-08-25T10:00:00Z",
      "1\t0\t", // rename marker (empty path)
      "old name.txt",
      "new name.txt",
    );
    const m = parseGitLogNumstat(out, START, DAYS);
    // new name.txt is at repo root "." → ancestor only "."
    expect(m.byDir.get(".")![0]!.additions).toBe(1);
    expect(m.byDir.get(".")![0]!.commits).toBe(1);
  });

  it("filenames containing tabs are kept whole (no split-\t truncation)", () => {
    // full path is "src/foo\tbar.ts"; a split("\t") parser would truncate to
    // "bar.ts" and lose the "src" directory.
    const out = commit("2026-08-25T10:00:00Z", "1\t2\tsrc/foo\tbar.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.byDir.get("src")![0]!.additions).toBe(1);
    expect(m.byDir.get(".")![0]!.deletions).toBe(2);
  });

  it("filenames containing newlines are kept whole (NUL-delimited)", () => {
    const out = commit("2026-08-25T10:00:00Z", "5\t6\tweird\nname.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.byDir.get(".")![0]!.additions).toBe(5);
    expect(m.byDir.get(".")![0]!.deletions).toBe(6);
  });

  it("unicode filenames aggregate correctly", () => {
    const out = commit("2026-08-25T10:00:00Z", "7\t8\tsrc/日本語.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.byDir.get("src")![0]!.additions).toBe(7);
  });

  it("binary records (`-`) are skipped", () => {
    const out = commit("2026-08-25T10:00:00Z", "-\t-\tsrc/data.bin", "2\t0\tsrc/a.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.byDir.get("src")![0]!.additions).toBe(2); // only the text file counted
  });

  it("commits outside the window are discarded (never clamped to edges)", () => {
    const out =
      commit("2026-08-24T10:00:00Z", "1\t0\tbefore.ts") + // day -1 → out
      commit("2026-08-25T10:00:00Z", "2\t0\tfirst.ts") + // day 0 → in
      commit("2026-08-31T10:00:00Z", "3\t0\tlast.ts") + // day 6 → in
      commit("2026-09-01T10:00:00Z", "4\t0\tafter.ts"); // day 7 → out
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.totalCommits).toBe(2);
    // out-of-window commits contributed nothing: day 0 only "first.ts" (2),
    // day 6 only "last.ts" (3).
    expect(m.byDir.get(".")![0]!.additions).toBe(2);
    expect(m.byDir.get(".")![6]!.additions).toBe(3);
    expect(m.byDir.get(".")![0]!.deletions).toBe(0);
    expect(m.byDir.get(".")![6]!.deletions).toBe(0);
  });

  it("dedupes: one commit per dir per day, but sums additions/deletions", () => {
    // two files in the same dir within ONE commit
    const out = commit("2026-08-25T10:00:00Z", "1\t0\tsrc/a.ts", "2\t3\tsrc/b.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    const day = m.byDir.get("src")![0]!;
    expect(day.commits).toBe(1); // not 2
    expect(day.additions).toBe(3);
    expect(day.deletions).toBe(3);
  });

  it("ancestor aggregation is unconditional across depths", () => {
    const out = commit("2026-08-25T10:00:00Z", "5\t5\tpackages/foo/src/a.ts");
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.byDir.get("packages/foo/src")![0]!.additions).toBe(5);
    expect(m.byDir.get("packages/foo")![0]!.additions).toBe(5);
    expect(m.byDir.get("packages")![0]!.additions).toBe(5);
    expect(m.byDir.get(".")![0]!.additions).toBe(5);
  });

  it("SHA-256 repo commit ids (64 hex) are recognized", () => {
    const HASH64 = "0123456789abcdef".repeat(4); // 64 hex
    const out = `${HASH64}\n2026-08-25T10:00:00Z\0\n1\t0\tsrc/a.ts\0`;
    const m = parseGitLogNumstat(out, START, DAYS);
    expect(m.totalCommits).toBe(1);
    expect(m.byDir.get("src")![0]!.additions).toBe(1);
  });

  it("a subdir prefix aligns repo-root-relative git log paths to cwd-relative (P1-4)", () => {
    // From a nested working tree, git log reports "sub/..." paths while the
    // scanner is cwd-relative. Paths outside the prefix are discarded.
    const out =
      commit("2026-08-25T10:00:00Z", "1\t0\tsub/src/a.ts", "2\t0\tother/b.ts") +
      commit("2026-08-26T10:00:00Z", "3\t0\tsub/lib/c.ts");
    const m = parseGitLogNumstat(out, START, DAYS, "sub/");
    expect(m.byDir.get("src")![0]!.additions).toBe(1); // sub/src/a.ts → src/a.ts
    expect(m.byDir.get(".")![0]!.additions).toBe(1); // ancestor "."
    expect(m.byDir.get("lib")![1]!.additions).toBe(3); // sub/lib/c.ts → lib/c.ts, day 1
    expect(m.byDir.has("other")).toBe(false); // outside the project root → discarded
    expect(m.totalCommits).toBe(2); // both commits are in-window
  });
});

describe("runGitActivity — temporary real git repository (rename integration)", () => {
  const NOW = new Date("2026-09-01T12:00:00Z"); // window 2026-08-26 … 2026-09-01

  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), "arte-git-"));
    git(["init", "-q"], { cwd: repo });
    git(["config", "user.email", "test@example.com"], { cwd: repo });
    git(["config", "user.name", "Test"], { cwd: repo });
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  function git(args: string[], opts: { cwd: string; env?: Record<string, string> }): string {
    return execFileSync("git", args, {
      cwd: opts.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, ...opts.env },
    }).trim();
  }

  it("consumes real `git log --numstat -z` rename output and lands on the new path's dir", () => {
    // commit 1: olddir/old name.txt on 2026-08-27 (day index 1)
    mkdirSync(path.join(repo, "olddir"), { recursive: true });
    writeFileSync(path.join(repo, "olddir", "old name.txt"), "hello\nworld\n");
    git(["add", "-A"], { cwd: repo });
    git(["commit", "-m", "add"], {
      cwd: repo,
      env: { GIT_AUTHOR_DATE: "2026-08-27T10:00:00Z", GIT_COMMITTER_DATE: "2026-08-27T10:00:00Z" },
    });

    // commit 2: rename olddir/old name.txt → newdir/new name.txt on 2026-09-01
    mkdirSync(path.join(repo, "newdir"), { recursive: true }); // git mv needs the target dir
    git(["mv", "olddir/old name.txt", "newdir/new name.txt"], { cwd: repo });
    // ensure a content change so additions > 0 on the rename
    writeFileSync(path.join(repo, "newdir", "new name.txt"), "hello\nworld\nmore\n");
    git(["add", "-A"], { cwd: repo });
    git(["commit", "-m", "rename"], {
      cwd: repo,
      env: { GIT_AUTHOR_DATE: "2026-09-01T10:00:00Z", GIT_COMMITTER_DATE: "2026-09-01T10:00:00Z" },
    });

    const result = runGitActivity(repo, 7, NOW);
    expect(result).not.toBeNull();
    const m = result!;

    // rename commit (day 6) hit newdir, NOT olddir
    expect(m.byDir.get("newdir")![6]!.commits).toBe(1);
    expect(m.byDir.get("newdir")![6]!.additions).toBeGreaterThan(0);
    expect(m.byDir.get("olddir")![6]!.commits).toBe(0);
    // first commit (day 1) hit olddir
    expect(m.byDir.get("olddir")![1]!.commits).toBe(1);
  });

  it("last-activity shows an inactive repo's history when the recent window is empty", () => {
    mkdirSync(path.join(repo, "src"), { recursive: true });
    writeFileSync(path.join(repo, "src", "a.ts"), "x\n");
    git(["add", "-A"], { cwd: repo });
    git(["commit", "-m", "old work"], {
      cwd: repo,
      env: { GIT_AUTHOR_DATE: "2026-08-20T10:00:00Z", GIT_COMMITTER_DATE: "2026-08-20T10:00:00Z" },
    });

    // "today" is long after the only commit → recent is empty.
    const now = new Date("2026-09-20T00:00:00Z");
    const recent = runGitActivity(repo, 7, now);
    expect(recent!.totalCommits).toBe(0); // window 09-14..09-20

    // last-activity anchors the SAME 7 days on the latest commit day (08-20).
    const last = runGitActivity(repo, 7, now, {}, "last-activity");
    expect(last).not.toBeNull();
    expect(last!.totalCommits).toBe(1);
    expect(last!.startDate).toBe("2026-08-14"); // 08-14..08-20
    expect(last!.byDir.get(".")![6]!.commits).toBe(1);
    expect(last!.byDir.get("src")![6]!.commits).toBe(1);
  });
});

describe("self-pollution exclusion (P0) — generated commits never count", () => {
  // Generated paths are under the output dir (non-binary so the outputDir
  // exclusion is what matters, not the binary-extension guard).
  const OUT = { outputDirs: [".github/arte-git-card"] };
  const GEN = ".github/arte-git-card/preview.html";

  it("a commit touching ONLY generated files is not counted at all", () => {
    const out = commit("2026-08-25T10:00:00Z", `9\t9\t${GEN}`);
    const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
    expect(m.totalCommits).toBe(0);
    expect(m.byDir.size).toBe(0);
  });

  it("a commit touching only the tool config is not counted (hard exclude)", () => {
    const out = commit("2026-08-25T10:00:00Z", "2\t0\tarte-gitcard.yml");
    const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
    expect(m.totalCommits).toBe(0);
  });

  it("a mixed commit counts once and aggregates only the REAL project file", () => {
    const out = commit("2026-08-25T10:00:00Z", `1\t2\tsrc/a.ts`, `90\t90\t${GEN}`);
    const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
    expect(m.totalCommits).toBe(1);
    expect(m.byDir.get("src")![0]!.additions).toBe(1);
    expect(m.byDir.get("src")![0]!.deletions).toBe(2);
    expect(m.byDir.get(".")![0]!.additions).toBe(1); // generated deltas never reach "."
  });

  describe("rename dual-side scope rule", () => {
    it("rename within scope aggregates against the new path", () => {
      const out = commit("2026-08-25T10:00:00Z", "1\t0\t", "src/a.ts", "src/b.ts");
      const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
      expect(m.totalCommits).toBe(1);
      expect(m.byDir.get("src")![0]!.additions).toBe(1);
    });

    it("rename OUT of scope (src → generated) still counts the commit, with no per-dir deltas", () => {
      const out = commit("2026-08-25T10:00:00Z", "2\t1\t", "src/a.ts", GEN);
      const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
      expect(m.totalCommits).toBe(1); // old path was in scope → real change
      expect(m.byDir.has("src")).toBe(false); // new path out of scope → no aggregation
    });

    it("rename INTO scope (generated → src) counts and aggregates to the new path", () => {
      const out = commit("2026-08-25T10:00:00Z", "3\t0\t", GEN, "src/b.ts");
      const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
      expect(m.totalCommits).toBe(1);
      expect(m.byDir.get("src")![0]!.additions).toBe(3);
    });

    it("rename fully out of scope is not counted", () => {
      const out = commit("2026-08-25T10:00:00Z", "4\t0\t", GEN, `${OUT.outputDirs[0]}/index.html`);
      const m = parseGitLogNumstat(out, START, DAYS, "", OUT);
      expect(m.totalCommits).toBe(0);
    });
  });

  it("historical output relocation: old output root stays excluded forever", () => {
    // output.directory moved from A (historical) to B (current): both are excluded.
    const m = parseGitLogNumstat(
      commit("2026-08-25T10:00:00Z", "5\t5\t.github/arte-git-card/preview.html"),
      START,
      DAYS,
      "",
      { outputDirs: ["docs/cards", ".github/arte-git-card"] },
    );
    expect(m.totalCommits).toBe(0); // historical A commit never resurrects
  });

  it("real git: a generated-only bot commit is excluded from totalCommits", () => {
    const NOW = new Date("2026-09-01T12:00:00Z");
    const bot = mkdtempSync(path.join(tmpdir(), "arte-bot-"));
    try {
      gitInit(bot);
      writeFileSync(path.join(bot, "src", "a.ts"), "export = 1;\n");
      gitCommit(bot, "feat: add source", "2026-08-30T10:00:00Z");
      // bot commit touches only the generated output (non-binary file)
      const genDir = path.join(bot, ".github", "arte-git-card");
      mkdirSync(genDir, { recursive: true });
      writeFileSync(path.join(genDir, "preview.html"), "<html></html>\n");
      gitCommit(bot, "chore: update cards", "2026-08-31T10:00:00Z");
      const m = runGitActivity(bot, 7, NOW, { outputDirs: [".github/arte-git-card"] });
      expect(m).not.toBeNull();
      expect(m!.totalCommits).toBe(1); // only the real source commit
    } finally {
      rmSync(bot, { recursive: true, force: true });
    }
  });

  function gitInit(dir: string): void {
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["config", "user.email", "t@e.com"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["config", "user.name", "T"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
    mkdirSync(path.join(dir, "src"), { recursive: true });
  }
  function gitCommit(dir: string, msg: string, when: string): void {
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
    execFileSync("git", ["commit", "-m", msg], {
      cwd: dir,
      env: { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
      stdio: ["ignore", "ignore", "ignore"],
    });
  }
});
