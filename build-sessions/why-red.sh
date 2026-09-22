#!/bin/zsh
# why-red.sh <PR#> — name the failing STEP and the real assertion, not the job.
# 🔑 CI blames the last step; only the step list says which guard exited 1.
pr=$1
url=$(gh pr checks $pr 2>/dev/null | awk -F'\t' '$2=="fail"{print $4}' | head -1)
[ -z "$url" ] && { echo "  #$pr: no failing check"; exit 0; }
jid=$(basename "$url" | sed 's/[^0-9]//g')
echo "  job $jid  $url"
log=$(mktemp)
gh api "repos/{owner}/{repo}/actions/jobs/$jid/logs" > $log 2>/dev/null
echo "  --- failing steps ---"
gh api "repos/{owner}/{repo}/actions/jobs/$jid" --jq '.steps[]|select(.conclusion=="failure")|"    \(.number)\t\(.name)"' 2>/dev/null
echo "  --- assertions / errors / guard output ---"
  # 🔑 a job can fail in MORE THAN ONE step. Print every failing step and match guard
  # output (✗ …) as well as TAP, or the second failure stays invisible.
grep -aE "(^|[^#] )not ok [0-9]+ -|error TS[0-9]+:|^##\[error\]|✗ |file\(s\) grew|FAILED" $log \
  | sed 's/\x1b\[[0-9;]*m//g' | sed -E 's/^[0-9T:.\-]+Z //' | sort -u | head -20 | cut -c1-190 | sed 's/^/    /'
rm -f $log
