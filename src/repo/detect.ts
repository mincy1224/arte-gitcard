/**
 * Repository state detector (P0). EVERY command branches on this one detector.
 * States: UNINITIALIZED (no config + no state/journal), LEGACY (v1 config),
 * HEALTHY, DRIFTED (owned generated file missing/modified or github mismatch),
 * DAMAGED (invalid config/theme/state), COLLISION (a needed path is occupied by
 * a NON-owned entity).
 *
 * Theme entries are USER-EDITABLE inputs: editing them never makes the repo
 * DAMAGED/DRIFTED. Only generated kinds (card/preview/workflow/ci-action/
 * ci-runtime) participate in hash-drift.
 */

import { existsSync, lstatSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import YAML from "yaml";
import { pathOccupied } from "../fs/presence.js";
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME, resolveFromProject } from "../config/paths.js";
import { loadConfigWithSchema, ConfigError } from "../config/load.js";
import { validateSemanticConfig } from "../config/root.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import { readState, assertDeletable, findEntry } from "../state/registry.js";
import type { StateRead } from "../state/registry.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import type { ArteRuntime } from "../runtime.js";
import {
  CI_ACTION_REL,
  CI_RUNTIME_REL,
  JOURNAL_REL,
  WORKFLOW_REL,
} from "../managed/paths.js";
import { inspectJournal, readJournal } from "../txn/journal.js";
import { isUninstallTailJournal } from "../lifecycle/uninstall-journal.js";
import { githubActionsBranchLiteral } from "../github/branch.js";
import { integrationIgnoredRels } from "../github/tracked.js";

export type RepoState =
  | "UNINITIALIZED"
  | "HEALTHY"
  | "LEGACY"
  | "DAMAGED"
  | "DRIFTED"
  | "COLLISION";

export interface Diagnosis {
  code: string;
  message: string;
  path?: string;
}

export interface DetectResult {
  state: RepoState;
  configPath: string | null;
  configVersion: number | null;
  stateStatus: StateRead["status"] | "unused";
  diagnoses: Diagnosis[];
}

export interface DetectOptions {
  /** override config path (already resolved to the project root) */
  configPath?: string;
  /** when true, count `preview.html` and any auto-update workflow/ci as expected paths */
  checkExpectedPaths?: boolean;
  /** compiled runtime driving expected-artifact / config validation (default: production). */
  runtime?: ArteRuntime;
}

export function detectRepositoryState(projectRoot: string, opts: DetectOptions = {}): DetectResult {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const diagnoses: Diagnosis[] = [];
  const stateStatus: StateRead["status"] | "unused" = "unused";

  const v2Path = path.join(projectRoot, CONFIG_FILENAME);
  const legacyPath = path.join(projectRoot, LEGACY_CONFIG_FILENAME);
  const hasV2 = existsSync(v2Path);
  const hasLegacy = existsSync(legacyPath);

  if (!hasV2 && !hasLegacy) {
    // UNINITIALIZED is ONLY a truly unmanaged repo: leftover state.json / orphan
    // journal means we touched this repo before, so `init` must refuse it (U-2).

    // P0: never read/classify through a SYMLINKED .arte-git-card — report DAMAGED
    // and do NOT follow it to read state.json/txn.json.
    let toolUnsafe = false;
    try {
      const st = lstatSync(path.join(projectRoot, ".arte-git-card"));
      if (st.isSymbolicLink() || !st.isDirectory()) toolUnsafe = true;
    } catch (err) {
      // Only a true ENOENT means absent; any other fs error makes the tool dir
      // unverifiable → treat as unsafe, never read through it.
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") toolUnsafe = true;
    }
    if (toolUnsafe) {
      return {
        state: "DAMAGED",
        configPath: null,
        configVersion: null,
        stateStatus: "unused",
        diagnoses: [
          {
            code: "tool-dir-unsafe",
            message:
              ".arte-git-card is a symlink/unsafe entry — arte-gitcard will NOT follow it or read state/journal " +
              "through it. Run `arte-gitcard doctor` to inspect.",
          },
        ],
      };
    }

    const orphanState = readState(projectRoot);
    const orphanPresent = orphanState.status !== "missing";
    const orphanJournalPath = path.join(projectRoot, JOURNAL_REL);
    const journalInspect = inspectJournal(orphanJournalPath, projectRoot);
    if (!orphanPresent && !journalInspect.present) {
      return {
        state: "UNINITIALIZED",
        configPath: null,
        configVersion: null,
        stateStatus: "unused",
        diagnoses,
      };
    }

    const orphanDiagnoses: Diagnosis[] = [];
    if (journalInspect.present) {
      if (journalInspect.state === "clean") {
        const journal = readJournal(orphanJournalPath);
        if (journal && isUninstallTailJournal(journal)) {
          orphanDiagnoses.push({
            code: "uninstall-interrupted",
            message:
              "An interrupted uninstall was found (the config is already removed but txn.json remains). " +
              "Re-run `arte-gitcard uninstall --yes` to complete it safely.",
          });
        } else {
          orphanDiagnoses.push({
            code: "orphan-journal",
            message: `An orphaned transaction journal exists at ${orphanJournalPath} without a config — run \`arte-gitcard doctor\` (it is never auto-overwritten).`,
          });
        }
      } else {
        orphanDiagnoses.push({
          code: "orphan-journal",
          message: `A ${journalInspect.state} transaction journal exists at ${orphanJournalPath} without a config — run \`arte-gitcard doctor\` (it is never auto-overwritten).`,
        });
      }
    }
    if (orphanPresent) {
      orphanDiagnoses.push({
        code: "orphan-state",
        message:
          "A .arte-git-card/state.json exists without a config (orphaned installation metadata) — there is no " +
          "config to provide output-directory authority, so uninstall cannot act on it. " +
          "Run `arte-gitcard doctor`, or `arte-gitcard reset --yes` to reinitialize clean tool state.",
      });
    }

    return {
      state: "DAMAGED",
      configPath: null,
      configVersion: null,
      stateStatus: orphanPresent ? orphanState.status : "unused",
      diagnoses: [...diagnoses, ...orphanDiagnoses],
    };
  }
  if (!hasV2 && hasLegacy) {
    diagnoses.push({ code: "legacy-config", message: "Found legacy arte-git-card.yml. Run `arte-gitcard migrate`." });
    return {
      state: "LEGACY",
      configPath: legacyPath,
      configVersion: 1,
      stateStatus,
      diagnoses,
    };
  }

  let loaded;
  try {
    loaded = loadConfigWithSchema(v2Path, runtime.config.v2Schema);
  } catch (err) {
    const e = err as ConfigError;
    return {
      state: "DAMAGED",
      configPath: v2Path,
      configVersion: null,
      stateStatus,
      diagnoses: [{ code: e.reason === "v1" ? "legacy-config-at-v2-path" : "config-invalid", message: (err as Error).message }],
    };
  }
  const config = loaded.config;
  const configVersion = config["schema-version"];

  // Semantic validation: schema-valid but path/semantic-invalid → DAMAGED.
  try {
    validateSemanticConfig(config, projectRoot);
  } catch (err) {
    diagnoses.push({ code: "config-semantic", message: (err as Error).message });
    return { state: "DAMAGED", configPath: v2Path, configVersion, stateStatus, diagnoses };
  }

  try {
    const theme = loadTheme(config.theme, projectRoot);
    resolveTheme(theme);
  } catch (err) {
    diagnoses.push({ code: "theme-invalid", message: `Selected theme is not resolvable: ${(err as Error).message}` });
    return { state: "DAMAGED", configPath: v2Path, configVersion, stateStatus, diagnoses };
  }

  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") {
    const message =
      stateRead.status === "missing"
        ? "state.json is missing — arte-gitcard cannot prove ownership of generated files. Run `arte-gitcard doctor` or `arte-gitcard reset`."
        : stateRead.status === "corrupt"
          ? `state.json is corrupt or unparsable (${stateRead.path}). Run \`arte-gitcard doctor\` or \`arte-gitcard reset\`.`
          : `state.json has an unsupported schemaVersion. Run \`arte-gitcard doctor\` or \`arte-gitcard reset\`.`;
    diagnoses.push({ code: `state-${stateRead.status}`, message });
    return { state: "DAMAGED", configPath: v2Path, configVersion, stateStatus: stateRead.status, diagnoses };
  }
  const state = stateRead.state;

  // Managed entries: generated kinds only (theme is user-editable input).
  const drifted: Diagnosis[] = [];
  const collisions: Diagnosis[] = [];
  const generatedKinds = new Set(["card", "preview", "workflow", "ci-action", "ci-runtime"]);
  for (const entry of state.managedFiles) {
    if (!generatedKinds.has(entry.kind)) continue;
    const status = assertDeletable(projectRoot, entry);
    if (status === "unsafe") {
      collisions.push({
        code: "entry-unsafe",
        path: entry.path,
        message: `managed path is no longer safe (symlink/escape/dir): ${entry.path}`,
      });
    } else if (status === "modified" || status === "missing") {
      drifted.push({
        code: "entry-drift",
        path: entry.path,
        message: `generated file ${status === "modified" ? "was modified" : "is missing"} after generation: ${entry.path}`,
      });
    }
  }

  const workflowExpected = config["auto-update"] === true;
  const workflowAbs = resolveFromProject(projectRoot, WORKFLOW_REL);
  const workflowPresent = pathOccupied(workflowAbs);
  if (workflowExpected !== workflowPresent) {
    const wfEntry = findEntry(state, WORKFLOW_REL);
    if (workflowPresent && !workflowExpected) {
      if (wfEntry) {
        drifted.push({
          code: "github-disabled-workflow",
          message:
            "auto-update is disabled but the owned workflow still exists (owned). " +
            "Run `arte-gitcard github disable` (or `github enable`) to reconcile.",
          path: WORKFLOW_REL,
        });
      } else {
        collisions.push({
          code: "workflow-not-owned",
          path: WORKFLOW_REL,
          message: `.github/workflows/arte-gitcard.yml exists but is not owned by arte-gitcard — refusing to touch it.`,
        });
      }
    } else {
      drifted.push({
        code: "github-enabled-no-workflow",
        message: "auto-update is enabled but the workflow is missing (owned reclaim via `github sync`).",
        path: WORKFLOW_REL,
      });
    }
  }
  // CI action/runtime presence should match workflow presence (they ship together).
  const ciPresent = pathOccupied(resolveFromProject(projectRoot, CI_ACTION_REL));
  const runtimePresent = pathOccupied(resolveFromProject(projectRoot, CI_RUNTIME_REL));
  if (workflowPresent && (!ciPresent || !runtimePresent)) {
    drifted.push({
      code: "ci-materialization",
      message: "workflow present but .arte-git-card/ci materialization is incomplete — run `arte-gitcard github sync`.",
    });
  }
  // GitHub integration ownership-KIND reconciliation (P1-3): a state entry with
  // the right path+hash but the WRONG kind is drift, repairable via sync.
  const kindByRel: Array<[string, string]> = [
    [WORKFLOW_REL, "workflow"],
    [CI_ACTION_REL, "ci-action"],
    [CI_RUNTIME_REL, "ci-runtime"],
  ];
  for (const [rel, expectedKind] of kindByRel) {
    const entry = state.managedFiles.find((e) => e.path === rel);
    if (entry && entry.kind !== expectedKind) {
      drifted.push({
        code: "github-ownership-kind",
        path: rel,
        message:
          `state.json records ${rel} with kind "${entry.kind}" (expected "${expectedKind}") — ` +
          "run `arte-gitcard github sync` to reconcile ownership.",
      });
    }
  }

  // Github integration snapshot consistency (drift → repairable via sync).
  const snapshot = state.github?.defaultBranch;
  if (config["auto-update"] === true) {
    if (!snapshot) {
      drifted.push({
        code: "github-missing-snapshot",
        message: "auto-update is enabled but state.json has no default-branch snapshot — run `arte-gitcard github sync`.",
      });
    } else {
      let validRef = false;
      try {
        execFileSync("git", ["check-ref-format", `refs/heads/${snapshot}`], {
          cwd: projectRoot,
          stdio: ["ignore", "pipe", "ignore"],
        });
        validRef = true;
      } catch {
        validRef = false;
      }
      if (!validRef) {
        drifted.push({
          code: "github-invalid-snapshot",
          message: `state.json defaultBranch "${snapshot}" is not a valid git ref — run \`arte-gitcard github sync\`.`,
        });
      } else if (workflowPresent) {
        // The materialized workflow's static filter must match the snapshot. GitHub
        // evaluates branch filters as globs, so compare against the ENCODED literal.
        const expected = githubActionsBranchLiteral(snapshot);
        let actual: string | null = null;
        try {
          const doc = YAML.parse(readFileSync(path.join(projectRoot, WORKFLOW_REL), "utf8")) as {
            on?: { push?: { branches?: unknown } };
          };
          const first = Array.isArray(doc?.on?.push?.branches) ? doc.on.push.branches[0] : undefined;
          if (typeof first === "string") actual = first;
        } catch {
          actual = null;
        }
        if (actual !== expected) {
          drifted.push({
            code: "github-workflow-branch-drift",
            path: WORKFLOW_REL,
            message:
              `the workflow trigger (${actual ?? "unreadable"}) does not match the state snapshot default branch ` +
              `(${snapshot}) — the repository default branch likely changed; run \`arte-gitcard github sync\`.`,
          });
        }
      }
    }
  } else if (snapshot !== undefined) {
    drifted.push({
      code: "github-stale-snapshot",
      message:
        "auto-update is disabled but state.json still records a default-branch snapshot — run `arte-gitcard github disable` (or `github enable`) to reconcile.",
    });
  }
  if (config["auto-update"] === true) {
    const ignoredIntegration = integrationIgnoredRels(projectRoot);
    if (ignoredIntegration.length > 0) {
      drifted.push({
        code: "github-ignored-integration",
        message:
          `Required GitHub integration file(s) are untracked and git-ignored — GitHub would never run them: ` +
          `${ignoredIntegration.join(", ")}. Add a .gitignore exception, then run \`arte-gitcard github sync\`.`,
      });
    }
  }

  // Expected-path collisions: paths the tool would write, occupied by unowned files.
  const outputAbs = path.isAbsolute(config.output.directory)
    ? config.output.directory
    : path.resolve(projectRoot, config.output.directory);
  const outputRel = path.relative(projectRoot, outputAbs).replace(/\\/g, "/");
  // Expected managed artifacts come from the RUNTIME's displays (enabled only).
  const expectedFiles: string[] = runtime.enabledDisplays(config).map((e) => e.file);
  if (opts.checkExpectedPaths !== false) {
    for (const f of expectedFiles) {
      const rel = `${outputRel}/${f}`;
      if (pathOccupied(resolveFromProject(projectRoot, rel)) && !findEntry(state, rel)) {
        collisions.push({
          code: "unowned-output-file",
          path: rel,
          message: `file exists at a managed path but is not owned by arte-gitcard: ${rel} — refusing to overwrite.`,
        });
      }
    }
  }

  if (collisions.length > 0) {
    return { state: "COLLISION", configPath: v2Path, configVersion, stateStatus: "ok", diagnoses: [...diagnoses, ...collisions, ...drifted] };
  }
  if (drifted.length > 0) {
    return { state: "DRIFTED", configPath: v2Path, configVersion, stateStatus: "ok", diagnoses: [...diagnoses, ...drifted] };
  }
  return { state: "HEALTHY", configPath: v2Path, configVersion, stateStatus: "ok", diagnoses };
}
