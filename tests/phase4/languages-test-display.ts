/**
 * TEST-ONLY third Display (`languages-test`) used by the Phase 4 acceptance.
 *
 * It reuses ONLY the existing `codebaseStatistics` and renders a tiny
 * deterministic SVG. It is deliberately NOT part of the production
 * DISPLAY_REGISTRY / DEFAULT_RUNTIME: a test registry/runtime injects it, which
 * proves that adding a Display requires zero production-core changes.
 */

import { z } from "zod";
import type { DisplayContext } from "../../src/display/types.js";
import { defineDisplay } from "../../src/display/definition.js";
import { parseIntegerRange } from "../../src/display/settings.js";
import { codebaseStatistics } from "../../src/statistics/index.js";
import { h } from "../../src/display/template/runtime.js";

export interface LanguagesTestCardConfig {
  enabled: boolean;
  limit: number;
}

const languagesTestSchema = z
  .object({
    enabled: z.boolean(),
    limit: z.number().int().min(1).max(99),
  })
  .strict() as z.ZodType<LanguagesTestCardConfig>;

function defaults(): LanguagesTestCardConfig {
  return { enabled: false, limit: 3 };
}

export const languagesTestDisplay = defineDisplay<LanguagesTestCardConfig>({
  id: "languages-test",
  title: "Languages Test",
  // Optional in schema-v2: an old config (codebase+structure only) stays valid.
  config: {
    schema: languagesTestSchema,
    defaults,
    requiredInSchemaV2: false,
    settings: [
      {
        key: "limit",
        type: "integer 1..99",
        description: "Language cap",
        read: (c) => c.limit,
        apply: (c, raw) => {
          c.limit = parseIntegerRange(raw, 1, 99, "languages-test.limit");
        },
        reset: (c) => {
          c.limit = 3;
        },
      },
    ],
  },
  template: (ctx) => {
    // Reuse the EXISTING codebase statistic only (no new statistic). Returns a
    // SAFE SvgNode — the framework serializes it through renderSvg.
    const codebase = ctx.statistics.get(codebaseStatistics);
    const limit = ctx.config.limit;
    return h(
      "svg",
      { viewBox: "0 0 320 90", role: "img" },
      h("title", null, "languages-test"),
      h("text", { x: "10", y: "30", fill: "currentColor" }, "languages-test"),
      h(
        "text",
        { x: "10", y: "60", fill: "currentColor" },
        `limit=${String(limit)} files=${String(codebase.analyzedSourceFiles)}`,
      ),
    );
  },
});

export type { DisplayContext };
