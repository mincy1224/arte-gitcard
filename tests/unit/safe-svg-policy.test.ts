/**
 * FH-4: safe-SVG serializer external-resource / attribute boundary. The safe
 * template runtime enforces the conservative policy centrally; the byte-locked
 * legacy renderers bypass it and are NOT affected.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { h, renderSvg } from "../../src/display/template/runtime.js";
import { displayArtifactContent, defineDisplay } from "../../src/display/definition.js";
import { SVG_NS } from "../../src/display/definition.js";
import type { DisplayContext } from "../../src/display/types.js";

function safeDisplayTemplate(template: () => ReturnType<typeof h>) {
  return defineDisplay<{ enabled: boolean }>({
    id: "probe-card",
    title: "Probe",
    config: {
      schema: z.object({ enabled: z.boolean() }).strict() as z.ZodType<{ enabled: boolean }>,
      defaults: () => ({ enabled: false }),
      requiredInSchemaV2: false,
      settings: [],
    },
    template: template as never,
  });
}
const ctx = {} as DisplayContext<{ enabled: boolean }>;

describe("FH-4 safe-SVG serializer boundary", () => {
  it("rejects the style ATTRIBUTE", () => {
    expect(() => renderSvg(h("rect", { style: "fill:red" }))).toThrow(/style.*forbidden/i);
  });

  it("rejects the <style> ELEMENT (removed from the safe whitelist)", () => {
    expect(() => renderSvg(h("style", null, "rect { fill:red }"))).toThrow(/not allowed/i);
  });

  it("rejects external / data / protocol-relative url() in attribute values", () => {
    expect(() => renderSvg(h("rect", { fill: "url(https://evil.example/x.svg)" }))).toThrow(/url\(\)/i);
    expect(() => renderSvg(h("rect", { fill: "url(data:image/svg+xml;base64,xxxx)" }))).toThrow(/url\(\)/i);
    expect(() => renderSvg(h("rect", { filter: "url(//evil.example/f.svg#x)" }))).toThrow(/url\(\)/i);
  });

  it("allows only a LOCAL fragment url(#local-id)", () => {
    const out = renderSvg(h("rect", { fill: "url(#grad)" }));
    expect(out).toContain('fill="url(#grad)"');
    expect(() => renderSvg(h("rect", { fill: "url(#bad id)" }))).toThrow(/url\(\)/i);
  });

  it("rejects a hostile attribute NAME (quote/space/`<`) before serialization", () => {
    expect(() => renderSvg(h("rect", { ["evil name"]: "1" }))).toThrow(/attribute name/i);
    expect(() => renderSvg(h("rect", { ['x" onload="x']: "1" }))).toThrow(/attribute name/i);
  });

  it("rejects event attributes and keeps hostile TEXT escaped", () => {
    expect(() => renderSvg(h("rect", { onclick: "evil()" }))).toThrow(/event attribute/i);
    const evil = '<script>alert(1)</script> & "q"';
    const out = renderSvg(h("text", null, evil));
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("a safe Display must return exactly one root <svg> node", () => {
    const bad = safeDisplayTemplate(() => h("g", null));
    expect(() => displayArtifactContent(bad, ctx)).toThrow(/root <svg>/i);
    const good = safeDisplayTemplate(() => h("svg", { viewBox: "0 0 1 1" }, h("rect", { width: "1", height: "1" })));
    expect(displayArtifactContent(good, ctx)).toMatch(/^<svg/);
  });

  it("the framework injects the canonical SVG xmlns on safe roots", () => {
    const display = safeDisplayTemplate(() => h("svg", null, h("title", null, "x")));
    const out = displayArtifactContent(display, ctx);
    expect(out).toContain(`xmlns="${SVG_NS}"`);
    // never a user-supplied external namespace
    const hostile = safeDisplayTemplate(() =>
      h("svg", { xmlns: "http://evil.example/ns" } as Record<string, unknown> as never),
    );
    expect(displayArtifactContent(hostile, ctx)).toContain(`xmlns="${SVG_NS}"`);
    expect(displayArtifactContent(hostile, ctx)).not.toContain("evil.example");
  });
});
