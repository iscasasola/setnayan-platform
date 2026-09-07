# LS8 — the hosted channel comes back at ₱3,000/day, and "Event Hub" stops meaning two things

**Model:** Sonnet 5 · **Effort:** high · **Wave:** now

Measured against `origin/main` @ `d93a44a56` and the live database on 2026-09-03. Re-fetch before you act.

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

TASK — LS8: two owner rulings from 2026-09-03. Read the DECISION_LOG row of that date first.

═══ PART 1 · THE HOSTED CHANNEL RETURNS, ₱3,000 PER DAY ═══

`LIVE_STUDIO_HOSTED_CHANNEL` was deactivated by LS6 (PR #5134) purely because no price had
been given and the session was told not to invent one. Zero orders exist. Reactivate it:
`retail_price_php = 3000`, `billing_period = 'per_day'`, `is_active = true`.

🔑 PER-DAY IS CORRECT EVEN THOUGH `LIVE_STUDIO` IS NOW ONE-TIME, AND THE ASYMMETRY IS THE
POINT — say so in the migration, because it looks like an inconsistency and will otherwise be
"fixed" by a future session. The base unlocks SOFTWARE that costs Setnayan nothing to run
twice. A Setnayan-supplied CHANNEL is a scarce per-day resource: production holds three
channels, two claimable, and one event-day consumes one. Per-day is what stops a couple
sitting on inventory.

⚠ AND IT IS DELIBERATELY EXPENSIVE — ₱3,000/day against a ₱2,500 one-time base, so the hosted
option costs MORE than the product it attaches to. That is intended. A Content ID strike on a
pool channel lands on a channel holding OTHER COUPLES' ARCHIVES, and three strikes takes all
of them down (LS7, PR #5136). This must be sold deliberately, never bundled.

  · ⚠ `lib/llms-txt-guard-input.ts` carries a HAND-TYPED copy of the catalog pinned by
    `llms-fixture-matches-the-catalog.db.test.ts`. It MUST move in the same PR — this trap has
    now turned two separate PRs red (2026-09-02, twice).
  · The add-on's shared-strike copy already exists (`POOL_CHANNEL_SHARED_STRIKE_NOTICE`) and
    LS7b routed it through `mayBroadcastOnSharedChannel()`. Verify it renders again once the
    SKU is on sale — `HostedChannelUpsell` opens with `if (!owns && !onSale) return null`, and
    that `return null` is exactly why the warning reached nobody last time.

═══ PART 2 · ONE WORD, TWO SCREENS — RESOLVED ═══

OWNER RULING 2026-09-03, verbatim in substance:
  · **Event Hub** = the GUEST-FACING SITE.
  · **Event Hub Controller** = the dashboard where the couple controls what the Event Hub
    contains.

PR #5108 shipped "one Event Hub keyed `launch` in all three phases" and its own note says
**"two rail rows now share that word and that is still open"**. This closes it.

  · Grep `Event Hub` across `apps/web` and decide EACH occurrence against the ruling. Do not
    bulk-replace: some already mean the guest site correctly (`/llms.txt` calls it "the 4-in-1
    couple website"; the Live Studio public FAQ says "They open your Event Hub and press
    play" — both are the GUEST sense and are right).
  · The DASHBOARD sense must become **Event Hub Controller** — the sidebar rail rows, and any
    dashboard heading that means "where I edit it".
  · `COUPLE_WEBSITE_PRO` is titled "Event Hub Pro" in the catalog and stays ₱3,500,
    unchanged — it upgrades the GUEST SITE, so its name is already correct under the ruling.

🚫 DO NOT rename any SKU code, route or database column. This is display copy only. A
`service_code` rename would reach seven modules and the orders table for no customer benefit.

GUARD — new file, own name, canonical `lib/strip-comments.ts`. Pin: no dashboard-sense surface
says bare "Event Hub"; the guest-sense surfaces still do; and the hosted SKU is active at
per_day. MUTATION-TEST each.

RUN THE FULL SUITES — `pnpm test:unit`, `pnpm test:db:ci` (~25 min), `npx tsc --noEmit`.
COMMIT BEFORE STARTING A LONG VERIFY.

SPEC IMPACT: the DECISION_LOG row of 2026-09-03 is ALREADY APPLIED in the corpus
(commit `b3c435b`). Do not duplicate it; reference it.
