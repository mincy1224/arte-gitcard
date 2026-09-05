/**
 * repositoryScanStatistic — the shared base source for other statistics.
 * Not a UI statistic: it feeds codebase / tree analysis. Reuses scanRepository
 * verbatim (git tracked-file behavior, hard + user excludes, symlink handling,
 * current-output exclusion). Scanner semantics are unchanged.
 */

import { scanRepository } from "../../scanner/index.js";
import type { ScanResult } from "../../scanner/index.js";
import { defineStatistic } from "../definition.js";

/** Base repository scan. Computed lazily and memoized per generation. */
export const repositoryScanStatistic = defineStatistic<undefined, ScanResult>({
  id: "repositoryScan",
  compute: (ctx) =>
    scanRepository(ctx.projectRoot, {
      outputDirs: [ctx.outputDirRel],
      exclude: ctx.exclude,
    }),
});
