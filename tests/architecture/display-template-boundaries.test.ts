/**
 * Phase 5 template boundaries:
 *  - the LEGACY raw-string adapter (defineLegacySvgDisplay) is restricted to the
 *    two byte-locked built-ins (codebase, structure) — new/scaffolded Displays
 *    must use the safe `defineDisplay` (SvgNode);
 *  - no display builtin may import a browser/frontend runtime (react/vue/svelte);
 *  - no display builtin may reference a raw-HTML/SVG escape hatch
 *    (dangerouslySetInnerHTML / rawSvg / unsafeHtml / rawHtml).
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const abs = path.join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(abs);
    }
  };
  walk(dir);
  return out;
}

const builtinFiles = collectFiles(path.join(srcRoot, "display", "builtin"));

describe("Display template boundaries (Phase 5)", () => {
  it("only codebase + structure may use the legacy raw-string adapter", () => {
    const users = builtinFiles
      .filter((f) => readFileSync(f, "utf8").includes("defineLegacySvgDisplay"))
      .map((f) => path.relative(srcRoot, f).replace(/\\/g, "/"))
      .sort();
    expect(users).toEqual([
      "display/builtin/codebase/definition.ts",
      "display/builtin/structure/definition.ts",
    ]);
  });

  it("no display builtin imports a browser/frontend runtime", () => {
    for (const file of builtinFiles) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      for (const framework of ["react", "preact", "vue", "svelte", "react-dom", "react/jsx"]) {
        expect(
          text.includes(`from "${framework}`) || text.includes(`from '${framework}`),
          `${rel} must not import ${framework} (TSX is authoring syntax only)`,
        ).toBe(false);
      }
    }
  });

  it("no display builtin references a raw HTML/SVG escape hatch", () => {
    for (const file of builtinFiles) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      for (const token of ["dangerouslySetInnerHTML", "rawSvg", "rawHtml", "unsafeHtml"]) {
        expect(text.includes(token), `${rel} must not expose a raw ${token} escape hatch`).toBe(false);
      }
    }
  });
});
