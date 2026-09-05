/**
 * FC-5: the internal scaffolder derives valid TypeScript identifiers from any
 * real kebab-case display id and emits a syntactically typecheckable skeleton
 * (no invalid tokens, no placeholder ellipses).
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error — the scaffolder is plain JS (no declaration file).
import { scaffoldFor } from "../../scripts/dev-new-display.mjs";

describe("dev:new-display identifier derivation (FC-5)", () => {
  it("languages-compact → Pascal/camel identifiers (files stay kebab)", () => {
    const text = scaffoldFor("languages-compact");
    expect(text).toContain("LanguagesCompactCardConfig");
    expect(text).toContain("languagesCompactSchema");
    expect(text).toContain("languagesCompactDefaults");
    expect(text).toContain("languagesCompactDisplay");
    expect(text).toContain("renderLanguagesCompact");
    expect(text).toContain("LanguagesCompactSvg");
    expect(text).toContain("builtin/languages-compact/definition.ts");
    expect(text).toContain('id: "languages-compact"');
    // the old, invalid derivation never appears
    expect(text).not.toContain("Languages-compactCardConfig");
    expect(text).not.toContain("languages-compactSchema");
  });

  it("repo-health and stats2 derive valid identifiers", () => {
    const repo = scaffoldFor("repo-health");
    expect(repo).toContain("RepoHealthCardConfig");
    expect(repo).toContain("repoHealthDisplay");
    expect(repo).toContain("renderRepoHealth");
    const stats2 = scaffoldFor("stats2");
    expect(stats2).toContain("Stats2CardConfig");
    expect(stats2).toContain("stats2Display");
    expect(stats2).toContain("Stats2Svg");
  });

  it("never emits placeholder ellipses or raw repository readers", () => {
    for (const id of ["repo-health", "languages-compact", "stats2"]) {
      const text = scaffoldFor(id);
      expect(text).not.toContain("…");
      expect(text).not.toContain("props.…");
      expect(text).not.toContain("node:fs");
      expect(text).not.toContain("defineLegacySvgDisplay");
      expect(text).toContain("defineDisplay");
      expect(text).toContain("requiredInSchemaV2: false");
    }
  });

  it("rejects invalid ids", () => {
    expect(() => scaffoldFor("Bad Thing")).toThrow(/usage/i);
    expect(() => scaffoldFor("9lives")).toThrow(/usage/i);
    expect(() => scaffoldFor("")).toThrow(/usage/i);
  });
});
