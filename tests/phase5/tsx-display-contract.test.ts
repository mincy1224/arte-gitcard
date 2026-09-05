/**
 * Phase 5 contract: a REAL `.tsx` Display template compiles and runs end-to-end
 * through the production toolchain — TSX (authoring syntax only, NO React) →
 * internal `h` factory → safe serializer → artifact → lifecycle. The template
 * reuses `codebaseStatistics` (statistics reuse unchanged), rendering is
 * deterministic, and text/attributes are escaped centrally.
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createArteRuntime } from "../../src/runtime.js";
import { codebaseDisplay } from "../../src/display/builtin/codebase/definition.js";
import { structureDisplay } from "../../src/display/builtin/structure/definition.js";
import { languagesCompactDisplay } from "./compact-display/definition.js";
import { initRepository } from "../../src/lifecycle/init.js";
import { addCard, removeCard } from "../../src/cardmgr/index.js";
import { loadConfigWithSchema } from "../../src/config/load.js";
import { cloneConfig, findConfigKey } from "../../src/config/registry.js";
import { writeConfigTxn } from "../../src/config/commit.js";
import { generateEnabledCards } from "../../src/generate/manage.js";
import { planCardArtifactsInternal } from "../../src/generate/plan.js";
import { buildStatusReport } from "../../src/lifecycle/status.js";
import { readState, findEntry } from "../../src/state/registry.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";

const runtime = createArteRuntime({
  displays: [codebaseDisplay, structureDisplay, languagesCompactDisplay],
});
const CONFIG = "arte-gitcard.yml";
const OUTPUT_REL = ".github/arte-git-card";
const CARD_SVG = `${OUTPUT_REL}/languages-compact.svg`;
const DANGEROUS = '<script>alert(1)</script> & <b>x</b>';

const dirs: string[] = [];
function tmpRoot(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agc-p5-"));
  dirs.push(dir);
  return dir;
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

function themeOf(root: string): { loaded: ReturnType<typeof loadConfigWithSchema>; theme: ReturnType<typeof resolveTheme> } {
  const loaded = loadConfigWithSchema(path.join(root, CONFIG), runtime.config.v2Schema);
  const theme = resolveTheme(loadTheme(loaded.config.theme, root));
  return { loaded, theme };
}

describe("Phase 5: safe TSX Display contract", () => {
  it("compiles via the internal factory, reuses statistics once, escapes text, and flows through lifecycle", () => {
    const root = tmpRoot();
    initRepository(root, {});

    // add the TSX display (materializes + enables + generates its safe SVG).
    const { loaded, theme } = themeOf(root);
    const addRes = addCard(root, loaded, theme, "languages-compact", { runtime });
    expect(addRes.effects.some((e) => e.type === "write" && e.rel === CARD_SVG)).toBe(true);
    expect(existsSync(path.join(root, CARD_SVG))).toBe(true);

    // set a hostile heading through the typed setting (config set materializes
    // on an existing block, keeping enabled=true).
    const spec = findConfigKey(runtime, "languages-compact.label")!;
    const cfgBefore = themeOf(root).loaded;
    const next = cloneConfig(cfgBefore.config);
    spec.apply(next, DANGEROUS, { projectRoot: root });
    writeConfigTxn(root, cfgBefore, next, { command: "phase5-label", runtime });
    expect((next.cards as unknown as Record<string, unknown>)["languages-compact"]).toEqual({
      enabled: true,
      label: DANGEROUS,
    });

    // regenerate with the hostile label.
    const { loaded: loaded2, theme: theme2 } = themeOf(root);
    const now = new Date("2026-01-01T00:00:00Z");
    const first = planCardArtifactsInternal(loaded2, theme2, { now, runtime });
    const compact = first.artifacts.find((a) => a.file === "languages-compact.svg")!;
    expect(compact).toBeTruthy();
    // deterministic across generations (same inputs → same bytes).
    const again = planCardArtifactsInternal(themeOf(root).loaded, theme2, { now, runtime });
    expect(again.artifacts.find((a) => a.file === "languages-compact.svg")!.content).toBe(compact.content);
    // central escaping: markup never reaches the artifact; text is escaped.
    expect(compact.content).not.toContain("<script>");
    expect(compact.content).toContain("&lt;script&gt;");
    expect(compact.content).not.toContain("<b>x</b>");
    // serializer element allowlist + deterministic attribute order still hold.
    expect(compact.content).toMatch(/^<svg[^>]*>/);
    expect(compact.content).toContain("analyzed=");

    // full lifecycle: generate persists it, state owns it, repo is HEALTHY,
    // then remove cleans the owned unchanged artifact.
    generateEnabledCards(root, loaded2, theme2, { runtime });
    const read = readState(root);
    const state = read.status === "ok" ? read.state : null;
    expect(findEntry(state!, CARD_SVG)?.kind).toBe("card");
    expect(buildStatusReport(root, { runtime }).report.state).toBe("HEALTHY");

    const rmRes = removeCard(root, themeOf(root).loaded, themeOf(root).theme, "languages-compact", { runtime });
    expect(rmRes.warnings).toHaveLength(0);
    expect(existsSync(path.join(root, CARD_SVG))).toBe(false);
    expect(buildStatusReport(root, { runtime }).report.state).toBe("HEALTHY");
  });
});
