/**
 * Structure directory-description store — CLI-managed user metadata committed
 * to the repo so GitHub auto-update renders the same descriptions.
 *
 * Document: `{ "schemaVersion": 1, "descriptions": { "<repoRel>": "<text>" } }`
 * at `.arte-git-card/structure-descriptions.json`. Keys are canonical POSIX
 * REPO-relative paths (matched against `StructureRow.repoRel`) so changing
 * `structure.root` never rebinds a description. Values: ≤20 code points, no
 * tab/line break/edge whitespace, XML-1.0-legal.
 *
 * fs-capable; display builtins must not import this (LC-2). Mutations go
 * through the transaction engine as kind `structure-descriptions` with an
 * optimistic sha256/absence precondition — never a raw write.
 */

import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { STRUCTURE_DESCRIPTIONS_REL } from "../managed/paths.js";
import { normalizeRelPosix, pathHasNoSymlinkComponents } from "../fs/pathguard.js";
import { sha256Content } from "../fs/hash.js";
import type { Precondition } from "../txn/plan.js";

/** Absolute supported Structure render depth (the config `max_depth` ceiling). */
export const MAX_STRUCTURE_DEPTH = 20;
export const MAX_DESC_CODEPOINTS = 20;
export const STORE_SCHEMA_VERSION = 1;

export class StructureDescriptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureDescriptionsError";
  }
}

export function storePath(projectRoot: string): string {
  return path.join(projectRoot, STRUCTURE_DESCRIPTIONS_REL);
}

/** Line/paragraph separators: CR, LF, U+2028, U+2029. */
function containsLineBreak(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 10 || cp === 13 || cp === 0x2028 || cp === 0x2029) return true;
  }
  return false;
}

/** XML 1.0 illegal code points (Char production). */
function containsIllegalXmlCodePoint(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x9 || cp === 0xa || cp === 0xd) continue;
    if (cp >= 0x20 && cp <= 0xd7ff) continue;
    if (cp >= 0xe000 && cp <= 0xfffd) continue;
    if (cp >= 0x10000 && cp <= 0x10ffff) continue;
    return true;
  }
  return false;
}

/** Reject a repository-INternal path that can never be a renderable directory. */
function isToolInternalKey(key: string): boolean {
  return key === ".git" || key.startsWith(".git/") || key === ".arte-git-card" || key.startsWith(".arte-git-card/");
}

/** Canonical repo-relative POSIX key rule → error message or null. */
export function descriptionKeyError(key: string): string | null {
  if (!key || key === ".") return "key must be a non-empty repository-relative directory path";
  if (key.startsWith("/") || /^[A-Za-z]:[\\/]/.test(key) || key.startsWith("\\")) {
    return "key must be a repository-relative path (no absolute/drive/UNC paths)";
  }
  if (key.includes("\\")) return "key must use POSIX separators";
  const norm = normalizeRelPosix(key);
  if (!norm || norm !== key) {
    return "key must be a canonical POSIX path (no ./ prefix, no trailing /, no //, no ..)";
  }
  if (isToolInternalKey(key)) return `key must not point inside the tool's own directory (${key})`;
  return null;
}

/** Description VALUE rules → error message or null (never silent truncation). */
export function descriptionValueError(text: string): string | null {
  if (text.length === 0) return "description must not be empty";
  if (text !== text.trim()) return "description must not start or end with whitespace";
  for (const ch of text) if (ch === "\t") return "description must not contain a tab";
  if (containsLineBreak(text)) return "description must not contain a line break";
  if (containsIllegalXmlCodePoint(text)) return "description contains a character invalid in XML 1.0";
  if (Array.from(text).length > MAX_DESC_CODEPOINTS) {
    return `description exceeds ${MAX_DESC_CODEPOINTS} code points`;
  }
  return null;
}

export interface StoreReadOk {
  status: "ok";
  map: Record<string, string>;
  /** sha256 of the EXACT bytes read from disk (the precondition's expected value). */
  sha256: string;
}
export type StoreRead = StoreReadOk | { status: "absent" };

/**
 * Read + strictly validate the store. Absent file ⇒ empty metadata. Symlink /
 * directory / unreadable file, malformed JSON, wrong schemaVersion, unknown
 * top-level field or any invalid key/value ⇒ error (no silent repair/drop).
 */
export function readStructureDescriptions(projectRoot: string): StoreRead {
  const abs = storePath(projectRoot);
  // NEVER read the description store through a symlinked control directory —
  // its contents feed mutation preconditions (P0-1).
  if (!pathHasNoSymlinkComponents(projectRoot, STRUCTURE_DESCRIPTIONS_REL)) {
    throw new StructureDescriptionsError(
      `${STRUCTURE_DESCRIPTIONS_REL} traverses a symlink/junction component — refusing to read it (fail closed).`,
    );
  }
  let st;
  try {
    st = lstatSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { status: "absent" };
    throw new StructureDescriptionsError(
      `cannot read ${STRUCTURE_DESCRIPTIONS_REL}: the file exists but could not be verified (fail closed). Run \`arte-gitcard doctor\`.`,
    );
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new StructureDescriptionsError(
      `${STRUCTURE_DESCRIPTIONS_REL} is a ${st.isSymbolicLink() ? "symbolic link" : "non-regular file"} — refusing to read it (fail closed).`,
    );
  }
  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch {
    throw new StructureDescriptionsError(
      `cannot read ${STRUCTURE_DESCRIPTIONS_REL} (unreadable file). Run \`arte-gitcard doctor\`.`,
    );
  }
  const sha256 = sha256Content(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StructureDescriptionsError(
      `${STRUCTURE_DESCRIPTIONS_REL} is not valid JSON — run \`arte-gitcard doctor\` (preserved, never auto-repaired).`,
    );
  }
  const map = parseStoreDocument(parsed);
  return { status: "ok", map, sha256 };
}

function parseStoreDocument(parsed: unknown): Record<string, string> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StructureDescriptionsError("description store must be a JSON object");
  }
  const doc = parsed as Record<string, unknown>;
  const allowedTop = new Set(["schemaVersion", "descriptions"]);
  for (const key of Object.keys(doc)) {
    if (!allowedTop.has(key)) {
      throw new StructureDescriptionsError(`description store has an unknown top-level field "${key}"`);
    }
  }
  if (doc.schemaVersion !== STORE_SCHEMA_VERSION) {
    throw new StructureDescriptionsError(
      `description store schemaVersion is ${JSON.stringify(doc.schemaVersion)} (expected ${STORE_SCHEMA_VERSION})`,
    );
  }
  const descs = doc.descriptions;
  if (!descs || typeof descs !== "object" || Array.isArray(descs)) {
    throw new StructureDescriptionsError("description store field `descriptions` must be an object");
  }
  // Rebuild onto a fresh object with defineProperty so a literal "__proto__" key
  // can never mutate the object's prototype (prototype-safe storage).
  const map: Record<string, string> = {};
  for (const key of Object.keys(descs)) {
    const keyErr = descriptionKeyError(key);
    if (keyErr) throw new StructureDescriptionsError(`invalid description key "${key}": ${keyErr}`);
    const value = (descs as Record<string, unknown>)[key];
    if (typeof value !== "string") {
      throw new StructureDescriptionsError(`description for "${key}" must be a string`);
    }
    const valueErr = descriptionValueError(value);
    if (valueErr) throw new StructureDescriptionsError(`invalid description for "${key}": ${valueErr}`);
    Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return map;
}

/** Deterministic serialization: stable lexical key sort, 2-space, trailing newline. */
export function serializeStructureDescriptions(map: Record<string, string>): string {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(map).sort()) {
    Object.defineProperty(sorted, key, { value: map[key], enumerable: true, writable: true, configurable: true });
  }
  return JSON.stringify({ schemaVersion: STORE_SCHEMA_VERSION, descriptions: sorted }, null, 2) + "\n";
}

/** repo-relative store key for a display-relative path under a resolved root. */
export function repoKeyOf(rootRel: string | null, rel: string): string {
  return rootRel ? `${rootRel}/${rel}` : rel;
}

/**
 * One coherent description snapshot: the validated map PLUS the observed store
 * state as an optimistic transaction precondition. A generation loads ONCE,
 * prunes, and reuses the SAME snapshot for rendering, write/delete planning and
 * the precondition — never render from metadata B while mutating against A.
 */
export interface DescriptionSnapshot {
  /** true when a store file exists (a write/delete is meaningful). */
  present: boolean;
  /** validated repo-relative descriptions map. */
  map: Record<string, string>;
  /** precondition asserting the on-disk store is exactly what was observed. */
  precondition: Precondition;
  /** sha256 of the exact bytes read; null when the store was absent. */
  contentHash: string | null;
}

export function loadDescriptionSnapshot(projectRoot: string): DescriptionSnapshot {
  const r = readStructureDescriptions(projectRoot);
  if (r.status === "absent") {
    return {
      present: false,
      map: {},
      contentHash: null,
      precondition: { kind: "absent", rel: STRUCTURE_DESCRIPTIONS_REL },
    };
  }
  return {
    present: true,
    map: r.map,
    contentHash: r.sha256,
    precondition: { kind: "sha256", rel: STRUCTURE_DESCRIPTIONS_REL, expectedSha256: r.sha256 },
  };
}
