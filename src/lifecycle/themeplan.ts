/**
 * Shared selected-theme planning for lifecycle transactions (init/reset/migrate).
 *
 * ONE rule so config, on-disk theme and generated cards always agree:
 *   - selected theme ABSENT → this command may MATERIALIZE it from a known
 *     source (write the YAML) and must register a {kind:"theme"} provenance
 *     entry in the SAME final state.json;
 *   - selected theme PRESENT → never overwrite, never auto-claim; the ACTUAL
 *     on-disk theme is strictly loaded/validated and used for card planning; a
 *     file that cannot load/validate fails closed BEFORE any write.
 *
 * A pre-existing theme keeps a legitimate provenance entry; an UNOWNED theme
 * stays unowned (no fabricated ownership).
 */

import YAML from "yaml";
import { resolveFromProject } from "../config/paths.js";
import { entryPresence } from "../fs/presence.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import type { ThemeSchema } from "../theme/schema.js";

export interface SelectedThemePlan {
  /** repo-relative selected theme path */
  rel: string;
  /** non-null exactly when THIS transaction materializes the file (write it). */
  writeRel: string | null;
  /** bytes to write when materializing; null when the file already exists. */
  writeBytes: string | null;
  /** theme to plan the card bytes against (disk theme when present, else the source). */
  resolved: ResolvedTheme;
}

export function planSelectedTheme(
  projectRoot: string,
  rel: string,
  materializeSource: ThemeSchema | null,
): SelectedThemePlan {
  const abs = resolveFromProject(projectRoot, rel);
  const presence = entryPresence(abs);
  if (presence === "file") {
    // A REAL regular theme file: preserve bytes, never overwrite / never
    // auto-claim. Strict load + validate — invalid content fails closed.
    const schema = loadTheme(rel, projectRoot);
    return { rel, writeRel: null, writeBytes: null, resolved: resolveTheme(schema) };
  }
  if (presence === "absent") {
    if (!materializeSource) {
      throw new Error(
        `Selected theme file "${rel}" does not exist and arte-gitcard has no builtin preset to materialize it. ` +
          `Run "arte-gitcard doctor" to inspect.`,
      );
    }
    const writeBytes = YAML.stringify(materializeSource);
    return { rel, writeRel: rel, writeBytes, resolved: resolveTheme(materializeSource) };
  }
  // unsafe: a symlink (valid or broken), a directory, or an unreadable occupant.
  // Never follow it, never materialize over it — fail closed before any mutation.
  throw new Error(
    `Selected theme file "${rel}" is not a regular file (symlink/directory/…) — refusing to use it (preserving). ` +
      `Run "arte-gitcard doctor" to inspect.`,
  );
}
