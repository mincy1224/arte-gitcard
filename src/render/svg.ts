/**
 * Canonical SVG serialization (plan.md P7/§72/§73): deterministic attribute
 * order, text/icon escaping, `round1` applied to layout floats at the boundary.
 */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Round layout floats to 1 decimal for stable output (plan.md §73). */
export function r1(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Round opacity floats to 2 decimals (preserves 0.16/0.03-style values). */
export function r2(value: number): string {
  return String(Math.round(value * 100) / 100);
}

type Attrs = Array<[string, string]>;

/** Build an element with fixed attribute insertion order. */
export function el(tag: string, attrs: Attrs, children = ""): string {
  const parts = attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
  return `<${tag}${parts}>${children}</${tag}>`;
}

/** `<rect .../>` in fixed order. */
export function rect(attrs: {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillOpacity?: number;
}): string {
  const a: Attrs = [
    ["x", r1(attrs.x)],
    ["y", r1(attrs.y)],
    ["width", r1(attrs.width)],
    ["height", r1(attrs.height)],
  ];
  if (attrs.rx !== undefined) a.push(["rx", r1(attrs.rx)]);
  if (attrs.fillOpacity !== undefined) a.push(["fill-opacity", r1(attrs.fillOpacity)]);
  if (attrs.fill !== undefined) a.push(["fill", attrs.fill]);
  if (attrs.stroke !== undefined) {
    a.push(["stroke", attrs.stroke]);
    if (attrs.strokeWidth !== undefined) a.push(["stroke-width", r1(attrs.strokeWidth)]);
  }
  return `<rect ${a.map(([k, v]) => `${k}="${v}"`).join(" ")}/>`;
}

/** `<text ...>` in fixed order. x/y/baseline always explicit (plan.md V0.1·A3). */
export function text(
  attrs: { x: number; y: number; className?: string; anchor?: "start" | "middle" | "end"; content: string },
): string {
  const a: Attrs = [
    ["x", r1(attrs.x)],
    ["y", r1(attrs.y)],
  ];
  if (attrs.className) a.push(["class", attrs.className]);
  if (attrs.anchor && attrs.anchor !== "start") a.push(["text-anchor", attrs.anchor]);
  return `<text ${a.map(([k, v]) => `${k}="${v}"`).join(" ")}>${escapeXml(attrs.content)}</text>`;
}
