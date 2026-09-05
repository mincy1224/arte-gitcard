/**
 * Memory-only card planner. Builds ONE StatisticsSession per generation, then
 * asks every ENABLED Display (from the compiled runtime) to render itself. The
 * statistics contract is TRULY lazy (FC-1): NO statistic is requested outside
 * the Displays — a generation whose Displays need neither repositoryScan nor
 * codebase runs neither. Only the PUBLIC `planCardArtifacts` wrapper requests the
 * legacy summary statistics, and only because its historical result shape
 * (`analyzedSourceFiles`, `git`) requires them.
 *
 * Never writes; displays are pure; statistics cache the single scan/analyze.
 * Shared spine for the CLI `generate`, the state-recording transaction and the
 * vendored CI runtime — output stays byte-identical everywhere.
 */

import path from "node:path";
import type { LoadedConfig } from "../config/types.js";
import { resolveFromProject } from "../config/paths.js";
import { buildRegistry, buildRegistryIndex } from "../languages/registry.js";
import { readState } from "../state/registry.js";
import { createStatisticsSession } from "../statistics/session.js";
import type { StatisticsSession } from "../statistics/session.js";
import {
  codebaseStatistics,
  repositoryScanStatistic,
} from "../statistics/index.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import { displayArtifactContent } from "../display/definition.js";
import type { ResolvedTheme } from "../theme/resolve.js";
import { readStructureDescriptions } from "../structure/descriptions.js";

export interface PlannedCardArtifact {
  file: string;
  content: string;
}

/** What the internal (lazy) planner needs to produce: just the artifacts. */
export interface PlanCardArtifactsCore {
  artifacts: PlannedCardArtifact[];
}

/** The historical PUBLIC result shape (kept for compatibility). */
export interface PlanCardArtifactsResult extends PlanCardArtifactsCore {
  analyzedSourceFiles: number;
  git: boolean;
}

/** Options for the INTERNAL runtime-aware planner (framework/test only). */
export interface PlanCardArtifactsInternalOptions {
  /** Deterministic clock (goldens/CI); defaults to the current date. */
  now?: Date;
  /** The compiled runtime whose displays drive this generation (required). */
  runtime: ArteRuntime;
  /**
   * Optional hook run AFTER all Displays rendered (same session). Used ONLY by
   * the public wrapper to fetch its legacy summary fields; lifecycle generation
   * never passes it, so no statistic is requested outside Displays.
   */
  afterRender?: (session: StatisticsSession) => void;
  /**
   * Repo-relative Structure description map (one coherent snapshot). When a
   * caller (planGenerateTxn) supplies it, the planner MUST use it and MUST NOT
   * reload the store — guaranteeing the rendered card and the mutation/
   * precondition come from the SAME snapshot. When omitted (render-only paths:
   * init/reset/migrate/output relocation/public planCardArtifacts) the planner
   * loads its own validated snapshot from the store.
   */
  structureDescriptions?: Record<string, string>;
}

/** POSIX relative path helper. */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * INTERNAL planner. Runtime-aware so framework code and tests may drive a custom
 * (test) registry. NOT part of the public package surface — the compiled runtime
 * is never derived from config/state/fs, and external callers must not inject a
 * Display registry / runtime / path authority.
 *
 * Lazy by construction: nothing is computed until a Display requests it. Each
 * Display receives its OWN Date instance for the same generation instant (never
 * a shared mutable clock).
 */
export function planCardArtifactsInternal(
  loaded: LoadedConfig,
  theme: ResolvedTheme,
  opts: PlanCardArtifactsInternalOptions,
): PlanCardArtifactsCore {
  const runtime = opts.runtime;
  const instant = (opts.now ?? new Date()).getTime();
  const { config, projectRoot } = loaded;
  const outputDir = resolveFromProject(projectRoot, config.output.directory);
  const outputDirRel = toPosix(path.relative(projectRoot, outputDir));

  // Activity excludes the CURRENT output dir plus every recorded HISTORICAL
  // output root (state.outputRoots) — metadata only, never mutation authority.
  const stateRead = readState(projectRoot);
  const activityDirs = stateRead.status === "ok"
    ? [...new Set([outputDirRel, ...stateRead.state.outputRoots])].filter((d) => d !== "")
    : [outputDirRel];

  const registry = buildRegistryIndex(buildRegistry(config.languages));
  const session = createStatisticsSession({
    projectRoot,
    now: new Date(instant),
    outputDirRel,
    exclude: config.exclude,
    activityDirs,
    registry,
  });

  // One coherent Structure-description map for this generation plan. A supplied
  // snapshot is authoritative and never reloaded; otherwise load a validated one
  // (absent store ⇒ empty; malformed store ⇒ fail closed, never silently dropped).
  const structureMap: Record<string, string> =
    opts.structureDescriptions ??
    (() => {
      const r = readStructureDescriptions(projectRoot);
      return r.status === "ok" ? r.map : {};
    })();

  const artifacts: PlannedCardArtifact[] = [];
  for (const entry of runtime.enabledDisplays(config)) {
    // Safe `svg` Displays are serialized through renderSvg (escaping/allowlist/
    // policy enforced centrally); the frozen legacy built-ins pass through their
    // byte-locked string. Each Display gets a FRESH Date for the same instant.
    // Structure receives the injected descriptions + offline repo display name +
    // the codebase comment policy (never persisted keys).
    const displayConfig =
      entry.definition.id === "structure"
        ? ({
            ...(entry.config as object),
            descriptions: structureMap,
            repositoryName: path.basename(projectRoot),
            codeIncludeComments: config.cards.codebase.languages.include_comments === true,
          } as never)
        : (entry.config as never);
    const content = displayArtifactContent(entry.definition, {
      statistics: session,
      config: displayConfig,
      theme,
      now: new Date(instant),
    } as never);
    artifacts.push({ file: entry.file, content });
  }

  if (opts.afterRender) opts.afterRender(session);
  return { artifacts };
}

/**
 * PUBLIC pure planner. Always uses the production DEFAULT_RUNTIME — the compiled
 * static registry — so a caller can never inject a custom Display/runtime.
 * `now` remains the historical optional positional argument (deterministic
 * clock for goldens/CI). Never writes.
 *
 * The returned `analyzedSourceFiles`/`git` legacy summary fields are computed by
 * explicitly requesting those statistics AFTER rendering (cached if any Display
 * already requested them), only because the historical public shape requires
 * them.
 */
export function planCardArtifacts(
  loaded: LoadedConfig,
  theme: ResolvedTheme,
  now?: Date,
): PlanCardArtifactsResult {
  let analyzedSourceFiles = 0;
  let git = false;
  const core = planCardArtifactsInternal(loaded, theme, {
    now: now ?? new Date(),
    runtime: DEFAULT_RUNTIME,
    afterRender: (session) => {
      analyzedSourceFiles = session.get(codebaseStatistics).analyzedSourceFiles;
      git = session.get(repositoryScanStatistic).git;
    },
  });
  return { artifacts: core.artifacts, analyzedSourceFiles, git };
}
