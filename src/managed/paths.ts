/**
 * Fixed tool-managed paths (repo-relative POSIX). These are the ONLY paths the
 * kind-specific guards allow for their kind — state.json is ownership EVIDENCE,
 * never path AUTHORITY. Source paths never appear in this set.
 */

export const STATE_REL = ".arte-git-card/state.json";
export const WORKFLOW_REL = ".github/workflows/arte-gitcard.yml";
export const CI_ACTION_REL = ".arte-git-card/ci/action.yml";
export const CI_RUNTIME_REL = ".arte-git-card/ci/main.cjs";
export const STRUCTURE_DESCRIPTIONS_REL = ".arte-git-card/structure-descriptions.json";
export const THEMES_DIR_REL = ".arte-git-card/themes";
export const LOCK_REL = ".arte-git-card/.lock";
export const JOURNAL_REL = ".arte-git-card/txn.json";

/**
 * Card output filenames are NOT hardcoded here: they derive from the static
 * display registry (`displayFilenames()`, `${displayId}.svg`) so state.json /
 * guards / detect can never drift from the compiled set of Displays.
 */
export const PREVIEW_FILENAME = "preview.html";
