#!/bin/bash
# revert-line-check.sh <batch-ref> <pr>... — for each PR, every line main ADDED since the PR's base (absent from EVERY
# merge-base of PR head and main-in-batch, so a stacked PR's own edits are not counted), in files the PR touches, must
# still be in the batch's version of the file. main-in-batch = merge-base(batch, origin/main).
set -u
B=$1; shift
M=$(git merge-base "$B" origin/main)
GEN='(\.generated\.|\.baseline\.(txt|json)$|baseline\.json$|^CHANGELOG\.md$|\.png$|\.jpg$|\.webp$)'
TRIV='^[[:space:]]*[]{}()\[;,]*[[:space:]]*$'
T=$(mktemp -d); total=0; dropped=0; checked=0
for pr in "$@"; do
  H=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
  bases=$(git merge-base --all "$H" "$M")
  n=0; c=0
  for f in $(git diff --name-only $(echo "$bases" | head -1) "$H" | /usr/bin/grep -Ev "$GEN"); do
    git show "$M:$f" > "$T/m" 2>/dev/null || continue
    : > "$T/b"; for b in $bases; do git show "$b:$f" >> "$T/b" 2>/dev/null; done
    # lines in main-in-batch not present in any base = added by main since the PR's base
    /usr/bin/grep -vxF -f "$T/b" "$T/m" 2>/dev/null | /usr/bin/grep -Ev "$TRIV" | sort -u > "$T/added"
    [ -s "$T/b" ] || sort -u "$T/m" | /usr/bin/grep -Ev "$TRIV" > "$T/added"
    [ -s "$T/added" ] || continue
    c=$((c+$(wc -l < "$T/added")))
    if ! git show "$B:$f" > "$T/x" 2>/dev/null; then echo "#$pr  $f  — file GONE in batch"; n=$((n+1)); continue; fi
    while IFS= read -r line; do
      echo "#$pr  $f  — dropped: $(printf '%s' "$line" | sed 's/^[[:space:]]*//' | cut -c1-140)"; n=$((n+1))
    done < <(/usr/bin/grep -vxF -f "$T/x" "$T/added")
  done
  total=$((total+1)); dropped=$((dropped+n)); checked=$((checked+c))
  echo "-- #$pr: $c lines checked, $n dropped"
done
rm -rf "$T"
echo "revert check: $total PRs, $checked lines checked, $dropped dropped lines (batch $B, main-in-batch ${M:0:10})"
