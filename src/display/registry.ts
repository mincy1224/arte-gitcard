/**
 * The ONE closed, static Display registry — no register/load/discover API, no
 * dynamic import. Output path authority derives from the display id (`${id}.svg`):
 * neither a display nor state.json can introduce a path or id on its own.
 */

import type { ArteGitCardConfig } from "../config/types.js";
import { codebaseDisplay } from "./builtin/codebase/definition.js";
import { structureDisplay } from "./builtin/structure/definition.js";
import type { RegisteredDisplay } from "./definition.js";
import { displayEnabledIn } from "./definition.js";

export type DisplayRegistry = readonly RegisteredDisplay[];

export const DISPLAY_ID_RE = /^[a-z][a-z0-9-]{0,47}$/;

/**
 * Setting key grammar. Dot-separated lowercase kebab segments so nested persisted
 * settings stay legal: `commits.enabled`, `changes.enabled`.
 */
export const SETTING_KEY_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

/** Reserved ids that can never be a display (framework-owned filenames). */
const RESERVED_IDS = new Set(["preview", "state", "workflow", "ci", "txn"]);

export function assertValidRegistry(entries: DisplayRegistry): void {
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const entry of entries) {
    if (!DISPLAY_ID_RE.test(entry.id)) {
      throw new Error(`display registry: invalid display id "${entry.id}"`);
    }
    if (RESERVED_IDS.has(entry.id) || entry.id.startsWith(".")) {
      throw new Error(`display registry: reserved display id "${entry.id}"`);
    }
    if (ids.has(entry.id)) throw new Error(`display registry: duplicate display id "${entry.id}"`);
    ids.add(entry.id);
    const file = `${entry.id}.svg`;
    if (files.has(file)) throw new Error(`display registry: duplicate output filename "${file}"`);
    files.add(file);
    if (entry.id === "preview") throw new Error("display registry: 'preview' is reserved");

    // FH-6.A — the display-local defaults MUST parse against its OWN strict schema.
    const defaults = entry.config.defaults() as unknown;
    const parsed = entry.config.schema.safeParse(defaults);
    if (!parsed.success) {
      throw new Error(
        `display registry: display "${entry.id}" defaults do not satisfy its own schema: ` +
          parsed.error.issues.map((i) => `\`${i.path.join(".") || "defaults"}\`: ${i.message}`).join("; "),
      );
    }
    // FH-6.B — display-local defaults must be DISABLED. Fresh required enablement
    // is owned separately by buildDefaultConfig / `add`; first `config set
    // <future>.setting` must never auto-enable a Display.
    const defaultEnabled = (defaults as { enabled?: unknown }).enabled;
    if (defaultEnabled !== false) {
      throw new Error(
        `display registry: display "${entry.id}" defaults must set enabled:false ` +
          `(enabled is lifecycle-managed by \`arte-gitcard add\` / \`arte-gitcard remove\`)`,
      );
    }

    // FH-6.C — every setting key must be syntactically valid, unique inside its
    // Display, and never the framework key `enabled`.
    const seenSettings = new Set<string>();
    for (const setting of entry.config.settings) {
      if (!SETTING_KEY_RE.test(setting.key)) {
        throw new Error(
          `display registry: display "${entry.id}" has an invalid setting key "${setting.key}" ` +
            `(expected lowercase kebab segments like "commits.enabled")`,
        );
      }
      if (setting.key === "enabled") {
        throw new Error(
          `display registry: display "${entry.id}" declares setting key "enabled" — ` +
            `"enabled" is lifecycle-managed by \`arte-gitcard add\` / \`arte-gitcard remove\`.`,
        );
      }
      if (seenSettings.has(setting.key)) {
        throw new Error(`display registry: display "${entry.id}" declares duplicate setting key "${setting.key}"`);
      }
      seenSettings.add(setting.key);
    }
  }
}

export const DISPLAY_REGISTRY: DisplayRegistry = Object.freeze(
  [codebaseDisplay, structureDisplay].map((d) => Object.freeze(d as RegisteredDisplay)),
);
assertValidRegistry(DISPLAY_REGISTRY);

export function displayFilename(id: string): string {
  return `${id}.svg`;
}

export function registryDisplayIds(registry: DisplayRegistry): readonly string[] {
  return registry.map((d) => d.id);
}

export function registryDisplayFilenames(registry: DisplayRegistry): readonly string[] {
  return registry.map((d) => displayFilename(d.id));
}

export function registryFindDisplay(registry: DisplayRegistry, id: string): RegisteredDisplay | undefined {
  return registry.find((d) => d.id === id);
}

export interface EnabledDisplayEntry {
  id: string;
  file: string;
  definition: RegisteredDisplay;
  /** the persisted `cards.<id>` object (contains `enabled`). */
  config: unknown;
}

export function registryEnabledDisplays(
  registry: DisplayRegistry,
  config: ArteGitCardConfig,
): EnabledDisplayEntry[] {
  const cards = config.cards as unknown as Record<string, { enabled?: boolean } | undefined>;
  const out: EnabledDisplayEntry[] = [];
  for (const definition of registry) {
    const cardConfig = cards[definition.id];
    if (displayEnabledIn(config, definition.id)) {
      out.push({ id: definition.id, file: displayFilename(definition.id), definition, config: cardConfig });
    }
  }
  return out;
}

