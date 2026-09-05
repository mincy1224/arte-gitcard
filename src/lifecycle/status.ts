/**
 * `arte-gitcard status` — user-friendly repository summary, backed by the ONE
 * repository-state detector. `status` (user) / `doctor` (diagnostics) /
 * `validate` (CI) are distinct commands.
 */

import path from "node:path";
import { VERSION } from "../version.js";
import { resolveFromProject, CONFIG_FILENAME } from "../config/paths.js";
import { loadConfigWithSchema } from "../config/load.js";
import { detectRepositoryState } from "../repo/detect.js";
import type { DetectResult } from "../repo/detect.js";
import { cardStatusList } from "../cardmgr/index.js";
import { readState, statePath } from "../state/registry.js";
import { existsSync } from "node:fs";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";

export interface StatusOptions {
  runtime?: ArteRuntime;
}

export interface StatusCard {
  id: string;
  enabled: boolean;
  owned: boolean;
}

export interface StatusReport {
  version: string;
  repository: string;
  state: string;
  configPath: string | null;
  cards: StatusCard[] | null;
  theme: string | null;
  output: string | null;
  autoUpdate: boolean | null;
  githubBranch: string | null;
  health: string;
  diagnoses: Array<{ code: string; message: string; path?: string }>;
}

export function buildStatusReport(
  projectRoot: string,
  opts: StatusOptions = {},
): { report: StatusReport; lines: string[] } {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const detect: DetectResult = detectRepositoryState(projectRoot, { runtime });
  const cfgPath = detect.configPath;

  let cards: StatusCard[] | null = null;
  let theme: string | null = null;
  let output: string | null = null;
  let autoUpdate: boolean | null = null;
  let githubBranch: string | null = null;

  if (detect.state !== "UNINITIALIZED" && detect.state !== "LEGACY" && detect.state !== "DAMAGED") {
    try {
      const loaded = loadConfigWithSchema(cfgPath!, runtime.config.v2Schema);
      theme = loaded.config.theme;
      output = loaded.config.output.directory;
      autoUpdate = loaded.config["auto-update"];
      const st = readState(projectRoot);
      githubBranch = st.status === "ok" ? (st.state.github?.defaultBranch ?? null) : null;
      cards = cardStatusList(projectRoot, loaded.config, { runtime }).map((c) => ({
        id: c.id,
        enabled: c.enabled,
        owned: c.owned,
      }));
    } catch {
      cards = null;
    }
  }

  const healthLabel =
    detect.state === "HEALTHY"
      ? "OK"
      : detect.state === "DRIFTED"
        ? "DRIFTED — run `arte-gitcard generate` (or `doctor` for details)"
        : detect.state === "DAMAGED"
          ? "DAMAGED — run `arte-gitcard doctor` (never auto-repairs)"
          : detect.state;

  const report: StatusReport = {
    version: VERSION,
    repository: projectRoot,
    state: detect.state,
    configPath: cfgPath,
    cards,
    theme,
    output,
    autoUpdate,
    githubBranch,
    health: healthLabel,
    diagnoses: detect.diagnoses,
  };

  const lines: string[] = [];
  lines.push(`arte-gitcard ${VERSION}`);
  lines.push("");
  lines.push("Repository");
  lines.push(`  ${projectRoot}`);
  lines.push("");
  lines.push("Cards");
  if (cards) {
    const w = Math.max(...cards.map((c) => c.id.length), 1);
    for (const c of cards) lines.push(`  ${c.id.padEnd(w)}  ${c.enabled ? "enabled" : "disabled"}`);
  } else {
    lines.push("  (config unavailable)");
  }
  lines.push("");
  lines.push("Theme");
  lines.push(`  ${theme ?? "(config unavailable)"}`);
  lines.push("");
  lines.push("Output");
  lines.push(`  ${output ?? "(config unavailable)"}`);
  lines.push("");
  lines.push("GitHub auto-update");
  lines.push(`  ${autoUpdate === true ? `enabled (default branch: ${githubBranch ?? "?"})` : autoUpdate === false ? "disabled" : "(config unavailable)"}`);
  lines.push("");
  lines.push("Health");
  lines.push(`  ${healthLabel}`);
  if (detect.diagnoses.length > 0) {
    for (const d of detect.diagnoses) {
      lines.push(`    - [${d.code}] ${d.message}`);
    }
  }

  return { report, lines };
}

export function configPathFor(projectRoot: string): string {
  return path.join(projectRoot, CONFIG_FILENAME);
}

export function outputAbs(projectRoot: string, directory: string): string {
  return resolveFromProject(projectRoot, directory);
}

export function hasState(projectRoot: string): boolean {
  return existsSync(statePath(projectRoot));
}
