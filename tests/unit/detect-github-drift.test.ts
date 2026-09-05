/**
 * detect/doctor GitHub drift regression tests (explicit acceptance) — direct
 * coverage of the DRIFTED/DAMAGED classifications and their actionable
 * `arte-gitcard github sync` / `disable` guidance. These are built against the
 * detector itself (not incidental), using a real temp repo + strict config +
 * theme + a hand-crafted state.json.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { DEFAULT_THEME } from "../../src/theme/default-theme.js";
import { sha256Content } from "../../src/fs/hash.js";
import { detectRepositoryState } from "../../src/repo/detect.js";
import { WORKFLOW_REL } from "../../src/managed/paths.js";

const dirs: string[] = [];
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "agc-drift-"));
  dirs.push(d);
  return d;
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
function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}

const CONFIG = (auto: boolean) => `schema-version: 2
cards:
  codebase: { enabled: true, languages: { include_comments: false } }
  structure: { enabled: true, root: ".", max_depth: 3, activity_days: 7,
    commits: { enabled: true }, changes: { enabled: true } }
theme: ".arte-git-card/themes/arte-theme.yml"
output: { directory: ".github/arte-git-card" }
auto-update: ${auto}
`;

const workflowYaml = (branch: string) => `on:
  push:
    branches:
      - '${branch}'
`;

interface Seed {
  autoUpdate: boolean;
  snapshot?: string;
  managed?: Array<{ path: string; kind: string; sha256: string }>;
  workflowBranch?: string;
  gitignore?: string;
}

function seed(s: Seed): string {
  const root = temp();
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "t@e.c"]);
  git(root, ["config", "user.name", "T"]);
  mkdirSync(path.join(root, ".arte-git-card", "themes"), { recursive: true });
  writeFileSync(path.join(root, ".arte-git-card", "themes", "arte-theme.yml"), YAML.stringify(DEFAULT_THEME), "utf8");
  writeFileSync(path.join(root, "arte-gitcard.yml"), CONFIG(s.autoUpdate), "utf8");
  if (s.gitignore) writeFileSync(path.join(root, ".gitignore"), s.gitignore, "utf8");
  if (s.workflowBranch) {
    const rel = WORKFLOW_REL;
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), workflowYaml(s.workflowBranch), "utf8");
  }
  const state: Record<string, unknown> = {
    schemaVersion: 2,
    toolVersion: "1.0.0",
    managedFiles: s.managed ?? [],
    outputRoots: [],
  };
  if (s.snapshot !== undefined) state.github = { defaultBranch: s.snapshot };
  writeFileSync(path.join(root, ".arte-git-card", "state.json"), JSON.stringify(state), "utf8");
  return root;
}

function codes(detect: ReturnType<typeof detectRepositoryState>): string[] {
  return detect.diagnoses.map((d) => d.code);
}

describe("detect surfaces GitHub drift with actionable guidance", () => {
  it("auto-update=true + missing snapshot → DRIFTED with `github sync`", () => {
    const root = seed({ autoUpdate: true });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    expect(codes(d)).toContain("github-missing-snapshot");
    expect(d.diagnoses.find((x) => x.code === "github-missing-snapshot")!.message).toContain("github sync");
  });

  it("auto-update=true + INVALID defaultBranch snapshot → DRIFTED (invalid-git-ref)", () => {
    const root = seed({ autoUpdate: true, snapshot: "bad ref ..x" });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    expect(codes(d)).toContain("github-invalid-snapshot");
    expect(d.diagnoses.find((x) => x.code === "github-invalid-snapshot")!.message).toContain("github sync");
  });

  it("auto-update=true + missing workflow → DRIFTED (github-enabled-no-workflow)", () => {
    const root = seed({ autoUpdate: true, snapshot: "main" });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    expect(codes(d)).toContain("github-enabled-no-workflow");
    expect(d.diagnoses.find((x) => x.code === "github-enabled-no-workflow")!.message).toContain("github sync");
  });

  it("auto-update=true + missing ci action/runtime with a present workflow → DRIFTED (ci-materialization)", () => {
    const root = seed({ autoUpdate: true, snapshot: "main", workflowBranch: "main" });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    const msg = d.diagnoses.find((x) => x.code === "ci-materialization")!;
    expect(msg).toBeDefined();
    expect(msg.message).toContain("github sync");
  });

  it("materialized workflow/defaultBranch drift → DRIFTED (github-workflow-branch-drift)", () => {
    const root = seed({ autoUpdate: true, snapshot: "trunk", workflowBranch: "main" });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    expect(codes(d)).toContain("github-workflow-branch-drift");
    expect(d.diagnoses.find((x) => x.code === "github-workflow-branch-drift")!.message).toContain("github sync");
  });

  it("ignored required integration file → DRIFTED (github-ignored-integration)", () => {
    const root = seed({ autoUpdate: true, snapshot: "main", gitignore: ".arte-git-card/\n" });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    const diag = d.diagnoses.find((x) => x.code === "github-ignored-integration");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain(".arte-git-card/ci/main.cjs");
    expect(diag!.message).toContain("github sync");
  });

  it("auto-update=false + stale owned workflow materialization + snapshot → DRIFTED (github-disable guidance)", () => {
    const workflow = workflowYaml("main");
    const root = seed({
      autoUpdate: false,
      snapshot: "main",
      workflowBranch: "main",
      managed: [{ path: WORKFLOW_REL, kind: "workflow", sha256: sha256Content(workflow) }],
    });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    expect(codes(d)).toContain("github-disabled-workflow");
    expect(codes(d)).toContain("github-stale-snapshot");
    const disabled = d.diagnoses.find((x) => x.code === "github-disabled-workflow")!;
    expect(disabled.message).toMatch(/github (disable|enable)/);
  });

  it("state entry with a WRONG ownership kind (correct bytes/hash) → DRIFTED (github-ownership-kind)", () => {
    const workflow = workflowYaml("main");
    const root = seed({
      autoUpdate: true,
      snapshot: "main",
      workflowBranch: "main",
      managed: [{ path: WORKFLOW_REL, kind: "ci-runtime", sha256: sha256Content(workflow) }],
    });
    const d = detectRepositoryState(root);
    expect(d.state).toBe("DRIFTED");
    const diag = d.diagnoses.find((x) => x.code === "github-ownership-kind");
    expect(diag).toBeDefined();
    expect(diag!.path).toBe(WORKFLOW_REL);
    expect(diag!.message).toContain("github sync");
  });
});
