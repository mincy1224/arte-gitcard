/**
 * Language detection (plan.md §61): filename → extension → shebang → Other.
 */

import type { Registry } from "./registry.js";
import path from "node:path";

export const OTHER_ID = "other";

/** Detect by file basename / extension, lowercased. */
export function detectByName(registry: Registry, filePath: string): string | undefined {
  const base = path.basename(filePath);
  const byName = registry.byFilename.get(base.toLowerCase());
  if (byName) return byName.id;
  const ext = path.extname(base).toLowerCase();
  const byExt = registry.byExt.get(ext);
  if (byExt) return byExt.id;
  return undefined;
}

/** Detect by shebang interpreter (`#!/usr/bin/env python3` → "python"; exact name match). */
export function detectByShebang(registry: Registry, firstLine: string): string | undefined {
  if (!firstLine.startsWith("#!")) return undefined;
  const rest = firstLine.slice(2).trim();
  let interp: string | undefined;
  const envMatch = /\benv\s+([A-Za-z0-9_.-]+)/.exec(rest);
  if (envMatch) {
    interp = envMatch[1];
  } else {
    const segMatch = /\/([A-Za-z0-9_.-]+)(?:\s|$)/.exec(rest);
    interp = segMatch?.[1];
  }
  if (!interp) return undefined;
  const norm = interp.toLowerCase();
  for (const lang of registry.languages) {
    for (const s of lang.shebang ?? []) {
      if (norm === s.toLowerCase()) return lang.id;
    }
  }
  return undefined;
}
