# LS5 — the hosted channel is an add-on, and the page stops claiming everyone bought it

**Model:** Sonnet 5 · **Effort:** high · **Wave:** now · **Runs in parallel with LS4**

Measured against `origin/main` @ `773c5f305` and the live database on 2026-09-02. Re-fetch before you act.

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

TASK — LS5: Live Studio has two ways to reach air, and the product describes only one of them.

OWNER RULING 2026-09-02, verbatim in substance: the couple's OWN YouTube link is the DEFAULT,
and Setnayan supplying the channel is an OPTIONAL extra "for people who don't have live stream
access or is not versed to activate that."

  LIVE_STUDIO           ₱1,500/day   multicam controller · couple pastes their own watch link
  + hosted channel      +₱1,500      → ₱3,000/day total · Setnayan supplies the channel

⚠ THE ₱1,500 ADD-ON PRICE IS THE OWNER'S NUMBER, read as "₱3,000 TOTAL for the hosted option",
not ₱3,000 on top of ₱1,500. If anything in the corpus or the catalog contradicts that reading,
STOP AND ASK — do not resolve a money question by picking the reading that needs less work.

PART 1 — THE LIVE FALSEHOOD, and this is the half that matters most.
`NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY` is ON in production. Both `studio/panood/setup/page.tsx` and
`studio/live-studio-control/page.tsx` therefore show EVERY host `POOL_ONLY_CONNECT_NOTICE`
(`lib/live-studio-pool-only.ts`):

  "Setnayan now provides the YouTube channel for your live broadcast, so there is nothing for
   you to connect."

Under the ruling that is TRUE ONLY FOR ADD-ON BUYERS. For everyone else it is false, and worse,
it talks them out of the paste-link box sitting on the same screen — the box that is their
actual route to air. A screen telling a couple there is nothing to do, above the one control
they must use, is this repo's signature defect wearing a different coat.

  Split the notice by entitlement: default copy points at the paste-link box; the pool sentence
  renders only when the event owns the add-on. Keep the pool-only FLAG on — it closes the BYO
  OAuth door and that is still correct for both paths (a couple never reaches Google's consent
  screen either way, which is what protects the 100-user cap).

PART 2 — THE ADD-ON SKU.
  · A catalog row in `platform_retail_catalog_v2`, `billing_period = 'per_day'` to match
    `LIVE_STUDIO`. Read the existing LIVE_STUDIO row first and mirror its shape.
  · STACKS on `LIVE_STUDIO` — it does NOT replace it. Do not introduce a second SKU that also
    grants multicam: SEVEN modules assume one SKU does (`lib/live-studio-control.ts`,
    `add-on-stats.ts`, `add-ons-catalog.ts`, `admin/pricing-clusters.ts`, `v2-catalog.ts`,
    `llms-txt.ts`, plus the buy page). Grep `LIVE_STUDIO` and read every hit before designing.
  · The add-on decides WHICH CHANNEL, nothing else. Entitlement to multicam, the watermark
    decision, and the publish gate are all unchanged and must stay unchanged.
  · `lib/llms-txt-guard-input.ts` carries a HAND-TYPED copy of the catalog and a db test pins it
    to the replayed catalog. A new SKU must move in the SAME PR or CI fails —
    `llms-fixture-matches-the-catalog.db.test.ts` caught exactly this on the ₱1,500 reprice.

🚫 DO NOT BUILD THE AVAILABILITY CHECK. "Subject to availability" has no date capture, no
capacity read and no reservation, and building that is NOT this task. Production now holds THREE
pool channels (two claimable; one awaiting YouTube activation), so sell the add-on and confirm
the date BY HAND until real demand justifies reservations. Say so in the handback.

🚫 DO NOT TOUCH the archive-download copy ("Downloadable from your dashboard after the event").
Under the pool model the couple is not the channel owner, and whether that promise can be kept
is an OPEN OWNER QUESTION. Surface it; do not resolve it.

GUARD — new file, own name, canonical `lib/strip-comments.ts`. Pin: the pool sentence renders
ONLY on the add-on branch; the default branch names the paste-link box; and the add-on does not
gate multicam (an event owning `LIVE_STUDIO` alone still gets the controller). MUTATION-TEST
each — showing the pool sentence unconditionally must turn one red.

RUN THE FULL SUITES including `pnpm test:db:ci` (~25 min). COMMIT BEFORE A LONG VERIFY.

SPEC IMPACT: YES — DECISION_LOG row for the two-tier model, and the § 4h pool assumption that
every Live Studio event rides a Setnayan channel is now false. Apply the DECISION_LOG row; SURFACE
the § 4h change rather than rewriting the spec unilaterally.
