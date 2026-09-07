# LS1 — the couple's film survives their wedding

**Model:** Sonnet 5 · **Effort:** medium · **Wave:** now · **Runs in parallel with LS2**

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

TASK — LS1: the editorial "Watch the Film" block can never render, for two independent reasons.

A couple pays for Live Studio, their ceremony airs, and their own editorial page shows no film.
No error, no empty state — the section is simply absent. Same disease as the guest list telling a
couple with 180 names that they had none: the failure renders identically to "they didn't buy it".

⚠ THIS WAS BUILT ONCE AND LOST before it was committed (worktree wiped mid-verify). The diagnosis
below was verified against production; the code was not. Re-verify each premise, do not trust it.

PREMISE 1 — IT ASKS FOR A SKU NOBODY CAN OWN.
`apps/web/app/[slug]/_components/editorial/data.ts` gates the replay on
`eventSkuActive(admin, eventId, 'PANOOD_SYSTEM')`. Grep for the string, never a line number.
`PANOOD_SYSTEM` is RETIRED — it is not a row in `platform_retail_catalog_v2` at all, so no order
can carry it and the condition is false for every event that has ever existed. Verify with:
  select service_code, is_active from platform_retail_catalog_v2 where service_code in ('PANOOD_SYSTEM','LIVE_STUDIO');
Expect ONE row back: LIVE_STUDIO.

  THE FIX IS WIDER, NOT A SWAP. Gate on `'LIVE_STUDIO'`. `SKU_OWNERSHIP_ALIASES.LIVE_STUDIO` in
  `apps/web/lib/entitlements.ts` is exactly `PANOOD_PAID_SKUS`
  (`PANOOD_SYSTEM` · `PANOOD_SYSTEM_MOBILE`), so a grandfathered Cast buyer still matches THROUGH
  THE ALIAS. Nobody loses the replay by this change; the current code is the one that gives it to
  nobody. Confirm the alias yourself before relying on it.

PREMISE 2 — THE URL IS WIPED THE MOMENT THE WEDDING ENDS.
`events.panood_watch_url` is the LIVE embed, and ending a broadcast clears it DELIBERATELY so the
event page stops advertising a finished broadcast as running (see the note in
`app/dashboard/[eventId]/studio/panood/setup/actions.ts`). The REPLAY wants exactly what End
destroys — so even with the SKU fixed the film vanishes at the moment someone goes looking for it.

  THE DURABLE SOURCE: a completed `panood_broadcasts` row. Its `broadcast_id` IS the YouTube video
  id — `apps/web/lib/live-studio-recordings.ts` reads it as one, guarded by `isYouTubeVideoId`.
  Prefer the live URL first (so an in-progress broadcast still embeds), fall back to the most
  recent `status = 'complete'` broadcast.

🔒 THE INJECTION BARRIER IS NOT OPTIONAL. The live path gets one free from `parseYouTubeVideoId`.
The fallback reads a raw column on its way to an iframe `src`, so it needs `isYouTubeVideoId`
before it reaches `youTubeEmbedUrl`. A guard must pin this.

🚫 DO NOT "simplify" by keeping `panood_watch_url` after End. That column drives the LIVE
"Watch Live" block; leaving it set tells guests a finished broadcast is still on air. Two
questions, two sources — that is the point, and it belongs in a comment.

GUARD — new file, its own name so it cannot conflict with a concurrent PR.
  · Window the assertions to the "Watch the Film" BLOCK, not the file. `data.ts` is thousands of
    lines and mentions `LIVE_STUDIO`, `panood_broadcasts` and `panood_watch_url` elsewhere; a
    whole-file match stays green through a gutted gate.
  · Strip comments with `apps/web/lib/strip-comments.ts` — the repo's ONE canonical stripper. A NEW
    file carrying its own two-replace stripper FAILS the required
    `scripts/lint-one-comment-stripper.mjs`. Your own prose will name `PANOOD_SYSTEM`, so an
    unstripped scan finds the defect it just fixed.
  · Read the retired codes from `PANOOD_PAID_SKUS`, do not re-type them.
  · PUT THE TEST IN `apps/web/lib/`, NOT beside `data.ts`. `tsx --test` globs do NOT match a
    directory containing `[slug]` — a test placed there reports "# tests 0" and exits 0, which
    reads exactly like a pass.
  · MUTATION-TEST IT: reverting the SKU, deleting the fallback, and removing the
    `isYouTubeVideoId` check must EACH turn it red. Restore by SHA-256 and re-run green.

RUN THE WHOLE DB SUITE, not the targeted tests. `pnpm test:db:ci` from `apps/web` — 2085 tests,
~25 min. Two PRs this week were pushed on targeted-only runs and both came back red from CI
(`exposure-freeze`, then `llms-fixture-matches-the-catalog`). Also `pnpm test:unit` and
`npx tsc --noEmit`. COMMIT BEFORE YOU START A LONG VERIFY — the previous attempt at this exact task
was lost that way.

SPEC IMPACT: None expected — this restores a § 6 behaviour, it does not change one.
