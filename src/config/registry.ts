/**
 * Typed config-key registry. `config set/reset` manage only TYPED TUNING keys,
 * never lifecycle keys (card enabled / theme / auto-update). Keys are COMPOSED
 * from the compiled Display registry; the default branch is never a config key
 * — GitHub owns it.
 */

import path from "node:path";
import { resolveFromProject } from "./paths.js";
import { assertOutputDirInside } from "./root.js";
import type { ArteGitCardConfig } from "./types.js";
import { displayEnabledIn, ensureDisplayCardSlice, persistedCardSliceOf, resolveDisplayConfig } from "../display/definition.js";
import type { RegisteredDisplay } from "../display/definition.js";
import type { ArteRuntime } from "../runtime.js";

export type ConfigKeyKind = "tuning" | "lifecycle";

export interface ConfigKeySpec {
  key: string;
  kind: ConfigKeyKind;
  type: string;
  description: string;
  managedBy?: string;
  read(c: ArteGitCardConfig): unknown;
  apply(c: ArteGitCardConfig, raw: string, env: { projectRoot: string }): void;
  reset(c: ArteGitCardConfig): void;
}

export class ConfigSetError extends Error {}

function fail(msg: string): never {
  throw new ConfigSetError(msg);
}

export function cloneConfig(c: ArteGitCardConfig): ArteGitCardConfig {
  // JSON round-trip is a lossless, field-agnostic deep clone (config is strict
  // JSON data); a hand-written copy would break when a new Display adds a field.
  return JSON.parse(JSON.stringify(c)) as ArteGitCardConfig;
}

function noSet(message: string): (c: ArteGitCardConfig, raw: string, env: { projectRoot: string }) => void {
  return () => fail(message);
}
function noReset(): (c: ArteGitCardConfig) => void {
  return () => fail("this key is lifecycle-managed; use its dedicated command");
}

const GLOBAL_CONFIG_KEYS: ConfigKeySpec[] = [
  {
    key: "theme",
    kind: "lifecycle",
    type: "string",
    description: "Selected theme (installed YAML path)",
    managedBy: "arte-gitcard theme select",
    read: (c) => c.theme,
    apply: noSet("theme is managed by `arte-gitcard theme select`"),
    reset: noReset(),
  },
  {
    key: "auto-update",
    kind: "lifecycle",
    type: "boolean",
    description: "GitHub auto-update",
    managedBy: "arte-gitcard github enable/disable",
    read: (c) => c["auto-update"],
    apply: noSet("auto-update is managed by `arte-gitcard github enable` / `arte-gitcard github disable`"),
    reset: noReset(),
  },
  {
    key: "output.directory",
    kind: "tuning",
    type: "safe-relative-path",
    description: "Card output directory (project-relative)",
    read: (c) => c.output.directory,
    apply: (c, raw, env) => {
      assertOutputDirInside(env.projectRoot, raw);
      const abs = resolveFromProject(env.projectRoot, raw);
      const rel = path.relative(env.projectRoot, abs).replace(/\\/g, "/");
      c.output.directory = rel;
    },
    reset: (c) => {
      c.output.directory = ".github/arte-git-card";
    },
  },
];

function displayKeys(d: RegisteredDisplay): ConfigKeySpec[] {
  const keys: ConfigKeySpec[] = [];
  keys.push({
    key: `${d.id}.enabled`,
    kind: "lifecycle",
    type: "boolean",
    description: `${d.title} card enabled`,
    managedBy: "arte-gitcard add/remove",
    read: (c) => displayEnabledIn(c, d.id),
    apply: noSet(`${d.id}.enabled is managed by \`arte-gitcard add ${d.id}\` / \`arte-gitcard remove ${d.id}\``),
    reset: noReset(),
  });
  for (const setting of d.config.settings) {
    keys.push({
      key: `${d.id}.${setting.key}`,
      kind: "tuning",
      type: setting.type,
      description: setting.description,
      read: (c) => setting.read(resolveDisplayConfig(c, d)),
      // apply materializes an absent optional display first so a `config set`
      // never auto-enables a card.
      apply: (c, raw) => {
        setting.apply(ensureDisplayCardSlice(c, d), raw);
      },
      // reset: absent optional block is a no-op (already at default), else resets in place.
      reset: (c) => {
        const persisted = persistedCardSliceOf(c, d.id);
        if (persisted !== undefined) setting.reset(persisted);
      },
    });
  }
  return keys;
}

export function composeConfigKeys(displays: readonly RegisteredDisplay[]): ConfigKeySpec[] {
  const keys: ConfigKeySpec[] = [];
  for (const d of displays) keys.push(...displayKeys(d));
  keys.push(...GLOBAL_CONFIG_KEYS);
  return keys;
}

export function listConfigKeys(runtime: ArteRuntime): ConfigKeySpec[] {
  return [...runtime.config.settings];
}

export function findConfigKey(runtime: ArteRuntime, key: string): ConfigKeySpec | null {
  return runtime.config.settings.find((k) => k.key === key) ?? null;
}

export function tuningKeys(runtime: ArteRuntime): ConfigKeySpec[] {
  return runtime.config.settings.filter((k) => k.kind === "tuning");
}
