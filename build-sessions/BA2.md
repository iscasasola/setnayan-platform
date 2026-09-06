# BA2 — quotes leave the budget page

**Model:** Opus 5 · **Effort:** high · **Wave:** now · **Blocks BA3 (the ledger's column semantics depend on this)**

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

## Scope

The display rule, not the arithmetic. `EventMoney.estimated` and `MoneyBucket.estimatedPhp` stay
computed — the Merkado lens and the checklist still use them. They simply stop reaching /budget.

## Owner decision, 2026-09-02

Verbatim: *"no quotes here. we only add the finalized budgets. on the marketplace, this is where
they can add and subtract the other vendors to help them find the better option for them."*

## Build

- `vendorsToItemize` currently widens from "contracted+" to "contracted+ OR carrying money".
  Stop widening on this surface: an unconfirmed supplier does not get a card.
- Retire the strip's *"₱X more is still an estimate"* hint here (`budgetStripMoney` in
  `lib/budget-page-money.ts`). It becomes dead copy for this page.
- Leave `resolveEventMoney` alone. This is about what renders, not what is counted.

## Why this does not break §18.5 rule 3

That rule says an estimate must not vanish, because a couple seeing ₱0 committed beside an ₱80,000
vendor in their list is a contradiction. The rule's PREMISE is that un-booked vendors are listed on
this page. Remove them and the contradiction dissolves — there is no ₱0-next-to-₱80,000 left to
explain. Say this in the changelog fragment; do not silently contradict the rule.

## SPEC IMPACT — not "None"

This reverses a documented display rule. In the SAME session, per the 2026-06-04 direct-edit
authorization, add a `DECISION_LOG.md` row in `~/Documents/Claude/Projects/Setnayan/` following the
COWORK.md sequence. Surface it in your PR body for owner sign-off even as you apply it.

## Done when

A shortlisted supplier's quote appears NOWHERE on /budget, and STILL renders in `quote-fill.tsx` (the Merkado surface that shows candidate quotes). Do NOT verify against `merkado-budget-lens.tsx` — that lens is payment-progress only and never showed quotes, so it would pass vacuously and verify nothing, and a
test fails if an unconfirmed vendor regains a card here.
