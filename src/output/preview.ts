/** preview.html — embeds the generated SVGs inline (plan.md §70; never
 * re-implements rendering). */

import { escapeXml } from "../render/svg.js";

export function buildPreviewHtml(cards: Array<{ file: string; svg: string }>): string {
  const cardsHtml = cards
    .map(
      (c) =>
        `<div class="card"><div class="cap">${escapeXml(c.file)}</div>${c.svg}</div>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>arte-git-card · Preview</title>
<style>
  body{margin:32px;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
  h1{font-size:18px;color:#333}
  .card{display:inline-block;margin:12px;background:#fff;padding:18px;border-radius:20px;box-shadow:0 4px 18px rgba(0,0,0,.08);vertical-align:top}
  .cap{margin:0 0 12px;font-size:13px;font-weight:600;color:#555;font-family:ui-monospace,Menlo,Consolas,monospace}
</style>
</head>
<body>
<h1>arte-git-card · Preview</h1>
${cardsHtml}
</body>
</html>
`;
}
