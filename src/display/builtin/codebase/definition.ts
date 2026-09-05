/** Codebase Display definition. Config slice = persisted `cards.codebase`. Legacy-backed template. */

import { z } from "zod";
import type { CodebaseCardConfig } from "../../../config/types.js";
import { defineLegacySvgDisplay } from "../../definition.js";
import { parseBool } from "../../settings.js";
import { renderCodebaseDisplay } from "./presenter.js";

const codebaseSchema = z
  .object({
    enabled: z.boolean(),
    languages: z.object({ include_comments: z.boolean() }).strict(),
  })
  .strict() as z.ZodType<CodebaseCardConfig>;

export const codebaseDisplay = defineLegacySvgDisplay<CodebaseCardConfig>({
  id: "codebase",
  title: "Codebase",
  config: {
    schema: codebaseSchema,
    defaults: () => ({ enabled: false, languages: { include_comments: false } }),
    requiredInSchemaV2: true,
    settings: [
      {
        key: "include-comments",
        type: "boolean",
        description: "Include comment lines in language stats",
        read: (c) => c.languages.include_comments,
        apply: (c, raw) => {
          c.languages.include_comments = parseBool(raw, "codebase.include-comments");
        },
        reset: (c) => {
          c.languages.include_comments = false;
        },
      },
    ],
  },
  // Byte-locked legacy renderer (golden). NOT migrated to the safe template runtime.
  template: (ctx) => renderCodebaseDisplay(ctx),
});
