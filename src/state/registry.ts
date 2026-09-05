/**
 * state.json ownership registry (P0). state.json records WHAT arte-gitcard
 * generated (ownership evidence). It is NEVER path authority — deletion and
 * overwrite still require the path to pass its kind guard AND the file to match
 * the recorded hash. Missing / corrupt / forward-incompatible state means no
 * ownership is provable → mutations fail closed (doctor/reset guide the user).
 */

import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { resolveContained, realpathContained, normalizeRelPosix, pathHasNoSymlinkComponents } from "../fs/pathguard.js";
import { sha256Content, sha256File } from "../fs/hash.js";
import { VERSION } from "../version.js";
import { STATE_REL } from "../managed/paths.js";
import type { ManagedKind } from "../txn/plan.js";

export class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

export class CollisionError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(message);
    this.name = "CollisionError";
    this.path = path;
  }
}

const MANAGED_KIND_VALUES = [
  "card",
  "preview",
  "workflow",
  "ci-action",
  "ci-runtime",
  "theme",
] as const;

const stateEntrySchema = z
  .object({
    path: z.string(),
    kind: z.enum(MANAGED_KIND_VALUES),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export const stateSchema = z
  .object({
    schemaVersion: z.literal(2),
    toolVersion: z.string(),
    managedFiles: z.array(stateEntrySchema),
    outputRoots: z.array(z.string()),
    github: z.object({ defaultBranch: z.string().optional() }).strict().optional(),
  })
  .strict();

export interface StateEntry {
  path: string;
  kind: ManagedKind;
  sha256: string;
}

export interface ArteGitcardState {
  schemaVersion: 2;
  toolVersion: string;
  managedFiles: StateEntry[];
  outputRoots: string[];
  /** GitHub integration installation snapshot (never path/config authority). */
  github?: { defaultBranch?: string };
}

export type StateStatus = "ok" | "missing" | "corrupt" | "incompatible";

export type StateRead =
  | { status: "ok"; state: ArteGitcardState; path: string; sha256: string }
  | { status: "missing"; path: string }
  | /**
     * Present but not usable as ownership evidence. `sha256` is the hash of the
     * EXACT bytes read when the file was readable (corrupt/incompatible content);
     * `null` when no trustworthy snapshot could be read (unreadable / unsafe /
     * symlinked control dir). Callers that overwrite the state must fail closed
     * on `null` rather than manufacturing a later hash.
     */
    { status: "corrupt" | "incompatible"; path: string; sha256: string | null };

export type EntryStatus = "ok" | "missing" | "modified" | "unsafe";

export function statePath(projectRoot: string): string {
  return path.join(projectRoot, STATE_REL);
}

export function initialState(): ArteGitcardState {
  return { schemaVersion: 2, toolVersion: VERSION, managedFiles: [], outputRoots: [], github: undefined };
}

export function readState(projectRoot: string): StateRead {
  const p = statePath(projectRoot);
  // Ownership/authority metadata must never be read THROUGH a symlinked control
  // directory (e.g. `.arte-git-card` -> `src`): its contents influence mutation
  // authority. Fail closed (CORRUPT) instead of trusting the redirect.
  if (!pathHasNoSymlinkComponents(projectRoot, STATE_REL)) return { status: "corrupt", path: p, sha256: null };
  let buf: Buffer;
  try {
    buf = readFileSync(p);
  } catch (err) {
    // Only a true ENOENT means the state does not exist. An unreadable existing
    // file (EACCES / path is a directory / …) is CORRUPT, not missing — a caller
    // must never overwrite an existing-but-unverifiable state.json. No
    // trustworthy snapshot was read → sha256: null.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { status: "missing", path: p };
    return { status: "corrupt", path: p, sha256: null };
  }
  // From here the EXACT bytes were read; any corrupt/incompatible outcome
  // carries their sha so a caller that overwrites state pins what it observed.
  const raw = buf.toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupt", path: p, sha256: sha256Content(buf) };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { schemaVersion?: unknown })["schemaVersion"] === "number" &&
    (parsed as { schemaVersion?: number })["schemaVersion"] !== 2
  ) {
    return { status: "incompatible", path: p, sha256: sha256Content(buf) };
  }
  const result = stateSchema.safeParse(parsed);
  if (!result.success) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
  const state = result.data;
  // Forged/malicious state is rejected before it can influence any mutation:
  // every managed path must be a valid, repo-relative POSIX path, and NO path may
  // appear twice — a duplicate makes findEntry/delete ambiguous (corrupt).
  const seenPaths = new Set<string>();
  for (const e of state.managedFiles) {
    const normalized = normalizeRelPosix(e.path);
    if (!normalized) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    if (seenPaths.has(normalized)) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    seenPaths.add(normalized);
  }
  const seenRoots = new Set<string>();
  for (const root of state.outputRoots) {
    const normalized = normalizeRelPosix(root);
    if (!normalized) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    if (seenRoots.has(normalized)) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    seenRoots.add(normalized);
  }
  return { status: "ok", state, path: p, sha256: sha256Content(buf) };
}

/** Deterministic serialization (sorted entries/roots) for atomic writes. */
export function serializeState(state: ArteGitcardState): string {
  const managedFiles = [...state.managedFiles].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const outputRoots = [...state.outputRoots].sort();
  const doc: ArteGitcardState = {
    schemaVersion: 2,
    toolVersion: VERSION,
    managedFiles,
    outputRoots,
  };
  if (state.github) doc.github = { defaultBranch: state.github.defaultBranch };
  return JSON.stringify(doc, null, 2) + "\n";
}

export function findEntry(state: ArteGitcardState, rel: string): StateEntry | undefined {
  return state.managedFiles.find((e) => e.path === rel);
}

/** Add or refresh a managed entry (replaces any entry at the same path). */
export function upsertEntry(state: ArteGitcardState, entry: StateEntry): void {
  const idx = state.managedFiles.findIndex((e) => e.path === entry.path);
  if (idx >= 0) state.managedFiles[idx] = entry;
  else state.managedFiles.push(entry);
}

export function removeEntry(state: ArteGitcardState, rel: string): void {
  state.managedFiles = state.managedFiles.filter((e) => e.path !== rel);
}

/**
 * Ownership proof for a managed entry:
 *   ok       → file exists, safe path, hash matches;
 *   missing  → file gone (idempotent removal OK / reclaimable by generate);
 *   modified → file exists but hash differs (user edit — preserve for
 *              remove/disable; only an EXPLICIT regeneration may reclaim);
 *   unsafe   → path escapes the repo or the file became a symlink/dir — refuse.
 * Deletion additionally requires the path to pass its kind guard (enforced by
 * the transaction engine), so this alone can never authorize a source-path delete.
 */
export function assertDeletable(projectRoot: string, entry: StateEntry): EntryStatus {
  const abs = resolveContained(projectRoot, entry.path);
  if (!abs) return "unsafe";
  if (!realpathContained(projectRoot, entry.path)) return "unsafe";
  let st;
  try {
    st = lstatSync(abs);
  } catch (err) {
    // ONLY a true ENOENT means the file is gone. An unreadable existing target
    // (EACCES / parent is a file / …) is UNSAFE — never "already missing".
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === "ENOENT" ? "missing" : "unsafe";
  }
  // symlink / directory / any other non-regular (FIFO, socket, device) → unsafe.
  if (st.isSymbolicLink() || !st.isFile()) return "unsafe";
  const cur = sha256File(abs);
  // lstat proved a regular file, but reading/hashing it failed → unsafe, not missing.
  if (cur === null) return "unsafe";
  return cur === entry.sha256 ? "ok" : "modified";
}
