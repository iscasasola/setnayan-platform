# LS6 — ₱2,500 once per event, and the broadcast day stops existing

**Model:** Sonnet 5 · **Effort:** high · **Wave:** now · **Runs BEFORE LS7**

Measured against `origin/main` @ `869bd6e17` and the live database on 2026-09-02. Re-fetch before you act.

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

TASK — LS6: Live Studio becomes ONE unlock per event at ₱2,500. The per-DAY window is retired.

OWNER RULING 2026-09-02: "live studio is 2500 per event", "unlock once per event, unlimited
streams, unlimited video link upload", "i want the mixer and the integration to be one in price".

CURRENT STATE, re-measure before acting:
  select service_code, retail_price_php, billing_period from platform_retail_catalog_v2
   where service_code like 'LIVE_STUDIO%';
  -- LIVE_STUDIO                1500.00  per_day
  -- LIVE_STUDIO_HOSTED_CHANNEL 1500.00  per_day   (shipped 2026-09-02, ZERO orders)

🛑 THE CATALOG CHANGE ALONE IS WORSE THAN DOING NOTHING. `billing_period` is only a LABEL —
`formatBillingPeriodSuffix`. What actually expires is `canPublishMultiCam`
(`lib/live-studio-publish.ts`), which calls `resolveBroadcastWindow`. Flip the label to
`one_time` without retiring the window and a couple pays ₱2,500 "per event", then LOSES
MULTICAM 24 HOURS AFTER FIRST GO-LIVE — the page saying one thing while the code does another,
on a wedding day. Both halves ship together or neither does.

PART 1 — CATALOG (migration; `platform_retail_catalog_v2` is the only price a customer pays).
  · `LIVE_STUDIO` → 2500.00, `billing_period` = 'one_time' (the CHECK already allows it —
    see `20270331500000_patiktok_per_day_billing.sql`).
  · `LIVE_STUDIO_HOSTED_CHANNEL` → **owner ruled 2026-09-02 to KEEP IT SEPARATE, not fold it
    in.** Reprice to `one_time` at a figure the OWNER gives you — DO NOT PICK ONE. If no figure
    has been given when you start, set `is_active = false` (zero orders exist, so nothing is
    stranded) and SAY SO in the handback rather than inventing a price.
    🔑 WHY IT IS NOT FOLDED IN, and this is a safety reason not a pricing one: a Content ID
    strike on a SETNAYAN pool channel hits a channel that also holds OTHER COUPLES' archives,
    and three strikes takes the channel down with "all your videos". Bundling that risk into
    every sale is wrong; it must be sold deliberately.
  · ⚠ `lib/llms-txt-guard-input.ts` carries a HAND-TYPED copy of the catalog, pinned by
    `llms-fixture-matches-the-catalog.db.test.ts`. It MUST move in the same PR — this exact
    trap turned the ₱1,500 reprice red on 2026-09-02.

PART 2 — RETIRE THE BROADCAST DAY. Read `lib/live-studio-window.ts` and
`lib/live-studio-window-server.ts` in full before touching anything.
  · `resolveBroadcastWindow` must stop expiring an owned event. Ownership becomes the whole
    test: owns LIVE_STUDIO ⇒ multiCam, for the life of the event.
  · `foldWindowEnd`, the day-stacking "hotel nights" fold, and the buy-another-day path lose
    their reason to exist. DELETE them or leave them provably unreachable — do not leave a
    second, disagreeing source of truth for "may this event publish".
  · ⚠ `stampFirstLiveAt` is pinned by `live-studio-lead-time.test.ts` as the thing that makes
    "your broadcast day starts when you first go live, not when you pay" TRUE. That sentence
    is about to become meaningless — fix `LEAD_TIME_NOTICE` and that assertion together, or
    the guard protects a promise the product no longer makes.

🪤 PART 3 — LS2'S RECLAIM BORROWS THE THING YOU ARE DELETING.
`reclaimStaleCheckouts` (`lib/live-studio-roam-provision.ts`) uses `PANOOD_WINDOW_HOURS` as its
grace period before taking a pool channel back. That import was deliberate: "one broadcast day"
was the honest span. If the broadcast day stops existing, THAT CONSTANT MUST NOT SILENTLY
BECOME A BARE NUMBER. Either keep `PANOOD_WINDOW_HOURS` alive in `lib/panood-watermark.ts` as
what it now is — a reclaim grace period, renamed and re-documented — or give reclaim its own
named constant with its own reasoning. Do NOT inline `24`.
Its guard `lib/live-studio-roam-reclaim-guard.test.ts` asserts the constant is imported and not
re-typed; keep that property true under the new name.

PART 4 — EVERY LINE THAT SAYS "PER EVENT-DAY" IS NOW FALSE. Grep, do not guess:
  · the catalog `description` (rewritten 2026-09-02 to say "Priced per event-day — your day
    starts when you first go live… extra days can be added" — ALL of that goes)
  · `lib/llms-txt.ts` (two places), `lib/live-studio-readiness.ts` (`LEAD_TIME_NOTICE`)
  · `lib/help.ts` — the Live Studio article says "priced per day"
  · the public page `app/(shell)/panood/page.tsx`
  · `apps/web/app/dashboard/[eventId]/studio/live-studio-control/page.tsx` — "One price, per
    event — the free single-camera livestream stays free" is ALREADY right; check it survives.

🚫 DO NOT TOUCH the free single-camera tier. `FREE_PUBLISHED_CHANNEL_LIMIT = 1` and the
owner ruling "the free single-camera livestream stays free" (2026-06-26) are unchanged.

GUARD — new file, own name, canonical `lib/strip-comments.ts`. Pin: an owned event's multicam
does NOT expire with time (construct an event owned long ago and assert `canPublishMultiCam`);
no surface says "per day" for LIVE_STUDIO; and reclaim's grace period is still an imported
named constant. MUTATION-TEST each.

RUN THE FULL SUITES — `pnpm test:unit` (~12k) and `pnpm test:db:ci` (~25 min) and
`npx tsc --noEmit`. COMMIT BEFORE STARTING A LONG VERIFY.

SPEC IMPACT: YES. DECISION_LOG row (supersedes the ₱1,500/day row of 2026-09-02), and the
per-event-day model in `Live_Studio_Unified_Spec_2026-07-25.md` — which already carries a
superseding banner from today; ADD to it, do not rewrite the body.
