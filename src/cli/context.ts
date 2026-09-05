/**
 * Per-command context: resolved global options, the leveled logger, and the
 * repository root resolved with the Git-boundary-aware resolver (P0).
 */

import { createLogger } from "./logger.js";
import type { Logger } from "./logger.js";
import { readGlobals } from "./options.js";
import type { GlobalOptions } from "./options.js";
import { resolveProjectRoot } from "../repo/resolve.js";
import type { ResolveResult } from "../repo/resolve.js";

export interface CliContext {
  globals: GlobalOptions;
  logger: Logger;
  startDir: string;
  resolved: ResolveResult;
  /** project root (git toplevel / config dir / start) */
  projectRoot: string;
}

/** Build a context from merged commander opts (root + action opts). */
export function makeContext(...optsSources: Array<Record<string, unknown>>): CliContext {
  const globals = readGlobals(...optsSources);
  const logger = createLogger({
    quiet: globals.quiet,
    verbose: globals.verbose,
    color: globals.color,
    reserveStdout: globals.json === true,
  });
  const startDir = process.cwd();
  const resolved = resolveProjectRoot(startDir, { repo: globals.repo });
  return { globals, logger, startDir, resolved, projectRoot: resolved.root };
}
