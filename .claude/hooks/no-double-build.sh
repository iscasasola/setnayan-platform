#!/bin/bash
# PreToolUse(Bash): refuse a production build while a dev server is already running.
# Why: this Mac has 16 GB; a `next build` beside a live `next dev` is two compiles at
# once and has crashed the app before. Exit 2 = Claude Code blocks the command and
# shows the reason to the model.
# The match patterns live in this FILE (not in the hook's command string) so pgrep
# can never match the hook's own shell — a self-matching pgrep always "finds" itself.
cmd=$(jq -r '.tool_input.command // ""')
if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])(npm|pnpm|yarn)( run)? build([[:space:]]|$)|next build'; then
  running=$(pgrep -fl 'next dev|next-server|vite( |$)|webpack( serve|-dev-server)' | head -3)
  if [ -n "$running" ]; then
    echo "BLOCKED: a dev server is already running — stop it first (or use preview_stop), then build once:" >&2
    echo "$running" >&2
    exit 2
  fi
fi
exit 0
