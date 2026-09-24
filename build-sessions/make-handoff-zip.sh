#!/usr/bin/env bash
# Build the account-handoff zip. Owner, 2026-09-23: at 97% weekly credit, stop
# everything, document everything, zip it so work continues on a new account.
#
#   bash build-sessions/make-handoff-zip.sh
#
# Takes a LIVE snapshot every run — the board decays in hours, so a zip built
# yesterday is a lie. Re-run it immediately before handing over.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Discover the memory dir rather than hardcoding one account's path — this
# bundle has to build on ANY machine and ANY Claude account.
MEM="${SETNAYAN_MEMORY_DIR:-}"
if [ -z "$MEM" ]; then
  MEM="$(ls -d "$HOME"/.claude/projects/*setnayan-platform/memory 2>/dev/null | head -1)"
fi
[ -z "$MEM" ] && MEM="$(ls -d "$HOME"/.claude/projects/*/memory 2>/dev/null | head -1)"
STAMP="$(date -u '+%Y-%m-%d-%H%M')Z"
OUT="${SETNAYAN_HANDOFF_OUT:-$HOME/Desktop}/setnayan-handoff-$STAMP"
ZIP="$OUT.zip"

rm -rf "$OUT"; mkdir -p "$OUT"/{memory,build-sessions,repo-docs,snapshot}

# ── 1 · MEMORY — the one thing that does NOT survive an account change ────────
if [ -d "$MEM" ]; then
  cp -R "$MEM/." "$OUT/memory/" 2>/dev/null
  echo "memory files: $(ls "$OUT"/memory/*.md 2>/dev/null | wc -l | tr -d ' ')"
else
  echo "!! MEMORY DIR NOT FOUND at $MEM — the handoff is incomplete" | tee "$OUT/memory/MISSING.txt"
fi

# ── 2 · plans, registers, prototypes ─────────────────────────────────────────
#
# 🔴 ORIGIN/MAIN FIRST, THE WORKING TREE SECOND — and that order is the fix.
#
# This used to copy `$REPO/build-sessions/` and nothing else. On 2026-09-24 it
# was run from a checkout sitting **2,839 commits behind origin/main**, and the
# bundle came out missing 68 files and 6 MB — the whole `assets/mb25` and
# `assets/mb28` artwork sets, four AREA-CHECKLISTs, PROVE-THE-FLOW.md. Nothing
# failed. The zip built, reported its counts, and was handed over incomplete.
# It was caught only because a human noticed the file was SMALLER than the last
# one.
#
# 🔑 A BUNDLE SILENTLY REFLECTS WHICHEVER CHECKOUT BUILT IT. Every session on
# this machine works in a worktree on its own branch, so the odds that the
# folder you are standing in is current are poor — and being behind looks
# exactly like being complete.
#
# So: extract the canonical copy from `origin/main` (build-sessions is tracked
# since 2026-09-24), then overlay the working tree WITHOUT clobbering, which
# keeps any local note a session has not pushed yet. Union, never either alone.
git -C "$REPO" fetch -q origin main 2>/dev/null
BEHIND="$(git -C "$REPO" rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
if git -C "$REPO" cat-file -e origin/main:build-sessions 2>/dev/null; then
  git -C "$REPO" archive origin/main build-sessions 2>/dev/null \
    | tar -x -C "$OUT" -f - 2>/dev/null
  echo "build-sessions from origin/main: $(find "$OUT/build-sessions" -type f | wc -l | tr -d ' ') files"
else
  echo "!! build-sessions NOT on origin/main — falling back to the working tree alone"
fi
# -n = no-clobber: origin/main wins any file that exists in both.
cp -Rn "$REPO/build-sessions/." "$OUT/build-sessions/" 2>/dev/null
echo "build-sessions after the working-tree overlay: $(find "$OUT/build-sessions" -type f | wc -l | tr -d ' ') files"
if [ "$BEHIND" != "0" ]; then
  echo "note: this checkout is $BEHIND commit(s) behind origin/main — the bundle took build-sessions from origin/main, not from here"
fi

# ── 3 · the repo's own instructions ──────────────────────────────────────────
for f in CLAUDE.md STATUS.md CHANGELOG.md COWORK_INBOX.md WHAT_IS_LEFT.md; do
  [ -f "$REPO/$f" ] && cp "$REPO/$f" "$OUT/repo-docs/" 2>/dev/null
done

# ── 3b · THE RULES THAT ARE NOT IN THE REPO ──────────────────────────────────
# Owner, 2026-09-24: "make sure all prompts and rules are included". The repo's
# own CLAUDE.md travels with the clone; these do NOT — they are per-machine and
# per-account, and a new account starts without them.
mkdir -p "$OUT/rules"
{
  echo "# Rules that live OUTSIDE the repo"
  echo
  echo "These are per-machine / per-account files. A fresh clone does not bring them."
  echo "Copied verbatim below as they stood at $STAMP. Treat as reference, not as truth:"
  echo "re-read the CURRENT CLAUDE.md inside the checkout you are actually working in."
  echo
} > "$OUT/rules/README.md"
for f in "$HOME/.claude/CLAUDE.md" "$HOME/CLAUDE.md"; do
  [ -f "$f" ] || continue
  dest="$OUT/rules/$(echo "${f#$HOME/}" | tr '/' '-')"
  cp "$f" "$dest" 2>/dev/null && echo "- \`${f/#$HOME/~}\` → \`rules/$(basename "$dest")\`" >> "$OUT/rules/README.md"
done
# The project's own instructions, from the checkout this script lives in.
[ -f "$REPO/CLAUDE.md" ] && cp "$REPO/CLAUDE.md" "$OUT/rules/repo-CLAUDE.md"
# Settings and skills — how this account was configured to behave.
[ -d "$HOME/.claude/skills" ] && cp -R "$HOME/.claude/skills" "$OUT/rules/skills" 2>/dev/null
for f in "$HOME/.claude/settings.json" "$REPO/.claude/settings.json" "$REPO/.claude/launch.json"; do
  [ -f "$f" ] && cp "$f" "$OUT/rules/$(echo "${f#$HOME/}" | tr '/' '-')" 2>/dev/null
done
echo "rules files: $(find "$OUT/rules" -type f 2>/dev/null | wc -l | tr -d ' ')"

# ⚠ THE CODE IS DELIBERATELY NOT IN THIS BUNDLE — it is on GitHub, it is large,
# and a zipped clone is stale the hour it is made. Say where it is instead.
cat > "$OUT/02-GET-THE-CODE.md" <<'GETCODE'
# Where the code is — it is NOT in this bundle, on purpose

A zipped clone is stale the hour it is made, and both repositories are public to you on GitHub.
This bundle carries only what GitHub does not have.

```bash
# THE CODE — the V1 implementation, where you work
git clone https://github.com/iscasasola/setnayan-platform.git
cd setnayan-platform && pnpm install --frozen-lockfile

# THE SPEC CORPUS — a SEPARATE repo: product specs, DECISION_LOG.md, iteration folders
git clone https://github.com/iscasasola/Setnayan-specs.git
```

The repo's `CLAUDE.md` refers to the corpus as `~/Documents/Claude/Projects/Setnayan/`.
**That is one machine's path, not an address.** Clone it anywhere and read it there.

## 🛑 Never read code from a home directory

On the machine this bundle was built on, `/Users/icecasasola` is itself a stale checkout of this
repo, hundreds of commits behind `main` — and because `~` is an ancestor of every project folder,
Claude Code auto-loaded THAT copy's `CLAUDE.md` for every session regardless of the project open.
A subagent aimed there once returned a fully traced, entirely wrong finding: real line numbers,
from a file whose code had since been deleted.

For a clean read hand over a detached worktree, never a path outside the checkout:

```bash
git worktree add --detach /tmp/wt-read origin/main
```

A fresh worktree has no `node_modules`, so `tsc`/lint/tests there pass while resolving nothing.
Install first, or reuse a worktree that already has them.

## What IS in this bundle

| folder | |
|---|---|
| `memory/` | The memory directory. **The one thing that does not survive an account change at all.** |
| `build-sessions/` | Plans, registers, session prompts, prototypes. Also committed to the repo as of 2026-09-24 — read `build-sessions/README.md` for the map. |
| `rules/` | `CLAUDE.md` files, settings and skills that live outside the repo and do not travel with a clone. |
| `repo-docs/` | `CLAUDE.md`, `STATUS.md`, `CHANGELOG.md`, `WHAT_IS_LEFT.md` as they stood. |
| `snapshot/` | The board, worktrees and recent `main`, regenerated at build time. |

⚠ Every dated claim in here rots. **A handoff is not evidence — including this one.**
GETCODE

# ── 4 · LIVE SNAPSHOT — regenerated every run ────────────────────────────────
S="$OUT/snapshot"
{
  echo "# Board snapshot · $STAMP"
  echo
  echo "## Open PRs"
  gh pr list --state open --limit 40 --json number,title,headRefName,isDraft,statusCheckRollup \
    --jq '.[]|"- #\(.number) \(if .isDraft then "[DRAFT] " else "" end)`\(.headRefName)` — \(.title)  · failing=\([.statusCheckRollup[]?|select(.conclusion=="FAILURE")]|length) pending=\([.statusCheckRollup[]?|select(.status=="IN_PROGRESS" or .status=="QUEUED")]|length)"' 2>/dev/null
  echo
  echo "## Branches with unlanded commits — active first, cold counted"
  echo
  echo "⚠ **Neither extreme works here, and both were tried in one sitting.** A 3-day"
  echo "window hid \`s41-wip\` (2 commits, 97 files) and \`claude/the-gift-is-a-switch\`"
  echo "(2 commits, one labelled *\"kept only so nothing is lost\"*) at 5 and 14 days —"
  echo "**the stalest branch is the one most likely to be forgotten.** Removing the window"
  echo "then listed 221 branches, 200 of them months dead, which nobody reads either."
  echo "So: everything touched in the last 21 days in full, the rest as a count."
  echo
  echo "### Active — touched in the last 21 days"
  echo
  ACTIVE=0; COLD=0
  for b in $(git -C "$REPO" branch -r --no-merged origin/main 2>/dev/null | grep -v HEAD | sed 's/ *//'); do
    d=$(git -C "$REPO" log -1 --format='%at' "$b" 2>/dev/null); [ -z "$d" ] && continue
    ahead=$(git -C "$REPO" rev-list --count origin/main.."$b" 2>/dev/null)
    [ "${ahead:-0}" = "0" ] && continue
    age=$(( ( $(date +%s) - d ) / 86400 ))
    if [ "$age" -le 21 ]; then
      ACTIVE=$((ACTIVE+1))
      printf '%04d\t- `%s` ahead %s · %sd ago (%s)\n' "$age" "${b#origin/}" "$ahead" "$age" \
        "$(git -C "$REPO" log -1 --format='%ad' --date=short "$b" 2>/dev/null)"
    else
      COLD=$((COLD+1))
    fi
  done | sort | cut -f2- > "$S/_active.txt"
  cat "$S/_active.txt"
  echo
  echo "### Cold"
  echo
  echo "$(git -C "$REPO" branch -r --no-merged origin/main 2>/dev/null | grep -cv HEAD) unmerged remote branches in total; the ones NOT listed above were last touched"
  echo "over 21 days ago. They are abandonment, not work in flight — but re-measure rather"
  echo "than trusting that sentence:"
  echo
  echo '```bash'
  echo 'for b in $(git branch -r --no-merged origin/main | grep -v HEAD); do'
  echo '  a=$(git rev-list --count origin/main..$b); [ "$a" = 0 ] && continue'
  echo '  echo "$b ahead $a $(git log -1 --format=%cr $b)"'
  echo 'done | sort -k4'
  echo '```'
  echo
  echo "## What production is serving"
  echo '```'
  curl -sL -o /dev/null -w 'setnayan.com            HTTP %{http_code}\n' --max-time 20 https://setnayan.com/ 2>/dev/null
  curl -sL -o /dev/null -w 'setnayan.com/api/health HTTP %{http_code}\n' --max-time 20 https://setnayan.com/api/health 2>/dev/null
  echo "origin/main = $(git -C "$REPO" rev-parse --short origin/main 2>/dev/null)"
  echo '```'
  echo
  echo "## Merged in the last 24h"
  gh pr list --state merged --limit 60 --json number,title,mergedAt \
    --jq --arg d "$(date -u -v-1d '+%Y-%m-%d' 2>/dev/null || date -u -d '1 day ago' '+%Y-%m-%d')" \
    '[.[]|select(.mergedAt[0:10] >= $d)]|.[]|"- #\(.number) \(.title)"' 2>/dev/null
} > "$S/BOARD.md" 2>/dev/null

git -C "$REPO" log origin/main --oneline -60 > "$S/recent-main.txt" 2>/dev/null
git -C "$REPO" worktree list                > "$S/worktrees.txt"   2>/dev/null

cp "$REPO/build-sessions/CONTROLLER.md"            "$OUT/00-READ-ME-FIRST-CONTROLLER.md" 2>/dev/null
cp "$REPO/build-sessions/SEQUENCE-2026-09-23.md"   "$OUT/01-SEQUENCE.md" 2>/dev/null

cd "$(dirname "$OUT")" && zip -qr "$ZIP" "$(basename "$OUT")" && rm -rf "$OUT"
echo "built: $ZIP  ($(du -h "$ZIP" | cut -f1))"
