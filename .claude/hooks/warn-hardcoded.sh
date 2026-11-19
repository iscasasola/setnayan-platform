#!/bin/bash
# PostToolUse(Edit|Write): warn when an edit to app code writes a TODO/FIXME,
# a localhost URL, or mock/dummy data. WARNS ONLY — owner ruling 2026-11-20: it never blocks.
# It always exits 0 and prints the warning on stdout as JSON `systemMessage` (shown in the
# transcript); exit 2 would feed it back as a blocking error, which is what the ruling removed.
# Scope: apps/web/{app,components,lib} and packages/*/src — this repo has no src/.
# Tests, dev labs (*.lab.tsx, app/dev/) and fixtures are exempt.
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
case "$file" in
  */apps/web/app/dev/*|*.lab.tsx|*.test.ts|*.test.tsx|*/fixtures/*|*/tests/*) exit 0 ;;
  */apps/web/app/*|*/apps/web/components/*|*/apps/web/lib/*|*/packages/*/src/*) ;;
  *) exit 0 ;;
esac
text=$(printf '%s' "$input" | jq -r '[.tool_input.new_string, .tool_input.content, (.tool_input.edits // [] | map(.new_string) | join("\n"))] | map(select(. != null)) | join("\n")')
hits=$(printf '%s' "$text" | grep -noE 'TODO:|FIXME:|localhost:[0-9]*|[Dd]ummy|mockData' | head -5)
if [ -n "$hits" ]; then
  msg="WARNING (not blocking) in $file: possible hardcoded URL, mock data, or TODO — wire it to env config or a lib/ service before finishing:
$hits"
  jq -nc --arg m "$msg" '{systemMessage: $m}'
  echo "$msg" >&2
fi
exit 0
