/**
 * Managed-entry presence classification (P0). Preflights must tell "nothing is
 * there" apart from "something occupies the path" — a BROKEN symlink, directory,
 * or unreadable entry — BEFORE a mutation stages anything: `statSync`/`existsSync`
 * follow symlinks and treat a broken symlink as absent, which would let a
 * transaction stage+write over it. Classification is by `lstatSync`; any
 * non-regular occupant or non-ENOENT lstat error is a fail-closed "unsafe".
 */

import { lstatSync } from "node:fs";

export type EntryPresence = "absent" | "file" | "unsafe";

export function entryPresence(abs: string): EntryPresence {
  let st;
  try {
    st = lstatSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return "absent";
    return "unsafe"; // unreadable parent / EACCES / ENOTDIR → fail closed
  }
  if (st.isSymbolicLink()) return "unsafe"; // includes broken symlinks
  if (st.isFile()) return "file";
  return "unsafe"; // directory / socket / fifo / …
}

/** True when any entry (including a broken symlink / dir) occupies the path. */
export function pathOccupied(abs: string): boolean {
  return entryPresence(abs) !== "absent";
}
