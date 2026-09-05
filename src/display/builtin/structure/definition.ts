/** Structure Display definition. Config slice = persisted `cards.structure` (no descriptions — CLI-managed store metadata). Legacy-backed template. */

import { z } from "zod";
import type { StructureCardConfig } from "../../../config/types.js";
import { activityDaysSchema } from "../../../config/schema.js";
import { defineLegacySvgDisplay } from "../../definition.js";
import { parseBool, parseEnumValue, parseIntegerRange } from "../../settings.js";
import { renderStructureDisplay } from "./presenter.js";

const structureSchema = z
  .object({
    enabled: z.boolean(),
    root: z.string(),
    max_depth: z.number().int().min(1).max(5),
    activity_days: activityDaysSchema,
    activity_anchor: z.enum(["recent", "last-activity"]).optional(),
    commits: z.object({ enabled: z.boolean() }).strict(),
    changes: z.object({ enabled: z.boolean() }).strict(),
  })
  .strict() as z.ZodType<StructureCardConfig>;

const intRange = (key: string, min: number, max: number) =>
  (c: StructureCardConfig, raw: string): number => parseIntegerRange(raw, min, max, key);

export const structureDisplay = defineLegacySvgDisplay<StructureCardConfig>({
  id: "structure",
  title: "Structure",
  config: {
    schema: structureSchema,
    defaults: () => ({
      enabled: false,
      root: ".",
      max_depth: 3,
      activity_days: 7,
      commits: { enabled: true },
      changes: { enabled: true },
    }),
    requiredInSchemaV2: true,
    settings: [
      {
        key: "root",
        type: "safe-relative-path",
        description: "Visual tree root (project-relative directory)",
        read: (c) => c.root,
        apply: (c, raw) => {
          // Root containment is validated at generation time (display-owned, read-only here).
          c.root = raw;
        },
        reset: (c) => {
          c.root = ".";
        },
      },
      {
        key: "max-depth",
        type: "integer 1..5",
        description: "Tree render depth (1..5; the repo root row is level 0 and does not consume it)",
        read: (c) => c.max_depth,
        apply: (c, raw) => {
          c.max_depth = intRange("structure.max-depth", 1, 5)(c, raw);
        },
        reset: (c) => {
          c.max_depth = 3;
        },
      },
      {
        key: "activity-days",
        type: "integer 7|14|30",
        description: "Git activity window in days",
        read: (c) => c.activity_days,
        apply: (c, raw) => {
          c.activity_days = parseEnumValue(raw, [7, 14, 30], "structure.activity-days") as 7 | 14 | 30;
        },
        reset: (c) => {
          c.activity_days = 7;
        },
      },
      {
        key: "activity-anchor",
        type: "recent|last-activity",
        description: "Activity window anchor (recent ends today; last-activity ends on the latest commit day)",
        read: (c) => c.activity_anchor ?? "recent",
        apply: (c, raw) => {
          c.activity_anchor = parseEnumValue(raw, ["recent", "last-activity"], "structure.activity-anchor") as "recent" | "last-activity";
        },
        reset: (c) => {
          delete c.activity_anchor;
        },
      },
      {
        key: "commits.enabled",
        type: "boolean",
        description: "Show commits heatmap",
        read: (c) => c.commits.enabled,
        apply: (c, raw) => {
          c.commits.enabled = parseBool(raw, "structure.commits.enabled");
        },
        reset: (c) => {
          c.commits.enabled = true;
        },
      },
      {
        key: "changes.enabled",
        type: "boolean",
        description: "Show changes microbars",
        read: (c) => c.changes.enabled,
        apply: (c, raw) => {
          c.changes.enabled = parseBool(raw, "structure.changes.enabled");
        },
        reset: (c) => {
          c.changes.enabled = true;
        },
      },
    ],
  },
  template: (ctx) => renderStructureDisplay(ctx),
});
