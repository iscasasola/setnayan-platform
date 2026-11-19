#!/bin/bash
# PreToolUse(Bash): refuse a production build while a dev server is running IN THIS SAME
# CHECKOUT. Two compiles of one tree at once is the double build; on this 16 GB Mac it has
# crashed the app. Exit 2 = Claude Code blocks the command and shows the reason.
#
# Scoped to this checkout ON PURPOSE (owner, 2026-11-18: nothing may stop a builder
# mid-flow): another session's dev server in another worktree never blocks your build —
# you could not stop it anyway (never pkill another session's process).
#
# The match patterns live in this FILE, not in the hook's command string, so pgrep can
# never match the hook's own shell (a self-matching pgrep always "finds" itself).
#
# WHAT COUNTS AS A BUILD — every form this repo uses (root package.json `build` = `turbo run
# build`; apps/web `build` runs `next build`; ci.yml / e2e.yml / lighthouse.yml /
# release-rehearsal.yml run `pnpm --filter @setnayan/web build`):
#   pnpm|npm|yarn|bun [flags…] [run] build      e.g. pnpm build · pnpm --filter @setnayan/web build
#                                                     pnpm -C apps/web run build · npm run build -w apps/web
#   [npx|pnpm exec|pnpm|yarn …] turbo [run] … build
#   [npx|pnpm exec|path/]next build
# A command only counts when the build STARTS a segment (after ; && || | ( ) { } ` newline,
# leading VAR=value assignments, and wrappers such as env/time/nice/if/bash -c), so
# `git commit -m "pnpm build"`, `pnpm tauri:build`, `cargo tauri build`, `pnpm rebuild` and
# `node scripts/check-build-budget.mjs` do not. The table of must/mustn't match lives in
# no-double-build.test.sh next to this file — run it after changing is_build_cmd.
#
# `no-double-build.sh --is-build '<command>'` exits 0 for a build, 1 otherwise (used by the test).

# Bash 3.2-safe (macOS /bin/bash): no ${x,,}, no mapfile, no associative arrays.
is_build_cmd() {
  local cmd=$1 seg prev
  local nl=$'\n'
  cmd=${cmd//\\$nl/ }                                   # join `\`-continued lines
  cmd=$(printf '%s' "$cmd" | tr ';&|(){}`' '\n\n\n\n\n\n\n\n')
  local SP='[[:space:]]'
  local FLAGS="($SP+-[^[:space:]]*($SP+[^-[:space:]][^[:space:]]*)?)*"   # -C dir · --filter x · -r
  local END="($SP|[\"']|\$)"
  while IFS= read -r seg; do
    # Strip leading noise until nothing changes: whitespace, VAR=value, shell keywords and
    # wrappers that run the rest of the line as a command.
    prev=''
    while [ "$seg" != "$prev" ]; do
      prev=$seg
      seg=$(printf '%s' "$seg" | sed -E \
        -e 's/^[[:space:]]+//' \
        -e 's/^[A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'"'"'[^'"'"']*'"'"'|[^[:space:]]*)[[:space:]]*//' \
        -e 's/^(if|then|else|elif|do|while|until|!|exec|command|nohup|time|caffeinate)([[:space:]]+|$)//' \
        -e 's/^env([[:space:]]+-[^[:space:]]+)*([[:space:]]+|$)//' \
        -e 's/^nice([[:space:]]+-n[[:space:]]*-?[0-9]+|[[:space:]]+-[0-9]+)?[[:space:]]+//' \
        -e 's/^timeout([[:space:]]+-[^[:space:]]+)*[[:space:]]+[0-9]+[smhd]?[[:space:]]+//' \
        -e 's/^(bash|sh|zsh)[[:space:]]+(-[a-z]+[[:space:]]+)*-[a-z]*c[[:space:]]*["'"'"']?//' \
        -e 's/^(npx|bunx)([[:space:]]+-[^[:space:]]+)*[[:space:]]+//' \
        -e 's/^(pnpm|yarn|npm|bun)(([[:space:]]+-[^[:space:]]*([[:space:]]+[^-[:space:]][^[:space:]]*)?)*)[[:space:]]+(exec|dlx|x)[[:space:]]+//' \
        -e 's/^(pnpm|yarn|bun)(([[:space:]]+-[^[:space:]]*([[:space:]]+[^-[:space:]][^[:space:]]*)?)*)[[:space:]]+((next|turbo)[[:space:]])/\5/')
    done
    [[ $seg =~ ^(npm|pnpm|yarn|bun)$FLAGS($SP+run)?$FLAGS$SP+build$END ]] && return 0
    [[ $seg =~ ^([^[:space:]]*/)?next$SP+build$END ]] && return 0
    [[ $seg =~ ^([^[:space:]]*/)?turbo($SP+[^[:space:]]+)*$SP+build$END ]] && return 0
  done <<EOF
$cmd
EOF
  return 1
}

if [ "$1" = "--is-build" ]; then
  is_build_cmd "$2"
  exit $?
fi

cmd=$(jq -r '.tool_input.command // ""')
is_build_cmd "$cmd" || exit 0
here=$(cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null && pwd -P)
[ -n "$here" ] || exit 0
for pid in $(pgrep -f 'next dev|next-server|vite( |$)|webpack( serve|-dev-server)'); do
  if [ -e "/proc/$pid/cwd" ]; then
    cwd=$(readlink "/proc/$pid/cwd")
  else
    cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  fi
  cwd=$(cd "$cwd" 2>/dev/null && pwd -P)
  case "$cwd/" in
    # A builder worktree nested inside this checkout is another checkout, not this one
    # (controller review 2026-11-18): its dev server must never block this tree's build.
    "$here"/.claude/worktrees/*) continue ;;
    "$here"/*)
      echo "BLOCKED: a dev server (pid $pid, in $cwd) is already running in this checkout — stop it first (preview_stop), then build once." >&2
      exit 2 ;;
  esac
done
exit 0
