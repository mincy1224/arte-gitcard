/**
 * `arte-gitcard doctor` — comprehensive, READ-ONLY health diagnostics. Never
 * repairs. A blocked/interrupted transaction (orphan txn.json), a drifted or
 * unsafe managed file, or an unreadable config is surfaced with an actionable
 * message — never reduced to a vague "DRIFTED".
 */

import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { VERSION } from "../version.js";
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME } from "../config/paths.js";
import { loadConfigWithSchema, ConfigError } from "../config/load.js";
import { validateSemanticConfig, assertOutputDirInside } from "../config/root.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import { detectRepositoryState } from "../repo/detect.js";
import { gitTopLevel } from "../repo/resolve.js";
import { cachedOriginHeadBranch } from "../github/default-branch.js";
import { readStructureDescriptions } from "../structure/descriptions.js";
import { integrationIgnoredRels } from "../github/tracked.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import {
  assertDeletable,
  findEntry,
  readState,
  statePath,
} from "../state/registry.js";
import {
  CI_ACTION_REL,
  CI_RUNTIME_REL,
  JOURNAL_REL,
  THEMES_DIR_REL,
  WORKFLOW_REL,
} from "../managed/paths.js";

export interface DoctorManaged {
  path: string;
  kind: string;
  status: "ok" | "missing" | "modified" | "unsafe";
  userEditable: boolean;
}

export interface DoctorReport {
  version: string;
  repository: string;
  gitRoot: string | null;
  gitBranch: string | null;
  state: string;
  config: { path: string | null; schemaVersion: number | null; status: string; error?: string };
  theme: { selected: string | null; ok: boolean; error?: string };
  installedThemes: string[];
  output: { directory: string | null; contained: boolean; error?: string };
  stateFile: { status: string; entries: number; toolDrift: boolean; outputRoots: string[] };
  managed: DoctorManaged[];
  github: {
    autoUpdate: boolean | null;
    workflowPresent: boolean;
    workflowOwned: boolean;
    ciPresent: boolean;
    branch: string | null;
  };
  blockedRecovery: boolean;
  diagnoses: Array<{ code: string; message: string; path?: string }>;
}

export interface DoctorOptions {
  runtime?: ArteRuntime;
}

export function buildDoctorReport(
  projectRoot: string,
  opts: DoctorOptions = {},
): { report: DoctorReport; lines: string[] } {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const detect = detectRepositoryState(projectRoot, { runtime });
  const gitRoot = gitTopLevel(projectRoot);
  const gitBranch = currentBranch(projectRoot);

  // config
  const cfgPath = path.join(projectRoot, CONFIG_FILENAME);
  const legacyPath = path.join(projectRoot, LEGACY_CONFIG_FILENAME);
  let configInfo: DoctorReport["config"] = { path: cfgPath, schemaVersion: null, status: "missing", error: undefined };
  let selectedTheme: string | null = null;
  let themeOk = false;
  let themeError: string | undefined;
  let outputDir: string | null = null;
  let outputContained = false;
  let outputError: string | undefined;

  try {
    const loaded = loadConfigWithSchema(cfgPath, runtime.config.v2Schema);
    configInfo = { path: cfgPath, schemaVersion: loaded.config["schema-version"], status: "ok", error: undefined };
    selectedTheme = loaded.config.theme;
    outputDir = loaded.config.output.directory;
    try {
      const theme = loadTheme(selectedTheme, projectRoot);
      resolveTheme(theme);
      themeOk = true;
    } catch (err) {
      themeError = (err as Error).message;
    }
    try {
      assertOutputDirInside(projectRoot, outputDir!);
      outputContained = true;
    } catch (err) {
      outputError = (err as Error).message;
    }
  } catch (err) {
    if (err instanceof ConfigError) {
      configInfo.status = err.reason;
      configInfo.error = err.message;
      if (configInfo.status === "v1") configInfo.path = existsSync(legacyPath) ? legacyPath : null;
    } else {
      configInfo.status = "error";
      configInfo.error = (err as Error).message;
    }
  }

  // state
  const stateRead = readState(projectRoot);
  const stateStatus = stateRead.status;
  let stateEntries = 0;
  let toolDrift = false;
  let outputRoots: string[] = [];
  if (stateRead.status === "ok") {
    stateEntries = stateRead.state.managedFiles.length;
    outputRoots = stateRead.state.outputRoots;
    toolDrift = stateRead.state.toolVersion !== VERSION;
  }

  // managed entries
  const managed: DoctorManaged[] = [];
  const generatedKinds = new Set<string>(["card", "preview", "workflow", "ci-action", "ci-runtime"]);
  if (stateRead.status === "ok") {
    for (const entry of stateRead.state.managedFiles) {
      const st = assertDeletable(projectRoot, entry);
      managed.push({
        path: entry.path,
        kind: entry.kind,
        status: st,
        userEditable: !generatedKinds.has(entry.kind),
      });
    }
  }

  // github — the default branch is an INSTALLATION snapshot in state.json, never config.
  let autoUpdate: boolean | null = null;
  let branch: string | null = null;
  try {
    const loaded = loadConfigWithSchema(cfgPath, runtime.config.v2Schema);
    autoUpdate = loaded.config["auto-update"];
  } catch {
    /* handled above */
  }
  if (stateRead.status === "ok") {
    branch = stateRead.state.github?.defaultBranch ?? null;
  }
  const wfPresent = existsSync(path.join(projectRoot, WORKFLOW_REL));
  const wfOwned = stateRead.status === "ok" && findEntry(stateRead.state, WORKFLOW_REL) !== undefined;
  const ciPresent =
    existsSync(path.join(projectRoot, CI_ACTION_REL)) || existsSync(path.join(projectRoot, CI_RUNTIME_REL));
  // Offline CACHED diagnostic only — never used to drive enable/sync.
  const cachedDefault = autoUpdate === true && branch ? cachedOriginHeadBranch(projectRoot) : null;
  // Required GitHub integration files that are untracked AND ignored (read-only diagnostic).
  const ignoredIntegration = autoUpdate === true ? integrationIgnoredRels(projectRoot) : [];

  // blocked recovery? ANY orphan txn.json blocks (corrupt/mismatched ones too —
  // they are untrusted evidence and arte-gitcard never auto-overwrites them).
  const blockedRecovery = existsSync(path.join(projectRoot, JOURNAL_REL));

  // installed themes
  const themesDir = path.join(projectRoot, THEMES_DIR_REL);
  let installedThemes: string[] = [];
  try {
    installedThemes = readdirSync(themesDir)
      .filter((f) => f.endsWith(".yml"))
      .sort();
  } catch {
    installedThemes = [];
  }

  // structure description store health (preserved user metadata — never repaired)
  let storeLine = "absent";
  try {
    const store = readStructureDescriptions(projectRoot);
    if (store.status === "ok") storeLine = `present, valid, ${Object.keys(store.map).length} entries`;
  } catch (err) {
    storeLine = `INVALID: ${(err as Error).message}`;
  }

  const report: DoctorReport = {
    version: VERSION,
    repository: projectRoot,
    gitRoot,
    gitBranch,
    state: detect.state,
    config: configInfo as DoctorReport["config"],
    theme: { selected: selectedTheme, ok: themeOk, error: themeError },
    installedThemes,
    output: { directory: outputDir, contained: outputContained, error: outputError },
    stateFile: { status: stateStatus, entries: stateEntries, toolDrift, outputRoots },
    managed,
    github: { autoUpdate, workflowPresent: wfPresent, workflowOwned: wfOwned, ciPresent, branch },
    blockedRecovery,
    diagnoses: detect.diagnoses,
  };

  const lines: string[] = [];
  const push = (k: string, v: string, indent = 2): void => {
    lines.push(`${" ".repeat(indent)}${k}: ${v}`);
  };
  lines.push(`arte-gitcard ${VERSION} — doctor`);
  lines.push("");
  push("repository state", detect.state);
  lines.push("");
  lines.push("Repository");
  push("root", projectRoot);
  push("git root", gitRoot ?? "not a git repo");
  push("git branch", gitBranch ?? "n/a");
  lines.push("");
  lines.push("Config");
  push("file", configInfo.path ?? "(none)");
  push("schema-version", configInfo.schemaVersion === null ? "(unavailable)" : String(configInfo.schemaVersion));
  push("load", configInfo.status);
  if (configInfo.error) push("problem", configInfo.error);
  lines.push("");
  lines.push("Theme");
  push("selected", selectedTheme ?? "(none)");
  push("resolvable", themeOk ? "yes" : `no${themeError ? ` — ${themeError}` : ""}`);
  push("installed", installedThemes.length ? installedThemes.join(", ") : "(none)");
  lines.push("");
  lines.push("Output");
  push("directory", outputDir ?? "(unavailable)");
  push("contained", outputContained ? "yes" : `no${outputError ? ` — ${outputError}` : ""}`);
  lines.push("");
  lines.push("state.json");
  push("status", stateStatus);
  push("managed entries", String(stateEntries));
  push("tool version", toolDrift ? `DRIFTED (recorded != ${VERSION})` : "matches");
  push("output roots", outputRoots.length ? outputRoots.join(", ") : "(none)");
  lines.push("");
  lines.push("Structure descriptions");
  push("store", storeLine);
  lines.push("");
  if (managed.length) {
    lines.push("Managed files");
    for (const m of managed) {
      const tag = m.userEditable ? "user-editable" : "generated";
      lines.push(`  - ${m.path}  [${m.kind}/${tag}] ${m.status}`);
    }
    lines.push("");
  }
  lines.push("GitHub");
  push("auto-update", autoUpdate === null ? "(unavailable)" : autoUpdate ? "enabled" : "disabled");
  push("default branch (snapshot)", branch ?? "n/a");
  push("origin/HEAD (cached)", cachedDefault ?? "n/a");
  push("workflow", wfPresent ? (wfOwned ? "present (owned)" : "present (NOT owned)") : "absent");
  push("ci action/runtime", ciPresent ? "present" : "absent");
  if (autoUpdate === true && branch && cachedDefault && cachedDefault !== branch) {
    // Git's local origin/HEAD is offline cache only — never the authority sync
    // follows, so no arte-gitcard remediation can repair it.
    lines.push(`    * cached origin/HEAD differs from snapshot (cache may be stale; not authoritative)`);
  }
  if (ignoredIntegration.length > 0) {
    lines.push(`    ** git-ignored integration file(s) would never reach GitHub — add a .gitignore exception:`);
    for (const rel of ignoredIntegration) lines.push(`       - ${rel}`);
  }
  lines.push("");
  lines.push("Interrupted transaction");
  push("blocked recovery", blockedRecovery ? "YES — an orphaned txn.json exists; run the blocked command again or remove it after review" : "no");
  lines.push("");
  lines.push("Diagnostics");
  if (detect.diagnoses.length === 0) lines.push("  none — repository is consistent");
  for (const d of detect.diagnoses) lines.push(`  - [${d.code}] ${d.message}`);

  return { report, lines };
}

function currentBranch(projectRoot: string): string | null {
  try {
    const out = execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}
