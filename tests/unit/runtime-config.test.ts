/**
 * Phase 4 config composition unit tests: the compiled ArteRuntime is immutable,
 * its typed config-key registry derives from the Display registry (settings
 * autowire), and effective-vs-persisted + materialization semantics hold at the
 * config-registry level (no filesystem involved).
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createArteRuntime, DEFAULT_RUNTIME } from "../../src/runtime.js";
import { codebaseDisplay } from "../../src/display/builtin/codebase/definition.js";
import { structureDisplay } from "../../src/display/builtin/structure/definition.js";
import { defineDisplay } from "../../src/display/definition.js";
import { h } from "../../src/display/template/runtime.js";
import { cloneConfig, findConfigKey, listConfigKeys, tuningKeys } from "../../src/config/registry.js";
import { buildDefaultConfig } from "../../src/config/defaults.js";
import type { ArteGitCardConfig } from "../../src/config/types.js";

interface FutureCardConfig {
  enabled: boolean;
  mystery: string;
}

const futureDisplay = defineDisplay<FutureCardConfig>({
  id: "future-card",
  title: "Future Card",
  config: {
    schema: z
      .object({ enabled: z.boolean(), mystery: z.string().min(1) })
      .strict() as z.ZodType<FutureCardConfig>,
    defaults: () => ({ enabled: false, mystery: "default-mystery" }),
    requiredInSchemaV2: false,
    settings: [
      {
        key: "mystery",
        type: "string",
        description: "A future setting",
        read: (c) => c.mystery,
        apply: (c, raw) => {
          c.mystery = raw;
        },
        reset: (c) => {
          c.mystery = "default-mystery";
        },
      },
    ],
  },
  template: () => h("svg", null),
});

const testRuntime = createArteRuntime({
  displays: [codebaseDisplay, structureDisplay, futureDisplay],
});

describe("ArteRuntime is compiled + immutable", () => {
  it("DEFAULT_RUNTIME and an isolated runtime freeze every derived value", () => {
    for (const rt of [DEFAULT_RUNTIME, testRuntime]) {
      expect(Object.isFrozen(rt)).toBe(true);
      expect(Object.isFrozen(rt.displays)).toBe(true);
      expect(Object.isFrozen(rt.config.settings)).toBe(true);
      expect(Object.isFrozen(rt.cardIds)).toBe(true);
      expect(Object.isFrozen(rt.cardFilenames)).toBe(true);
    }
    expect(DEFAULT_RUNTIME.cardIds).toEqual(["codebase", "structure"]);
    expect(testRuntime.cardIds).toEqual(["codebase", "structure", "future-card"]);
    expect(testRuntime.cardFilenames).toEqual([
      "codebase.svg",
      "structure.svg",
      "future-card.svg",
    ]);
  });

  it("createArteRuntime refuses a display that declares the framework key 'enabled'", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bad = defineDisplay<any>({
      id: "bad-card",
      title: "Bad",
      config: {
        schema: z.object({ enabled: z.boolean() }).strict() as any,
        defaults: () => ({ enabled: false }),
        requiredInSchemaV2: false,
        settings: [
          {
            key: "enabled",
            type: "boolean",
            description: "tries to shadow lifecycle",
            read: () => false,
            apply: () => undefined,
            reset: () => undefined,
          },
        ],
      },
      template: () => h("svg", null),
    });
    expect(() => createArteRuntime({ displays: [codebaseDisplay, structureDisplay, bad] })).toThrow(/enabled.*lifecycle-managed/);
  });
});

describe("typed settings autowire from the registry", () => {
  it("the default key registry carries lifecycle + settings + globals (no hardcoded display keys)", () => {
    const keys = listConfigKeys(DEFAULT_RUNTIME).map((k) => k.key);
    for (const expected of [
      "codebase.enabled",
      "structure.enabled",
      "codebase.include-comments",
      "structure.root",
      "structure.max-depth",
      "structure.activity-days",
      "structure.commits.enabled",
      "structure.changes.enabled",
      "theme",
      "auto-update",
      "output.directory",
    ]) {
      expect(keys).toContain(expected);
    }
    // The GitHub default branch is NEVER a config key — GitHub owns it.
    expect(keys).not.toContain("github.branch");
    const tunings = tuningKeys(DEFAULT_RUNTIME).map((k) => k.key);
    expect(tunings).toContain("structure.max-depth");
    expect(tunings).not.toContain("codebase.enabled");
    expect(tunings).not.toContain("structure.enabled");
  });

  it("an optional display contributes <id>.enabled (lifecycle) + its typed settings", () => {
    expect(findConfigKey(testRuntime, "future-card.enabled")!.kind).toBe("lifecycle");
    expect(findConfigKey(testRuntime, "future-card.mystery")!.kind).toBe("tuning");
  });

  it("config set/reset <id>.enabled is REFUSED with the add/remove hint", () => {
    const spec = findConfigKey(testRuntime, "future-card.enabled")!;
    expect(spec.kind).toBe("lifecycle");
    const cfg = cloneConfig(buildDefaultConfig());
    expect(() => spec.apply(cfg, "true", { projectRoot: "." })).toThrow(/arte-gitcard add future-card/);
    expect(() => spec.reset(cfg)).toThrow(/lifecycle-managed/);
  });
});

describe("effective vs persisted config + materialization semantics", () => {
  function base(cards?: Record<string, unknown>): ArteGitCardConfig {
    const cfg = cloneConfig(buildDefaultConfig());
    if (cards) for (const [k, v] of Object.entries(cards)) (cfg.cards as Record<string, unknown>)[k] = v;
    return cfg;
  }

  it("an absent optional display reads EFFECTIVE defaults without materializing", () => {
    const cfg = base();
    const spec = findConfigKey(testRuntime, "future-card.mystery")!;
    expect(spec.read(cfg)).toBe("default-mystery");
    expect("future-card" in (cfg.cards as object)).toBe(false);
  });

  it("config set on a missing block materializes defaults + applies, keeping enabled=false", () => {
    const cfg = base();
    const spec = findConfigKey(testRuntime, "future-card.mystery")!;
    spec.apply(cfg, "hello", { projectRoot: "." });
    const block = (cfg.cards as Record<string, unknown>)["future-card"] as { enabled: boolean; mystery: string };
    expect(block).toEqual({ enabled: false, mystery: "hello" });
  });

  it("config reset on a missing block is a no-op; on a persisted block resets only that setting", () => {
    const missing = base();
    const spec = findConfigKey(testRuntime, "future-card.mystery")!;
    spec.reset(missing);
    expect("future-card" in (missing.cards as object)).toBe(false);

    const persisted = base({ "future-card": { enabled: true, mystery: "custom" } });
    spec.reset(persisted);
    const block = (persisted.cards as Record<string, unknown>)["future-card"] as { enabled: boolean; mystery: string };
    expect(block).toEqual({ enabled: true, mystery: "default-mystery" }); // enabled state preserved
  });

  it("a schema with the optional display registered accepts its block; DEFAULT refuses unregistered ids", () => {
    const cfg = buildDefaultConfig();
    (cfg.cards as Record<string, unknown>)["future-card"] = { enabled: false, mystery: "x" };
    expect(testRuntime.config.v2Schema.safeParse(cfg).success).toBe(true);
    expect(DEFAULT_RUNTIME.config.v2Schema.safeParse(cfg).success).toBe(false);
  });
});
