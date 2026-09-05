/**
 * Internal TSX/SVG template runtime — determinism + security policy (Phase 5).
 */

import { describe, expect, it } from "vitest";
import { h, renderSvg, formatNumber } from "../../src/display/template/runtime.js";

describe("template runtime", () => {
  it("renders a deterministic SVG tree (LF, no whitespace between elements)", () => {
    const out = renderSvg(
      h("svg", { viewBox: "0 0 10 10", width: "10" },
        h("title", null, "t"),
        h("rect", { x: 1, y: 2, width: 3, height: 4, fill: "#fff" }),
      ),
    );
    expect(out).toBe(
      '<svg viewBox="0 0 10 10" width="10"><title>t</title><rect fill="#fff" height="4" width="3" x="1" y="2"></rect></svg>',
    );
    expect(out).not.toContain("\n");
    expect(renderSvg(h("svg", null))).toBe(renderSvg(h("svg", null))); // deterministic
  });

  it("attributes are emitted in sorted order regardless of author order", () => {
    const a = renderSvg(h("rect", { y: 1, x: 2, fill: "red", id: "z" }));
    const b = renderSvg(h("rect", { id: "z", fill: "red", x: 2, y: 1 }));
    expect(a).toBe(b);
  });

  it("escapes text nodes and attribute values", () => {
    const evil = '</svg><script>alert(1)</script>';
    const out = renderSvg(h("text", null, `user <${evil}> & "quotes"`));
    expect(out).toContain("&lt;");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain(evil);
  });

  it("policy rejects <script>, <foreignObject> and unknown elements", () => {
    expect(() => renderSvg(h("script", null, "x"))).toThrow(/not allowed/i);
    expect(() => renderSvg(h("foreignObject", null))).toThrow(/not allowed/i);
    expect(() => renderSvg(h("div", null))).toThrow(/not allowed/i);
  });

  it("policy rejects event attributes (on*), external resources and dangerous hrefs", () => {
    expect(() => renderSvg(h("rect", { onclick: "x()" }))).toThrow(/event attribute/i);
    expect(() => renderSvg(h("rect", { onload: "x()" }))).toThrow(/event attribute/i);
    expect(() => renderSvg(h("notAnElement", {}))).toThrow(/not allowed/i);
    expect(() => renderSvg(h("rect", { href: "https://evil/x" }))).toThrow(/fragment|scheme/i);
    expect(() => renderSvg(h("rect", { href: "javascript:alert(1)" }))).toThrow(/fragment|scheme/i);
    // fragment-only href IS allowed
    expect(renderSvg(h("rect", { href: "#grad" }))).toContain('href="#grad"');
  });

  it("formatNumber is deterministic (integers trimmed, floats rounded)", () => {
    expect(formatNumber(12)).toBe("12");
    expect(formatNumber(12.5)).toBe("12.5");
    expect(formatNumber(1 / 3)).toBe("0.333");
  });
});
