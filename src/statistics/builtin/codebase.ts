/**
 * codebaseStatistics — semantic repository code statistics (view-agnostic).
 * No formatting/colors/sorting-for-rank/theme/SVG here: it always exposes BOTH
 * effective and comments data; whether comments join a rank is a Display choice.
 *
 * Depends on repositoryScanStatistic (single scan per generation).
 */

import { analyzeCodebase } from "../../codebase/analyze.js";
import type { CodebaseData } from "../../codebase/analyze.js";
import type { ScanResult } from "../../scanner/index.js";
import { defineStatistic } from "../definition.js";
import { legacyView } from "../legacy-internal.js";
import { repositoryScanStatistic } from "./repository-scan.js";

/** Semantic codebase statistics (analyzeCodebase output, unchanged). */
export const codebaseStatistics = defineStatistic<undefined, CodebaseData>({
  id: "codebase",
  compute: (ctx) => {
    // Internal seam: feed the trusted legacy analyzer its mutable-view input.
    const scan = legacyView<ScanResult>(ctx.statistics.get(repositoryScanStatistic));
    return analyzeCodebase(scan.files, ctx.registry);
  },
});
