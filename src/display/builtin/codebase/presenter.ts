/**
 * Codebase Display presenter — legacy-backed wrapper. The SVG is produced by the
 * UNCHANGED legacy renderer; repository data + theme cross the readonly boundary
 * via the narrow `legacyView` seam.
 */

import type { CodebaseCardConfig } from "../../../config/types.js";
import type { DisplayContext } from "../../types.js";
import { codebaseStatistics } from "../../../statistics/index.js";
import { legacyView } from "../../../statistics/legacy-internal.js";
import type { ResolvedTheme } from "../../../theme/resolve.js";
import { buildCodebaseCard } from "../../../codebase/card.js";
import { layoutCodebase } from "../../../layout/codebase.js";
import { renderCodebaseCard } from "../../../codebase/render.js";

export function renderCodebaseDisplay(ctx: DisplayContext<CodebaseCardConfig>): string {
  // Narrow legacy seam (byte-locked builder expects historical mutable types).
  const data = legacyView<Parameters<typeof buildCodebaseCard>[0]>(ctx.statistics.get(codebaseStatistics));
  const theme = legacyView<ResolvedTheme>(ctx.theme);
  const cardData = buildCodebaseCard(data, ctx.config.languages.include_comments, theme.dataColors);
  const layout = layoutCodebase(cardData);
  return renderCodebaseCard(layout, theme);
}
