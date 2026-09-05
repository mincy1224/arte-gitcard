/**
 * Theme manager unit tests (P0): single .yml model, partial override merge +
 * strict validation, duplicate refusal, preset materialization, transactional
 * select (config + regenerate together — no half state), selected-removal
 * refusal, modified/unowned preserve, ownership entries.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  installTheme,
  selectTheme,
  removeTheme,
  installedThemes,
  themeBodyFor,
  validateThemeFile,
  THEME_PRESETS,
} from "../../src/thememgr/index.js";
import { loadConfig } from "../../src/config/load.js";
import { loadTheme } from "../../src/theme/load.js";
import { resolveTheme } from "../../src/theme/resolve.js";
import { makeV2Repo, seedHealthyRepo } from "../helpers/repo.js";
import { okState } from "../helpers/repo.js";
import { readState } from "../../src/state/registry.js";
import { sha256File } from "../../src/fs/hash.js";
import { GITHUB_THEME } from "../../src/theme/github-theme.js";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agc-theme-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function load(root: string) {
  const loaded = loadConfig(path.join(root, "arte-gitcard.yml"));
  return { loaded, theme: resolveTheme(loadTheme(loaded.config.theme, root)) };
}

const PARTIAL = "name: tokyo-night\npalette:\n  accent: \"#1A1B1E\"\n";

describe("theme install", () => {
  it("installs a PARTIAL theme (merged + strict-validated), records ownership, no overwrite on duplicate", () => {
    const root = seedHealthyRepo(temp()).root;
    const file = path.join(temp(), "tokyo-night.yml");
    writeFileSync(file, PARTIAL, "utf8");
    const res = installTheme(root, file);
    expect(res.name).toBe("tokyo-night");
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(true);
    // ownership entry present (kind theme)
    const state = okState(readState(root));
    expect(state.managedFiles.some((e) => e.path.endsWith("tokyo-night.yml") && e.kind === "theme")).toBe(true);
    // the stored file is the raw partial (loadTheme merges later)
    expect(readFileSync(path.join(root, ".arte-git-card", "themes", "tokyo-night.yml"), "utf8")).toContain("accent");

    // duplicate → refused, nothing changed
    expect(() => installTheme(root, file)).toThrow(/already installed/);
    // the full default is still selectable
    expect(Object.keys(THEME_PRESETS)).toEqual(["arte-theme", "github-theme"]);
  });

  it("rejects an invalid theme (unknown key / bad hex) before any write", () => {
    const root = seedHealthyRepo(temp()).root;
    const file = path.join(temp(), "bad.yml");
    writeFileSync(file, "palette:\n  accent: \"not-a-color\"\n", "utf8");
    expect(() => installTheme(root, file)).toThrow(/Invalid theme/);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "bad.yml"))).toBe(false);
  });

  it("preset install materializes arte-theme / github-theme from the preset", () => {
    const root = seedHealthyRepo(temp()).root;
    const res = installTheme(root, "github-theme");
    expect(res.name).toBe("github-theme");
    const body = readFileSync(path.join(root, ".arte-git-card", "themes", "github-theme.yml"), "utf8");
    expect(body).toContain("#FFFFFF"); // github surface
  });
});

describe("theme select (transactional: config + regenerate)", () => {
  it("selecting a preset materializes it, switches config, and regenerates cards with the new theme", () => {
    const root = seedHealthyRepo(temp()).root;
    const beforeBytes = readFileSync(path.join(root, ".github", "arte-git-card", "codebase.svg"), "utf8");
    const { loaded } = load(root);
    const res = selectTheme(root, loaded, "github-theme");
    expect(res.materializedPreset).toBe(true);
    expect(res.nextConfig.theme).toBe(".arte-git-card/themes/github-theme.yml");
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toContain("github-theme.yml");
    // cards regenerated under the NEW theme → bytes differ (theme feature, not a style change)
    const afterBytes = readFileSync(path.join(root, ".github", "arte-git-card", "codebase.svg"), "utf8");
    expect(afterBytes).not.toBe(beforeBytes);
    // new theme loads through the normal loader
    const schema = loadTheme(".arte-git-card/themes/github-theme.yml", root);
    expect(schema.palette.surface).toBe(GITHUB_THEME.palette.surface);
  });

  it("selecting a broken installed theme fails with NO config half-state", () => {
    const root = seedHealthyRepo(temp()).root;
    const file = path.join(root, ".arte-git-card", "themes", "broken.yml");
    writeFileSync(file, "palette:\n  accent: \"not-a-color\"\n", "utf8");
    const configBefore = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8");
    const { loaded } = load(root);
    expect(() => selectTheme(root, loaded, "broken")).toThrow(/Invalid theme/);
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toBe(configBefore); // untouched
  });

  it("a regeneration collision aborts BEFORE config is switched (no half state)", () => {
    const root = seedHealthyRepo(temp()).root;
    // make codebase an unowned collision (drop its entry, keep the file)
    const state = okState(readState(root));
    state.managedFiles = state.managedFiles.filter((e) => !e.path.endsWith("codebase.svg"));
    writeFileSync(path.join(root, ".arte-git-card", "state.json"), JSON.stringify(state, null, 2), "utf8");
    const configBefore = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8");
    const { loaded } = load(root);
    expect(() => selectTheme(root, loaded, "github-theme")).toThrow(/no ownership record/);
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toBe(configBefore); // config NOT switched
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "github-theme.yml"))).toBe(false); // no leftover materialize
  });

  it("selecting a nonexistent (non-preset) theme errors", () => {
    const root = seedHealthyRepo(temp()).root;
    const { loaded } = load(root);
    expect(() => selectTheme(root, loaded, "nope")).toThrow(/not installed/);
  });
});

describe("theme remove", () => {
  function installInto(root: string, name: string, body: string): void {
    const f = path.join(temp(), `${name}.yml`);
    writeFileSync(f, body, "utf8");
    installTheme(root, f);
  }

  it("refuses to remove the currently selected theme", () => {
    const root = seedHealthyRepo(temp()).root;
    const { loaded } = load(root);
    // select tokyo-night then try to remove it
    installInto(root, "tokyo-night", PARTIAL);
    selectTheme(root, loaded, "tokyo-night");
    expect(() => removeTheme(root, load(root).loaded, "tokyo-night")).toThrow(/selected/);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "tokyo-night.yml"))).toBe(true);
  });

  it("removes an installed, unmodified, non-selected theme", () => {
    const root = seedHealthyRepo(temp()).root;
    installInto(root, "custom-theme", PARTIAL);
    const res = removeTheme(root, load(root).loaded, "custom-theme"); // arte-theme selected
    expect(res.preserved).toBe(false);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "custom-theme.yml"))).toBe(false);
    const state = okState(readState(root));
    expect(state.managedFiles.some((e) => e.path.endsWith("custom-theme.yml"))).toBe(false); // entry dropped
  });

  it("PRESERVES a user-modified installed theme (never deletes user edits)", () => {
    const root = seedHealthyRepo(temp()).root;
    installInto(root, "edited-theme", PARTIAL);
    const target = path.join(root, ".arte-git-card", "themes", "edited-theme.yml");
    writeFileSync(target, "# user tweaked\nname: edited-theme\n", "utf8");
    expect(() => removeTheme(root, load(root).loaded, "edited-theme")).toThrow(/preserved|modified/);
    expect(existsSync(target)).toBe(true);
  });

  it("a preset that is not installed cannot be removed; an unowned file is preserved", () => {
    const root = seedHealthyRepo(temp()).root;
    expect(() => removeTheme(root, load(root).loaded, "github-theme")).toThrow(/not installed/);
    // unowned file (no state entry)
    const orphan = path.join(root, ".arte-git-card", "themes", "orphan.yml");
    writeFileSync(orphan, PARTIAL, "utf8");
    expect(() => removeTheme(root, load(root).loaded, "orphan")).toThrow(/Cannot prove/);
    expect(existsSync(orphan)).toBe(true); // preserved
  });
});

describe("show / validate / list", () => {
  it("list reports installed + presets; installed themes directory is the model", () => {
    const root = seedHealthyRepo(temp()).root;
    const f = path.join(temp(), "extra.yml");
    writeFileSync(f, PARTIAL, "utf8");
    installTheme(root, f);
    const installed = installedThemes(root);
    expect(installed).toContain("arte-theme"); // init materialization
    expect(installed).toContain("extra");
    const { body, preset } = themeBodyFor(root, "github-theme");
    expect(preset).toBe(true);
    expect(body).toContain("#FFFFFF");
  });

  it("validateThemeFile accepts partial and rejects invalid", () => {
    const good = path.join(temp(), "g.yml");
    writeFileSync(good, PARTIAL, "utf8");
    expect(validateThemeFile(good).ok).toBe(true);
    const bad = path.join(temp(), "b.yml");
    writeFileSync(bad, "palette: { accent: nope }\n", "utf8");
    expect(validateThemeFile(bad).ok).toBe(false);
  });
});

describe("theme install state gate (P1-5) — manager-level fail closed", () => {
  function source(body: string): string {
    const f = path.join(temp(), "gated.yml");
    writeFileSync(f, body, "utf8");
    return f;
  }

  it("state.json MISSING → zero write, actionable error", () => {
    const root = seedHealthyRepo(temp()).root;
    rmSync(path.join(root, ".arte-git-card", "state.json"));
    expect(() => installTheme(root, source(PARTIAL))).toThrow(/state\.json is missing|cannot prove ownership|fail closed/i);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "gated.yml"))).toBe(false);
  });

  it("state.json CORRUPT → zero write", () => {
    const root = seedHealthyRepo(temp()).root;
    writeFileSync(path.join(root, ".arte-git-card", "state.json"), "{ corrupt", "utf8");
    expect(() => installTheme(root, source(PARTIAL))).toThrow(/state\.json is corrupt|cannot prove ownership|fail closed/i);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "gated.yml"))).toBe(false);
  });

  it("state.json INCOMPATIBLE → zero write", () => {
    const root = seedHealthyRepo(temp()).root;
    writeFileSync(
      path.join(root, ".arte-git-card", "state.json"),
      JSON.stringify({ schemaVersion: 99, toolVersion: "x", managedFiles: [], outputRoots: [] }),
      "utf8",
    );
    expect(() => installTheme(root, source(PARTIAL))).toThrow(/state\.json is incompatible|cannot prove ownership|fail closed/i);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "gated.yml"))).toBe(false);
  });

  it("UNINITIALIZED (no config) → hints `init`, zero write", () => {
    const root = temp(); // empty dir, no config/state
    expect(() => installTheme(root, source(PARTIAL))).toThrow(/not initialized|init/i);
    expect(existsSync(path.join(root, ".arte-git-card"))).toBe(false); // no side effect at all
  });

  it("LEGACY v1 config present → hints `migrate`, zero write", () => {
    const root = temp();
    writeFileSync(path.join(root, "arte-git-card.yml"), "cards:\n  codebase: { enabled: true }\n", "utf8");
    expect(() => installTheme(root, source(PARTIAL))).toThrow(/migrate/);
    expect(existsSync(path.join(root, ".arte-git-card", "themes", "gated.yml"))).toBe(false);
  });
});

describe("theme install ownership hash == actual written (LF) bytes (F2)", () => {
  it("a CRLF theme file installs with an entry that matches the installed LF file; remove works as owned", () => {
    const root = seedHealthyRepo(temp()).root;
    const file = path.join(temp(), "crlf-theme.yml");
    // CRLF source: transaction writes LF-normalized bytes on disk
    writeFileSync(file, "name: crlf-theme\r\npalette:\r\n  accent: \"#101010\"\r\n", "utf8");
    installTheme(root, file);
    const installed = path.join(root, ".arte-git-card", "themes", "crlf-theme.yml");
    // the installed file's actual bytes equal the state entry hash
    const state = okState(readState(root));
    const entry = state.managedFiles.find((e) => e.path === ".arte-git-card/themes/crlf-theme.yml");
    expect(entry).toBeTruthy();
    expect(sha256File(installed)).toBe(entry!.sha256); // no false "modified"
    // immediate remove succeeds as owned + unchanged (no CRLF false positive)
    expect(() => removeTheme(root, load(root).loaded, "crlf-theme")).not.toThrow();
    expect(existsSync(installed)).toBe(false);
  });
});

describe("theme select provenance + unsafe theme paths (final patch)", () => {
  it("select of a pre-existing manual theme does NOT claim it; remove later refuses (preserve)", () => {
    const root = seedHealthyRepo(temp()).root;
    const manual = path.join(root, ".arte-git-card", "themes", "manual.yml");
    writeFileSync(manual, 'name: manual\npalette:\n  accent: "#202020"\n', "utf8");
    expect(() => selectTheme(root, load(root).loaded, "manual")).not.toThrow();
    let state = okState(readState(root));
    expect(state.managedFiles.some((e) => e.path === ".arte-git-card/themes/manual.yml")).toBe(false); // never auto-claimed
    // switch back to arte-theme, then removing the unowned manual theme must refuse
    selectTheme(root, load(root).loaded, "arte-theme");
    expect(() => removeTheme(root, load(root).loaded, "manual")).toThrow(/Cannot prove|not installed|preserved/i);
    expect(existsSync(manual)).toBe(true); // preserved
  });

  it("select of an installed theme does NOT refresh its ownership SHA after a user edit", () => {
    const root = seedHealthyRepo(temp()).root;
    const src = path.join(temp(), "owned.yml");
    writeFileSync(src, "name: owned\npalette:\n  accent: \"#303030\"\n", "utf8");
    installTheme(root, src);
    const rel = ".arte-git-card/themes/owned.yml";
    const originalSha = okState(readState(root)).managedFiles.find((e) => e.path === rel)!.sha256;
    // user edits the installed theme
    const installed = path.join(root, rel);
    writeFileSync(installed, "# user edit\nname: owned\n", "utf8");
    expect(() => selectTheme(root, load(root).loaded, "owned")).not.toThrow();
    const stateAfter = okState(readState(root));
    const shaAfter = stateAfter.managedFiles.find((e) => e.path === rel)!.sha256;
    expect(shaAfter).toBe(originalSha); // NOT refreshed to the user edit
    // switch away; removing 'owned' reports MODIFIED and preserves the edit
    selectTheme(root, load(root).loaded, "arte-theme");
    expect(() => removeTheme(root, load(root).loaded, "owned")).toThrow(/modified|preserved/i);
    expect(readFileSync(installed, "utf8")).toBe("# user edit\nname: owned\n"); // preserved
  });

  it("select REFUSES a theme path occupied by a DIRECTORY (fail closed, nothing changed)", () => {
    const root = seedHealthyRepo(temp()).root;
    const dirPath = path.join(root, ".arte-git-card", "themes", "diry.yml");
    mkdirSync(dirPath, { recursive: true });
    const configBefore = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8");
    expect(() => selectTheme(root, load(root).loaded, "diry")).toThrow(/not a regular file|symlink|directory/i);
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toBe(configBefore); // untouched
    expect(existsSync(dirPath)).toBe(true);
  });

  it("select REFUSES a theme path that is a VALID symlink to a real theme file (preserve)", () => {
    const root = seedHealthyRepo(temp()).root;
    const real = path.join(root, ".arte-git-card", "themes", "real.yml");
    writeFileSync(real, "name: real\npalette:\n  accent: \"#404040\"\n", "utf8");
    const link = path.join(root, ".arte-git-card", "themes", "linked.yml");
    let linked = true;
    try {
      symlinkSync(real, link, "file");
    } catch {
      linked = false;
    }
    if (!linked) return; // no file-symlink privilege on this host
    const configBefore = readFileSync(path.join(root, "arte-gitcard.yml"), "utf8");
    expect(() => selectTheme(root, load(root).loaded, "linked")).toThrow(/not a regular file|symlink/i);
    expect(readFileSync(path.join(root, "arte-gitcard.yml"), "utf8")).toBe(configBefore);
    expect(lstatSync(link).isSymbolicLink()).toBe(true); // symlink preserved
  });
});
