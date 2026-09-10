# LS2 — a finished wedding returns its channel

**Model:** Sonnet 5 · **Effort:** high · **Wave:** now · **Runs in parallel with LS1**

Measured against `origin/main` @ `1838a68c6` and the live database on 2026-09-02. Re-fetch before you act.

Start a new Claude Code session and paste EVERYTHING below the rule.

---
---

Read the repo's own CLAUDE.md and the corpus CLAUDE.md first, then follow RULE 0: assume what you
are about to build already exists, and locate it before writing anything. On this stream RULE 0 has
now paid SEVEN times — "invite an off-platform supplier", "a supplier can only tap six fixed
messages", "the camera screen says 3 cameras free to test with", the host stranger-copy defect, the
NPC residency rows, the camera-claimer name, and the ENTIRE captured-by-person build were all
reported as missing and ALL already ship.

0. MEASURE AGAINST origin/main, NEVER A LOCAL CHECKOUT. `git fetch` first, then read with
   `git grep <pattern> origin/main -- <path>`. The main checkout on this machine was 2237 commits
   behind while reporting itself as main, and it produced four false findings in one hour —
   including two sessions scoped to build things that already shipped.
   NEVER ANCHOR ON A LINE NUMBER. Grep for a string. Line numbers rot between fetches.

0b. A `git add` THAT STAGES NOTHING REPORTS SUCCESS. This repo's root is an ALLOWLIST: `.gitignore`
   line 18 is `/*`, so EVERY new top-level file or directory is ignored unless a `!/path` line below
   it says otherwise. `git add <new-top-level-path>` then exits 0 having staged nothing, `git status`
   shows nothing, and the work never enters the repo. `.gitignore`'s own header records this
   swallowing a README once already. If you create ANY new top-level path, add its `!/path` line in
   the SAME commit and verify with `git check-ignore -v <path>` before believing it is staged.
   Nested paths (under apps/, supabase/, changelog.d/ …) are unaffected.

0c. A CHECK THAT CANNOT FAIL IS NOT A CHECK. Twice in one day a verification command returned a
   confident FALSE answer because of its own shape, not the repo's state:
     · `for f in $list; do git cat-file -e "ref:$f"; done < <(...)` — a command inside the loop
       consumed the loop's stdin, so every probe failed and reported "97 files absent upstream".
       All 97 were present.
     · `git check-ignore -v X | head -2 || echo "not ignored"` — `||` binds to the PIPELINE, whose
       status is `head`'s zero, so the fallback branch can never run and BOTH outcomes print nothing.
     · `timeout 60 <cmd>` printed `DB_EXIT=127 elapsed=0s` — **`timeout` does not exist on macOS**,
       so the command never ran. 127-in-zero-seconds reads as a fast decisive result if only the exit
       code is printed. 🔑 **PRINT ELAPSED TIME BESIDE EXIT STATUS.** Duration is a cheap, general
       detector for "the command did not run", which no exit code alone can distinguish from "the
       command ran and failed".
   Before believing a verification, ask what output the FAILING case would produce and confirm the
   command can produce it. Prefer an explicit `if cmd; then … else … fi` over `&&`/`||` after a pipe,
   and prefer set arithmetic (`comm`, `sort -u`) over per-item loops that shell out. If a result is
   implausible — everything present, everything absent, silence from both branches — suspect the
   check before the repo.

WORKING RULES — every one has cost this project real work before:

1. Branch, then `git worktree add` IMMEDIATELY — beside the repo, NEVER in /tmp, and branch FROM
   origin/main. A finished, proved change was lost to a /tmp worktree on 2026-08-28.
2. `pnpm install` in the worktree BEFORE running anything. A run in an uninstalled worktree means
   nothing.
3. `git fetch` before branching. origin/main moved 2237 commits ahead of a checkout that still
   called itself main.
4. PUSH THE MOMENT IT TYPECHECKS. Do not batch a session's work into one commit at the end.
5. Typecheck with the exit code printed beside the error count:
   NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json > /tmp/tsc.log 2>&1; \
     echo "TSC_EXIT=$?"; grep -c 'error TS' /tmp/tsc.log
   An EMPTY log is NOT a clean one — tsc exits 134/143/144 on abort and that reads as zero errors.
   Require TSC_EXIT=0 printed beside ERROR_LINES=0; either one alone is a lie. Never run two.
6. Require `# tests` to be NON-ZERO before believing any pass. Zero-tests-zero-failures is
   byte-identical to success and exits 0. A --test glob that matches nothing behaves identically.
7. Mutation-test every assertion you add and PRINT THE OCCURRENCE COUNT before → after. An
   unmeasured sabotage proves nothing. If a well-formed sabotage reports GREEN, suspect the
   sabotage before the guard.
8. Read the live object, never a migration comment or a docblock. A migration comment is not
   evidence; neither is a decision log; neither is this prompt.
9. Add a changelog fragment in changelog.d/ — never edit CHANGELOG.md or STATUS.md directly.
10. Auto-merge is the standing default: `gh pr merge <n> --auto --merge` right after creating it.

AUTONOMY RULES — how this session finishes rather than stalls:

11. DONE MEANS MERGED. After arming auto-merge, poll until the PR reads MERGED. If a required
    check fails, read the failure, fix it, push again. Do NOT hand back a red or open PR and call
    the session complete. If the same check fails twice for the same reason, STOP and escalate.
12. NEVER STALL ON A GATE. If a feature flag's production value is unknown, build behind the
    EXISTING flag, defaulted off, and record the open question in your handback. Do not stop and
    wait for an answer you were not promised.
13. WRITE STATE AS YOU GO. Create the changelog fragment on your FIRST commit, not your last. If
    you are running low on context, commit and push everything already proved, and write the next
    concrete step into the fragment so a fresh session resumes instead of restarting.
14. IF THE DEFECT IS NOT THERE, SAY SO AND STOP. Do not invent adjacent work to justify the
    session. Report what you measured, with the command and its output. That is a complete and
    successful session — two of this program's ten original sessions ended that way.
15. ONE SESSION = ONE BRANCH = ONE PR. If the work genuinely needs a second PR, say so in the
    handback before opening it.
16. HAND BACK IN THIS EXACT FORMAT so the overseer can verify without re-reading everything:

    SESSION: <C-id>
    PR: <#number> <MERGED|OPEN|BLOCKED>
    MEASURED-AGAINST: origin/main @ <sha>   (must be a fetched sha, not a local HEAD)
    TSC_EXIT=<n> ERROR_LINES=<n>
    TESTS: <# run> passed, <# run> total   (must be non-zero)
    MUTATION: <assertion> — before <n> occurrences, after <n>
    PREMISE: <HELD | FALSE — with the command that showed it>
    OWNER QUESTION: <none, or the one thing you could not resolve>
    LEFT UNDONE: <none, or exactly what and why>

---

TASK — LS2: the pool answers "no channel available" while holding one for a wedding that ended.

⚠ THIS WAS BUILT ONCE AND LOST before it was committed. Re-verify every premise below.

THE LIVE STATE, 2026-09-02. `live_studio_roam_channel_pool` holds ONE channel, `status =
'checked_out'` to Cale & Ice since 06:45, while both of that event's `live_studio_roam_streams`
rows are `complete`. The admin board reads "1 channel · 0 ready to claim". Re-measure:
  select id, status, checked_out_event_id, checked_out_at from live_studio_roam_channel_pool;
  select status, count(*) from live_studio_roam_streams group by 1;

🔑 WHY THIS BECAME URGENT TODAY AND WAS SURVIVABLE YESTERDAY. `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY`
went ON in production on 2026-09-02, closing the BYO connect door. Until then a host with no pool
channel connected their own YouTube and still reached air. Now the pool is the ONLY route, and
production holds ONE channel — so a single un-released checkout is the entire product down for
every other event, silently, until an admin notices.

🚫 MANUAL RELEASE IS DELIBERATE — DO NOT MAKE END RELEASE THE CHANNEL. Read the note beginning
"THE POOL CHANNEL IS DELIBERATELY *NOT* RELEASED HERE" in
`app/dashboard/[eventId]/studio/panood/setup/actions.ts`. Two reasons, both still standing: the
spec follows release with a WIPE that is not built (and § 6 promises the archive indefinite
retention, so it must not happen silently), and auto-release would not survive a host who ends
after the ceremony and restarts for the reception. Neither is a reason to turn away a wedding
happening TODAY.

🚫 AND DO NOT BUILD A CRON. All five `apps/web/app/api/cron/*` routes are DORMANT — no
`vercel.json`, and no workflow in `.github/` calls any of them (verify: `grep -rl "api/cron"
.github/`). A new one needs a secret this repo does not hold and would ship green-and-inert. That
exact trap is documented in `.github/workflows/deploy-drift-monitor.yml`'s header: a workflow
"shipped asking for a secret this repo has NEVER held" and "went GREEN having checked nothing".
This codebase already refreshes pool tokens LAZILY at use time; match that.

BUILD — reclaim at claim time, inside `checkoutPoolChannel` in
`apps/web/lib/live-studio-roam-provision.ts`.

  · LAST RESORT, NEVER EAGER. Sweep ONLY on the branch where the availability read returns nothing
    (`freeErr || !free`). With a second channel connected it then never fires at all. That ordering
    IS the safety argument: a mistaken reclaim costs a host a channel they had stopped using; not
    reclaiming costs a wedding happening today its whole broadcast, on a date that cannot move.
  · TWO CONDITIONS, BOTH REQUIRED. (1) `checked_out_at` older than `PANOOD_WINDOW_HOURS` — IMPORT
    it from `lib/panood-watermark.ts`, never re-type an hour count; that module already owns "how
    long one broadcast day is" and it is import-free and pure. This is the clause protecting the
    end-and-restart host, whose gap is hours. (2) `releasePoolChannelIfIdle` agrees — it refuses
    while ANY of that event's streams is outside complete/errored, AND refuses on an unreadable
    stream table, so a transient fault cannot look like "the wedding is finished".
  · ONE RELEASE PATH. DELEGATE to `releasePoolChannelIfIdle`; do not write the pool row yourself.
    Two mechanisms deciding "is this channel free" will eventually disagree, and the way they
    disagree is a live wedding losing its channel mid-vow.
  · RECLAIM IS NOT A WIPE. Say so in a comment. It returns the row to 'available' and deletes
    nothing; § 6's indefinite retention is untouched.
  · SWEEP AT MOST ONCE per checkout — a second pass finds the same rows and turns the existing
    bounded retry into a slow spin.
  · LOG every reclaim. A channel changing hands with nobody asking is exactly what cannot be
    reconstructed later from an empty log.

GUARD — new file, own name. Slice windows PER FUNCTION (`checkoutPoolChannel`,
`reclaimStaleCheckouts`), not per file — the module is long and names these symbols in several
places. Use the canonical `lib/strip-comments.ts` (a new file with its own stripper fails
`scripts/lint-one-comment-stripper.mjs`). Pin all four: reclaim runs AFTER the availability read,
the grace period is the imported constant and not a literal, reclaim delegates rather than
`.update(`s the pool, and the once-only guard exists. MUTATION-TEST each of the four separately —
each must turn exactly one test red. Restore by SHA-256 and re-run green.

RUN THE WHOLE DB SUITE (`pnpm test:db:ci`, ~25 min) plus `pnpm test:unit` and `npx tsc --noEmit`.
COMMIT BEFORE STARTING A LONG VERIFY — the previous attempt at this task was lost that way.

OWNER QUESTION TO SURFACE, do not decide it: one pool channel is a single point of failure now
that BYO is closed. Connecting more channels is the cheaper fix and needs no code (~97 cap slots
remain). Say so in the handback.

SPEC IMPACT: § 4h — release/reuse. Reclaim is release WITHOUT the wipe that section pairs it with;
flag it, do not edit the corpus to match.
