/**
 * arte-gitcard CLI (v2). All mutations run through the transaction engine under
 * the repo lock, all commands gate on the ONE repository-state detector, and
 * every delete requires proven ownership + kind path guard. Global options are
 * registered on every command (root / groups / leaves) so they parse anywhere.
 */

import { Command } from "commander";
import { isDeepStrictEqual } from "node:util";
import { createInterface } from "node:readline";
import path from "node:path";
import { VERSION } from "../version.js";
import { addGlobalOptions } from "./options.js";
import { makeContext } from "./context.js";
import type { CliContext } from "./context.js";
import { renderOutput, renderError } from "./render.js";
import { detectRepositoryState } from "../repo/detect.js";
import type { DetectResult } from "../repo/detect.js";
import { initRepository } from "../lifecycle/init.js";
import { resetRepository } from "../lifecycle/reset.js";
import { migrateRepository } from "../lifecycle/migrate.js";
import { uninstallRepository } from "../lifecycle/uninstall.js";
import type { UninstallReason } from "../lifecycle/uninstall.js";
import { buildStatusReport } from "../lifecycle/status.js";
import { buildDoctorReport } from "../lifecycle/doctor.js";
import { loadHealthyProject, writeConfigTxn, relocateOutputDirectory } from "../config/commit.js";
import { loadConfig } from "../config/load.js";
import { validateSemanticConfig } from "../config/root.js";
import { languageRuleSchema } from "../config/schema.js";
import { loadTheme } from "../theme/load.js";
import { resolveTheme } from "../theme/resolve.js";
import { generateEnabledCards } from "../generate/manage.js";
import { CARD_IDS, isCardId, addCard, removeCard, cardStatusList, buildCardSnippet, buildAllEnabledSnippets } from "../cardmgr/index.js";
import type { CardId } from "../cardmgr/index.js";
import { cloneConfig, findConfigKey, listConfigKeys } from "../config/registry.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import { DEFAULT_EXCLUDE } from "../config/defaults.js";
import { BUILTIN_LANGUAGES } from "../languages/builtin.js";
import type { ArteGitCardConfig, LoadedConfig } from "../config/types.js";
import { CONFIG_FILENAME } from "../config/paths.js";
import {
  installedThemes,
  installTheme,
  isPreset,
  selectTheme,
  removeTheme,
  themeBodyFor,
  validateThemeFile,
  selectedName,
  THEME_PRESETS,
} from "../thememgr/index.js";
import {
  githubEnable,
  githubDisable,
  githubSync,
  githubStatus,
  ciBundlePathFromCli,
} from "../github/manage.js";
import { isGitRoot } from "../repo/resolve.js";
import { displayEnabledIn } from "../display/definition.js";
import { candidates } from "../completion/engine.js";
import { SHELL_SCRIPTS } from "../completion/shells.js";
import { structureList, structureDescribe, structureRemove } from "../structure/manage.js";
import { readStructureDescriptions } from "../structure/descriptions.js";
import { STRUCTURE_DESCRIPTIONS_REL } from "../managed/paths.js";

const program = new Command();
program
  .name("arte-gitcard")
  .description("Native SVG repository cards (Codebase + Structure) for GitHub READMEs")
  .version(VERSION, "-v, --version");
addGlobalOptions(program);
program.showHelpAfterError();

interface CmdOut {
  lines?: string[];
  data?: unknown;
}

type Action = (
  ctx: CliContext,
  options: Record<string, unknown>,
  positionals: unknown[],
) => CmdOut | void | Promise<CmdOut | void>;

function allOpts(command: Command): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let c: Command | null = command; c; c = c.parent as Command | null) {
    out.push(c.opts() as Record<string, unknown>);
  }
  return out;
}

/** Robust action wrapper over commander's (...positionals, options, command). */
function act(fn: Action): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    const last = args[args.length - 1];
    const command = last instanceof Command ? last : undefined;
    const options: Record<string, unknown> = command
      ? ((args[args.length - 2] ?? {}) as Record<string, unknown>)
      : ((last ?? {}) as Record<string, unknown>);
    const positionals = command ? args.slice(0, args.length - 2) : args.slice(0, args.length - 1);
    const ctx = makeContext(options, ...(command ? allOpts(command) : [program.opts() as Record<string, unknown>]));
    try {
      const out = await fn(ctx, options, positionals);
      if (out && typeof out === "object") {
        const o = out as CmdOut;
        if (o.data !== undefined) renderOutput(ctx, { lines: o.lines ?? [], data: o.data });
        else if (o.lines) for (const l of o.lines) ctx.logger.info(l);
      }
    } catch (err) {
      renderError(ctx, err);
      process.exitCode = 1;
    }
  };
}

function damagedMessage(d: DetectResult): string {
  return (
    "arte-gitcard configuration is damaged.\n\n" +
    d.diagnoses.map((x) => `Problem:\n  ${x.message}`).join("\n") +
    "\n\nRun:\n  arte-gitcard doctor\nTo reinitialize:\n  arte-gitcard reset"
  );
}

function notInitialized(cmd = ""): Error {
  return new Error(`No arte-gitcard.yml found${cmd ? ` for "${cmd}"` : ""}. Run "arte-gitcard init" first.`);
}

function assertConfigUsable(ctx: CliContext): DetectResult {
  const d = detectRepositoryState(ctx.projectRoot);
  if (d.state === "UNINITIALIZED") throw notInitialized();
  if (d.state === "LEGACY") throw new Error(`Found a legacy v1 config. Run "arte-gitcard migrate" first.`);
  if (d.state === "DAMAGED") throw new Error(damagedMessage(d));
  return d;
}

function assertWritable(ctx: CliContext): DetectResult {
  const d = assertConfigUsable(ctx);
  if (d.state === "COLLISION") {
    throw new Error(
      "A file at a path arte-gitcard manages is NOT owned by arte-gitcard (collision).\n\n" +
        d.diagnoses.map((x) => `  ${x.message}`).join("\n") +
        "\n\nNothing was modified. Run `arte-gitcard doctor` for details.",
    );
  }
  return d;
}

/** Human label for an uninstall preserve reason (shown on the ⚠ lines). */
function preserveReasonLabel(reason: UninstallReason): string {
  switch (reason) {
    case "modified":
      return "modified after arte-gitcard generation (preserved)";
    case "unowned":
      return "not owned by arte-gitcard (preserved)";
    case "unsafe":
      return "unsafe path — symlink/escape/special entry (preserved)";
    case "custom-theme":
      return "custom or user-modified theme (preserved)";
  }
}

/**
 * uninstall confirmation: interactive TTY without --yes prompts (default No);
 * any non-interactive run without --yes FAILS CLOSED (never guesses "yes").
 */
function confirmUninstall(ctx: CliContext, yes: boolean): Promise<boolean> {
  if (yes) return Promise.resolve(true);
  if (!process.stdin.isTTY) {
    return Promise.reject(
      new Error("Not a terminal — re-run with --yes to confirm uninstall."),
    );
  }
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    ctx.logger.warning("This will safely uninstall arte-gitcard from this repository.");
    ctx.logger.warning("Only files arte-gitcard can prove it owns and that remain unchanged will be removed.");
    ctx.logger.warning("Unknown, user-created, modified, symlinked, or otherwise unsafe files will be preserved.");
    ctx.logger.log("warning", "Continue? [y/N]");
    rl.question("", (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function confirmReset(ctx: CliContext, yes: boolean): Promise<boolean> {
  if (yes) return Promise.resolve(true);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    ctx.logger.warning("This will reset arte-gitcard configuration.");
    ctx.logger.warning("User repository source files will not be modified.");
    ctx.logger.log("warning", "Continue? [y/N]");
    rl.question("", (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/** register a subcommand (leaf) with global options + action, with optionals */
function leaf(
  parent: Command,
  name: string,
  description: string,
  fn: Action,
  opts?: { option: [string, string] }[],
): void {
  const c = parent.command(name).description(description);
  addGlobalOptions(c);
  for (const o of opts ?? []) c.option(o.option[0], o.option[1]);
  c.action(act(fn));
}

function group(name: string, description: string): Command {
  const g = program.command(name).description(description);
  addGlobalOptions(g);
  return g;
}

function requireConfig(ctx: CliContext): ArteGitCardConfig {
  assertConfigUsable(ctx);
  return loadHealthyProject(ctx.projectRoot).loaded.config;
}

/** Mutation leaves derive their config write from the FULL LoadedConfig so the
 * config precondition is the EXACT bytes parsed (LoadedConfig.sourceSha256). */
function requireLoaded(ctx: CliContext): LoadedConfig {
  assertConfigUsable(ctx);
  return loadHealthyProject(ctx.projectRoot).loaded;
}

function chooseCards(all: boolean, card: string | undefined): CardId[] {
  if (all) return [...CARD_IDS];
  if (card === undefined) throw new Error("expected a registered card or --all");
  if (!isCardId(card)) throw new Error(`unknown card "${card}" (available: ${CARD_IDS.join(", ")})`);
  return [card as CardId];
}

function enableState(config: ArteGitCardConfig, id: CardId): boolean {
  return displayEnabledIn(config, id);
}

/** Error when init must refuse orphaned arte-gitcard metadata (no config). */
function orphanInitError(d: DetectResult): Error {
  const diag = d.diagnoses.find(
    (x) => x.code === "uninstall-interrupted" || x.code === "orphan-journal" || x.code === "orphan-state",
  );
  return new Error(
    "Cannot init: this repository has leftover arte-gitcard metadata but no config.\n" +
      `  ${diag ? diag.message : "Run `arte-gitcard doctor` to inspect."}\n\n` +
      "init never runs over orphaned ownership state or an interrupted transaction journal. " +
      "Resolve it first (`arte-gitcard doctor`; an interrupted uninstall completes with `arte-gitcard uninstall --yes`).",
  );
}

leaf(
  program,
  "init",
  "Set up arte-gitcard in the current project (UNINITIALIZED only)",
  (ctx, o) => {
    const dryRun = ctx.globals.dryRun;
    const d = detectRepositoryState(ctx.projectRoot);
    if (d.state === "LEGACY") throw new Error(`Found a legacy v1 config. Run "arte-gitcard migrate" first.`);
    if (d.state === "DAMAGED" && d.configPath === null) {
      // Orphaned state.json / txn.json with no config: never init over it (U-2).
      throw orphanInitError(d);
    }
    if (d.state !== "UNINITIALIZED") {
      throw new Error(
        "arte-gitcard is already initialized in this repository.\n\nRun:\n  arte-gitcard status\nTo reinitialize:\n  arte-gitcard reset",
      );
    }
    const { created, effects } = initRepository(ctx.projectRoot, { dryRun });
    for (const rel of created) ctx.logger.success(`${dryRun ? "would create" : "created"} ${rel}`);
    for (const e of effects) {
      if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
    }
    return { lines: [], data: { ok: true, dryRun, created } };
  },
);

leaf(
  program,
  "reset",
  "Reset arte-gitcard configuration + managed artifacts (destructive; confirm)",
  async (ctx, o) => {
    const d = detectRepositoryState(ctx.projectRoot);
    if (d.state === "UNINITIALIZED") throw new Error("Not initialized — nothing to reset. Run `arte-gitcard init`.");
    const ok = await confirmReset(ctx, o.yes === true);
    if (!ok) throw new Error("Aborted.");
    const dryRun = ctx.globals.dryRun;
    const { effects, warnings, preserved } = resetRepository(ctx.projectRoot, { dryRun });
    for (const w of warnings) ctx.logger.warning(w);
    for (const p of preserved) ctx.logger.warning(`preserved: ${p}`);
    for (const e of effects) {
      if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
      if (e.type === "delete") ctx.logger.success(`${dryRun ? "would remove" : "removed"} ${e.rel}`);
    }
    return { lines: [], data: { ok: true, reset: true, dryRun, preserved } };
  },
  [{ option: ["--yes", "skip the confirmation prompt"] }],
);

leaf(program, "migrate", "Migrate a legacy v1 arte-git-card.yml to v2 arte-gitcard.yml", (ctx, o) => {
  const d = detectRepositoryState(ctx.projectRoot);
  if (d.state !== "LEGACY") {
    if (d.state === "UNINITIALIZED") throw notInitialized();
    throw new Error("Nothing to migrate — this repository is already on arte-gitcard v2.");
  }
  const dryRun = ctx.globals.dryRun;
  const { effects } = migrateRepository(ctx.projectRoot, { dryRun });
  for (const e of effects) {
    if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
  }
  ctx.logger.warning("The legacy arte-git-card.yml was preserved (not deleted). Remove it once you are satisfied.");
  return { lines: [], data: { ok: true, migrated: true, dryRun } };
});

leaf(
  program,
  "uninstall",
  "Safely remove arte-gitcard from this repository (owned + unchanged files only; NEVER recursive)",
  async (ctx, o) => {
    const dryRun = ctx.globals.dryRun;
    const ok = await confirmUninstall(ctx, o.yes === true);
    if (!ok) throw new Error("Aborted.");
    const res = uninstallRepository(ctx.projectRoot, { dryRun });
    for (const rel of res.removed) ctx.logger.success(`${dryRun ? "would remove" : "removed"} ${rel}`);
    for (const p of res.preserved) {
      // The description store is CLI-managed USER METADATA — classified explicitly,
      // never reduced to a generic "unowned" file.
      const label =
        p.path === STRUCTURE_DESCRIPTIONS_REL && p.reason === "unowned"
          ? "preserved user metadata (arte-gitcard structure descriptions)"
          : preserveReasonLabel(p.reason);
      ctx.logger.warning(`preserved ${p.path} — ${label}`);
    }
    if (!dryRun) {
      ctx.logger.info("arte-gitcard has been uninstalled. Some user or modified files were preserved intentionally.");
    } else {
      ctx.logger.info("Dry run: nothing was changed. Re-run without --dry-run (with --yes) to uninstall.");
    }
    return {
      lines: [],
      data: {
        command: "uninstall",
        dryRun,
        removed: res.removed,
        preserved: res.preserved,
        status: res.status,
      },
    };
  },
  [{ option: ["--yes", "skip the confirmation prompt"] }],
);

leaf(program, "status", "Show a user-friendly repository status summary", (ctx) => {
  const { report, lines } = buildStatusReport(ctx.projectRoot);
  return { lines, data: report };
});

leaf(program, "doctor", "Comprehensive read-only health diagnostics (never repairs)", (ctx) => {
  const { report, lines } = buildDoctorReport(ctx.projectRoot);
  return { lines, data: report };
});

leaf(program, "validate", "Fast deterministic validation of config, theme and output paths (for CI)", (ctx) => {
  const d = detectRepositoryState(ctx.projectRoot);
  if (d.state === "UNINITIALIZED") throw notInitialized();
  if (d.state === "LEGACY") throw new Error(`Found a legacy v1 config. Run "arte-gitcard migrate" first.`);
  const configPath = path.join(ctx.projectRoot, CONFIG_FILENAME);
  const loaded = loadConfig(configPath);
  validateSemanticConfig(loaded.config, ctx.projectRoot);
  const theme = loadTheme(loaded.config.theme, ctx.projectRoot);
  resolveTheme(theme);
  // The description store is preserved user metadata — a malformed/unsafe store
  // must fail validation (never silently dropped or repaired).
  const store = readStructureDescriptions(ctx.projectRoot);
  const storeLine =
    store.status === "absent"
      ? "structure descriptions: absent"
      : `structure descriptions: present, valid, ${Object.keys(store.map).length} entries`;
  return {
    lines: [`config ok: ${configPath}`, `theme ok: ${loaded.config.theme}`, storeLine],
    data: {
      ok: true,
      configPath,
      theme: loaded.config.theme,
      output: loaded.config.output.directory,
      structureDescriptions: store.status === "absent" ? null : Object.keys(store.map).length,
    },
  };
});

leaf(
  program,
  "generate",
  "Regenerate all ENABLED cards (never auto-enables)",
  (ctx, o) => {
    assertWritable(ctx);
    const dryRun = ctx.globals.dryRun;
    const preview = o.preview === true;
    const { loaded, theme } = loadHealthyProject(ctx.projectRoot);
    const res = generateEnabledCards(ctx.projectRoot, loaded, theme, { preview, dryRun });
    let wrote = 0;
    for (const e of res.effects) {
      if (e.type === "write") {
        ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
        wrote++;
      }
    }
    if (wrote === 0) ctx.logger.info("cards are up to date");
    return { lines: [], data: { ok: true, dryRun, cards: res.planned.artifacts.map((a) => a.file) } };
  },
  [{ option: ["--preview", "also write a preview.html"] }],
);

leaf(
  program,
  "add [card]",
  "Enable a card and generate it (or --all)",
  (ctx, o, pos) => {
    assertWritable(ctx);
    const dryRun = ctx.globals.dryRun;
    const ids = chooseCards(o.all === true, pos[0] as string | undefined);
    const warnings: string[] = [];
    for (const id of ids) {
      // Reload between mutations so --all accumulates on the LATEST config.
      const { loaded, theme } = loadHealthyProject(ctx.projectRoot);
      const res = addCard(ctx.projectRoot, loaded, theme, id, { dryRun });
      warnings.push(...res.warnings);
      ctx.logger.info(
        enableState(loaded.config, id)
          ? `${id} is already enabled`
          : `${dryRun ? "would enable" : "enabled"} ${id}`,
      );
      for (const e of res.effects) {
        if (e.type === "write" && e.rel !== CONFIG_FILENAME) ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
      }
    }
    for (const w of warnings) ctx.logger.warning(w);
    return { lines: [], data: { ok: true, dryRun, cards: ids, warnings } };
  },
  [{ option: ["-a, --all", "enable all supported cards"] }],
);

leaf(
  program,
  "remove [card]",
  "Disable a card; delete its SVG ONLY if owned and unmodified (else preserve)",
  (ctx, o, pos) => {
    assertWritable(ctx);
    const dryRun = ctx.globals.dryRun;
    const ids = chooseCards(o.all === true, pos[0] as string | undefined);
    const warnings: string[] = [];
    for (const id of ids) {
      // Reload between mutations so --all accumulates on the LATEST config.
      const { loaded, theme } = loadHealthyProject(ctx.projectRoot);
      const res = removeCard(ctx.projectRoot, loaded, theme, id, { dryRun });
      warnings.push(...res.warnings);
      ctx.logger.info(
        enableState(loaded.config, id)
          ? `${dryRun ? "would disable" : "disabled"} ${id}`
          : `${id} is already disabled`,
      );
    }
    for (const w of warnings) ctx.logger.warning(w);
    return { lines: [], data: { ok: true, dryRun, cards: ids, warnings } };
  },
  [{ option: ["-a, --all", "disable all supported cards"] }],
);

leaf(program, "snippet [card]", "Print the README markdown snippet for a card (no README edits)", (ctx, _o, pos) => {
  const config = requireConfig(ctx);
  // No-arg → ENABLED Displays only (registry order). An optional Display that is
  // absent/disabled in an old config must never break `arte-gitcard snippet`.
  const blocks =
    pos[0] === undefined
      ? buildAllEnabledSnippets(config, DEFAULT_RUNTIME)
      : buildCardSnippet(config, [pos[0] as string], DEFAULT_RUNTIME); // explicit disabled id → actionable error
  const data = blocks.map((md) => ({ card: md.match(/^!\[([^\]]+) card\]/)?.[1], markdown: md }));
  if (!ctx.globals.json) for (const b of blocks) process.stdout.write(b + "\n");
  return { lines: [], data: data.length === 1 ? data[0] : data };
});

const cardGroup = group("card", "Card status");
leaf(cardGroup, "list", "List cards with enabled + ownership status", (ctx) => {
  const config = requireConfig(ctx);
  const cards = cardStatusList(ctx.projectRoot, config).map((c) => ({
    id: c.id,
    enabled: c.enabled,
    path: c.path,
    owned: c.owned,
  }));
  return {
    lines: cards.map((c) => `  ${c.id}\t${c.enabled ? "enabled" : "disabled"}\t${c.owned ? "owned" : "not-owned"}`),
    data: cards,
  };
});

const configGroup = group("config", "Typed configuration management");
leaf(configGroup, "list", "List typed config keys and their current values", (ctx) => {
  let config: ArteGitCardConfig | null = null;
  try {
    config = loadHealthyProject(ctx.projectRoot).loaded.config;
  } catch {
    /* registry keys listed without a loadable config */
  }
  const rows = listConfigKeys(DEFAULT_RUNTIME).map((k) => ({
    key: k.key,
    type: k.type,
    kind: k.kind,
    managedBy: k.managedBy,
    value: config ? k.read(config) : null,
  }));
  return {
    lines: rows.map((r) => `  ${r.key}  [${r.kind}/${r.type}]${r.managedBy ? ` → ${r.managedBy}` : ""}`),
    data: rows,
  };
});

leaf(configGroup, "get <key>", "Print a typed config value", (ctx, _o, pos) => {
  const key = pos[0] as string;
  const spec = findConfigKey(DEFAULT_RUNTIME, key);
  if (!spec) throw new Error(`unknown config key "${key}". Run "arte-gitcard config list".`);
  const value = spec.read(requireConfig(ctx));
  return { lines: [String(value)], data: { key, value } };
});

leaf(configGroup, "set <key> <value>", "Set a typed TUNING value (lifecycle keys use their dedicated command)", (ctx, o, pos) => {
  const key = pos[0] as string;
  const value = pos[1] as string;
  const dryRun = ctx.globals.dryRun;
  const spec = findConfigKey(DEFAULT_RUNTIME, key);
  if (!spec) throw new Error(`unknown config key "${key}". Run "arte-gitcard config list".`);
  if (spec.kind === "lifecycle") {
    throw new Error(`"${key}" is lifecycle-managed — use ${spec.managedBy ?? "its dedicated command"} instead.`);
  }
  const loaded = requireLoaded(ctx);
  const config = loaded.config;
  const next = cloneConfig(config);
  spec.apply(next, value, { projectRoot: ctx.projectRoot });
  if (key === "output.directory") {
    const { effects, preserved } = relocateOutputDirectory(ctx.projectRoot, loaded, next, {
      dryRun,
      command: "config-set-output",
    });
    for (const p of preserved) ctx.logger.warning(`preserved (not moved): ${p}`);
    for (const e of effects) {
      if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
      if (e.type === "delete") ctx.logger.success(`${dryRun ? "would remove" : "removed"} ${e.rel}`);
    }
  } else {
    const effects = writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun, command: `config-set-${key}` });
    for (const e of effects) if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
  }
  return { lines: [], data: { ok: true, key, value, dryRun } };
});

leaf(configGroup, "reset <key>", "Reset a TUNING value to its default", (ctx, o, pos) => {
  const key = pos[0] as string;
  const dryRun = ctx.globals.dryRun;
  const spec = findConfigKey(DEFAULT_RUNTIME, key);
  if (!spec) throw new Error(`unknown config key "${key}". Run "arte-gitcard config list".`);
  if (spec.kind === "lifecycle") {
    throw new Error(`"${key}" is lifecycle-managed — use ${spec.managedBy ?? "its dedicated command"} instead.`);
  }
  const loaded = requireLoaded(ctx);
  const config = loaded.config;
  const next = cloneConfig(config);
  spec.reset(next);
  // FH-2: a semantic no-op (the effective value was already the default — e.g. a
  // MISSING optional Display's setting) must be ZERO-WRITE: no transaction, no
  // lock, no YAML rewrite/reformat. Report already-default and return.
  if (isDeepStrictEqual(next, config)) {
    return { lines: [`${key} is already at its default — nothing changed`], data: { ok: true, key, noop: true, dryRun } };
  }
  if (key === "output.directory") {
    // Same safe relocation lifecycle as `config set output.directory` — never a
    // bare config write that would drift config/cards/state apart.
    const { effects, preserved } = relocateOutputDirectory(ctx.projectRoot, loaded, next, {
      dryRun,
      command: "config-reset-output",
    });
    for (const p of preserved) ctx.logger.warning(`preserved (not moved): ${p}`);
    for (const e of effects) {
      if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
      if (e.type === "delete") ctx.logger.success(`${dryRun ? "would remove" : "removed"} ${e.rel}`);
    }
  } else {
    const effects = writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun, command: `config-reset-${key}` });
    for (const e of effects) if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
  }
  return { lines: [`reset ${key} to default`], data: { ok: true, key, dryRun } };
});

leaf(configGroup, "path", "Print the config file path", (ctx) => {
  const p = path.join(ctx.projectRoot, CONFIG_FILENAME);
  return { lines: [p], data: { path: p } };
});

const excludeGroup = group("exclude", "Scan exclusion management");
leaf(excludeGroup, "list", "List the user-editable scan exclusions", (ctx) => {
  const items = requireConfig(ctx).exclude ?? [];
  return { lines: items.map((i) => `  ${i}`), data: { exclude: items } };
});
leaf(excludeGroup, "add <pattern>", "Add an exclusion pattern (same semantics as the scanner)", (ctx, o, pos) => {
  const pattern = pos[0] as string;
  if (!pattern) throw new Error("exclusion pattern must not be empty");
  const loaded = requireLoaded(ctx);
  const config = loaded.config;
  const items = config.exclude ?? [];
  if (items.includes(pattern)) throw new Error(`"${pattern}" is already excluded`);
  const next = cloneConfig(config);
  next.exclude = [...items, pattern];
  writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun: ctx.globals.dryRun, command: "exclude-add" });
  ctx.logger.success(`excluded ${pattern}`);
  return { lines: [], data: { ok: true, exclude: next.exclude } };
});
leaf(excludeGroup, "remove <pattern>", "Remove an exclusion pattern", (ctx, o, pos) => {
  const pattern = pos[0] as string;
  const loaded = requireLoaded(ctx);
  const config = loaded.config;
  const items = config.exclude ?? [];
  if (!items.includes(pattern)) throw new Error(`"${pattern}" is not excluded`);
  const next = cloneConfig(config);
  next.exclude = items.filter((i) => i !== pattern);
  writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun: ctx.globals.dryRun, command: "exclude-remove" });
  ctx.logger.success(`un-excluded ${pattern}`);
  return { lines: [], data: { ok: true, exclude: next.exclude } };
});
leaf(excludeGroup, "reset", "Reset exclusions to the arte-gitcard defaults", (ctx, o) => {
  const loaded = requireLoaded(ctx);
  const config = loaded.config;
  const next = cloneConfig(config);
  next.exclude = [...DEFAULT_EXCLUDE];
  writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun: ctx.globals.dryRun, command: "exclude-reset" });
  ctx.logger.success(`reset to ${next.exclude.length} default exclusions`);
  return { lines: [], data: { ok: true, exclude: next.exclude } };
});

const langGroup = group("language", "Language rule management");
leaf(langGroup, "list", "List built-in + custom language rules", (ctx) => {
  let config: ArteGitCardConfig | null = null;
  try {
    config = loadHealthyProject(ctx.projectRoot).loaded.config;
  } catch {
    /* builtin list only */
  }
  const custom = new Set((config?.languages ?? []).map((l) => l.id));
  const rows: Array<{ id: string; source: "builtin" | "custom" }> = [];
  for (const l of BUILTIN_LANGUAGES) rows.push({ id: l.id, source: "builtin" });
  for (const id of custom) rows.push({ id, source: "custom" });
  return { lines: rows.map((r) => `  ${r.id}\t${r.source}`), data: rows };
});
leaf(langGroup, "show <id>", "Show a language rule", (ctx, _o, pos) => {
  const id = pos[0] as string;
  const config = requireConfig(ctx);
  const custom = (config.languages ?? []).find((l) => l.id === id);
  if (custom) return { lines: [JSON.stringify(custom, null, 2)], data: { id, source: "custom", rule: custom } };
  const builtin = BUILTIN_LANGUAGES.find((l) => l.id === id);
  if (builtin) return { lines: [JSON.stringify(builtin, null, 2)], data: { id, source: "builtin", rule: builtin } };
  throw new Error(`unknown language id "${id}"`);
});
leaf(
  langGroup,
  "add <id>",
  "Add (or override) a custom language rule",
  (ctx, o, pos) => {
    const id = pos[0] as string;
    const loaded = requireLoaded(ctx);
    const config = loaded.config;
    const name = o.name as string | undefined;
    if (!name) throw new Error("--name is required");
    let block: [string, string] | undefined;
    if (o.blockComment) {
      const pair = String(o.blockComment).split(",").map((s) => s.trim());
      if (pair.length !== 2 || !pair[0] || !pair[1]) throw new Error("--block-comment expects a pair like /*,*/");
      block = [pair[0]!, pair[1]!];
    }
    const rule = {
      id,
      name,
      extensions: o.extensions ? String(o.extensions).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      filenames: o.filenames ? String(o.filenames).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      shebang: o.shebang ? String(o.shebang).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      comments:
        o.lineComment || o.blockComment
          ? { line: o.lineComment ? [String(o.lineComment)] : undefined, block }
          : undefined,
    };
    const parsed = languageRuleSchema.safeParse(rule);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `\`${i.path.join(".") || "rule"}\`: ${i.message}`).join("\n");
      throw new Error(`invalid language rule:\n${msg}`);
    }
    const next = cloneConfig(config);
    next.languages = [...(next.languages ?? []).filter((l) => l.id !== id), parsed.data];
    writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun: ctx.globals.dryRun, command: "language-add" });
    ctx.logger.success(`added language ${id}`);
    return { lines: [], data: { ok: true, id } };
  },
  [
    { option: ["--name <name>", "display name"] },
    { option: ["--extensions <list>", "comma-separated file extensions"] },
    { option: ["--filenames <list>", "comma-separated filenames"] },
    { option: ["--shebang <list>", "comma-separated shebang programs"] },
    { option: ["--line-comment <marker>", "line comment marker"] },
    { option: ["--block-comment <pair>", "block comment pair like /*,*/"] },
  ],
);
leaf(langGroup, "remove <id>", "Remove a CUSTOM language rule (built-in languages are not removable)", (ctx, o, pos) => {
  const id = pos[0] as string;
  const loaded = requireLoaded(ctx);
  const config = loaded.config;
  const isCustom = (config.languages ?? []).some((l) => l.id === id);
  if (!isCustom) throw new Error(`"${id}" is not a custom language rule (built-ins cannot be removed)`);
  const next = cloneConfig(config);
  next.languages = (next.languages ?? []).filter((l) => l.id !== id);
  writeConfigTxn(ctx.projectRoot, loaded, next, { dryRun: ctx.globals.dryRun, command: "language-remove" });
  ctx.logger.success(`removed custom language ${id}`);
  return { lines: [], data: { ok: true, id } };
});

function assertGitRepo(ctx: CliContext): void {
  const gitRoot = ctx.resolved.gitRoot ?? (isGitRoot(ctx.projectRoot) ? path.resolve(ctx.projectRoot) : null);
  if (!gitRoot) {
    throw new Error("GitHub integration requires a Git repository root. Run `git init` first (or `--repo` a git repo).");
  }
  // GitHub workflows only run when arte-gitcard's project root IS the Git
  // repository root. `--repo` into a SUBDIRECTORY would write
  // subdir/.github/workflows/... which GitHub never treats as a repo workflow.
  if (path.resolve(ctx.projectRoot) !== path.resolve(gitRoot)) {
    throw new Error("GitHub integration requires --repo to point at the Git repository root.");
  }
}

const githubGroup = group("github", "GitHub auto-update integration");

leaf(
  githubGroup,
  "enable",
  "Enable GitHub auto-update for the repository DEFAULT branch: config + workflow + vendored CI action + state in one local transaction",
  (ctx) => {
    assertGitRepo(ctx);
    const dryRun = ctx.globals.dryRun;
    const loaded = requireLoaded(ctx);
    const res = githubEnable(ctx.projectRoot, loaded, { dryRun, ciBundlePath: ciBundlePathFromCli() });
    ctx.logger.success(`${dryRun ? "would enable" : "enabled"} auto-update (default branch "${res.branch}")`);
    for (const e of res.effects) {
      if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
    }
    return { lines: [], data: { ok: true, dryRun, branch: res.branch } };
  },
);

leaf(githubGroup, "disable", "Disable auto-update ALL-OR-NOTHING (modified/unowned workflow/runtime → abort before config)", (ctx) => {
  assertGitRepo(ctx);
  const dryRun = ctx.globals.dryRun;
  const loaded = requireLoaded(ctx);
  const res = githubDisable(ctx.projectRoot, loaded, { dryRun });
  ctx.logger.success(`${dryRun ? "would disable" : "disabled"} auto-update`);
  for (const e of res.effects) {
    if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
    if (e.type === "delete") ctx.logger.success(`${dryRun ? "would remove" : "removed"} ${e.rel}`);
  }
  return { lines: [], data: { ok: true, dryRun } };
});

leaf(githubGroup, "sync", "Reconcile the full desired GitHub state (default branch → workflow/CI runtime/state) — no commit / no push / no remote mutation", (ctx) => {
  assertGitRepo(ctx);
  const dryRun = ctx.globals.dryRun;
  const loaded = requireLoaded(ctx);
  const res = githubSync(ctx.projectRoot, loaded, { dryRun, ciBundlePath: ciBundlePathFromCli() });
  for (const w of res.warnings) ctx.logger.warning(w);
  for (const e of res.effects) {
    if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
  }
  if (res.effects.length === 0 && res.warnings.length === 0) {
    ctx.logger.info("github integration is already synchronized");
  }
  return { lines: [], data: { ok: true, dryRun, warnings: res.warnings } };
});

leaf(githubGroup, "status", "Show GitHub integration status", (ctx) => {
  const { status, lines } = githubStatus(ctx.projectRoot);
  return { lines, data: status };
});

const structureGroup = group("structure", "Structure tree + directory description metadata");

leaf(structureGroup, "list [depth]", "List the Structure tree with descriptions (strictly read-only)", (ctx, _o, pos) => {
  const config = requireConfig(ctx);
  const rawDepth = pos[0] === undefined ? undefined : String(pos[0]);
  const res = structureList(ctx.projectRoot, config, rawDepth);
  return { lines: res.lines, data: { root: res.root, depth: res.depth, entries: res.entries } };
});

leaf(structureGroup, "describe <path> <description>", "Set/update a directory description (does NOT regenerate cards)", (ctx, _o, pos) => {
  const loaded = requireLoaded(ctx);
  const path = pos[0] as string;
  const text = pos[1] as string | undefined;
  if (text === undefined) throw new Error("expected a description as the second argument (quote it, e.g. describe src \"核心源码\")");
  const dryRun = ctx.globals.dryRun;
  const res = structureDescribe(ctx.projectRoot, loaded, path, text, { dryRun });
  if (res.targetChanged) {
    ctx.logger.success(
      `${dryRun ? "would update" : "updated"} description for "${path}"; run "arte-gitcard generate" to refresh cards`,
    );
  } else if (res.changed) {
    // The target already had this value; only stale entries were pruned — no
    // regeneration is implied and no "updated <target>" is claimed.
    ctx.logger.info(`description for "${path}" is unchanged; pruned ${res.removed.length} stale description(s)`);
  } else {
    ctx.logger.info(`description for "${path}" is unchanged — nothing to regenerate`);
  }
  for (const r of res.removed) ctx.logger.info(`pruned stale description: ${r}`);
  if (res.warning) ctx.logger.warning(res.warning);
  return { lines: [], data: { ok: true, dryRun, changed: res.changed, targetChanged: res.targetChanged, generationRequired: res.generationRequired, removed: res.removed, warning: res.warning ?? null } };
});

leaf(structureGroup, "remove <path>", "Remove a directory description (does NOT regenerate cards)", (ctx, _o, pos) => {
  const loaded = requireLoaded(ctx);
  const path = pos[0] as string;
  if (!path) throw new Error("expected a path");
  const dryRun = ctx.globals.dryRun;
  const res = structureRemove(ctx.projectRoot, loaded, path, { dryRun });
  if (res.targetChanged) {
    ctx.logger.success(
      `${dryRun ? "would remove" : "removed"} description for "${path}"; run "arte-gitcard generate" to refresh cards`,
    );
  } else if (res.changed) {
    ctx.logger.info(`no description for "${path}"; pruned ${res.removed.length} stale description(s)`);
  } else {
    ctx.logger.info(`no description for "${path}" — nothing to remove`);
  }
  for (const r of res.removed) ctx.logger.info(`pruned stale description: ${r}`);
  if (res.warning) ctx.logger.warning(res.warning);
  return { lines: [], data: { ok: true, dryRun, changed: res.changed, targetChanged: res.targetChanged, generationRequired: res.generationRequired, removed: res.removed, warning: res.warning ?? null } };
});

const themeGroup = group("theme", "Theme management (installed .yml in .arte-git-card/themes)");

leaf(themeGroup, "list", "List installed themes and installable presets", (ctx) => {
  let selected: string | null = null;
  try {
    const config = loadHealthyProject(ctx.projectRoot).loaded.config;
    selected = selectedName(config.theme);
  } catch {
    /* no usable config */
  }
  const installed = installedThemes(ctx.projectRoot).map((name) => ({
    name,
    selected: selected === name,
  }));
  const presets = Object.keys(THEME_PRESETS).filter((p) => !installed.some((i) => i.name === p));
  const lines = ["Installed:"];
  if (installed.length === 0) lines.push("  (none)");
  for (const i of installed) lines.push(`  ${i.name}${i.selected ? "  [selected]" : ""}`);
  lines.push("Presets (installable): " + (presets.join(", ") || "(none)"));
  return { lines, data: { installed, presets, selected } };
});

leaf(themeGroup, "install <file>", "Install a theme from a LOCAL file (or a preset: arte-theme|github-theme)", (ctx, o, pos) => {
  const dryRun = ctx.globals.dryRun;
  const source = pos[0] as string;
  if (!source) throw new Error("expected a theme file or preset name");
  const res = installTheme(ctx.projectRoot, source, { dryRun });
  ctx.logger.success(`${dryRun ? "would install" : "installed"} theme "${res.name}" -> ${res.rel}`);
  return { lines: [], data: { ok: true, name: res.name, rel: res.rel, dryRun } };
});

leaf(themeGroup, "select <name>", "Select an installed theme (or preset) and regenerate enabled cards in one transaction", (ctx, _o, pos) => {
  assertWritable(ctx); // regenerate writes cards → refuse on COLLISION
  const dryRun = ctx.globals.dryRun;
  const name = pos[0] as string;
  const { loaded } = loadHealthyProject(ctx.projectRoot);
  const res = selectTheme(ctx.projectRoot, loaded, name, { dryRun });
  for (const e of res.effects) {
    if (e.type === "write") ctx.logger.success(`${dryRun ? "would write" : "wrote"} ${e.rel}`);
  }
  if (res.materializedPreset) ctx.logger.success(`${dryRun ? "would materialize" : "materialized"} preset "${name}"`);
  ctx.logger.success(`${dryRun ? "would select" : "selected"} theme "${name}"`);
  return { lines: [], data: { ok: true, name, dryRun, materializedPreset: res.materializedPreset } };
});

leaf(themeGroup, "show <name>", "Show a theme's YAML (installed file or preset template)", (ctx, _o, pos) => {
  const name = pos[0] as string;
  const { body, preset } = themeBodyFor(ctx.projectRoot, name);
  if (!ctx.globals.json) process.stdout.write(body);
  return { lines: [], data: { name, preset, yaml: body } };
});

leaf(themeGroup, "validate <file>", "Validate a theme file (partial YAML allowed; strict schema)", (ctx, _o, pos) => {
  const file = pos[0] as string;
  const r = validateThemeFile(file);
  if (!r.ok) throw new Error(r.error ?? "invalid theme");
  return { lines: [`theme ok: ${file}`], data: { ok: true, file } };
});

leaf(themeGroup, "remove <name>", "Remove an installed theme (refuses the selected theme; preserves modified)", (ctx, o, pos) => {
  const dryRun = ctx.globals.dryRun;
  const name = pos[0] as string;
  const loaded = requireLoaded(ctx);
  const res = removeTheme(ctx.projectRoot, loaded, name, { dryRun });
  for (const e of res.effects) {
    if (e.type === "delete") ctx.logger.success(`${dryRun ? "would remove" : "removed"} ${e.rel}`);
  }
  ctx.logger.success(`${dryRun ? "would remove" : "removed"} theme "${name}"`);
  return { lines: [], data: { ok: true, name, dryRun } };
});

const completionGroup = group("completion", "Print a shell completion script (install it yourself)");

for (const [shell, script] of Object.entries(SHELL_SCRIPTS)) {
  leaf(completionGroup, shell, `Print the ${shell} completion script`, () => {
    process.stdout.write(script);
    return undefined;
  });
}

// Hidden engine: forwards typed words; stdout is candidates ONLY (machine-readable).
program
  .command("__complete", { hidden: true })
  .description("internal dynamic completion engine")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(() => {
    const raw = process.argv;
    const idx = raw.indexOf("__complete");
    const words = idx >= 0 ? raw.slice(idx + 1) : [];
    for (const c of candidates(words)) process.stdout.write(c + "\n");
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`✖ ${message}\n`);
    process.exitCode = 1;
  }
}

main();
