/**
 * Transactional v1 → v2 migration (P0) — ONE transaction. Validates the legacy
 * config first (invalid v1 → refused); REFUSES any pre-existing v2 state.json
 * (v1 has NO ownership registry, so no state can prove a legacy file is owned);
 * preflights enabled-card destinations BEFORE any write (an existing entry is
 * never claimed/overwritten → ZERO changes); and regenerates enabled cards +
 * materialized theme + fresh state.json from initialState() in that ONE
 * transaction, leaving a HEALTHY repo. The legacy arte-git-card.yml is ALWAYS
 * preserved.
 *
 * Theme rule (shared): an absent builtin theme is materialized (provenance entry
 * in the SAME transaction); an existing theme is never overwritten, strictly
 * loaded/validated; a custom theme path must exist on disk; invalid/missing
 * fails closed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { migrateV1Config } from "../config/migrate.js";
import { DEFAULT_THEME } from "../theme/default-theme.js";
import { GITHUB_THEME } from "../theme/github-theme.js";
import type { ThemeSchema } from "../theme/schema.js";
import { runTransaction } from "../txn/engine.js";
import type { Effect } from "../txn/engine.js";
import { buildManagedGuard } from "../state/guards.js";
import { initialState, readState, serializeState, upsertEntry } from "../state/registry.js";
import type { ArteGitCardConfig } from "../config/types.js";
import { sha256WrittenContent } from "../fs/atomic.js";
import { sha256Content } from "../fs/hash.js";
import { pathOccupied } from "../fs/presence.js";
import { STATE_REL } from "../managed/paths.js";
import { emptyPlan } from "../txn/plan.js";
import type { TxnPlan } from "../txn/plan.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import { planCardArtifactsInternal } from "../generate/plan.js";
import { planSelectedTheme } from "./themeplan.js";

export interface MigrateResult {
  effects: Effect[];
  materializedThemes: string[];
}

/**
 * Build the migrate plan WITHOUT applying it (test seam). Pins BOTH the legacy
 * SOURCE bytes that were parsed and the DESTINATION absences: if the legacy
 * config changes (or a v2 config / state appears) after planning, the
 * transaction fails with ZERO mutation rather than applying a stale plan.
 */
export function buildMigrateRepositoryPlan(
  projectRoot: string,
): { plan: TxnPlan; materializedThemes: string[]; config: ArteGitCardConfig } {
  const legacyPath = path.join(projectRoot, LEGACY_CONFIG_FILENAME);
  let buf: Buffer;
  try {
    buf = readFileSync(legacyPath);
  } catch {
    throw new Error(`No legacy config found at ${legacyPath}. Nothing to migrate.`);
  }
  const raw = buf.toString("utf8");
  // Hash the EXACT bytes parsed (parse the decoded text, hash the buffer) so the
  // source precondition matches the legacy file this plan was derived from.
  const legacySha = sha256Content(buf);

  const plan = migrateV1Config(raw, legacyPath);
  // v1 historically accepted max_depth up to 20; v2 structure cards cap render
  // depth at 5. A legacy value above 5 is refused with explicit remediation
  // (never silently clamped, never written then re-parsed as DAMAGED).
  const legacyDepth = plan.config.cards.structure.max_depth;
  if (legacyDepth > 5) {
    throw new Error(
      `arte-gitcard v2 renders structure cards at most 5 levels deep, but the legacy config has ` +
        `structure.max_depth = ${legacyDepth}. Set structure.max_depth to a value in 1..5 in ` +
        `${LEGACY_CONFIG_FILENAME} and run migrate again (nothing was written).`,
    );
  }
  const configAbs = path.join(projectRoot, CONFIG_FILENAME);
  const nextLoaded = { config: plan.config, projectRoot, configPath: configAbs };

  // RB-1: NEVER trust or use any pre-existing state.json. v1 has no ownership
  // registry, so no state can prove a legacy SVG is owned — and explicit
  // regeneration must not let a stale/forged entry allow overwriting it.
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "missing") {
    throw new Error(
      "A pre-existing arte-gitcard state.json was found in a legacy repository. v1 has no ownership registry, " +
        "so migration refuses to trust or overwrite it. Inspect/back up/remove the stale state, then retry.",
    );
  }

  // Theme rule. Builtin preset sources are known; a custom theme must exist on disk.
  let themeSource: ThemeSchema | null = null;
  if (plan.materializeThemes.length > 0) {
    const name = plan.materializeThemes[0]!;
    themeSource = name === "github-theme" ? GITHUB_THEME : DEFAULT_THEME;
  }
  // Throws (fail closed) if the selected theme file exists but is invalid, or is
  // absent without a materializable preset.
  const themePlan = planSelectedTheme(projectRoot, plan.config.theme, themeSource);

  // Plan the migrated enabled cards in memory (a fresh repo: no state to read).
  const planned = planCardArtifactsInternal(nextLoaded, themePlan.resolved, { runtime: DEFAULT_RUNTIME });
  const outputDirRel = path.relative(projectRoot, resolveFromProject(projectRoot, plan.config.output.directory)).replace(/\\/g, "/");

  const txn = emptyPlan();
  const state = initialState();

  // Preflight every enabled-card destination: ANY existing entry (regular file,
  // broken symlink, dir) is an unowned legacy target → refuse with ZERO changes.
  for (const artifact of planned.artifacts) {
    const rel = `${outputDirRel}/${artifact.file}`;
    const abs = resolveFromProject(projectRoot, rel);
    if (pathOccupied(abs)) {
      throw new Error(
        "migration refused — nothing was written.\n\n" +
          `A file already exists at a path the migrated configuration would generate: ${rel}\n` +
          `arte-gitcard never claims or overwrites legacy v1 files (v1 has no ownership registry).\n` +
          `Back up or move the old v1 SVG(s) out of the way, then retry \`arte-gitcard migrate\`.\n` +
          `The legacy arte-git-card.yml was preserved (not modified).`,
      );
    }
    txn.writes.push({ rel, abs, content: artifact.content, kind: "card", expectedBefore: { kind: "absent" } });
    upsertEntry(state, { path: rel, kind: "card", sha256: sha256WrittenContent(artifact.content) });
  }
  if (!state.outputRoots.includes(outputDirRel)) {
    state.outputRoots = [...state.outputRoots, outputDirRel];
  }

  // v2 config write (v2 config was observed ABSENT).
  txn.writes.push({
    rel: CONFIG_FILENAME,
    abs: configAbs,
    content: YAML.stringify(plan.config),
    kind: "config",
    expectedBefore: { kind: "absent" },
  });

  const materializedThemes: string[] = [];
  if (themePlan.writeRel !== null && themePlan.writeBytes !== null) {
    txn.writes.push({
      rel: themePlan.writeRel,
      abs: resolveFromProject(projectRoot, themePlan.writeRel),
      content: themePlan.writeBytes,
      kind: "theme",
      expectedBefore: { kind: "absent" },
    });
    upsertEntry(state, {
      path: themePlan.writeRel,
      kind: "theme",
      sha256: sha256WrittenContent(themePlan.writeBytes),
    });
    materializedThemes.push(themePlan.writeRel);
  }

  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  txn.preconditions = [
    // The legacy source must still be the exact bytes that were migrated.
    { kind: "sha256", rel: LEGACY_CONFIG_FILENAME, expectedSha256: legacySha },
    // Destinations were observed absent and must stay absent until the lock.
    { kind: "absent", rel: CONFIG_FILENAME },
    { kind: "absent", rel: STATE_REL },
  ];

  return { plan: txn, materializedThemes, config: plan.config };
}

export function migrateRepository(projectRoot: string, opts: { dryRun?: boolean } = {}): MigrateResult {
  const { plan, materializedThemes, config } = buildMigrateRepositoryPlan(projectRoot);
  const result = runTransaction(plan, {
    repoRoot: projectRoot,
    command: "migrate",
    dryRun: opts.dryRun === true,
    guard: buildManagedGuard(projectRoot, config),
  });

  return { effects: result.effects, materializedThemes };
}
