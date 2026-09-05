/**
 * Golden generator (SPEC §9). Regenerates the frozen golden SVGs from the
 * PRODUCTION renderers using shared fixture JSON — no second hand-written
 * renderer, no string recolouring. Run intentionally:
 *
 *   npm run build && npm run golden:update
 *
 * Normal `npm test` only COMPARES production output against these frozen
 * goldens and never overwrites them.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCodebaseCard,
  layoutCodebase,
  renderCodebaseCard,
  buildTree,
  buildStructureData,
  layoutStructure,
  renderStructureCard,
  resolveTheme,
  DEFAULT_THEME,
  GITHUB_THEME,
  deriveTone,
} from "../../dist/index.js";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const arteDir = join(projectRoot, "tests", "golden", "baselines", "arte");
const githubDir = join(projectRoot, "tests", "golden", "baselines", "github-theme");
const fixturesDir = join(projectRoot, "tests", "golden", "fixtures");

const readFixture = (name) => JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));

const codebaseFixture = readFixture("codebase.json");
const structureFixtures = {
  7: readFixture("structure-7d.json"),
  14: readFixture("structure-14d.json"),
  30: readFixture("structure-30d.json"),
};

// ---- Production-driven card builders ----
function codebaseCard(fixture, includeComments, minCardWidth, theme) {
  const data = buildCodebaseCard(fixture, includeComments, theme.dataColors);
  const layout = layoutCodebase(data, { minCardWidth });
  return renderCodebaseCard(layout, theme);
}

function structureCard(fixture, theme) {
  // Production chain: raw fixture → model → layout → renderer (SPEC §9).
  // Whole-repo cards get the level-0 repository row (repoName), matching the
  // generation-time display.
  const tree = buildTree(
    fixture.files.map((p) => ({ absolutePath: p, relative: p })),
    ".",
    fixture.maxDepth,
  );
  const activity = {
    totalCommits: fixture.activity.totalCommits,
    byDir: new Map(Object.entries(fixture.activity.byDir)),
  };
  const data = buildStructureData(tree, activity, fixture.days, new Date(fixture.now), "example-repo");
  const layout = layoutStructure(data, { commits: true, changes: true });
  return renderStructureCard(layout, theme, fixture.analyzedSourceFiles);
}

// ---- Theme Palette reference card (colors from the theme + OKLCH tones) ----
function paletteSVG(theme, label) {
  const p = theme.palette;
  const pW = 680;
  const pL = 24;
  const uiTrack = (632 - 6 * 12) / 7;
  const uiRowH = 50;
  const uiTop = 64;
  const uiItems = [
    ["surface", p.surface],
    ["surface_muted", p.surface_muted],
    ["text", p.text],
    ["text_muted", p.text_muted],
    ["border_muted", p.border_muted],
    ["divider", p.divider],
    ["accent", p.accent],
    ["accent_soft", p.accent_soft],
    ["neutral", p.neutral],
    ["positive", p.positive],
    ["negative", p.negative],
  ]
    .map(([name, hex], idx) => {
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const x = pL + col * (uiTrack + 12);
      const y = uiTop + row * uiRowH;
      return `    <g transform="translate(${x} ${y})"><rect x="0" y="0" width="40" height="22" rx="4" fill="${hex}" stroke="${p.border_muted}" stroke-width="0.5"/><text x="0" y="33" class="pname">${name}</text><text x="0" y="43" class="phex">${hex}</text></g>`;
    })
    .join("\n");
  const uiBottom = uiTop + 2 * uiRowH;
  const famTrack = (632 - 3 * 14) / 4;
  const famRowH = 66;
  const famGap = 14;
  const famTop = uiBottom + 34;
  const famItems = p.data_palette.families
    .map((family, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = pL + col * (famTrack + famGap);
      const y = famTop + row * famRowH;
      const lift = deriveTone(family.base, "lift");
      const deep = deriveTone(family.base, "deep");
      return `    <g transform="translate(${x} ${y})">\n      <text x="0" y="0" class="fname">${family.name}</text>\n      <rect x="0" y="10" width="20" height="20" rx="4" fill="${lift}"/>\n      <rect x="24" y="10" width="20" height="20" rx="4" fill="${family.base}"/>\n      <rect x="48" y="10" width="20" height="20" rx="4" fill="${deep}"/>\n      <text x="0" y="42" class="phex">${family.base}</text>\n    </g>`;
    })
    .join("\n");
  const famBottom = famTop + Math.ceil(p.data_palette.families.length / 4) * famRowH;
  const pCardH = famBottom + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pW}" height="${pCardH}" viewBox="0 0 ${pW} ${pCardH}" role="img" aria-labelledby="pg-title pg-desc">
  <title id="pg-title">arte-git-card · Theme Palette</title>
  <desc id="pg-desc">The ${label} theme: UI colors and the 12-family data palette (lift / base / deep, OKLCH-derived).</desc>
  <style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${p.text};text-rendering:geometricPrecision}
    .label{font-size:12px;font-weight:500;letter-spacing:0.08em;fill:${p.text_muted}}
    .pname{font-size:9px;font-weight:600}
    .phex{font-size:8px;fill:${p.text_muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .fname{font-size:10px;font-weight:700}
  </style>
  <rect x="0.5" y="0.5" width="${pW - 1}" height="${pCardH - 1}" rx="16" fill="${p.surface}" stroke="${p.border_muted}"/>
  <text x="24" y="38" class="label">THEME PALETTE · ${label}</text>
  <text x="24" y="${uiTop - 12}" class="label">UI PALETTE</text>
  ${uiItems}
  <text x="24" y="${famTop - 14}" class="label">DATA PALETTE · 12 FAMILIES / 3 TONES</text>
  ${famItems}
</svg>
`;
}

// ---- arte baselines (authoritative visuals used by golden tests) ----
const arteTheme = resolveTheme(DEFAULT_THEME);
mkdirSync(arteDir, { recursive: true });
const arteFiles = {
  "codebase-golden.svg": codebaseCard(codebaseFixture, false, 680, arteTheme),
  "codebase-golden-comments.svg": codebaseCard(codebaseFixture, true, 680, arteTheme),
  "codebase-golden-wide.svg": codebaseCard(codebaseFixture, false, 920, arteTheme),
  "structure-7d.svg": structureCard(structureFixtures[7], arteTheme),
  "structure-14d.svg": structureCard(structureFixtures[14], arteTheme),
  "structure-30d.svg": structureCard(structureFixtures[30], arteTheme),
  "palette-golden.svg": paletteSVG(arteTheme, "arte-theme"),
};
for (const [file, svg] of Object.entries(arteFiles)) {
  writeFileSync(join(arteDir, file), svg, "utf8");
  console.log(`wrote tests/golden/baselines/arte/${file}`);
}

// ---- github-theme baselines (production-rendered with GITHUB_THEME) ----
const githubTheme = resolveTheme(GITHUB_THEME);
mkdirSync(githubDir, { recursive: true });
const githubFiles = {
  "codebase.svg": codebaseCard(codebaseFixture, false, 680, githubTheme),
  "codebase-comments.svg": codebaseCard(codebaseFixture, true, 680, githubTheme),
  "codebase-wide.svg": codebaseCard(codebaseFixture, false, 920, githubTheme),
  "structure-7d.svg": structureCard(structureFixtures[7], githubTheme),
  "structure-14d.svg": structureCard(structureFixtures[14], githubTheme),
  "structure-30d.svg": structureCard(structureFixtures[30], githubTheme),
  "palette.svg": paletteSVG(githubTheme, "github-theme"),
};
for (const [file, svg] of Object.entries(githubFiles)) {
  writeFileSync(join(githubDir, file), svg, "utf8");
  console.log(`wrote tests/golden/baselines/github-theme/${file}`);
}
