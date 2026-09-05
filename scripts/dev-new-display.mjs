#!/usr/bin/env node
/**
 * arte-gitcard INTERNAL developer scaffolder (NOT a user command, NOT runtime
 * discovery). Prints a ready-to-paste scaffold for a new SAFE TSX Display and
 * the single registration line for the static registry. It never edits files
 * and never discovers anything at runtime — the registry stays a closed,
 * hand-reviewed list.
 *
 *   pnpm dev:new-display <id>
 *
 * The scaffold is the REAL internal DX contract: definition → presenter →
 * template.tsx, where the template returns a SAFE SvgNode (TSX compiled to the
 * internal `h` factory) and reuses read-only Statistics. It NEVER generates a
 * legacy raw-string display, never touches fs/git/state/runtime, and every
 * identifier it emits is valid TypeScript for the kebab-case id.
 */

const RE = /^[a-z][a-z0-9-]{0,47}$/;

function pascal(id) {
  return id
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ""))
    .join("");
}
function camel(id) {
  const p = pascal(id);
  return p ? p[0].toLowerCase() + p.slice(1) : "";
}

function scaffoldFor(id) {
  if (!RE.test(id)) {
    throw new Error(`usage: pnpm dev:new-display <id>   (id must match ${RE})`);
  }
  const Cap = pascal(id); // LanguagesCompact
  const low = camel(id); // languagesCompact

  const lines = [
    `Create these files, then register the display (one line in src/display/registry.ts):`,
    ``,
    `  src/display/builtin/${id}/definition.ts`,
    `  src/display/builtin/${id}/config.ts`,
    `  src/display/builtin/${id}/presenter.ts`,
    `  src/display/builtin/${id}/template.tsx`,
    `  src/display/builtin/${id}/template.test.ts`,
    ``,
    `config.ts — the Display's OWN typed config descriptor (never the full config):`,
    `  import { z } from "zod";`,
    `  export interface ${Cap}CardConfig { enabled: boolean; }`,
    `  export const ${low}Schema = z.object({ enabled: z.boolean() }).strict();`,
    `  export const ${low}Defaults = (): ${Cap}CardConfig => ({ enabled: false });`,
    ``,
    `definition.ts — SAFE defineDisplay (the template returns an SvgNode, never a raw SVG string):`,
    `  import { z } from "zod";`,
    `  import { defineDisplay } from "../../definition.js";`,
    `  import type { SvgNode } from "../../template/runtime.js";`,
    `  import type { DisplayContext } from "../../types.js";`,
    `  import { render${Cap} } from "./presenter.js";`,
    `  import { ${low}Schema, ${low}Defaults } from "./config.js";`,
    `  import type { ${Cap}CardConfig } from "./config.js";`,
    `  export const ${low}Display = defineDisplay<${Cap}CardConfig>({`,
    `    id: "${id}",`,
    `    title: "${id}",`,
    `    config: {`,
    `      schema: ${low}Schema as z.ZodType<${Cap}CardConfig>,`,
    `      defaults: ${low}Defaults,`,
    `      requiredInSchemaV2: false,`,
    `      settings: [],`,
    `    },`,
    `    template: (ctx: DisplayContext<${Cap}CardConfig>): SvgNode => render${Cap}(ctx),`,
    `  });`,
    ``,
    `presenter.ts — read-only statistics only (repository data arrives ONLY here):`,
    `  import type { DisplayContext } from "../../types.js";`,
    `  import type { SvgNode } from "../../template/runtime.js";`,
    `  import { codebaseStatistics } from "../../../statistics/index.js";`,
    `  import { ${Cap}Svg } from "./template";`,
    `  import type { ${Cap}CardConfig } from "./config.js";`,
    `  export function render${Cap}(ctx: DisplayContext<${Cap}CardConfig>): SvgNode {`,
    `    const codebase = ctx.statistics.get(codebaseStatistics);`,
    `    return ${Cap}Svg({ analyzed: codebase.analyzedSourceFiles });`,
    `  }`,
    ``,
    `template.tsx — AUTHORING-ONLY JSX compiled to the internal \`h\` factory:`,
    `  import { h } from "../../template/runtime.js";`,
    `  import type { SvgNode } from "../../template/runtime.js";`,
    `  export interface ${Cap}Props { analyzed: number; }`,
    `  export function ${Cap}Svg(props: ${Cap}Props): SvgNode {`,
    `    return (`,
    `      <svg viewBox="0 0 640 120" role="img">`,
    `        <title>${id}</title>`,
    `        <text x="10" y="30" fill="currentColor">${id}</text>`,
    `        <text x="10" y="90" fill="currentColor">files={props.analyzed}</text>`,
    `      </svg>`,
    `    );`,
    `  }`,
    ``,
    `REGISTER (append to DISPLAY_REGISTRY in src/display/registry.ts):`,
    `  import { ${low}Display } from "./builtin/${id}/definition.js";`,
    `  export const DISPLAY_REGISTRY = Object.freeze([... , ${low}Display]);`,
    ``,
    `The output filename is derived as "${id}.svg". add/remove/list/snippet/`,
    `completion/detect/path-guard/config-keys pick it up from the registry`,
    `automatically — NO lifecycle/state/txn/github/CLI changes needed.`,
    ``,
    `Rules: template returns SvgNode (never a raw string); no fs/child_process/`,
    `state/git/scanner/activity/analyze imports; no Date.now()/new Date() (use`,
    `ctx.now); no React/Vue/Svelte; deterministic output only.`,
  ];
  return lines.join("\n") + "\n";
}

// CLI entry.
if (process.argv[1] && process.argv[1].endsWith("dev-new-display.mjs")) {
  const id = process.argv[2];
  try {
    process.stdout.write(scaffoldFor(id));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

export { scaffoldFor };
