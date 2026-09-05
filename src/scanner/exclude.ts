/**
 * Exclusion rules (SPEC §7). Paths are POSIX-style relative to the project root.
 *  - Hard tool-correctness excludes (.git/**, config, .arte-git-card/**, output
 *    dir) — never user-removable; prevents self-counting.
 *  - User-editable `exclude` list: names matched exactly at any depth (a bare
 *    `out` never matches `about`/`stdout`) plus `*.suffix` patterns on the
 *    basename; dotted names are plain exact-name rules (never infer suffix from
 *    a leading dot).
 * Plus a binary-extension guard (`.png` etc. never count as source). There is
 * NO blanket "exclude every dotfile" rule — dotfiles are included unless listed.
 */

/** Tool-correctness hard excludes — always applied, cannot be removed by config. */
export const HARD_EXCLUDED_DIRS = [".git", ".arte-git-card"] as const;

/** Well-known binary/image/archive/font extensions skipped before sniffing. */
export const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg",
  ".pdf", ".zip", ".gz", ".tar", ".tgz", ".bz2", ".xz", ".7z", ".rar",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".mov", ".avi", ".wav", ".flac", ".ogg",
  ".wasm", ".exe", ".dll", ".so", ".dylib", ".o", ".a",
  ".pyc", ".pyo", ".class", ".jar", ".war",
  ".min", ".lock",
]);

/**
 * Match one user-configurable exclude entry against a relative POSIX path:
 * a directory/file name at any depth, the path itself, a path prefix, or a
 * dotted suffix on the basename.
 */
function matchesExcludeEntry(relativePosix: string, entry: string): boolean {
  if (!entry) return false;
  const segments = relativePosix.split("/");
  const base = segments[segments.length - 1] ?? "";
  // Explicit filename-suffix pattern (`*.map`, `*.min.js`): match the basename
  // ending. Plain entries are exact segment / path / prefix rules ONLY — a
  // bare `out` must never match `about` or `stdout`.
  if (entry.startsWith("*.")) {
    return base.endsWith(entry.slice(1));
  }
  return (
    segments.includes(entry) ||
    relativePosix === entry ||
    relativePosix.startsWith(`${entry}/`)
  );
}

export interface ExcludeOptions {
  /**
   * Resolved output directories as POSIX paths relative to the scan root. The
   * scanner passes only the CURRENT output dir; git-activity passes the current
   * dir PLUS every recorded historical output root (state.outputRoots) so old
   * generated commits are excluded forever.
   */
  outputDirs?: string[];
  /** User-editable exclusion list from config.exclude. */
  exclude?: string[];
}

function underOutputDir(relativePosix: string, dirs: readonly string[] | undefined): boolean {
  if (!dirs) return false;
  return dirs.some((d) => d && (relativePosix === d || relativePosix.startsWith(`${d}/`)));
}

/** True when the POSIX relative path is excluded (files), not the tree. */
export function isExcludedFile(
  relativePosix: string,
  opts: ExcludeOptions = {},
): boolean {
  const segments = relativePosix.split("/");

  // Hard tool-correctness excludes (never user-removable).
  if (segments.some((seg) => (HARD_EXCLUDED_DIRS as readonly string[]).includes(seg))) return true;
  // Both config names + the owned workflow are fixed tool paths — never self-counted.
  if (relativePosix === "arte-git-card.yml" || relativePosix === "arte-gitcard.yml") return true;
  if (relativePosix === ".github/workflows/arte-gitcard.yml") return true;
  if (underOutputDir(relativePosix, opts.outputDirs)) return true;

  // Binary-extension guard (never source code, regardless of the exclude list).
  const base = segments[segments.length - 1] ?? "";
  const lower = base.toLowerCase();
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx >= 0 && BINARY_EXTENSIONS.has(lower.slice(dotIdx))) return true;

  if (opts.exclude && opts.exclude.some((e) => matchesExcludeEntry(relativePosix, e))) return true;
  return false;
}

/** Whether a directory should be pruned during a walk (POSIX relative dir). */
export function isExcludedDir(
  relativeDirPosix: string,
  opts: ExcludeOptions = {},
): boolean {
  const segments = relativeDirPosix.split("/");
  if (segments.some((seg) => (HARD_EXCLUDED_DIRS as readonly string[]).includes(seg))) return true;
  if (opts.exclude && opts.exclude.some((e) => e && segments.includes(e))) return true;
  if (underOutputDir(relativeDirPosix, opts.outputDirs)) return true;
  return false;
}
