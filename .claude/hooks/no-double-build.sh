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
cmd=$(jq -r '.tool_input.command // ""')
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])(npm|pnpm|yarn)( run)? build([[:space:]]|$)|next build' || exit 0
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
