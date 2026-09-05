import { z } from "zod";

export const activityDaysSchema = z.union([z.literal(7), z.literal(14), z.literal(30)]);

// Comment markers must be non-empty: a zero-length start/end marker can stall
// the lexer cursor in an infinite loop (SPEC §8), so empty strings are rejected.
export const languageCommentSchema = z
  .object({
    line: z.array(z.string().min(1)).optional(),
    block: z.array(z.tuple([z.string().min(1), z.string().min(1)])).optional(),
  })
  .strict();

export const languageRuleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    extensions: z.array(z.string()).optional(),
    filenames: z.array(z.string()).optional(),
    shebang: z.array(z.string()).optional(),
    comments: languageCommentSchema.optional(),
  })
  .strict();

/**
 * v1 (LEGACY) strict config schema, kept ONLY for migration (config/migrate.ts)
 * and tests. v1 defaulting via deepMerge is GONE — loading is strict and never
 * silently repaired. v2 lives in config/v2.ts.
 */
export const arteGitCardConfigSchema = z
  .object({
    cards: z
      .object({
        codebase: z
          .object({
            enabled: z.boolean(),
            languages: z.object({ include_comments: z.boolean() }).strict(),
          })
          .strict(),
        structure: z
          .object({
            enabled: z.boolean(),
            root: z.string(),
            max_depth: z.number().int().min(1).max(20),
            activity_days: activityDaysSchema,
            commits: z.object({ enabled: z.boolean() }).strict(),
            changes: z.object({ enabled: z.boolean() }).strict(),
          })
          .strict(),
      })
      .strict(),
    languages: z.array(languageRuleSchema).optional(),
    exclude: z.array(z.string()).optional(),
    theme: z.string(),
    output: z.object({ directory: z.string() }).strict(),
  })
  .strict();

export type ArteGitCardConfigSchema = z.infer<typeof arteGitCardConfigSchema>;
