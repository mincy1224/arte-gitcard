export { VERSION } from "./version.js";
export { round1, formatInteger, formatPercent } from "./util/format.js";
export { compareCodeUnit } from "./util/sort.js";

// Layout engine
export { estimateTextWidth } from "./layout/measure.js";
export {
  layoutLanguageArea,
  measureLanguageCell,
  resolveColumns,
  chunkColumns,
  MINI_BAR_WIDTH,
  MINI_BAR_HEIGHT,
  MINI_BAR_GAP,
  LANGUAGE_ITEM_GAP,
  LANGUAGE_ROW_HEIGHT,
} from "./layout/languages.js";
export { layoutCodebase } from "./layout/codebase.js";
export { layoutStructure } from "./layout/structure.js";

// Codebase model + analysis
export {
  countedLines,
  compareLanguageRank,
  sortLanguages,
  rankLanguages,
} from "./codebase/model.js";
export { analyzeCodebase } from "./codebase/analyze.js";
export { buildCodebaseCard } from "./codebase/card.js";

// Structure model
export { buildTree, flattenTree } from "./structure/tree.js";
export { runGitActivity } from "./structure/activity.js";
export { buildStructureData } from "./structure/model.js";

// Languages
export { BUILTIN_LANGUAGES } from "./languages/builtin.js";
export { buildRegistry, buildRegistryIndex } from "./languages/registry.js";
export { detectByName, detectByShebang } from "./languages/detect.js";
export { countSourceFile, totalOf } from "./languages/lexer.js";

// Renderers
export { renderCodebaseCard } from "./codebase/render.js";
export { renderStructureCard } from "./structure/render.js";

// Scanner
export { scanRepository } from "./scanner/index.js";

// Themes
export { resolveTheme, assignLanguageColors, HUE_INTERLEAVE_ORDER } from "./theme/resolve.js";
export { deriveTone } from "./theme/color.js";
export { DEFAULT_THEME } from "./theme/default-theme.js";
export { GITHUB_THEME } from "./theme/github-theme.js";
export { loadTheme, BUILTIN_THEMES } from "./theme/load.js";

// Generation planning + preview: PURE, memory-only APIs only. Direct mutation
// writers are intentionally not exported: all mutation goes through the CLI
// lifecycle managers (state.json ownership + transaction engine).
export { planCardArtifacts } from "./generate/plan.js";
export { buildPreviewHtml } from "./output/preview.js";
