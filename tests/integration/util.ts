/** Shared CLI-integration helpers (spawn the built dist/cli.js). */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const CLI = path.resolve("dist/cli.js");

function flatten(args: string[]): string[] {
  // Allow callers to write runCli(dir, "config set", "structure.max-depth", "7")
  // — each arg is split on whitespace into real argv tokens. Empty tokens are
  // PRESERVED: `""` is a meaningful current-word in __complete contexts.
  return args.flatMap((a) => a.split(/\s+/));
}

export function runCli(cwd: string, ...args: string[]): string {
  return execFileSync(process.execPath, [CLI, ...flatten(args)], { cwd, encoding: "utf8" });
}

export interface CliError {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run with stdin input (for interactive prompts); never throws. */
export function runCliInput(cwd: string, input: string, ...args: string[]): CliError {
  const r = spawnSync(process.execPath, [CLI, ...flatten(args)], { cwd, encoding: "utf8", input });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Run a CLI command that is expected to FAIL; returns stdout/stderr/status. */
export function runCliFail(cwd: string, ...args: string[]): CliError {
  try {
    runCli(cwd, ...args);
    throw new Error(`expected command to fail: ${args.join(" ")}`);
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

export function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "arte-int-"));
}

export function makeSrcRepo(): string {
  const dir = tempDir();
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(path.join(dir, "src", "main.ts"), "const x = 1;\n// c\n\n", "utf8");
  return dir;
}

export function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
