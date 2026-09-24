# HANDOFF — finish the 3 sessions (written 2026-09-22)

> For a NEW Claude Code account. Read this whole file before touching anything.
> ⚠ A handoff is not evidence — re-measure every line with the command next to it.
> Model/effort to run the follow-up: **Opus 5 · medium** (watching + small CI fixes). Use **high** only if a PR needs a real code fix.

Repo: `~/Documents/Claude/Projects/setnayan-platform` (NOT `~` — that is a stale checkout, never read code from it).
Spec corpus: `~/Documents/Claude/Projects/Setnayan/`.

---

## 0. First 60 seconds — re-measure the state

```bash
cd ~/Documents/Claude/Projects/setnayan-platform && git fetch -q origin
gh pr list --state open --limit 40 --json number,title,headRefName,mergeStateStatus,autoMergeRequest \
  --jq '.[] | "\(.number)\t\(.mergeStateStatus)\tauto=\(.autoMergeRequest!=null)\t\(.title)"'
for n in 5831 5837 5838 5843 5845 5846 5847; do echo "== $n $(gh pr view $n --json state --jq .state)"; gh pr checks $n | grep -v pass | cut -f1,2; done
```

State when this was written (all auto-merge ARMED, all pushed, no unpushed local commits):

| Session | PR | Branch | State | Stacking |
|---|---|---|---|---|
| **A · Profile** | #5831 formal name + @tag + search | `claude/profile-formal-name` | ⚠ **CONFLICTING** (53 behind main) | base of #5837 |
| | #5837 Profile & settings in six groups | `claude/profile-grouped-settings` | BLOCKED = CI running | **contains all of #5831** |
| **B · Guests / seats** | #5838 each extra seat is a chair | `claude/extra-seats-sit-beside` | BLOCKED = CI running | base |
| | #5843 unlisted guest, quick-add line | `claude/unlisted-quick-add` | BLOCKED = CI running | contains #5838's commit |
| | #5846 extra seats lock + name each seat | `claude/seats-lock-and-names` (worktree `../wt-gl`) | BLOCKED = CI running | contains #5843 + #5838 |
| **C · Invitation** | #5845 the pass says the right arrival time | `claude/the-pass-arrives-on-time` | BLOCKED = CI running | independent |
| | #5847 the first screen is the invitation card | `claude/the-invitation-card` (worktree `../wt-card`) | BLOCKED = CI running (5 checks pending) | independent |

"BLOCKED" here only meant **required checks still pending** — `typecheck + lint` holds the ~45–55 min DB-replay step. 33+ minutes in is normal, not stalled.

Dependencies already merged (do not rebuild): #5827 (any-order search) · #5834 (+1…+4 count) · #5839 (unlisted guests) · #5844 (pass looks like a pass, hub moves).

Trial merges I ran on 2026-09-22 against `origin/main`: **#5845 + #5847 merge clean together** (both touch `apps/web/app/[slug]/_components/site-body.tsx`) · **#5837 + #5846 merge clean together**. #5831 alone conflicts on exactly one file: `supabase/security/exposure-surface.baseline.txt`.

---

## 1. Watch-outs, per session

### A · Profile (#5831 → #5837)
1. **#5831 is CONFLICTING, and a CONFLICTING PR runs NO CI** (it shows zero failing AND zero running — count the checks, don't trust "no red").
2. **Easiest path: let #5837 merge.** It contains every #5831 commit, so when #5837's merge commit lands, #5831's head becomes reachable from `main` and GitHub should flip #5831 to MERGED by itself. Verify: `gh pr view 5831 --json state`. If it stays OPEN after #5837 merged, close it with a comment "landed via #5837" (confirm `git merge-base --is-ancestor origin/claude/profile-formal-name origin/main` first).
3. **If #5837 goes CONFLICTING too**, the conflict will again be the **generated exposure baseline**. NEVER hand-edit it. Regenerate on the merged tree:
   ```bash
   git merge origin/main   # in the PR's worktree
   node scripts/lint-exposure-baseline.mjs --help   # read its usage; regenerate with its write flag, then re-run it without to confirm OK
   ```
   The regenerated file should differ from `main` only by the PR's new columns (`users.name_prefix/first_name/middle_name/last_name/name_suffix/name_search`) plus the header.
4. It carries a **migration** (`supabase/migrations/20271237898004_users_formal_name.sql`). Let the pipeline apply it. **Never** apply it directly to prod (MCP `apply_migration`, local `db push`, raw SQL) — that orphans the prod ledger and freezes every later deploy. If `deploy-prod` fails with "Remote migration versions not found in local migrations", STOP and tell the owner; the repair command is owner-only.
5. After merge, click-check on production: `/profile` shows six groups (Profile · Guest details · Privacy · Sign-in & security · Preferences · Account); old links `#url-slug`, `#privacy`, `?slug_saved=1` land on the right group; People search finds "Casasola Ice" and "@ice". Known limit (by design, stated in PR): password/sign-out *errors* show on the Profile group.

### B · Guests / seats (#5838 → #5843 → #5846)
1. Each PR contains the one below it, so **any merge order works**; if #5846 merges first, #5838/#5843 should auto-flip to MERGED (same rule as A.2).
2. #5843/#5846 regenerated the exposure baseline (`plus_one_count`). If either conflicts after another PR lands, **regenerate — never hand-merge** (A.3).
3. SPEC IMPACT rows (`DECISION_LOG.md` 2026-09-21 🪑 and 🔒) are **uncommitted edits in the corpus** — see `corpus-uncommitted.patch` in the zip. Do not lose them; do not commit other sessions' corpus edits blindly either.
4. After merge, as a real couple (testnayan1 by **email+password**, never the Google button — `is_internal` passes every paid gate and gives a false green): set a guest to +2 → two "+ TBA · brought by …" rows appear beside them in the seat plan; finalize the list → the + control is locked with a reason; on the guest's invitation, name boxes per seat appear and a blank box stays TBA.
5. Security property to keep if you touch the code: the invitation reply **trusts nothing** — a seat id is honoured only if it's one of that guest's seats, and a reply can never mint more seats than the couple gave (`planSeatNames`, `lib/extra-seats.test.ts`).

### C · Invitation (#5845, #5847)
1. **#5847 was never seen rendered before merge** (this Mac lacks the server key). You MUST check it on production after it serves: open the live event page (e.g. `/cale-ice`) logged out and as a guest → paper card with gold hairline, names with italic "and", date between gold rules, countdown below the first screen, music/account buttons sit on the pinned top bar (not over the pass). An event with a hero photo keeps the old masthead.
2. **#5845 check:** as a test guest on `/cale-ice`, the pass must say **1:30 PM**, not 9:30 PM, and match the programme.
3. `deploy-prod` green ≠ served yet — the job only fires the Vercel hook; wait for the build, then compare the served commit to `origin/main` before calling anything live.

---

## 2. If a PR goes red — how to finish it

1. Read which step failed: `gh pr checks <n>` then `gh run view <run-id> --log-failed | tail -80`. CI often blames "encoder" for a guard that exited 1 — read the step list; only `lint:dup-rule` and `test:db:ci` are not continue-on-error.
2. Check whether `main` itself is red (`gh run list --branch main --limit 5`). If so, the PR is not at fault — wait for main to go green, then `git merge origin/main && git push` to refresh.
3. Work in the PR's own worktree (`../wt-gl`, `../wt-card`) or make one: `git worktree add ../wt-fix-<n> claude/<branch>`. A fresh worktree needs `pnpm install` first, or tsc/tests "pass" while resolving nothing.
4. Run unit tests **from `apps/web`** (otherwise every `@/…` import dies). `pnpm lint` does NOT run the ~27 repo guards — they're separate CI steps.
5. This Mac has 16 GB: **one heavy job at a time** (tsc, db suite, build). Three concurrent `tsc` runs have shut the laptop down.
6. Push the fix to the same branch; auto-merge stays armed. If you ever open a new PR: `gh pr merge <n> --auto --merge` right after.
7. Add a `changelog.d/<branch-slug>.md` fragment for any code change. Never edit `CHANGELOG.md`/`STATUS.md` in a feature PR. Never run `changelog-collect` as a check (it deletes every fragment).
8. A watcher must not read silence as success: a gh outage returns empty, not "merged". Check `state` explicitly.

---

## 3. When everything is merged
- Prune worktrees immediately: `git worktree remove ../wt-gl --force; git worktree remove ../wt-card --force; git worktree prune` (only if no live session is still using them).
- Update `build-sessions/BUILD-SEQUENCE.md` (PRs merged, owner checks done/pending).
- Next planned work (from #5847's own body): **the compact hub cards** — second of two merges toward canvas "1 · Arrival" (`build-sessions/ARRIVAL-SEQUENCE.md`). Not started.
- Owner-only checks still open (from BUILD-SEQUENCE): guest personal link (pass facts, no NFC, face pop-up) · install on iPhone + Android · mirrored livestream autoplay on a TV · a ninong sees "Suit, in the wedding colours".

---

## 4. What's in the zip
| File | Why |
|---|---|
| `HANDOFF-3-SESSIONS-2026-09-22.md` | this file |
| `pr-bodies.txt` | full description of all 7 PRs (what + how verified) |
| `branches.bundle` | git bundle of all 7 branches — only needed if GitHub is unreachable. Restore: `git fetch branches.bundle 'refs/heads/*:refs/remotes/bundle/*'` |
| `corpus-uncommitted.patch` | the uncommitted `DECISION_LOG.md` / spec edits in `~/Documents/Claude/Projects/Setnayan` (SPEC IMPACT of B). Apply with `git apply` in the corpus only if they're missing there. |
| `build-sessions/` | controller files: `BUILD-SEQUENCE.md`, `ARRIVAL-*.md`, `REPORT-PEOPLE-PROFILE-2026-09-21.md`, `HANDOFF-AUDIT-*.md` |
| `memory/` | this account's Claude memory (does not travel between accounts). Copy into the new account's `~/.claude/projects/-Users-icecasasola-Documents-Claude-Projects-setnayan-platform/memory/` to keep the lessons. |
