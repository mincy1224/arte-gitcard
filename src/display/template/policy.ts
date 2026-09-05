/**
 * Safe SVG template security policy (serialize-time):
 *  - element whitelist, no event attrs (/^on/i), no `style`, no external
 *    url(...)/href — only local `#fragment`s — and values are always escaped.
 *
 * The byte-locked legacy renderers do NOT pass through this policy.
 */

/** Canonical SVG XML namespace — the ONLY allowed xmlns value on safe roots. */
export const SVG_NS = "http://www.w3.org/2000/svg";

/** Elements a SAFE Display template may emit. `<style>` is intentionally absent. */
export const SVG_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "clipPath",
  "mask",
  "title",
  "desc",
]);

const EVENT_ATTR_RE = /^on/i;

/**
 * Strict XML-ish attribute-name grammar. A hostile object key containing quotes,
 * spaces, `<`, or `=` can never break the ` name="value"` serialization.
 */
const ATTR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

/** A local fragment name (safe id: letters/digits/._-). */
const FRAGMENT_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

/** URL-ish attributes that must only ever carry a local "#fragment". */
const URL_ATTRS = new Set(["href", "xlink:href", "xlinkHref"]);

/** Reject these schemes anywhere (caught via url()/scheme scans). */
const FORBIDDEN_PROTOCOLS = new Set([
  "http",
  "https",
  "javascript",
  "file",
  "data",
  "vbscript",
  "blob",
  "ftp",
]);

function isForbiddenScheme(text: string): boolean {
  const schemeMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(text.trim());
  if (!schemeMatch) return false;
  return FORBIDDEN_PROTOCOLS.has(schemeMatch[0].slice(0, -1).toLowerCase());
}

export function assertAllowedElement(tag: string): void {
  if (!SVG_ELEMENTS.has(tag)) {
    throw new Error(`template policy: element <${tag}> is not allowed in a safe Display SVG`);
  }
}

/**
 * Validate an attribute name/value. Throws on any policy violation.
 * Order matters: names first (so a hostile key can never be serialized), then
 * value-level url()/scheme/fragment checks.
 */
export function assertSafeAttribute(tag: string, name: string, value: string): void {
  assertAllowedElement(tag);
  if (!ATTR_NAME_RE.test(name)) {
    throw new Error(`template policy: attribute name "${name}" is not a safe XML name`);
  }
  if (EVENT_ATTR_RE.test(name)) {
    throw new Error(`template policy: event attribute "${name}" is forbidden`);
  }
  if (name === "style") {
    throw new Error('template policy: the "style" attribute is forbidden in safe Display templates');
  }
  if (name === "xmlns") {
    // Narrow exception (FH-4.G): only the canonical SVG namespace is legal; the
    // framework injects it and a template may never author an external namespace.
    if (value !== SVG_NS) {
      throw new Error('template policy: xmlns must be the canonical SVG namespace (framework-owned)');
    }
    return;
  }
  if (URL_ATTRS.has(name)) {
    if (!value.startsWith("#")) {
      throw new Error(`template policy: ${name} must be a local "#fragment", got "${name}=${value}"`);
    }
    if (!FRAGMENT_RE.test(value.slice(1))) {
      throw new Error(`template policy: ${name} fragment is not a safe local name`);
    }
    return;
  }
  // Conservative URL scan: url(...) may only reference a local fragment.
  for (const m of value.matchAll(/url\(\s*([^)]*)\s*\)/g)) {
    const inner = m[1]!.trim();
    if (inner.startsWith("#")) {
      if (FRAGMENT_RE.test(inner.slice(1))) continue;
      throw new Error(`template policy: url() fragment "${inner}" is not a safe local name`);
    }
    throw new Error(`template policy: url() must reference a LOCAL fragment, got "${inner}"`);
  }
  if (isForbiddenScheme(value)) {
    throw new Error(`template policy: forbidden URL scheme in attribute ${name}`);
  }
  // Reject protocol-relative / comments-in-value leftovers conservatively.
  if (value.includes("//")) {
    throw new Error(`template policy: protocol-relative "//" is not allowed in attribute ${name}`);
  }
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
