/**
 * Framework hardening regressions (unit):
 *  FH-1  no-arg snippet = ENABLED Displays only (optional absent → no error).
 *  FH-5  statistics cache is keyed by the DEFINITION object, not id; params that
 *        cannot be canonicalized FAIL CLOSED (never ambiguous `[object Object]`).
 *  FH-6  createArteRuntime rejects invalid defaults / enabled-true optional
 *        defaults / duplicate / invalid / shadowing config keys.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { createArteRuntime } from "../../src/runtime.js";
import { codebaseDisplay } from "../../src/display/builtin/codebase/definition.js";
import { structureDisplay } from "../../src/display/builtin/structure/definition.js";
import { defineDisplay } from "../../src/display/definition.js";
import { h } from "../../src/display/template/runtime.js";
import { languagesTestDisplay } from "../phase4/languages-test-display.js";
import { initRepository } from "../../src/lifecycle/init.js";
import { addCard } from "../../src/cardmgr/index.js";
import { buildAllEnabledSnippets } from "../../src/cardmgr/index.js";
import { loadConfigWithSchema } from "../../src/config/load.js";
import { cloneConfig, findConfigKey } from "../../src/config/registry.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { buildRegistry, buildRegistryIndex } from "../../src/languages/registry.js";
import { createStatisticsSession } from "../../src/statistics/session.js";
import { defineStatistic } from "../../src/statistics/definition.js";

const dirs: string[] = [];
function tmpRoot(): string {
  const d = mkdtempSync(path.join(os.tmpdir(), "agc-h-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("FH-1: no-arg snippet = ENABLED Displays only", () => {
  const runtime = createArteRuntime({
    displays: [codebaseDisplay, structureDisplay, languagesTestDisplay],
  });

  function themeOf(root: string) {
    const loaded = loadConfigWithSchema(path.join(root, "arte-gitcard.yml"), runtime.config.v2Schema);
    return { loaded, theme: resolveTheme(loadTheme(loaded.config.theme, root)) };
  }

  it("old config (optional absent) → codebase/structure only, no error, config byte-identical", () => {
    const root = tmpRoot();
    initRepository(root, {});
    const before = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8");
    const { loaded } = themeOf(root);
    const snippets = buildAllEnabledSnippets(loaded.config, runtime);
    expect(snippets.map((s) => s.match(/^!\[([^\]]+) card\]/)![1])).toEqual(["codebase", "structure"]);
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toBe(before);
  });

  it("after add, all-enabled snippets include it automatically", () => {
    const root = tmpRoot();
    initRepository(root, {});
    addCard(root, themeOf(root).loaded, themeOf(root).theme, "languages-test", { runtime });
    const { loaded } = themeOf(root);
    const snippets = buildAllEnabledSnippets(loaded.config, runtime);
    expect(snippets.map((s) => s.match(/^!\[([^\]]+) card\]/)![1])).toEqual([
      "codebase",
      "structure",
      "languages-test",
    ]);
    expect(existsSync(path.join(root, ".github/arte-git-card/languages-test.svg"))).toBe(true);
  });
});

describe("FH-5: statistics cache keyed by the DEFINITION object, not id", () => {
  function session() {
    const env = {
      projectRoot: tmpRoot(),
      now: new Date("2026-01-01T00:00:00Z"),
      outputDirRel: ".github/arte-git-card",
      activityDirs: [".github/arte-git-card"],
      registry: buildRegistryIndex(buildRegistry(undefined)),
    };
    return createStatisticsSession(env);
  }

  it("two definitions sharing an id never alias their cached/computed results", () => {
    let aRuns = 0;
    let bRuns = 0;
    const statA = defineStatistic<undefined, { a: number }>({
      id: "same",
      compute: () => {
        aRuns += 1;
        return { a: 1 };
      },
    });
    const statB = defineStatistic<undefined, { b: number }>({
      id: "same",
      compute: () => {
        bRuns += 1;
        return { b: 2 };
      },
    });
    const s = session();
    expect(s.get(statA)).toEqual({ a: 1 });
    expect(s.get(statB)).toEqual({ b: 2 });
    expect(s.get(statA)).toEqual({ a: 1 });
    expect(s.get(statB)).toEqual({ b: 2 });
    expect(aRuns).toBe(1);
    expect(bRuns).toBe(1);
  });

  it("uncanonicalizable params FAIL CLOSED (no ambiguous '[object Object]' key)", () => {
    const stat = defineStatistic<{ big: bigint }, number>({
      id: "big",
      compute: () => 7,
    });
    const s = session();
    expect(() => s.get(stat, { big: 1n })).toThrow(/canonicalized/i);
  });
});

describe("FH-2: semantic no-op reset guard", () => {
  it("resetting a MISSING optional display's setting leaves the config deeply equal", () => {
    const runtime = createArteRuntime({ displays: [codebaseDisplay, structureDisplay, languagesTestDisplay] });
    const root = tmpRoot();
    initRepository(root, {});
    const loaded = loadConfigWithSchema(path.join(root, "arte-gitcard.yml"), runtime.config.v2Schema);
    const spec = findConfigKey(runtime, "languages-test.limit")!;
    const next = cloneConfig(loaded.config);
    spec.reset(next);
    expect(isDeepStrictEqual(next, loaded.config)).toBe(true);
    expect((next.cards as unknown as Record<string, unknown>)["languages-test"]).toBeUndefined();
  });
});

describe("FH-6: createArteRuntime rejects bad Display definitions", () => {
  function display(input: {
    id: string;
    schema: z.ZodType<unknown>;
    defaults: () => unknown;
    settings?: Array<{ key: string; description?: string }>;
    required?: boolean;
  }) {
    return defineDisplay<any>({
      id: input.id,
      title: input.id,
      config: {
        schema: input.schema,
        defaults: input.defaults as () => any,
        requiredInSchemaV2: input.required ?? false,
        settings: (input.settings ?? []).map((s) => ({
          key: s.key,
          type: "boolean",
          description: s.description ?? s.key,
          read: () => false,
          apply: () => undefined,
          reset: () => undefined,
        })),
      },
      template: () => h("svg", null),
    });
  }
  const okEnabled = () => ({ enabled: false });
  const tryBuild = (def: ReturnType<typeof display>): void => {
    createArteRuntime({ displays: [codebaseDisplay, structureDisplay, def] });
  };

  it("rejects display-local defaults that fail its own strict schema", () => {
    const bad = display({
      id: "broken-defaults",
      schema: z.object({ enabled: z.boolean(), num: z.number() }).strict() as never,
      defaults: () => ({ enabled: false }),
    });
    expect(() => tryBuild(bad)).toThrow(/defaults do not satisfy/i);
  });

  it("rejects optional display defaults with enabled=true (would auto-enable on first config set)", () => {
    const bad = display({
      id: "auto-on",
      schema: z.object({ enabled: z.boolean() }).strict() as never,
      defaults: () => ({ enabled: true }),
    });
    expect(() => tryBuild(bad)).toThrow(/enabled:false/);
  });

  it("rejects a duplicate setting key inside a display", () => {
    const bad = display({
      id: "dup-setting",
      schema: z.object({ enabled: z.boolean() }).strict() as never,
      defaults: okEnabled,
      settings: [
        { key: "dup", description: "a" },
        { key: "dup", description: "b" },
      ],
    });
    expect(() => tryBuild(bad)).toThrow(/duplicate setting key/);
  });

  it("rejects an invalid setting key", () => {
    const bad = display({
      id: "bad-key",
      schema: z.object({ enabled: z.boolean() }).strict() as never,
      defaults: okEnabled,
      settings: [{ key: "Bad Key" }],
    });
    expect(() => tryBuild(bad)).toThrow(/invalid setting key/);
  });

  it("rejects a compiled key that shadows the framework output.directory", () => {
    const shadow = display({
      id: "output",
      schema: z.object({ enabled: z.boolean(), directory: z.string() }).strict() as never,
      defaults: () => ({ enabled: false, directory: "." }),
      settings: [{ key: "directory", description: "shadow" }],
    });
    expect(() => tryBuild(shadow)).toThrow(/config-key collision.*output\.directory/);
  });

});
