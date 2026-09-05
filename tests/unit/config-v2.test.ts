/**
 * v2 config schema (schema-version: 2). STRICT — no silent defaulting:
 * missing required fields, wrong types, and unknown keys all fail.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_RUNTIME } from "../../src/runtime.js";

const v2Schema = DEFAULT_RUNTIME.config.v2Schema;

const base = {
  "schema-version": 2,
  cards: {
    codebase: { enabled: true, languages: { include_comments: false } },
    structure: {
      enabled: true,
      root: ".",
      max_depth: 3,
      activity_days: 7,
      commits: { enabled: true },
      changes: { enabled: true },
    },
  },
  theme: ".arte-git-card/themes/arte-theme.yml",
  output: { directory: ".github/arte-git-card" },
  "auto-update": false,
};

describe("v2 config schema", () => {
  it("accepts a complete v2 config", () => {
    expect(v2Schema.safeParse(base).success).toBe(true);
  });

  it("accepts optional languages/exclude", () => {
    const full = {
      ...base,
      languages: [{ id: "custom", name: "Custom", extensions: [".cx"], comments: { line: ["//"] } }],
      exclude: ["out"],
    };
    expect(v2Schema.safeParse(full).success).toBe(true);
  });

  it("rejects a config that stores a github branch (GitHub owns the default branch, never config)", () => {
    expect(v2Schema.safeParse({ ...base, github: { branch: "main" } }).success).toBe(false);
  });

  it("rejects a missing schema-version literal", () => {
    const { "schema-version": _v, ...rest } = base;
    expect(v2Schema.safeParse(rest).success).toBe(false);
  });

  it("rejects a wrong schema-version", () => {
    expect(v2Schema.safeParse({ ...base, "schema-version": 3 }).success).toBe(false);
  });

  it("rejects a missing auto-update (would previously be deep-merged silently)", () => {
    const { "auto-update": _a, ...rest } = base;
    expect(v2Schema.safeParse(rest).success).toBe(false);
  });

  it("rejects an unknown top-level key (typos fail loudly)", () => {
    expect(v2Schema.safeParse({ ...base, tehme: "x" }).success).toBe(false);
  });

  it("rejects a wrong-typed field", () => {
    expect(
      v2Schema.safeParse({
        ...base,
        cards: { ...base.cards, structure: { ...base.cards.structure, max_depth: "three" } },
      }).success,
    ).toBe(false);
  });

  it("rejects a wrong-typed auto-update", () => {
    expect(v2Schema.safeParse({ ...base, "auto-update": "yes" }).success).toBe(false);
  });

  it("rejects a config whose cards contain an UNREGISTERED display id (schema authority = registry)", () => {
    // The production registry compiles only codebase + structure, so a user
    // cannot invent a display identity through the config.
    const forged = {
      ...base,
      cards: { ...base.cards, "evil-custom-card": { enabled: true, limit: 5 } },
    };
    expect(v2Schema.safeParse(forged).success).toBe(false);
  });

  it("rejects an unknown key INSIDE a card slice", () => {
    const bad = {
      ...base,
      cards: {
        ...base.cards,
        codebase: { enabled: true, languages: { include_comments: false }, surprise: true },
      },
    };
    expect(v2Schema.safeParse(bad).success).toBe(false);
  });
});
