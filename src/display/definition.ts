/**
 * DisplayDefinition — a user-facing Card. A display owns its presentation plus a
 * TYPED config descriptor; it never imports the full v2/app config. Output PATH
 * authority derives from the id (`${id}.svg`), never an arbitrary output path.
 */

import { z } from "zod";
import type { DisplayContext } from "./types.js";
import type { DisplaySetting } from "./settings.js";
import { renderSvg } from "./template/runtime.js";
import type { VNode, SvgNode } from "./template/runtime.js";
import { SVG_NS } from "./template/policy.js";
import { deepCloneJson } from "../util/readonly.js";

/** Canonical SVG XML namespace (framework-injected on every safe <svg>). */
export { SVG_NS };

export interface DisplayConfig<C> {
  /** Strict schema of the persisted `cards.<id>` object (INCLUDING `enabled`). */
  readonly schema: z.ZodType<C>;
  /** Returns a FRESH deep clone of the ONE canonical defaults snapshot captured at freezeConfig time. */
  readonly defaults: () => C;
  /** True only for Displays required by schema-v2 since 1.0 (codebase, structure); others are optional. */
  readonly requiredInSchemaV2: boolean;
  /** Typed user settings. `enabled` is ALWAYS framework-managed (add/remove). */
  readonly settings: readonly DisplaySetting<C>[];
}

/** A SAFE template: returns an SvgNode tree that the framework serializes. */
export type SvgTemplate<C> = (ctx: DisplayContext<C>) => SvgNode;
/** A LEGACY template: returns raw SVG string (frozen built-in renderers only). */
export type LegacyStringTemplate<C> = (ctx: DisplayContext<C>) => string;

export type DisplayRenderer<C> =
  | { readonly kind: "svg"; readonly template: SvgTemplate<C> }
  | { readonly kind: "legacy-string"; readonly template: LegacyStringTemplate<C> };

export interface DisplayDefinition<C> {
  readonly id: string;
  /** Human title (card list / snippet alt text). */
  readonly title: string;
  readonly config: DisplayConfig<C>;
  /**
   * Presentation: `kind: "svg"` is a PURE context→SvgNode function (renderSvg
   * enforces escaping/allowlist/event/href policy centrally); `kind:
   * "legacy-string"` is a NARROW escape hatch for byte-locked renderers only.
   */
  readonly render: DisplayRenderer<C>;
}

/** Authoring input for a SAFE Display (`defineDisplay`). */
export interface SafeDisplayInput<C> {
  id: string;
  title: string;
  config: DisplayConfig<C>;
  /** Returns a safe SvgNode tree. MUST be pure + deterministic; no fs/state/git. */
  template: SvgTemplate<C>;
}

/**
 * Capture the ONE canonical defaults snapshot: `defaults()` runs EXACTLY ONCE,
 * deep-cloned into a private `canonical`. Every later `defaults()` returns a
 * fresh clone, so a mutable/nondeterministic closure cannot cause drifting
 * defaults and no caller can corrupt the canonical value.
 */
function freezeConfig<C>(config: DisplayConfig<C>): DisplayConfig<C> {
  const canonical = deepCloneJson(config.defaults() as object);
  return Object.freeze({
    ...config,
    defaults: () => deepCloneJson(canonical) as C,
    settings: Object.freeze(config.settings.map((s) => Object.freeze({ ...s }))),
  });
}

function freezeDefinition<C>(
  definition: Omit<DisplayDefinition<C>, "config" | "render"> & {
    config: DisplayConfig<C>;
    render: DisplayRenderer<C>;
  },
): DisplayDefinition<C> {
  return Object.freeze({
    id: definition.id,
    title: definition.title,
    config: freezeConfig(definition.config),
    render: Object.freeze({ ...definition.render }),
  });
}

/** Normal Display authoring API. Template returns an SvgNode — never a raw string, so the safety policy can't be bypassed. */
export function defineDisplay<C>(definition: SafeDisplayInput<C>): DisplayDefinition<C> {
  return freezeDefinition({
    id: definition.id,
    title: definition.title,
    config: definition.config,
    render: Object.freeze({ kind: "svg", template: definition.template } as const),
  });
}

/** Authoring input for the LEGACY byte-locked string renderers. */
export interface LegacyDisplayInput<C> {
  id: string;
  title: string;
  config: DisplayConfig<C>;
  /** Returns an already-serialized SVG string (existing legacy renderer). */
  template: LegacyStringTemplate<C>;
}

/** NARROW legacy adapter for the codebase/structure Displays ONLY; new Displays MUST use `defineDisplay`. */
export function defineLegacySvgDisplay<C>(definition: LegacyDisplayInput<C>): DisplayDefinition<C> {
  return freezeDefinition({
    id: definition.id,
    title: definition.title,
    config: definition.config,
    render: Object.freeze({ kind: "legacy-string", template: definition.template } as const),
  });
}

/** Registry storage form (authoring stays generic; registry is the boundary). */
export type RegisteredDisplay = DisplayDefinition<any>;

/** Safe output must be EXACTLY ONE root `<svg>`; the framework injects the canonical xmlns so an external one can't be authored. */
function prepareSvgRoot(node: SvgNode): VNode {
  if (!node || typeof node !== "object" || node.tag !== "svg") {
    throw new Error("template policy: a safe Display template must return exactly one root <svg> node");
  }
  // FH-4.G — the framework owns the root namespace: it always injects the
  // canonical SVG xmlns, so a template can never author an external namespace.
  return { ...node, props: { ...node.props, xmlns: SVG_NS } };
}

/** Render to artifact bytes: safe `svg` through the serializer; `legacy-string` passes through unchanged. */
export function displayArtifactContent<C>(definition: DisplayDefinition<C>, ctx: DisplayContext<C>): string {
  const render = definition.render;
  if (render.kind === "legacy-string") return render.template(ctx);
  return renderSvg(prepareSvgRoot(render.template(ctx)));
}

export function displayCardRecordOf(config: { cards: Record<string, unknown> }): Record<string, unknown> {
  return config.cards;
}

export function persistedCardSliceOf(config: { cards: Record<string, unknown> }, id: string): unknown {
  return config.cards[id];
}

/** Effective display config: persisted block as-is, or defaults for an absent OPTIONAL display. Read-only — never materializes. */
export function resolveDisplayConfig<C>(config: { cards: Record<string, unknown> }, definition: DisplayDefinition<C>): C {
  const persisted = config.cards[definition.id];
  if (persisted !== undefined) return persisted as C;
  return freshDisplayDefaults(definition);
}

/**
 * Always a FRESH DEEP CLONE of the freeze-time canonical snapshot: two
 * resolutions never share nested references and mutating one cannot corrupt
 * future defaults. Double clone is belt-and-braces for pre-freeze definitions.
 */
export function freshDisplayDefaults<C>(definition: DisplayDefinition<C>): C {
  return deepCloneJson(definition.config.defaults() as object) as C;
}

/** Framework-managed enabled flag (absent optional display → disabled). Never materializes. */
export function displayEnabledIn(config: { cards: Record<string, unknown> }, id: string): boolean {
  const slice = config.cards[id] as { enabled?: boolean } | undefined;
  return slice?.enabled === true;
}

/** Ensure `cards.<id>` exists (materializing defaults) and return the LIVE block for in-place mutation. Called only on a true mutation. */
export function ensureDisplayCardSlice<C>(
  config: { cards: Record<string, unknown> },
  definition: DisplayDefinition<C>,
): C {
  const existing = config.cards[definition.id];
  if (existing !== undefined) return existing as C;
  const created = freshDisplayDefaults(definition);
  config.cards[definition.id] = created;
  return created;
}
