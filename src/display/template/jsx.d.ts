/**
 * JSX typing for internal Display `.tsx` templates. TSX is AUTHORING syntax only:
 * tsconfig `"jsx": "react"` + `"jsxFactory": "h"` compile it to the internal safe
 * factory — no React runtime ships. `h` comes from `./runtime.js`; the framework
 * serializes every element through `renderSvg`, enforcing the policy centrally.
 */

import type { SvgNode, TemplateChildInput } from "./runtime.js";

/** Attribute typing is deliberately permissive — the SERIALIZER policy validates attributes at runtime. */
type SvgProps = { children?: TemplateChildInput | TemplateChildInput[] } & Record<string, unknown>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      svg: SvgProps;
      g: SvgProps;
      defs: SvgProps;
      linearGradient: SvgProps;
      radialGradient: SvgProps;
      stop: SvgProps;
      rect: SvgProps;
      circle: SvgProps;
      ellipse: SvgProps;
      line: SvgProps;
      polyline: SvgProps;
      polygon: SvgProps;
      path: SvgProps;
      text: SvgProps;
      tspan: SvgProps;
      clipPath: SvgProps;
      mask: SvgProps;
      title: SvgProps;
      desc: SvgProps;
    }
    interface Element extends SvgNode {}
    interface ElementChildrenAttribute {
      children: TemplateChildInput | TemplateChildInput[];
    }
  }
}

export {};
