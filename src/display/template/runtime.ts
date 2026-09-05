/**
 * Deterministic SVG template runtime (internal; for FUTURE Displays): a tiny
 * element-tree serializer with a strict security policy — no React/browser
 * framework. Existing Codebase/Structure displays are NOT migrated here.
 *
 * Determinism: attribute order is sorted; numbers via String(); LF endings.
 */

import { assertAllowedElement, assertSafeAttribute, escapeAttr, escapeText } from "./policy.js";

export type TemplateChild = VNode | string | number | null | undefined | boolean;

export type SvgNode = VNode;

/** Authoring form of a child: may be (recursively) an array of children (JSX maps). */
export type TemplateChildInput = TemplateChild | TemplateChildInput[];

export interface VNode {
  tag: string;
  props: Record<string, string | number | undefined>;
  children: TemplateChild[];
}

function flattenChildren(input: readonly TemplateChildInput[]): TemplateChild[] {
  const out: TemplateChild[] = [];
  const push = (child: TemplateChildInput): void => {
    if (Array.isArray(child)) {
      for (const c of child) push(c);
    } else {
      out.push(child);
    }
  };
  for (const c of input) push(c);
  return out;
}

/** Create an element node (JSX factory — `.tsx` templates compile to `h`). */
export function h(
  tag: string | ((props: Record<string, unknown>) => VNode),
  props: Record<string, unknown> | null,
  ...children: TemplateChildInput[]
): VNode {
  if (typeof tag === "function") {
    // FC-6: JSX children of a function component are flattened and passed through
    // `props.children` so `<Group><text/></Group>` renders the nested content.
    const element = tag({ ...(props ?? {}), children: flattenChildren(children) });
    return element;
  }
  const outProps: Record<string, string | number | undefined> = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      outProps[k] = typeof v === "boolean" ? (v ? "true" : "false") : (v as string | number);
    }
  }
  return { tag, props: outProps, children: flattenChildren(children) };
}

export function renderSvg(root: TemplateChild | TemplateChild[]): string {
  return (Array.isArray(root) ? root : [root]).map(renderNode).join("");
}

function renderNode(node: TemplateChild): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    return escapeText(String(node));
  }
  const { tag, props, children } = node;
  assertAllowedElement(tag);
  const names = Object.keys(props).sort();
  let attrs = "";
  for (const name of names) {
    const value = props[name];
    if (value === undefined) continue;
    const text = typeof value === "number" ? String(value) : value;
    assertSafeAttribute(tag, name, text);
    attrs += ` ${name}="${escapeAttr(text)}"`;
  }
  const inner = children.map(renderNode).join("");
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}
