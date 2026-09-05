/**
 * Static shell completion scripts (P0). Each forwards the typed words to the
 * hidden `arte-gitcard __complete <words...>` — ALL business/dynamic-candidate
 * logic lives in the CLI engine (completion/engine.ts), never duplicated per
 * shell. Scripts are printed by `arte-gitcard completion <shell>`; the user
 * installs them into their own shell profile (the tool never edits profiles).
 */

export const BASH_SCRIPT = `_arte_gitcard_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local out
  out="$(arte-gitcard __complete "\${COMP_WORDS[@]:1}" 2>/dev/null)"
  local IFS=$'\\n' lines=($out)
  COMPREPLY=()
  local c
  for c in "\${lines[@]}"; do
    [[ "$c" == "$cur"* ]] && COMPREPLY+=("$c")
  done
}
complete -F _arte_gitcard_completions arte-gitcard
`;

export const ZSH_SCRIPT = `#compdef arte-gitcard
_arte_gitcard() {
  local -a lines
  lines=("\${(@f)\$(arte-gitcard __complete "\${words[@]:1}" 2>/dev/null)}")
  compadd -- "\${lines[@]}"
}
compdef _arte_gitcard arte-gitcard
`;

export const FISH_SCRIPT = `function __arte_gitcard_complete
  set -l tokens (commandline -opc)
  set -e tokens[1]
  set -l partial (commandline -ct)
  set -l out (arte-gitcard __complete $tokens $partial 2>/dev/null)
  for c in $out
    printf '%s\\tarte-gitcard\\n' "$c"
  end
end
complete -c arte-gitcard -f -a '(__arte_gitcard_complete)'
`;

export const POWERSHELL_SCRIPT = `Register-ArgumentCompleter -Native -CommandName arte-gitcard -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $words = @()
  foreach ($e in $commandAst.CommandElements) { $words += $e.Extent.Text }
  if ($words.Count -gt 0) { $words = $words[1..($words.Count - 1)] }
  $out = & arte-gitcard __complete @words 2>$null
  $out | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;

export const SHELL_SCRIPTS: Record<string, string> = {
  bash: BASH_SCRIPT,
  zsh: ZSH_SCRIPT,
  fish: FISH_SCRIPT,
  powershell: POWERSHELL_SCRIPT,
};
