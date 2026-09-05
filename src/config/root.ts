/**
 * `structure.root` normalization + validation: `"."` / `""` → null (whole repo);
 * otherwise must be an existing project-relative directory (absolute paths and
 * `..` rejected). Returns a POSIX rel path, no leading `./` or trailing `/`.
 */

import { existsSync, statSync, lstatSync } from "node:fs";
import path from "node:path";

/**
 * Host-independent rooted/absolute detection. Config paths are portable across
 * OSes, so a value that is absolute or rooted under ANY platform must be
 * rejected everywhere — otherwise a config accepted on Linux could resolve
 * outside the project when the same repo is opened on Windows.
 */
function isRootedOrAbsolute(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("\\")) return true; // POSIX abs, UNC/rooted Windows
  if (/^[A-Za-z]:/.test(value)) return true; // Windows drive (absolute or drive-relative special)
  return false;
}

export function normalizeStructureRoot(raw: string, projectRoot: string): string | null {
  let r = (raw ?? "").trim();
  if (r === "" || r === ".") return null;
  r = r.replace(/^\.\//, "").replace(/\/+$/, "");
  if (r === "") return null;

  if (isRootedOrAbsolute(r)) {
    throw new Error(`structure.root must be a project-relative directory, got absolute path "${raw}"`);
  }
  const parts = r.split(/[\\/]+/);
  if (parts.includes("..")) {
    throw new Error(`structure.root must not escape the project root, got "${raw}"`);
  }

  // Never traverse symlink/junction components: a link could redirect the visual
  // tree outside the repo. lstat each existing part; a missing part ends the walk.
  let cur = projectRoot;
  for (const part of parts) {
    cur = path.join(cur, part);
    let st;
    try {
      st = lstatSync(cur);
    } catch {
      break; // component genuinely absent → the existence check below reports it
    }
    if (st.isSymbolicLink()) {
      throw new Error(
        `structure.root "${raw}" traverses a symbolic link at "${cur}" — the visual tree root must not leave the repository`,
      );
    }
  }

  const abs = path.resolve(projectRoot, ...parts);
  if (!existsSync(abs)) {
    throw new Error(`structure.root "${raw}" does not exist (resolved to ${abs})`);
  }
  if (!statSync(abs).isDirectory()) {
    throw new Error(`structure.root "${raw}" is not a directory (resolved to ${abs})`);
  }
  return parts.join("/");
}

/**
 * Output-directory safety: the resolved output dir must live inside the project
 * root (scanner self-excludes it) and must not BE the root (breaks exclusion).
 */
export function assertOutputDirInside(projectRoot: string, directory: string): void {
  // Reject rooted/absolute forms under any host BEFORE host path semantics apply.
  if (isRootedOrAbsolute(directory)) {
    throw new Error(`output.directory "${directory}" must be inside the project root`);
  }
  const abs = path.resolve(projectRoot, directory);
  const rel = path.relative(projectRoot, abs);
  if (rel === "") {
    throw new Error(
      `output.directory "${directory}" must not be the project root itself (breaks output self-exclusion)`,
    );
  }
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`output.directory "${directory}" must be inside the project root`);
  }
  // Lexical containment is not enough: an existing symlink/junction can redirect
  // output outside the repo, so lstat each existing component and reject links.
  let cur = projectRoot;
  for (const part of rel.split(/[\\/]+/)) {
    cur = path.join(cur, part);
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(cur);
    } catch {
      return; // component doesn't exist yet — nothing to follow
    }
    if (st.isSymbolicLink()) {
      throw new Error(
        `output.directory "${directory}" traverses a symbolic link at "${cur}" — output must not leave the project root`,
      );
    }
  }
}

export function validateSemanticConfig(
  config: { cards: { structure: { root: string } }; output: { directory: string } },
  projectRoot: string,
): void {
  normalizeStructureRoot(config.cards.structure.root, projectRoot);
  assertOutputDirInside(projectRoot, config.output.directory);
}
