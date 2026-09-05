/**
 * Git activity (SPEC §3/§5). One `git log --numstat -z` parsed as a NUL-delimited
 * token stream (rename records `A\tD\t\0old\0new`, tab/newline/unicode names,
 * binary `-` entries). Time uses the committer date (`%cI`); out-of-window
 * commits are discarded, never clamped.
 *
 * SELF-POLLUTION GUARD (P0): a commit counts only when it modifies ≥1 file in
 * the scan scope — by path exclusion (isExcludedFile), NEVER by author/message.
 * Exclusions cover the current output dir PLUS every recorded historical output
 * root (state.outputRoots), so relocation never resurrects old bot commits.
 *
 * Renames are dual-side: a commit counts if EITHER old or new path is in scope;
 * deltas aggregate only against the NEW path when in scope.
 */

import { execFileSync } from "node:child_process";
import { isExcludedFile } from "../scanner/exclude.js";
import type { ExcludeOptions } from "../scanner/exclude.js";
import { resolveActivityWindow, utcDay, daysBetween } from "./dates.js";
import type { ActivityAnchor } from "./dates.js";

export interface ActivityDay {
  commits: number;
  additions: number;
  deletions: number;
}

export interface ActivityMap {
  /** dir rel (posix, "." for repo root) → per-day activity. */
  byDir: Map<string, ActivityDay[]>;
  totalCommits: number;
  days: number;
  /** Window day 0 ("YYYY-MM-DD", UTC) — shared by every rendered row. */
  startDate: string;
}

/** POSIX dir path of a file rel, then its ancestor chain up to ".". */
function dirChain(fileRel: string): string[] {
  const parts = fileRel.split("/");
  parts.pop();
  const out: string[] = [];
  let cur = parts.join("/") || ".";
  for (;;) {
    out.push(cur);
    if (cur === ".") break;
    const idx = cur.lastIndexOf("/");
    cur = idx < 0 ? "." : cur.slice(0, idx);
  }
  return out;
}

/** A commit header record from `--format=%H%n%cI`: `<40-64-hex>\n<ISO-date>` (SHA-1 or SHA-256 repo). */
const COMMIT_HEADER_RE = /^[0-9a-f]{40,64}\n\d{4}-\d{2}-\d{2}T/;

/** A numstat record: `A\tD\t<path>` (rename: `A\tD\t` with an empty path). */
const NUMSTAT_RE = /^\d+\t\d+(\t|$)/;

/** `git rev-parse --show-prefix` → the subdir prefix ("" at the repo top level). */
function gitShowPrefix(root: string): string {
  try {
    const out = execFileSync(
      "git",
      ["rev-parse", "--show-prefix"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out.trim();
  } catch {
    return "";
  }
}

/** Align a repo-root-relative git path to the scan's cwd-relative space; null when outside. */
function alignPrefix(p: string, prefix: string): string | null {
  if (!prefix) return p;
  if (!p.startsWith(prefix)) return null;
  return p.slice(prefix.length);
}

/**
 * UTC day of the repository's LATEST commit (one bounded `git log -1`), used to
 * anchor a `last-activity` window. Null when git fails or history is empty —
 * the caller then degrades to the recent window (no fabricated dates).
 */
export function latestCommitDayUtc(root: string): string | null {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out ? utcDay(new Date(out)) : null;
  } catch {
    return null;
  }
}

/**
 * Run git activity for `days` (7|14|30) over ONE shared window.
 *   recent        → window ends on the current day;
 *   last-activity → window ends on the latest repository commit day (resolved
 *                   once, bounded); an empty/invalid history degrades to recent.
 * All rendered rows share this exact window. Returns null when git fails.
 */
export function runGitActivity(
  root: string,
  days: number,
  now: Date,
  opts: ExcludeOptions = {},
  anchor: ActivityAnchor = "recent",
): ActivityMap | null {
  const latestDay = anchor === "last-activity" ? latestCommitDayUtc(root) : null;
  const window = resolveActivityWindow(days, anchor, now, latestDay);
  const since = `${window.startDate}T00:00:00Z`;

  const prefix = gitShowPrefix(root);

  let out: string;
  try {
    out = execFileSync(
      "git",
      ["log", "--numstat", "-z", "--format=%H%n%cI", "--find-renames", `--since=${since}`],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }
  return parseGitLogNumstat(out, window.startDate, days, prefix, opts);
}

/** Parse raw `git log --numstat -z` output into an ActivityMap (pure, testable). */
export function parseGitLogNumstat(
  output: string,
  startStr: string,
  days: number,
  prefix = "",
  opts: ExcludeOptions = {},
): ActivityMap {
  const byDir = new Map<string, ActivityDay[]>();
  const empty = (): ActivityDay[] => Array.from({ length: days }, () => ({ commits: 0, additions: 0, deletions: 0 }));
  const ensure = (dir: string): ActivityDay[] => {
    let arr = byDir.get(dir);
    if (!arr) {
      arr = empty();
      byDir.set(dir, arr);
    }
    return arr;
  };

  let totalCommits = 0;
  let currentDayIndex = -1;
  let touched: Map<string, { additions: number; deletions: number }> | null = null;
  // A commit counts only if ≥1 of its files is inside the scan scope (P0).
  let commitHasValidFile = false;

  const finalize = (): void => {
    if (touched === null || currentDayIndex < 0) return;
    if (!commitHasValidFile) return;
    totalCommits += 1;
    for (const [dir, deltas] of touched) {
      const arr = ensure(dir);
      arr[currentDayIndex]!.commits += 1; // dedupe: one commit per dir per day
      arr[currentDayIndex]!.additions += deltas.additions;
      arr[currentDayIndex]!.deletions += deltas.deletions;
    }
  };

  const records = output.split("\0");
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!;

    if (COMMIT_HEADER_RE.test(rec)) {
      finalize();
      const nl = rec.indexOf("\n");
      const iso = nl >= 0 ? rec.slice(nl + 1) : "";
      const dayIndex = iso ? daysBetween(startStr, utcDay(new Date(iso))) : -1;
      if (iso && dayIndex >= 0 && dayIndex < days) {
        currentDayIndex = dayIndex;
        touched = new Map();
        commitHasValidFile = false;
      } else {
        currentDayIndex = -1;
        touched = null;
        commitHasValidFile = false;
      }
      continue;
    }

    if (touched === null) continue; // records of an out-of-window commit
    const recBody = rec.startsWith("\n") ? rec.slice(1) : rec;
    if (!NUMSTAT_RE.test(recBody)) continue;

    // Parse added/deleted strictly: first two tab-delimited fields.
    const t1 = recBody.indexOf("\t");
    const t2 = t1 >= 0 ? recBody.indexOf("\t", t1 + 1) : -1;
    if (t1 < 0 || t2 < 0) continue;
    const addedStr = recBody.slice(0, t1);
    const deletedStr = recBody.slice(t1 + 1, t2);
    const added = parseInt(addedStr, 10);
    const deleted = parseInt(deletedStr, 10);
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue; // binary `-` fields → skip

    let path = recBody.slice(t2 + 1); // full remainder — may itself contain tabs
    if (path === "") {
      // Rename record: `A\tD\t\0<old>\0<new>`. Dual-side scope rule (P0).
      // The two path tokens are separate NUL records with NO leading newline;
      // strip one defensively (some fixtures prefix every token).
      const oldRaw = (records[i + 1] ?? "").replace(/^\n/, "");
      const newRaw = (records[i + 2] ?? "").replace(/^\n/, "");
      if (records[i + 2] === undefined) continue;
      i += 2;
      const oldAligned = alignPrefix(oldRaw, prefix);
      const newAligned = alignPrefix(newRaw, prefix);
      if (oldAligned === null && newAligned === null) continue;
      const oldInScope = oldAligned !== null && !isExcludedFile(oldAligned, opts);
      const newInScope = newAligned !== null && !isExcludedFile(newAligned, opts);
      if (!oldInScope && !newInScope) continue;
      commitHasValidFile = true;
      if (newInScope && newAligned !== null) {
        for (const dir of dirChain(newAligned)) {
          const cur = touched.get(dir) ?? { additions: 0, deletions: 0 };
          cur.additions += added;
          cur.deletions += deleted;
          touched.set(dir, cur);
        }
      }
      // new out of scope but old in scope → commit still counts once, no per-dir deltas.
      continue;
    }

    const aligned = alignPrefix(path, prefix);
    if (aligned === null) continue;
    if (isExcludedFile(aligned, opts)) continue;
    commitHasValidFile = true;

    for (const dir of dirChain(aligned)) {
      const cur = touched.get(dir) ?? { additions: 0, deletions: 0 };
      cur.additions += added;
      cur.deletions += deleted;
      touched.set(dir, cur);
    }
  }
  finalize();

  return { byDir, totalCommits, days, startDate: startStr };
}
