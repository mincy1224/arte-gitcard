/**
 * Language registry: built-ins merged with user-defined custom languages
 * (plan.md §55). Custom languages override built-ins by id and add new ones.
 */

import { BUILTIN_LANGUAGES, BUILTIN_BY_EXT, BUILTIN_BY_FILENAME, type LanguageDef, type LexerSyntax } from "./builtin.js";
import type { LanguageRule } from "../config/types.js";

const EMPTY_SYNTAX: LexerSyntax = {};

/** Build the effective language set from config custom rules (plan.md §55). */
export function buildRegistry(customRules: LanguageRule[] | undefined): LanguageDef[] {
  if (!customRules || customRules.length === 0) return BUILTIN_LANGUAGES;
  const byId = new Map<string, LanguageDef>();
  for (const lang of BUILTIN_LANGUAGES) byId.set(lang.id, lang);
  for (const rule of customRules) {
    const existing = byId.get(rule.id);
    // Merge syntax, don't replace: keep the built-in's strings and any comment
    // kind the rule doesn't touch; an explicit empty array removes that kind.
    const base = existing?.syntax ?? EMPTY_SYNTAX;
    const syntax: LexerSyntax = {
      lineComment: rule.comments?.line !== undefined ? rule.comments.line : base.lineComment,
      blockComment: rule.comments?.block !== undefined ? rule.comments.block : base.blockComment,
      strings: base.strings,
    };
    // Overrides inherit unspecified fields via ?? (never ||), so an explicit
    // empty array still means "remove".
    byId.set(rule.id, {
      id: rule.id,
      name: rule.name ?? existing?.name,
      extensions: rule.extensions ?? existing?.extensions,
      filenames: rule.filenames ?? existing?.filenames,
      shebang: rule.shebang ?? existing?.shebang,
      syntax,
    });
  }
  return [...byId.values()];
}

export interface Registry {
  languages: LanguageDef[];
  byExt: Map<string, LanguageDef>;
  byFilename: Map<string, LanguageDef>;
  byId: Map<string, LanguageDef>;
}

export function buildRegistryIndex(languages: LanguageDef[]): Registry {
  const byExt = new Map<string, LanguageDef>();
  const byFilename = new Map<string, LanguageDef>();
  const byId = new Map<string, LanguageDef>();
  for (const lang of languages) {
    byId.set(lang.id, lang);
    for (const ext of lang.extensions ?? []) byExt.set(ext.toLowerCase(), lang);
    for (const name of lang.filenames ?? []) byFilename.set(name.toLowerCase(), lang);
  }
  return { languages, byExt, byFilename, byId };
}
