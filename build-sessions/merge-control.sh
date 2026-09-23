#!/bin/bash
# merge-control.sh — the controller's merge-collision analyzer.
#
# WHAT IT ANSWERS: "if every build in flight lands, which ones will conflict, on which
# files, and in what order should they land so that the fewest of them have to be redone?"
#
# It does REAL trial merges (git merge-tree --write-tree), never a grep — a grep cannot
# predict a merge conflict (memory: a-grep-cannot-predict-a-merge-conflict). It touches no
# worktree and no branch: merge-tree writes only loose objects, and the simulated landing
# commits are dangling (gc reclaims them).
#
# CANDIDATES it analyzes, by default:
#   • every OPEN PR on origin (head ref = origin/<branch>)
#   • every LOCAL worktree branch that is NOT yet merged into origin/main and is ahead of it
#     (an unpushed build in flight), unless it is contained in an open PR (stacked) or it is
#     parked (behind origin/main by more than STALE_BEHIND commits)
#   • plus any refs you pass with --branch (a session runs this on itself before it pushes)
#
# USAGE
#   build-sessions/merge-control.sh                     # full report → build-sessions/MERGE-CONTROL.md
#   build-sessions/merge-control.sh --branch HEAD       # "will MY branch collide with anything in flight?"
#   build-sessions/merge-control.sh --order 5867,5865   # simulate this landing order first (PR numbers or refs)
#   build-sessions/merge-control.sh --no-locals         # PRs only
#   build-sessions/merge-control.sh --md /path/out.md   # write the report elsewhere
#
# EXIT: 0 = no conflict anywhere · 1 = at least one conflict in the landing simulation · 2 = usage/tooling error
#
# READ THE VERDICT LINES, not only the tables:
#   CLEAN      merges onto the simulated main with no conflict
#   CONFLICT   conflicts; the file list says where. GENERATED baselines are REGENERATED on the
#              merged tree (the tool prints the file's own regenerate line), never hand-merged.
#   OVERLAP    two candidates edit the same non-changelog file but git merges them cleanly today —
#              still a warning: the second to land should re-run its own tests on the merged tree.

set +u  # bash 3.2 on this Mac: empty arrays trip -u; every read is guarded explicitly
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not in a git repo" >&2; exit 2; }
cd "$REPO_ROOT" || exit 2
STALE_BEHIND="${STALE_BEHIND:-500}"
OUT_MD="$REPO_ROOT/build-sessions/MERGE-CONTROL.md"
INCLUDE_LOCALS=1
EXTRA_REFS=()
ORDER_SPEC=""

while [ $# -gt 0 ]; do
  case "$1" in
    --branch) EXTRA_REFS+=("$2"); shift 2 ;;
    --order) ORDER_SPEC="$2"; shift 2 ;;
    --no-locals) INCLUDE_LOCALS=0; shift ;;
    --md) OUT_MD="$2"; shift 2 ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "gh CLI missing" >&2; exit 2; }
git merge-tree --write-tree --name-only HEAD HEAD >/dev/null 2>&1 || { echo "git merge-tree --write-tree unsupported (need git ≥ 2.38)" >&2; exit 2; }

git fetch -q --prune origin || { echo "git fetch failed — NOT measuring against a stale origin/main" >&2; exit 2; }
MAIN=origin/main
MAIN_SHA=$(git rev-parse --short "$MAIN")
NOW=$(date -u +'%Y-%m-%d %H:%M UTC')

# rng LOW HIGH — emit LOW..HIGH ascending, and NOTHING when HIGH < LOW.
# ⚠ Do NOT use `seq` here. BSD seq on this Mac COUNTS DOWN when first > last: `seq 6 5` prints
# "6 5", so an empty inner loop silently becomes a self-pair, and `seq 0 -1` (zero candidates)
# prints "0 -1". A probe with two deliberately-conflicting commits is what exposed it — the tool
# had reported a bogus "probe-B vs probe-B" row. An empty range must be empty.
rng() { [ "$2" -lt "$1" ] && return 0; local n="$1"; while [ "$n" -le "$2" ]; do echo "$n"; n=$((n+1)); done; }

# conflict_files RAW — the conflicted PATHS from `git merge-tree --write-tree --name-only`.
# Its output is: line 1 = tree OID, then the conflicted paths, then a BLANK line, then prose
# ("Auto-merging …", "CONFLICT (content): …"). Taking everything after line 1 turned that prose
# into fake filenames in the report. Stop at the first blank line.
conflict_files() { printf '%s\n' "$1" | sed 1d | sed '/^$/q' | grep -v '^$'; }

# try_merge REF_A REF_B -> prints "clean" | "conflict" | "unmergeable"
# ⚠ `git merge-tree --write-tree` exits 1 for a CONFLICT *and* for a ref it cannot resolve
# ("not something we can merge"). Identical exit codes, opposite meanings — a renamed or deleted
# branch would otherwise be reported as a conflict and mis-sequence a whole wave. Verify both refs
# resolve to commits FIRST, so rc=1 can only mean conflict.
try_merge() {
  git rev-parse -q --verify "$1^{commit}" >/dev/null || { echo unmergeable; return; }
  git rev-parse -q --verify "$2^{commit}" >/dev/null || { echo unmergeable; return; }
  git merge-tree --write-tree --name-only "$1" "$2" >/dev/null 2>&1
  case $? in 0) echo clean ;; 1) echo conflict ;; *) echo unmergeable ;; esac
}

# ---------- candidate discovery -------------------------------------------------------------
# arrays indexed in parallel
C_KEY=(); C_REF=(); C_LABEL=(); C_KIND=(); C_NOTE=()

add_candidate() { # key ref label kind note
  local i; for i in "${!C_KEY[@]}"; do [ "${C_KEY[$i]}" = "$1" ] && return; done
  C_KEY+=("$1"); C_REF+=("$2"); C_LABEL+=("$3"); C_KIND+=("$4"); C_NOTE+=("$5")
}

PR_JSON=$(gh pr list --state open --limit 60 --json number,headRefName,title,mergeStateStatus,autoMergeRequest,isDraft 2>/dev/null) || PR_JSON="[]"
PR_COUNT=$(printf '%s' "$PR_JSON" | jq 'length')
if [ "$PR_COUNT" = "" ]; then echo "gh returned nothing — a gh outage is NOT 'no open PRs'" >&2; exit 2; fi

while IFS=$'\t' read -r num head title mstate auto draft; do
  [ -z "$num" ] && continue
  ref="origin/$head"
  if ! git rev-parse -q --verify "$ref^{commit}" >/dev/null; then
    add_candidate "#$num" "" "#$num $title" "PR" "head $head NOT in origin (fetch failed?)"; continue
  fi
  note="$mstate"; [ "$auto" = "true" ] && note="$note · auto" || note="$note · NO AUTO"; [ "$draft" = "true" ] && note="$note · draft"
  add_candidate "#$num" "$ref" "#$num $title" "PR" "$note"
done < <(printf '%s' "$PR_JSON" | jq -r '.[] | [.number, .headRefName, .title, .mergeStateStatus, (.autoMergeRequest!=null), .isDraft] | @tsv')

PARKED=(); STACKED=(); DIRTY_KEYS=(); DIRTY_FP=()
if [ "$INCLUDE_LOCALS" = 1 ]; then
  while read -r wt ref; do
    b=${ref#refs/heads/}
    git rev-parse -q --verify "$b^{commit}" >/dev/null || continue
    # UNCOMMITTED WORK IS ALSO A BUILD IN FLIGHT. A worktree whose BRANCH is already merged can
    # still hold a session's live edits; the first pass of this script called those "merged" and
    # missed two real sessions. Uncommitted work cannot be trial-merged (merge-tree needs commits),
    # so it enters as a FOOTPRINT-ONLY candidate: overlap is reported, the verdict is advisory.
    wfp=$(git -C "$wt" status --porcelain --untracked-files=all 2>/dev/null \
            | sed 's/^...//' | sed 's/.* -> //' | grep -v '^build-sessions/' | grep -v '^changelog.d/' | sort -u)
    if [ -n "$wfp" ]; then DIRTY_KEYS+=("$b|$wt"); DIRTY_FP+=("$wfp"); fi
    git merge-base --is-ancestor "$b" "$MAIN" && continue            # merged → not a commit candidate
    ahead=$(git rev-list --count "$MAIN..$b"); [ "$ahead" = 0 ] && continue
    behind=$(git rev-list --count "$b..$MAIN")
    contained=""
    for i in "${!C_REF[@]}"; do
      [ -z "${C_REF[$i]}" ] && continue
      if git merge-base --is-ancestor "$b" "${C_REF[$i]}"; then contained="${C_KEY[$i]}"; break; fi
    done
    if [ -n "$contained" ]; then STACKED+=("$b (in $wt) is contained in $contained — stacked, not a collision"); continue; fi
    if [ "$behind" -gt "$STALE_BEHIND" ]; then PARKED+=("$b (in $wt) ahead=$ahead behind=$behind — parked; excluded"); continue; fi
    pushed="unpushed"; git rev-parse -q --verify "origin/$b" >/dev/null && pushed="pushed, no PR"
    add_candidate "$b" "$b" "$b" "LOCAL" "$pushed · ahead $ahead · behind $behind · $wt"
  done < <(git worktree list --porcelain | awk '/^worktree /{wt=$2} /^branch /{print wt, $2}')
fi

for r in "${EXTRA_REFS[@]:-}"; do
  [ -z "$r" ] && continue
  sha=$(git rev-parse -q --verify "$r^{commit}") || { echo "--branch $r: not a commit" >&2; exit 2; }
  name=$(git rev-parse --abbrev-ref "$r" 2>/dev/null); [ "$name" = "HEAD" ] && name="$r@$(git rev-parse --short "$sha")"
  dup=""; for i in "${!C_REF[@]}"; do [ -n "${C_REF[$i]}" ] && [ "$(git rev-parse "${C_REF[$i]}")" = "$sha" ] && dup="${C_KEY[$i]}"; done
  [ -n "$dup" ] && continue
  add_candidate "$name" "$sha" "$name" "ASKED" "passed with --branch"
done

N=${#C_KEY[@]}

# ---------- footprints ---------------------------------------------------------------------
declare -a FP
for i in $(rng 0 $((N-1))); do
  if [ -z "${C_REF[$i]}" ]; then FP[$i]=""; continue; fi
  base=$(git merge-base "$MAIN" "${C_REF[$i]}")
  FP[$i]=$(git diff --name-only "$base" "${C_REF[$i]}" | sort)
done

is_generated() { # path → 0 if a generated/baseline artefact
  case "$1" in
    *baseline*|*.baseline.*|supabase/security/*|apps/web/scripts/port-control-baseline.json) return 0 ;;
    *) return 1 ;;
  esac
}
regen_hint() { # path → the file's own "regenerate" line(s) from its header on origin/main
  git show "$MAIN:$1" 2>/dev/null | head -12 | grep -iE 'regenerat|generated by|--write|--update|pnpm [a-z:-]+baseline' | sed 's/^[#/ ]*//' | head -2 | tr '\n' ' '
}
classify() { # path → tag
  local p="$1"
  case "$p" in
    changelog.d/*) echo "fragment" ;;
    supabase/migrations/*) echo "MIGRATION" ;;
    apps/web/lib/ugat/graph.ts|apps/web/tests/db/ugat-*.baseline.txt) echo "UGAT" ;;
    *) if is_generated "$p"; then echo "GENERATED"; else echo "source"; fi ;;
  esac
}

# ---------- pairwise: shared files + trial merge --------------------------------------------
PAIR_SHARED=(); PAIR_CONFLICT=()  # bash 3.2 has no associative arrays: keyed i*N+j
OVERLAPS=0; PAIR_CONFLICTS=0
for i in $(rng 0 $((N-1))); do
  for j in $(rng $((i+1)) $((N-1))); do
    [ -z "${C_REF[$i]}" ] || [ -z "${C_REF[$j]}" ] && continue
    shared=$(comm -12 <(printf '%s\n' "${FP[$i]}") <(printf '%s\n' "${FP[$j]}") | grep -v '^changelog.d/' | grep -v '^$')
    PAIR_SHARED[$((i*N+j))]="$shared"
    [ -n "$shared" ] && OVERLAPS=$((OVERLAPS+1))
    verdict=$(try_merge "${C_REF[$i]}" "${C_REF[$j]}")
    if [ "$verdict" = "unmergeable" ]; then
      PAIR_CONFLICT[$((i*N+j))]="(a ref no longer resolves — NOT a conflict; re-fetch or the branch was renamed/deleted)"
      continue
    fi
    out=$(git merge-tree --write-tree --name-only "${C_REF[$i]}" "${C_REF[$j]}" 2>&1); rc=$?
    if [ "$verdict" = "conflict" ]; then
      PAIR_CONFLICT[$((i*N+j))]=$(conflict_files "$out")
      PAIR_CONFLICTS=$((PAIR_CONFLICTS+1))
    elif [ $rc -gt 1 ]; then PAIR_CONFLICT[$((i*N+j))]="(merge-tree error rc=$rc: $out)"
    else PAIR_CONFLICT[$((i*N+j))]=""; fi
  done
done

# ---------- landing simulation ---------------------------------------------------------------
# order: --order first (PR numbers or keys), then PRs by number ascending, then LOCAL, then ASKED
ORDER=()
if [ -n "$ORDER_SPEC" ]; then
  IFS=',' read -ra want <<< "$ORDER_SPEC"
  for w in "${want[@]}"; do
    w=$(echo "$w" | tr -d ' '); [[ "$w" =~ ^[0-9]+$ ]] && w="#$w"
    for i in $(rng 0 $((N-1))); do [ "${C_KEY[$i]}" = "$w" ] && ORDER+=("$i"); done
  done
fi
for kind in PR LOCAL ASKED; do
  for i in $(rng 0 $((N-1))); do
    [ "${C_KIND[$i]}" = "$kind" ] || continue
    skip=0; for o in "${ORDER[@]:-}"; do [ "$o" = "$i" ] && skip=1; done
    [ $skip = 1 ] || ORDER+=("$i")
  done
done

SIM_LINES=(); SIM_CONFLICTS=0; cur=$(git rev-parse "$MAIN")
declare -a SIM_STATUS SIM_FILES
for i in "${ORDER[@]}"; do
  if [ -z "${C_REF[$i]}" ]; then SIM_STATUS[$i]="SKIPPED"; SIM_FILES[$i]="ref missing"; continue; fi
  if git merge-base --is-ancestor "${C_REF[$i]}" "$cur"; then SIM_STATUS[$i]="ALREADY-IN"; SIM_FILES[$i]=""; continue; fi
  if [ "$(try_merge "$cur" "${C_REF[$i]}")" = "unmergeable" ]; then
    SIM_STATUS[$i]="UNMERGEABLE"; SIM_FILES[$i]="a ref no longer resolves — NOT a conflict"; continue
  fi
  out=$(git merge-tree --write-tree --name-only "$cur" "${C_REF[$i]}" 2>&1); rc=$?
  if [ $rc -eq 0 ]; then
    tree=$(printf '%s\n' "$out" | head -1)
    cur=$(git commit-tree "$tree" -p "$cur" -p "$(git rev-parse "${C_REF[$i]}")" -m "merge-control simulation: ${C_KEY[$i]}" 2>/dev/null) || { SIM_STATUS[$i]="SIM-ERROR"; SIM_FILES[$i]="commit-tree failed"; continue; }
    SIM_STATUS[$i]="CLEAN"; SIM_FILES[$i]=""
  elif [ $rc -eq 1 ]; then
    SIM_STATUS[$i]="CONFLICT"; SIM_FILES[$i]=$(conflict_files "$out"); SIM_CONFLICTS=$((SIM_CONFLICTS+1))
    # the conflicting one does NOT land; later ones are simulated without it
  else SIM_STATUS[$i]="SIM-ERROR"; SIM_FILES[$i]="$out"; fi
done

# ---------- report ------------------------------------------------------------------------
{
  echo "# MERGE CONTROL — trial-merge snapshot"
  echo
  echo "> Generated by \`build-sessions/merge-control.sh\` at **$NOW** against \`origin/main\` **$MAIN_SHA**."
  echo "> This file is a SNAPSHOT: re-run the script rather than trusting it. Every verdict below is a real"
  echo "> \`git merge-tree\` result, not a grep. A CONFLICT on a GENERATED file is regenerated on the merged tree, never hand-merged."
  echo
  echo "**Verdict:** $N candidates · $OVERLAPS pairwise file overlaps · $PAIR_CONFLICTS pairwise conflicts · **$SIM_CONFLICTS conflicts in the landing order below**"
  echo
  echo "## Candidates"
  echo
  echo "| key | kind | files | generated/migration touched | state |"
  echo "|---|---|---|---|---|"
  for i in $(rng 0 $((N-1))); do
    nfiles=$(printf '%s\n' "${FP[$i]}" | grep -c . )
    hot=""; while read -r f; do [ -z "$f" ] && continue; t=$(classify "$f"); case "$t" in GENERATED|MIGRATION|UGAT) hot="$hot \`$(basename "$f")\`($t)";; esac; done <<< "${FP[$i]}"
    echo "| ${C_LABEL[$i]//|/\\|} | ${C_KIND[$i]} | $nfiles |${hot:- —} | ${C_NOTE[$i]//|/\\|} |"
  done
  if [ ${#STACKED[@]} -gt 0 ]; then echo; echo "Stacked (excluded, contained in an open PR):"; for s in "${STACKED[@]}"; do echo "- $s"; done; fi
  if [ ${#PARKED[@]} -gt 0 ]; then echo; echo "Parked (excluded, behind origin/main by > $STALE_BEHIND):"; for s in "${PARKED[@]}"; do echo "- $s"; done; fi
  echo
  echo "## Landing simulation (each CLEAN one is folded into a simulated main before the next is tried)"
  echo
  echo "| # | candidate | result | conflicting files → what to do |"
  echo "|---|---|---|---|"
  n=0
  for i in "${ORDER[@]}"; do
    n=$((n+1)); st="${SIM_STATUS[$i]:-?}"; detail=""
    if [ "$st" = "CONFLICT" ]; then
      while read -r f; do [ -z "$f" ] && continue
        t=$(classify "$f")
        case "$t" in
          GENERATED|UGAT) detail="$detail \`$f\` → **REGENERATE on the merged tree** ($(regen_hint "$f"));" ;;
          MIGRATION) detail="$detail \`$f\` → two migrations collide; allocate forward with \`pnpm migration:new\`;" ;;
          fragment) detail="$detail \`$f\` → two branches share one changelog fragment; rename one;" ;;
          *) detail="$detail \`$f\` → merge origin/main in the PR's worktree after the earlier one lands, redo the edit there;" ;;
        esac
      done <<< "${SIM_FILES[$i]}"
    else detail="${SIM_FILES[$i]:-}"; fi
    icon="✅"; [ "$st" = "CONFLICT" ] && icon="🔴"; [ "$st" = "ALREADY-IN" ] && icon="↩"; [[ "$st" == SIM-ERROR* || "$st" == SKIPPED ]] && icon="⚠"
    echo "| $n | ${C_LABEL[$i]//|/\\|} | $icon $st | ${detail:- } |"
  done
  echo
  echo "## Pairwise overlap (non-changelog files both candidates edit)"
  echo
  if [ "$OVERLAPS" = 0 ] && [ "$PAIR_CONFLICTS" = 0 ]; then echo "No two candidates touch the same file. Nothing to sequence."; else
    echo "| A | B | shared files | trial merge A+B |"; echo "|---|---|---|---|"
    for i in $(rng 0 $((N-1))); do for j in $(rng $((i+1)) $((N-1))); do
      s="${PAIR_SHARED[$((i*N+j))]:-}"; c="${PAIR_CONFLICT[$((i*N+j))]:-}"
      [ -z "$s" ] && [ -z "$c" ] && continue
      sl=$(printf '%s\n' "$s" | grep -c .); sfiles=$(printf '%s\n' "$s" | sed 's/.*/`&`/' | paste -sd' ' -)
      if [ -n "$c" ]; then res="🔴 CONFLICT: $(printf '%s\n' "$c" | paste -sd' ' -)"; else res="clean today (OVERLAP — second to land re-runs its tests on the merged tree)"; fi
      echo "| ${C_KEY[$i]} | ${C_KEY[$j]} | $sl: $sfiles | $res |"
    done; done
  fi
  echo
  echo "## 🔌 COUPLING — a CLEAN merge that still breaks something"
  echo
  echo "The dangerous case is not a conflict. Candidate A edits a shared module; candidate B never"
  echo "opens that file but **imports** it, in another route, owned by another session. \`merge-tree\`"
  echo "calls that CLEAN and it is, textually — the break is in meaning, and only sequencing prevents it."
  echo
  echo "Worked example this section was built from: \`lib/chat-box-tools.ts\` (the COUPLE's chat panels)"
  echo "imports \`VENDOR_THREAD_TOOLS\` from \`lib/vendor-thread-tools.ts\` (the SUPPLIER's registry) and"
  echo "derives \`COUPLE_THREAD_PANELS\` from it. Editing the supplier registry silently changes the"
  echo "couple's chat box. Nothing on either pull request says so."
  echo
  {
    for i in $(rng 0 $((N-1))); do
      printf '%s\t%s\n' "${C_KEY[$i]}" "${C_LABEL[$i]}"
      printf '%s\n' "${FP[$i]}" | grep -v '^changelog.d/' | grep .
      echo
    done
    for k in $(rng 0 $((${#DIRTY_KEYS[@]}-1))); do
      printf '%s\t%s\n' "${DIRTY_KEYS[$k]%%|*} (uncommitted)" "${DIRTY_KEYS[$k]##*|}"
      printf '%s\n' "${DIRTY_FP[$k]}" | grep .
      echo
    done
  } | python3 "$REPO_ROOT/build-sessions/import-graph.py" --ref "$MAIN" || {
        echo; echo "⚠ **The import scan FAILED — this section proves nothing.** Treat coupling as UNKNOWN."; }
  echo
  echo "⚠ **This resolves \`@/…\` and relative specifiers only.** A re-export, a runtime \`import()\` built"
  echo "from a variable, or a shared database row / feature flag is invisible to it. **An empty table"
  echo "here is not proof of independence** — it means this one mechanism found nothing."
  echo "## Uncommitted work in live worktrees (footprint only — it cannot be trial-merged)"
  echo
  if [ ${#DIRTY_KEYS[@]} -eq 0 ]; then echo "No worktree holds uncommitted changes."; else
    echo "A session's live edits are a build in flight even before its first commit. Overlap below is"
    echo "**advisory**: git has no commit to merge yet, so the verdict is \"these two are writing the same"
    echo "file\", not \"they will conflict\". Treat it as a reason to sequence, not as a conflict."
    echo
    echo "| worktree branch | files | overlaps with |"
    echo "|---|---|---|"
    for k in $(rng 0 $((${#DIRTY_KEYS[@]}-1))); do
      b="${DIRTY_KEYS[$k]%%|*}"; wt="${DIRTY_KEYS[$k]##*|}"
      cnt=$(printf '%s\n' "${DIRTY_FP[$k]}" | grep -c .)
      hits=""
      for i in $(rng 0 $((N-1))); do
        sh=$(comm -12 <(printf '%s\n' "${DIRTY_FP[$k]}") <(printf '%s\n' "${FP[$i]}" | grep -v '^changelog.d/') | grep .)
        [ -n "$sh" ] && hits="$hits ${C_KEY[$i]}($(printf '%s\n' "$sh" | paste -sd' ' -))"
      done
      for m in $(rng $((k+1)) $((${#DIRTY_KEYS[@]}-1))); do
        sh=$(comm -12 <(printf '%s\n' "${DIRTY_FP[$k]}") <(printf '%s\n' "${DIRTY_FP[$m]}") | grep .)
        [ -n "$sh" ] && hits="$hits ${DIRTY_KEYS[$m]%%|*}($(printf '%s\n' "$sh" | paste -sd' ' -))"
      done
      echo "| \`$b\` ($wt) | $cnt |${hits:- none} |"
    done
  fi
  echo
  echo "## Hotspot files across all candidates (edited by ≥2, or generated)"
  echo
  printf '%s\n' "${FP[@]}" "${DIRTY_FP[@]}" | grep -v '^changelog.d/' | grep . | sort | uniq -c | sort -rn | while read -r cnt f; do
    t=$(classify "$f"); if [ "$cnt" -ge 2 ] || [ "$t" = GENERATED ] || [ "$t" = UGAT ] || [ "$t" = MIGRATION ]; then echo "- ×$cnt \`$f\` ($t)"; fi
  done
  echo
  echo "## How a session uses this before it pushes"
  echo
  echo '```bash'
  echo '~/Documents/Claude/Projects/setnayan-platform/build-sessions/merge-control.sh --branch HEAD'
  echo '```'
  echo "If your branch shows CONFLICT or OVERLAP with an open PR: **merge \`origin/main\` after that PR lands, regenerate any GENERATED file on the merged tree, re-run your own tests, then push.** Do not open a PR that the simulation already says will conflict — that is a wasted ~1 h CI round trip and a second merge the owner pays for."
} > "$OUT_MD"

# ---------- stdout summary ------------------------------------------------------------------
echo "merge-control · $NOW · origin/main $MAIN_SHA"
echo "candidates=$N overlaps=$OVERLAPS pairwise_conflicts=$PAIR_CONFLICTS landing_conflicts=$SIM_CONFLICTS"
n=0; for i in "${ORDER[@]}"; do n=$((n+1)); printf '  %2d. %-9s %s\n' "$n" "${SIM_STATUS[$i]:-?}" "${C_LABEL[$i]}"; [ "${SIM_STATUS[$i]:-}" = CONFLICT ] && printf '%s\n' "${SIM_FILES[$i]}" | sed 's/^/        ⤷ /'; done
for s in "${STACKED[@]:-}"; do [ -n "$s" ] && echo "  stacked: $s"; done
for s in "${PARKED[@]:-}"; do [ -n "$s" ] && echo "  parked:  $s"; done
for k in $(rng 0 $((${#DIRTY_KEYS[@]}-1))); do
  [ ${#DIRTY_KEYS[@]} -eq 0 ] && break
  echo "  dirty:   ${DIRTY_KEYS[$k]%%|*} — $(printf '%s\n' "${DIRTY_FP[$k]}" | grep -c .) uncommitted files (${DIRTY_KEYS[$k]##*|})"
done
echo "report → $OUT_MD"
[ "$SIM_CONFLICTS" -gt 0 ] && exit 1 || exit 0
