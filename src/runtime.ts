/**
 * ArteRuntime — the compiled, immutable runtime of a Display registry (Phase 4).
 *
 * Everything display-shaped that a consumer needs is derived ONCE here:
 *
 *   - the static display set (`displays`), never extended at runtime;
 *   - the registry-composed v2 config schema (`config.v2Schema`);
 *   - the typed config-key registry (`config.settings`), i.e. the per-display
 *     lifecycle + autowired settings PLUS the non-display global keys;
 *   - registered display ids / card output filenames (path-authority metadata).
 *
 * Production binds the singleton `DEFAULT_RUNTIME` (compiled from the static
 * DISPLAY_REGISTRY). A test may build an ISOLATED runtime with
 * `createArteRuntime({ displays: [...] })`. A runtime is never created from
 * config/state.json/env/filesystem/repo — only from statically imported Display
 * modules.
 *
 * Display→config dependency stays one-directional:
 *   display schema → DisplayDefinition → registry → buildV2Schema → ArteRuntime.
 * Display definitions never import the full config.
 */

import type { ArteGitCardConfig } from "./config/types.js";
import type { ConfigKeySpec } from "./config/registry.js";
import { composeConfigKeys } from "./config/registry.js";
import { buildV2Schema } from "./config/v2.js";
import type { RegisteredDisplay } from "./display/definition.js";
import {
  DISPLAY_REGISTRY,
  assertValidRegistry,
  displayFilename,
  registryDisplayFilenames,
  registryDisplayIds,
  registryEnabledDisplays,
} from "./display/registry.js";
import type { DisplayRegistry, EnabledDisplayEntry } from "./display/registry.js";
import type { z } from "zod";

export type { DisplayRegistry };

export interface ArteRuntimeConfig {
  /** Registry-composed STRICT v2 config schema (unknown display ids fail). */
  readonly v2Schema: z.ZodType<ArteGitCardConfig>;
  /** Full typed config-key registry (display lifecycle/settings + globals). */
  readonly settings: readonly ConfigKeySpec[];
}

export interface ArteRuntime {
  /** The compiled display set, in deterministic order. Immutable. */
  readonly displays: DisplayRegistry;
  /** Derived config system (schema + typed key registry). Immutable. */
  readonly config: ArteRuntimeConfig;
  /** All registered display ids, in registry order (path/identity authority). */
  readonly cardIds: readonly string[];
  /** All registered card output filenames `${id}.svg` (kind-guard authority). */
  readonly cardFilenames: readonly string[];
  /** Look up a registered display by id. */
  findDisplay(id: string): RegisteredDisplay | undefined;
  /** Displays enabled by the current config, in registry order. */
  enabledDisplays(config: ArteGitCardConfig): EnabledDisplayEntry[];
}

/**
 * Compile a Display registry into an immutable ArteRuntime. Derives the v2
 * schema and the config-key registry at construction time; every derived value
 * is frozen. Nothing here reads config/state/fs/repo/env — the displays ARE the
 * runtime's authority.
 */
export function createArteRuntime(input: { displays: DisplayRegistry }): ArteRuntime {
  assertValidRegistry(input.displays);
  const displays: DisplayRegistry = Object.freeze([...input.displays].map((d) => Object.freeze(d)));
  const settings = composeConfigKeys(displays);
  // FH-6.D — every compiled full ConfigKeySpec.key must be globally unique. This
  // generically catches a future Display (`output.directory`, `auto-update`)
  // that would shadow a framework-global key — no ad-hoc reserved-name list.
  const seenKeys = new Set<string>();
  for (const spec of settings) {
    if (seenKeys.has(spec.key)) {
      throw new Error(
        `runtime: config-key collision on "${spec.key}" — a Display setting shadows a framework/other key. ` +
          `Use a distinct display id/setting name.`,
      );
    }
    seenKeys.add(spec.key);
  }
  const runtime: ArteRuntime = {
    displays,
    config: Object.freeze({
      v2Schema: buildV2Schema(displays),
      settings: Object.freeze(settings),
    }),
    cardIds: Object.freeze(registryDisplayIds(displays)),
    cardFilenames: Object.freeze(registryDisplayFilenames(displays)),
    findDisplay: (id) => displays.find((d) => d.id === id),
    enabledDisplays: (config) => registryEnabledDisplays(displays, config),
  };
  return Object.freeze(runtime);
}

/** Production runtime: always compiled from the package's static registry. */
export const DEFAULT_RUNTIME: ArteRuntime = createArteRuntime({ displays: DISPLAY_REGISTRY });

/** Output filename of a registered display id (`${id}.svg`). */
export function runtimeCardFile(id: string): string {
  return displayFilename(id);
}
