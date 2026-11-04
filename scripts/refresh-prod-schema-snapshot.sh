#!/usr/bin/env bash
# Refresh supabase/security/prod-schema.snapshot.txt from PRODUCTION and, if it
# changed, propose it as ONE pull request from a fixed bot branch.
#
# Run by .github/workflows/deploy-prod.yml right after `supabase db push`
# succeeds (see the docblock on that step for WHY). Read-only against prod: the
# generator only runs two SELECTs through `supabase db query --linked`.
#
# 🔑 THIS SCRIPT NEVER FAILS THE DEPLOY. Every failure becomes a `::warning::`
# and exit 0. The deploy is the important part; a missed refresh only means the
# next deploy tries again (and, at worst, the freshness test names the manual
# command — exactly the state before this script existed).
#
# 🔑 IT NEVER FORCE-PUSHES (repo rule). While its PR is open it brings `main` in
# with a merge commit and adds a commit on top. A bot branch whose PR is already
# merged or closed is deleted and started again from the deployed commit.
#
# Environment:
#   BOT_PUSH_TOKEN   AUTOMERGE_PAT. REQUIRED to push/open the PR: a PR opened or
#                    pushed with the default GITHUB_TOKEN fires NO workflows, so
#                    its required checks would never run and it could never merge.
#   GITHUB_REPOSITORY  owner/repo (set by Actions).
#   DRY_RUN=1        do everything locally (generate, diff, commit on the local
#                    bot branch) but never push, open, or arm anything.
#   SNAPSHOT_GENERATE_CMD  override the generator command (dry-run proofs only).
#
# Local dry run (no prod access needed when the generator is overridden):
#   DRY_RUN=1 SNAPSHOT_GENERATE_CMD=true bash scripts/refresh-prod-schema-snapshot.sh

set -uo pipefail

SNAP='supabase/security/prod-schema.snapshot.txt'
BRANCH='bot/prod-schema-snapshot'
FRAG_GLOB='changelog.d/bot-prod-schema-snapshot-*.md'
GEN_CMD="${SNAPSHOT_GENERATE_CMD:-npx --yes tsx@4.22.3 apps/web/scripts/gen-schema-snapshot.ts}"
DRY_RUN="${DRY_RUN:-0}"
BOT=(-c user.name='prod-schema-snapshot-bot' -c user.email='prod-schema-snapshot-bot@users.noreply.github.com')

warn() { echo "::warning title=prod schema snapshot not refreshed::$*"; }
# Any unexpected failure: warn and leave with 0 so the deploy job stays green.
# (No `set -E`: a failing `$(…)` then surfaces here, in the main shell, instead of
# the trap exiting only the subshell and the script carrying on with an empty value.)
trap 'warn "step failed at line $LINENO (exit $?) — the deploy is unaffected; the next deploy retries."; exit 0' ERR
set -e

cd "$(git rev-parse --show-toplevel)"
start_ref="$(git rev-parse HEAD)"

# ── 1. Generate (read-only) ──────────────────────────────────────────────────
echo "Generating the snapshot from production (read-only)…"
if ! $GEN_CMD; then
  warn "the generator failed (see its output above). Production was only read; nothing was written anywhere. The deploy is unaffected."
  git checkout -q -- "$SNAP" 2>/dev/null || true
  exit 0
fi

# ── 2. Did anything change? ──────────────────────────────────────────────────
if git diff --quiet -- "$SNAP"; then
  echo "✓ Snapshot already matches production — nothing to propose."
  exit 0
fi

count() { awk -v s="[$1]" '$0==s{on=1;next} /^\[/{on=0} on && $0!~/^#/ && NF{n++} END{print n+0}' "$SNAP"; }
ledger_n="$(count ledger)"
cols_n="$(count columns)"
nn_n="$(count notnull)"
head_v="$(awk '$0=="[ledger]"{on=1;next} /^\[/{on=0} on && $0!~/^#/ && NF{v=$0} END{print v}' "$SNAP")"
repo_n="$(find supabase/migrations -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')"
echo "Snapshot changed: ledger ${ledger_n} (head ${head_v}) · ${cols_n} columns · ${nn_n} NOT NULL · repo files ${repo_n}"
git --no-pager diff --stat -- "$SNAP"

# ── 3. What is already proposed? ─────────────────────────────────────────────
if [ "$DRY_RUN" != "1" ] && [ -z "${BOT_PUSH_TOKEN:-}" ]; then
  warn "AUTOMERGE_PAT is not set. A PR pushed with the default GITHUB_TOKEN runs no CI and can never merge, so none was opened. Refresh by hand: pnpm --filter @setnayan/web schema:snapshot"
  git checkout -q -- "$SNAP"
  exit 0
fi
if [ -n "${BOT_PUSH_TOKEN:-}" ]; then export GH_TOKEN="$BOT_PUSH_TOKEN"; fi

pr=''
if [ -n "${GH_TOKEN:-}" ]; then
  pr="$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$BRANCH" --state open --json number --jq '.[0].number // empty')"
fi
remote=''
if git fetch -q origin "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}" 2>/dev/null; then
  remote="refs/remotes/origin/${BRANCH}"
fi

# Same snapshot already on the bot branch → do not churn CI with another push.
if [ -n "$remote" ] && git diff --quiet "$remote" -- "$SNAP"; then
  git checkout -q -- "$SNAP"
  if [ -n "$pr" ]; then
    echo "✓ PR #${pr} already proposes this exact snapshot — not pushing again."
    if [ "$DRY_RUN" != "1" ]; then
      gh pr merge "$pr" --repo "$GITHUB_REPOSITORY" --auto --merge \
        || warn "could not arm auto-merge on #${pr}; it will wait for a human."
    fi
  else
    echo "::notice title=prod schema snapshot::${BRANCH} already carries this snapshot but has no open PR (closed without merging?) — not reopening it."
  fi
  exit 0
fi

# ── 4. Commit on the bot branch ──────────────────────────────────────────────
generated="$(mktemp)"
cp "$SNAP" "$generated"
git checkout -q -- "$SNAP"

if [ -n "$pr" ] && [ -n "$remote" ]; then
  mode='update'
  git switch -q -C "$BRANCH" "$remote"
  # Bring main in with a MERGE COMMIT (never a force-push). On a conflict main's
  # side wins: the only files this branch owns are the snapshot, overwritten
  # just below, and its own fragments, removed just below.
  git "${BOT[@]}" merge -q --no-edit -X theirs "$start_ref"
  for f in $FRAG_GLOB; do
    [ -e "$f" ] || continue
    git cat-file -e "${start_ref}:${f}" 2>/dev/null || git rm -q -- "$f"
  done
else
  mode='fresh'
  git switch -q -C "$BRANCH" "$start_ref"
fi

cp "$generated" "$SNAP"
rm -f "$generated"
today="$(date -u +%Y-%m-%d)"
fragment="changelog.d/bot-prod-schema-snapshot-${head_v}.md"
cat > "$fragment" <<EOF
## ${today} · chore(security): refresh the prod schema snapshot (automatic, read-only)

Regenerated by \`deploy-prod.yml\` right after \`supabase db push\` succeeded, with
\`apps/web/scripts/gen-schema-snapshot.ts\` reading production through the
already-linked project (two SELECTs; nothing is written to prod).

- ledger: ${ledger_n} migrations (head \`${head_v}\`) · repo migration files: ${repo_n}
- schema: ${cols_n} columns, ${nn_n} NOT NULL

Keeps the "prod snapshot is fresh enough" check in
\`apps/web/tests/db/schema-drift.db.test.ts\` (ceiling 40) from going red on every
PR at once, as it did when the snapshot fell 41 behind.

SPEC IMPACT: None.
EOF
git add -- "$SNAP" "$fragment"
git "${BOT[@]}" commit -q \
  -m "chore(security): refresh the prod schema snapshot (ledger ${ledger_n}, head ${head_v})" \
  -m "Generated read-only by deploy-prod.yml after db push. See scripts/refresh-prod-schema-snapshot.sh."

# The PR must hold the snapshot and ONE fragment — nothing else, ever.
extra="$(git diff --name-only "$start_ref" HEAD | grep -vxF -e "$SNAP" -e "$fragment" || true)"
if [ -n "$extra" ]; then
  warn "the bot branch would change more than the snapshot and its fragment (${extra//$'\n'/, }) — not pushing."
  git switch -q --detach "$start_ref"
  exit 0
fi
echo "Committed on ${BRANCH} (${mode}). Diff against the deployed commit:"
git --no-pager diff --stat "$start_ref" HEAD

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY RUN — would push ${BRANCH} (${mode}, no force) and open/update its PR with auto-merge armed. Pushed nothing."
  git switch -q --detach "$start_ref"
  exit 0
fi

# ── 5. Push with the PAT (so the PR's checks run). Never a force-push. ───────
# The empty extraheader drops the GITHUB_TOKEN header actions/checkout
# persisted, so the push is attributed to the PAT and fires `pull_request`.
push_url="https://x-access-token:${BOT_PUSH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
if [ "$mode" = 'fresh' ] && [ -n "$remote" ]; then
  # Its PR is merged or closed: retire the old branch, then start it again.
  git -c http.https://github.com/.extraheader= push -q "$push_url" --delete "$BRANCH"
  echo "Deleted the stale ${BRANCH} (its PR is no longer open)."
fi
git -c http.https://github.com/.extraheader= push -q "$push_url" "HEAD:refs/heads/${BRANCH}"
echo "Pushed ${BRANCH}."

# ── 6. Open or update ONE PR, then arm auto-merge (merge commit) ────────────
body="Automatic, read-only refresh of \`${SNAP}\` from production, made by \`deploy-prod.yml\` right after \`supabase db push\` succeeded.

- ledger: **${ledger_n}** migrations (head \`${head_v}\`) · repo migration files: ${repo_n}
- schema: ${cols_n} columns, ${nn_n} NOT NULL

Contains only the snapshot and a changelog fragment. Nothing is written to production; the generator runs two SELECTs.

If a check on this PR is red, it is telling the truth about production (for example a \`CREATE TABLE IF NOT EXISTS\` that silently no-opped) — investigate it; do not regenerate over it.

Workflow run: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID:-local}"

if [ -z "$pr" ]; then
  url="$(gh pr create --repo "$GITHUB_REPOSITORY" --base main --head "$BRANCH" \
    --title "chore(security): refresh the prod schema snapshot (automatic)" --body "$body")"
  pr="${url##*/}"
  echo "Opened PR #${pr}: ${url}"
else
  gh pr edit "$pr" --repo "$GITHUB_REPOSITORY" --body "$body" >/dev/null
  echo "Updated PR #${pr}."
fi

gh pr merge "$pr" --repo "$GITHUB_REPOSITORY" --auto --merge \
  || warn "could not arm auto-merge on #${pr}; it will wait for a human."
echo "✓ Done."
