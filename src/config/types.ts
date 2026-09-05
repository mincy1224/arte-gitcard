export type ActivityDays = 7 | 14 | 30;
/** Activity window anchor: `recent` ends today; `last-activity` ends on the
 * repository's latest commit day (so an inactive repo still shows its history). */
export type ActivityAnchor = "recent" | "last-activity";

export interface LanguageCommentDef {
  line?: string[];
  block?: Array<[string, string]>;
}

export interface LanguageRule {
  id: string;
  name: string;
  extensions?: string[];
  filenames?: string[];
  shebang?: string[];
  comments?: LanguageCommentDef;
}

/** Persisted `cards.structure`. Directory descriptions are NOT a config key —
 * CLI-managed store metadata injected at generation time. */
export interface StructureCardConfig {
  enabled: boolean;
  root: string;
  max_depth: number;
  activity_days: ActivityDays;
  /** Optional anchor override (default `recent`); additive so existing v2 configs stay valid. */
  activity_anchor?: ActivityAnchor;
  commits: { enabled: boolean };
  changes: { enabled: boolean };
}

export interface CodebaseCardConfig {
  enabled: boolean;
  languages: {
    include_comments: boolean;
  };
}

/**
 * Persisted `cards.<id>` slices are display-owned. Required displays (codebase,
 * structure) are typed here; registered optional displays live at the Display
 * boundary, accessed only via `resolveDisplayConfig`. Unregistered ids are
 * rejected by the schema.
 */
export interface CardSlices {
  codebase: CodebaseCardConfig;
  structure: StructureCardConfig;
  [displayId: string]: unknown;
}

/** v2 config (schema-version: 2). The GitHub default branch is NEVER config — GitHub owns it. */
export interface ArteGitCardConfig {
  "schema-version": 2;
  cards: CardSlices;
  languages?: LanguageRule[];
  /** User-editable scan exclusions; tool-correctness hard excludes are applied by the scanner regardless. */
  exclude?: string[];
  theme: string;
  output: { directory: string };
  /**
   * GitHub auto-update, managed via `github enable`/`github disable`. The default
   * branch is never stored here — GitHub is the source of truth; the installed
   * branch lives in state.json.
   */
  "auto-update": boolean;
}

export interface LoadedConfig {
  config: ArteGitCardConfig;
  /** Absolute directory of the config file. All relative paths resolve against it. */
  projectRoot: string;
  configPath: string;
  /**
   * SHA-256 of the EXACT bytes parsed into `config`; preconditions must use this,
   * never a later re-read. Absent for in-memory/fabricated configs.
   */
  sourceSha256?: string;
}
