/**
 * Global CLI options (arte-gitcard §49/§四十八): registered on the root program
 * AND on every subcommand so they work before or after the command name.
 * `-v` is reserved for version; verbosity is `--verbose`.
 */

import type { Command } from "commander";

export interface GlobalOptions {
  repo?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  /** true unless --no-color */
  color: boolean;
  dryRun?: boolean;
}

const GLOBAL_OPTIONS: Array<{ flags: string; description: string }> = [
  { flags: "--repo <path>", description: "operate on <path> instead of the cwd" },
  { flags: "--json", description: "emit machine-readable JSON on stdout" },
  { flags: "--quiet", description: "suppress informational output" },
  { flags: "--verbose", description: "verbose diagnostics" },
  { flags: "--no-color", description: "disable ANSI colors" },
  { flags: "--dry-run", description: "validate and report changes without writing anything" },
];

export function addGlobalOptions(cmd: Command): void {
  for (const o of GLOBAL_OPTIONS) {
    cmd.option(o.flags, o.description);
  }
}

/** Merge commander-opts into GlobalOptions (both the root opts and the action opts). */
export function readGlobals(...sources: Array<Record<string, unknown>>): GlobalOptions {
  const o: Record<string, unknown> = {};
  for (const s of sources) Object.assign(o, s);
  return {
    repo: typeof o.repo === "string" && o.repo.length > 0 ? o.repo : undefined,
    json: o.json === true,
    quiet: o.quiet === true,
    verbose: o.verbose === true,
    color: o.color !== false,
    dryRun: o.dryRun === true,
  };
}
