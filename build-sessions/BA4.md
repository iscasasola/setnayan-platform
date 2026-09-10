# BA4 — one top line, and it follows you down the page

**Model:** Sonnet 5 · **Effort:** medium · **Wave:** after BA3 · **Blocks nothing**

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

Presentation only. Hand the visual pass to **Fable 5** once the structure works — that split
worked on the prototype: structure first, then a design pass under written constraints.

## Build

- Merge the two money summaries into ONE. Today the page shows "Current commitments"
  (Target / Committed / Budget left) AND "Payment progress" (total to pay / paid so far / balance)
  — four overlapping words for different quantities, on one screen.
- Drop the "What this unlocks" hint card from above the fold. It explains a feature instead of
  showing one, and it sits between the couple and their numbers.
- A condensed bar pins once the full summary scrolls away: Agreed · Paid · Owed, a hairline meter,
  tap to return. The ledger's column header pins directly beneath it.
- The pinned bar flips to an over-target state when Agreed passes Target.

## Traps, each of which has already cost time

- `.screen`-style containers with `overflow: hidden` SILENTLY kill `position: sticky` on every
  descendant. Use fixed positioning and match the header's own box — matching the outer container's
  box drifts a pixel, because that rect includes its border.
- The page already has two sticky layers: the shared hide-on-scroll bar and the docked Budget
  sub-nav. Anchors reserve `scroll-mt-24` for that chrome. DOCK below it; do not stack a third.
- Never gate visibility of content on an effect having run. A reveal that depends on
  IntersectionObserver renders a BLANK PAGE where the observer never reports. Hidden start-states
  belong behind a `.js` class, with a failsafe.
- Every headline figure must be written by the render path, never only by an animation. A number
  that exists only after a count-up shows ₱0 until you scroll to it.

## Done when

Editing a figure deep in the list moves the pinned total without scrolling; the page renders in
full with JavaScript disabled; and there is no horizontal scroll at 375px or 1280px.

## Two tolls already paid on this stream — do not pay them a third time

**1. There is ONE comment stripper.** `apps/web/lib/strip-comments.ts` (JS twin in
`scripts/port-controls.mjs`). Any guard that reads source text must strip comments first, and the
obvious two-line regex is WRONG — it strips block comments first, so a `//` line containing a `/*`
swallows everything after it. `lint-one-comment-stripper.mjs` fails CI if you grow your own.
FOUR sessions paid a ~36-minute CI cycle for this in one day: `59c4abb85` (BA1), `4fd528d1e`
(Event Hub), `4fb111281` (privacy), `a95db1448` (BA2). Import the existing one.

**2. `pnpm typecheck` in `apps/web` is NOT what CI runs.** CI runs the ROOT `turbo run typecheck`,
which fans out to `apps/web` AND `packages/shared`. Verifying with the workspace one produces a
green local and a red CI. BA2 lost two cycles to this. Run it from the repo root.

**3. Re-fetch before you verify, not just before you start.** `origin/main` moved THREE times
during BA2's single verification pass. A 20-minute typecheck against a base that moved is a
verification of nothing. `git fetch && git merge origin/main` immediately before the long checks.

**4. Your fixture may break from a sibling session, not from your own diff.** BA5 added a REQUIRED
`due: MoneyDue` field to `EventMoney` mid-flight and turned BA2's test red. Every session on this
stream consumes `EventMoney`. If typecheck fails on a type you did not touch, check what merged
in the last hour before hunting your own work.
