/**
 * SAFE TSX Display template (Phase 5 contract). TSX is AUTHORING syntax only:
 * tsconfig/vitest/tsup compile it to the internal `h` factory — there is no
 * React/jsx-runtime in the artifact. `h` MUST be imported into scope (classic
 * jsxFactory). The template returns an SvgNode tree; the framework serializes it
 * through renderSvg (escaping + element allowlist + event/href policy).
 */

import { h } from "../../../src/display/template/runtime.js";
import type { SvgNode } from "../../../src/display/template/runtime.js";

export interface CompactTemplateProps {
  /** Text rendered into <title> + a <text> (tests escaping). */
  heading: string;
  /** Reused codebase statistic result (single scan/analyze per generation). */
  analyzed: number;
}

const SAMPLE = ["one", "two", "three"];

/** Renders <svg>… with an array-mapped <g> to prove JSX children flatten. */
export function CompactSvg(props: CompactTemplateProps): SvgNode {
  return (
    <svg viewBox="0 0 320 160" role="img">
      <title>{props.heading}</title>
      <text x="8" y="24" fill="currentColor">
        {props.heading}
      </text>
      <g>
        {SAMPLE.map((s) => (
          <text x="12" y={40 + 16 * SAMPLE.indexOf(s)} fill="currentColor">
            {s}
          </text>
        ))}
      </g>
      <text x="8" y="150" fill="currentColor">
        analyzed={props.analyzed}
      </text>
    </svg>
  );
}
