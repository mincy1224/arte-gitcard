/**
 * cloneConfig is a DEEP clone (Phase 4) so nested objects/arrays never share
 * references — required for extension-safe config mutation (a future Display
 * config field must not need a hand-written copy clause).
 */

import { describe, expect, it } from "vitest";
import { cloneConfig } from "../../src/config/registry.js";
import { buildDefaultConfig } from "../../src/config/defaults.js";

describe("cloneConfig deep isolation", () => {
  it("nested objects and arrays are independent after cloning", () => {
    const original = buildDefaultConfig();
    const copy = cloneConfig(original);

    expect(copy).toEqual(original);

    // arrays
    copy.exclude = [...(copy.exclude ?? []), "my-custom"];
    expect(original.exclude).not.toContain("my-custom");

    // nested objects (cards + per-card languages + commits/changes)
    copy.cards.structure.max_depth = 9;
    copy.cards.codebase.languages.include_comments = true;
    copy.cards.structure.commits.enabled = false;
    expect(original.cards.structure.max_depth).toBe(3);
    expect(original.cards.codebase.languages.include_comments).toBe(false);
    expect(original.cards.structure.commits.enabled).toBe(true);

    // language rules array elements are independent
    const withLangs = buildDefaultConfig();
    withLangs.languages = [{ id: "tsx", name: "TSX", extensions: [".tsx"], comments: { line: ["//"] } }];
    const langCopy = cloneConfig(withLangs);
    langCopy.languages = [{ id: "tsx", name: "TSX", extensions: [".ts"], comments: { line: ["//"] } }];
    expect(withLangs.languages[0]!.extensions).toEqual([".tsx"]);
  });
});
