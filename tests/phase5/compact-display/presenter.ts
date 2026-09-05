/**
 * Presenter: pulls data from the (reused) codebaseStatistics and hands it to the
 * SAFE TSX template. No fs/state/git/runtime access.
 */

import type { DisplayContext } from "../../../src/display/types.js";
import type { SvgNode } from "../../../src/display/template/runtime.js";
import { codebaseStatistics } from "../../../src/statistics/index.js";
import type { CompactCardConfig } from "./definition.js";
import { CompactSvg } from "./template";

/** Render the compact SVG as a safe SvgNode via the TSX template. */
export function renderCompact(ctx: DisplayContext<CompactCardConfig>): SvgNode {
  const codebase = ctx.statistics.get(codebaseStatistics);
  return CompactSvg({ heading: ctx.config.label, analyzed: codebase.analyzedSourceFiles });
}
