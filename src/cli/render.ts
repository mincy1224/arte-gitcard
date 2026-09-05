/**
 * Machine-readable output helpers. `--json` reserves stdout for ONE JSON
 * document; human text goes through the logger. Every report-style command
 * returns { lines: string[], data: unknown } so human + JSON stay in sync.
 */

import type { CliContext } from "./context.js";

export interface CommandOutput {
  lines: string[];
  data: unknown;
}

export function renderOutput(ctx: CliContext, out: CommandOutput): void {
  if (ctx.globals.json) {
    process.stdout.write(JSON.stringify(out.data, null, 2) + "\n");
  } else {
    for (const line of out.lines) {
      ctx.logger.info(line);
    }
  }
}

/** Report a fatal error to the user (human or JSON shape). */
export function renderError(ctx: CliContext, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (ctx.globals.json) {
    process.stdout.write(
      JSON.stringify(
        { ok: false, error: message },
        null,
        2,
      ) + "\n",
    );
  } else {
    ctx.logger.error(message);
  }
}
