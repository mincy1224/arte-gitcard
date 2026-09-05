/**
 * TEST-ONLY safe TSX Display (`languages-compact`). Proves the full internal
 * authoring path: definition → presenter → template.tsx → safe serializer →
 * artifact → lifecycle. NOT in DISPLAY_REGISTRY / DEFAULT_RUNTIME.
 */

import { z } from "zod";
import type { SvgNode } from "../../../src/display/template/runtime.js";
import { defineDisplay } from "../../../src/display/definition.js";
import type { DisplayContext } from "../../../src/display/types.js";
import { renderCompact } from "./presenter";

export interface CompactCardConfig {
  enabled: boolean;
  /** Heading text (rendered into <title>/<text>) — exercised for escaping. */
  label: string;
}

const schema = z.object({ enabled: z.boolean(), label: z.string().min(1) }).strict();

function defaults(): CompactCardConfig {
  return { enabled: false, label: "compact" };
}

export const languagesCompactDisplay = defineDisplay<CompactCardConfig>({
  id: "languages-compact",
  title: "Languages Compact",
  config: {
    schema: schema as z.ZodType<CompactCardConfig>,
    defaults,
    requiredInSchemaV2: false,
    settings: [
      {
        key: "label",
        type: "string",
        description: "Heading text",
        read: (c) => c.label,
        apply: (c, raw) => {
          c.label = raw;
        },
        reset: (c) => {
          c.label = "compact";
        },
      },
    ],
  },
  // SAFE template: returns an SvgNode (TSX) — the framework serializes it.
  template: (ctx: DisplayContext<CompactCardConfig>): SvgNode => renderCompact(ctx),
});
