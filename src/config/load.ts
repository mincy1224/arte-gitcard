/**
 * STRICT v2 config loading. An existing config is validated DIRECTLY against the
 * v2 schema — no deepMerge of defaults, so the tool never silently repairs it.
 * Reasons let the state detector branch: v1 → LEGACY (migrate), all others →
 * DAMAGED. Only init/migrate materializes defaults via buildDefaultConfig().
 */

import { readFileSync } from "node:fs";
import YAML from "yaml";
import type { ZodError, ZodType } from "zod";
import { projectRootOf } from "./paths.js";
import { DEFAULT_RUNTIME } from "../runtime.js";
import { sha256Content } from "../fs/hash.js";
import type { ArteGitCardConfig, LoadedConfig } from "./types.js";

export type ConfigLoadReason =
  | "invalid-yaml"
  | "v1"
  | "unsupported-version"
  | "strict-fail";

export class ConfigError extends Error {
  readonly configPath: string;
  readonly reason: ConfigLoadReason;
  constructor(message: string, configPath: string, reason: ConfigLoadReason = "strict-fail") {
    super(message);
    this.name = "ConfigError";
    this.configPath = configPath;
    this.reason = reason;
  }
}

export function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? `\`${issue.path.join(".")}\`` : "config";
      return `${field}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * Strict-validate against a COMPILED runtime schema (a config can never invent
 * display ids). Never merges defaults.
 */
export function loadConfigWithSchema(configPath: string, schema: ZodType<ArteGitCardConfig>): LoadedConfig {
  // Hash the exact BYTES read (never a re-encoded string) so the source precondition matches what was parsed.
  let bytes: Buffer;
  try {
    bytes = readFileSync(configPath);
  } catch (err) {
    throw new ConfigError(`cannot read config file: ${configPath}`, configPath, "invalid-yaml");
  }
  const raw = bytes.toString("utf8");

  let parsed: Record<string, unknown> | null;
  try {
    const value = YAML.parse(raw);
    parsed = value === null || typeof value !== "object" || Array.isArray(value) ? {} : (value as Record<string, unknown>);
  } catch (err) {
    throw new ConfigError(`invalid YAML in ${configPath}`, configPath, "invalid-yaml");
  }

  const version = parsed["schema-version"];
  if (version === undefined) {
    throw new ConfigError(
      `This is a legacy v1 config (no "schema-version"). Run "arte-gitcard migrate" to upgrade to arte-gitcard v2.`,
      configPath,
      "v1",
    );
  }
  if (version !== 2) {
    throw new ConfigError(
      `Unsupported schema-version ${JSON.stringify(version)} in ${configPath}. ` +
        `This arte-gitcard version supports schema-version 2.`,
      configPath,
      "unsupported-version",
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(
      `Invalid configuration (${configPath}):\n${formatZodError(result.error)}`,
      configPath,
      "strict-fail",
    );
  }

  return {
    config: result.data,
    projectRoot: projectRootOf(configPath),
    configPath,
    // Hash the EXACT bytes that were parsed (a precondition source, not a re-read).
    sourceSha256: sha256Content(bytes),
  };
}

export function loadConfig(configPath: string): LoadedConfig {
  return loadConfigWithSchema(configPath, DEFAULT_RUNTIME.config.v2Schema);
}
