/**
 * Built-in language registry (plan.md §61). ~25 common languages with the
 * lexical syntax needed by the LOC lexer: line comments, block comments and
 * string delimiters. Colors are NOT here — the theme data palette assigns them
 * by ranking (final spec).
 */

export interface LexerSyntax {
  /** Line comments: everything after the marker (in code state) is a comment. */
  lineComment?: string[];
  /** Block comments: [start, end] pairs, can span lines. */
  blockComment?: Array<[string, string]>;
  /** String opening delimiters; the closing delimiter is the same sequence. */
  strings?: string[];
}

export interface LanguageDef {
  id: string;
  name: string;
  extensions?: string[];
  filenames?: string[];
  shebang?: string[];
  syntax: LexerSyntax;
}

/** C-style string delimiters shared by most curly-brace languages. */
const C_STRINGS = ['"', "'", "`"];

/** Built-in language definitions. Keep ids stable — the registry and icon paths depend on them. */
export const BUILTIN_LANGUAGES: LanguageDef[] = [
  { id: "typescript", name: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: C_STRINGS } },
  { id: "javascript", name: "JavaScript", extensions: [".js", ".jsx", ".mjs", ".cjs"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: C_STRINGS } },
  { id: "python", name: "Python", extensions: [".py", ".pyw"], shebang: ["python", "python3"], syntax: { lineComment: ["#"], blockComment: [["'''", "'''"], ['"""', '"""']], strings: ["'", '"'] } },
  { id: "rust", name: "Rust", extensions: [".rs"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "go", name: "Go", extensions: [".go"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "`"] } },
  { id: "shell", name: "Shell", extensions: [".sh", ".bash", ".zsh", ".fish"], shebang: ["sh", "bash", "zsh", "fish"], syntax: { lineComment: ["#"], strings: ['"', "'", "`"] } },
  { id: "java", name: "Java", extensions: [".java"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "c", name: "C", extensions: [".c", ".h"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "cpp", name: "C++", extensions: [".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "csharp", name: "C#", extensions: [".cs"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "ruby", name: "Ruby", extensions: [".rb"], shebang: ["ruby"], syntax: { lineComment: ["#"], blockComment: [["=begin", "=end"]], strings: ['"', "'"] } },
  { id: "php", name: "PHP", extensions: [".php"], syntax: { lineComment: ["//", "#"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "swift", name: "Swift", extensions: [".swift"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "kotlin", name: "Kotlin", extensions: [".kt", ".kts"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "html", name: "HTML", extensions: [".html", ".htm"], syntax: { blockComment: [["<!--", "-->"]], strings: ['"', "'"] } },
  { id: "css", name: "CSS", extensions: [".css"], syntax: { blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "markdown", name: "Markdown", extensions: [".md", ".markdown"], syntax: { blockComment: [["<!--", "-->"]], strings: [] } },
  { id: "json", name: "JSON", extensions: [".json"], syntax: { strings: ['"'] } },
  { id: "yaml", name: "YAML", extensions: [".yml", ".yaml"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
  { id: "toml", name: "TOML", extensions: [".toml"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
  { id: "sql", name: "SQL", extensions: [".sql"], syntax: { lineComment: ["--"], blockComment: [["/*", "*/"]], strings: ["'"] } },
  { id: "dockerfile", name: "Dockerfile", filenames: ["Dockerfile", "Containerfile"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
  { id: "makefile", name: "Makefile", filenames: ["Makefile", "makefile", "GNUmakefile"], syntax: { lineComment: ["#"] } },
  { id: "cmake", name: "CMake", filenames: ["CMakeLists.txt"], extensions: [".cmake"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
];

export const BUILTIN_BY_EXT: Map<string, LanguageDef> = (() => {
  const m = new Map<string, LanguageDef>();
  for (const lang of BUILTIN_LANGUAGES) {
    for (const ext of lang.extensions ?? []) m.set(ext.toLowerCase(), lang);
  }
  return m;
})();

export const BUILTIN_BY_FILENAME: Map<string, LanguageDef> = (() => {
  const m = new Map<string, LanguageDef>();
  for (const lang of BUILTIN_LANGUAGES) {
    for (const name of lang.filenames ?? []) m.set(name.toLowerCase(), lang);
  }
  return m;
})();
