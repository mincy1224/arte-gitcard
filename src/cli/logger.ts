/** Leveled CLI output: error / warning / info / success (+ verbose detail). */

export type LogLevel = "error" | "warning" | "info" | "success" | "verbose";

const PREFIX: Record<LogLevel, string> = {
  error: "✖",
  warning: "⚠",
  info: "ℹ",
  success: "✓",
  verbose: "·",
};

const LEVEL: Record<LogLevel, number> = {
  error: 0,
  warning: 1,
  info: 2,
  success: 2,
  verbose: 3,
};

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
  /** when true, non-error logs go to stderr so stdout stays machine-readable (--json / completion) */
  reserveStdout?: boolean;
}

export interface Logger {
  error(message: string): void;
  warning(message: string): void;
  info(message: string): void;
  success(message: string): void;
  verbose(message: string): void;
  log(level: LogLevel, message: string): void;
}

const ANSI: Record<LogLevel, string> = {
  error: "[31m",
  warning: "[33m",
  info: "[36m",
  success: "[32m",
  verbose: "[2m",
};
const RESET = "[0m";

export function createLogger(opts: LoggerOptions = {}): Logger {
  const colorEnabled = opts.color !== false;
  const threshold = opts.verbose ? 3 : opts.quiet ? 1 : 2;
  const reserveStdout = opts.reserveStdout === true;

  const log = (level: LogLevel, message: string): void => {
    if (LEVEL[level] > threshold) return;
    const prefix = colorEnabled ? `${ANSI[level]}${PREFIX[level]}${RESET}` : PREFIX[level];
    const line = `${prefix} ${message}\n`;
    if (level === "error") {
      process.stderr.write(line);
    } else if (reserveStdout) {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  };

  return {
    log,
    error: (m) => log("error", m),
    warning: (m) => log("warning", m),
    info: (m) => log("info", m),
    success: (m) => log("success", m),
    verbose: (m) => log("verbose", m),
  };
}
