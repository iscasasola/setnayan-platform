# BA8 — the paid guard reads the same books

**Model:** Opus 5 · **Effort:** high · **Wave:** BLOCKED — owner sign-off first · **Do not start without an explicit owner decision**

Measured against `origin/main` @ `377ad436b` and the live database on 2026-09-02. Re-fetch and re-measure before you act.

Start a new Claude Code session and paste EVERYTHING below the rule.

---

Read the repo's own CLAUDE.md and the corpus CLAUDE.md first, then follow RULE 0: assume what you
are about to build already exists, and locate it before writing anything. On this stream RULE 0 has
already paid — the per-category money (`EventMoney.byBucket`), the absorption engine
(`computeBudgetOverspend`), the vendor claim link, the payment log with method and reference, and
the 7-day payment-due threshold were ALL reported as missing during planning and ALL already ship.

0. MEASURE AGAINST origin/main, NEVER A LOCAL CHECKOUT. `git fetch` first, then read with
   `git grep <pattern> origin/main -- <path>`. NEVER ANCHOR ON A LINE NUMBER — grep for a string.
   Line numbers rot between fetches, and a "corrected" line number can itself be the error.

1. CHECK WHAT IS IN FLIGHT, not just what shipped:
       gh pr list --state open --limit 40 --json number,title,headRefName
       git worktree list
       git log origin/main --oneline -15
   Grepping main answers "does this ship", never "is somebody building this right now".

2. THE BUDGET-TRUTH FLAG IS ON. `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` is `true` in Vercel Production
   (owner-confirmed 2026-09-02). `resolveEventMoney` is the LIVE path on /budget, the Merkado lens and
   the checklist. Any code comment saying "flag OFF, production renders byte-identically" is
   describing the past. Build against the resolver; no dual-path fallback is needed.

3. DECISIONS ALREADY MADE — do not re-litigate, do not contradict:
   - **Finalized money only.** Quotes and shortlists live in the Merkado, never on /budget.
   - **Four columns, and their names are load-bearing:** Planned (what you budgeted) ·
     Agreed (what you signed for) · Paid (handed over so far) · Owed (agreed minus paid).
     The owner misread the old labels; that is why they read this way now. Do not abbreviate them.
   - **Two doors.** Still deciding -> Merkado, lands here once contracted. Already done -> added
     here, saves LOCKED, mirrors a row into the Merkado, returns a QR invite.
   - **Off-platform is not the same as final.** `marketplace_vendor_id IS NULL` says they are not
     on the app; `status >= 'contracted'` says the money is real. A manual upload sitting at
     `shortlisted` is still a quote.
   - **Ownership of a price:** locked package = frozen for both sides; vendor catalogue = theirs
     (message them); manual line = the couple's. `MoneyLine.readOnly` already encodes this.

4. STANDING RULES. Never guess a number that governs money — find its existing home or stop.
   A log line never changed a pixel: the measurement must reach the render. If two mechanisms can
   disagree about one fact, that is the defect. Never weaken or delete a guard to go green.

5. WORKFLOW. Worktree + PR, `gh pr merge <PR#> --auto --merge` immediately after creating it.
   Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line. Do NOT edit
   CHANGELOG.md or STATUS.md in a feature PR. Prune the worktree the moment the PR merges.
   Run unit tests from `apps/web`, or every `@/…` import dies.

6. REPORT HONESTLY. If a check fails, say so with the output. If you skipped something, say that.
   The main session will re-run your verification against the real thing before calling it done.

## STOP

This session changes what a ₱1,499 SKU reports, and the number can move in either direction.
It is a product call, not an engineering one. Do not start it on your own judgement.

## The finding

`SETNAYAN_AI` sells, verbatim on its buy page: **"Warns you before you go over budget"** —
*"It adds up what you've committed against your target while there's still room to trim."*

The guard is real: `overBudgetTrigger` / GRD-05 in `lib/setnayan-ai-triggers.ts`, firing an in-app
`ai_guard_alert`. But `lib/setnayan-ai-snapshot.ts` computes its OWN committed total from raw
`total_cost_php` plus order totals, and never calls `resolveEventMoney`. Grep it for
`budget-truth` — there is no import.

So the paid guard cannot see what the free page sees: a locked package's agreed total, catalogue
line items, manual lines on an off-platform supplier, credits, or crew meals. A couple can be
warned by one number and reassured by another on the next screen — and the number they paid for is
the narrower one.

## Build, once approved

- Point GRD-05 at `resolveEventMoney`.
- It then inherits `byBucket` for free, so the alert stops saying "you are over" and starts saying
  "you are over, and it is catering."
- Add a test that fails if the guard's committed total and the budget page's ever diverge.

## Done when

One fact, one source — and the owner has said in writing which direction the reported number is
allowed to move.
