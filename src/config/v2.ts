/**
 * v2 config schema (schema-version: 2). STRICT — an existing config is validated
 * directly with no deepMerge of defaults; only init/migrate materializes defaults.
 */

import { z } from "zod";
import { languageRuleSchema } from "./schema.js";
import type { RegisteredDisplay } from "../display/definition.js";
import type { ArteGitCardConfig } from "./types.js";

/**
 * Compose the v2 cards schema from the compiled Display registry: required
 * displays are REQUIRED, others OPTIONAL, and unknown card ids are rejected by
 * `.strict()` — a config can never invent a display identity, while a future
 * display missing from an old config stays valid.
 */
export function buildV2Schema(displays: readonly RegisteredDisplay[]): z.ZodType<ArteGitCardConfig> {
  const cardsShape: Record<string, z.ZodTypeAny> = {};
  for (const display of displays) {
    cardsShape[display.id] = display.config.requiredInSchemaV2
      ? display.config.schema
      : display.config.schema.optional();
  }
  const schema = z
    .object({
      "schema-version": z.literal(2),
      cards: z.object(cardsShape).strict(),
      languages: z.array(languageRuleSchema).optional(),
      exclude: z.array(z.string()).optional(),
      theme: z.string(),
      output: z.object({ directory: z.string() }).strict(),
      "auto-update": z.boolean(),
    })
    .strict();
  // zod cannot statically map the registry-composed shape onto CardSlices
  // (typed codebase/structure + index-unknown); framework reads slices via helpers.
  return schema as unknown as z.ZodType<ArteGitCardConfig>;
}
