import { existsSync } from "node:fs";
import path from "node:path";

export const CONFIG_FILENAME = "arte-gitcard.yml";
export const LEGACY_CONFIG_FILENAME = "arte-git-card.yml";

/** Prefer the v2 filename; return the legacy path too so the caller can detect LEGACY state and drive `migrate`. */
export function findConfigPath(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const v2 = path.join(dir, CONFIG_FILENAME);
    if (existsSync(v2)) return v2;
    const legacy = path.join(dir, LEGACY_CONFIG_FILENAME);
    if (existsSync(legacy)) return legacy;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function projectRootOf(configPath: string): string {
  return path.dirname(configPath);
}

export function resolveFromProject(projectRoot: string, p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(projectRoot, p);
}
