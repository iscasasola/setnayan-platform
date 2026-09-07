# BA7 — money that has no supplier to hang on

**Model:** Opus 5 · **Effort:** xhigh · **Wave:** after BA3 · **Largest session. Blocks nothing that follows**

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

Migration + resolver + UI. The biggest of the eight.

## The defect

`event_vendor_line_items.vendor_id` is `UUID NOT NULL REFERENCES public.event_vendors(vendor_id)`.
Every peso must hang off a vendor row. A couple cannot record their first ₱ until they invent a
supplier, and the empty state says so out loud: *"No vendors yet. Add a vendor first, then come back
here to itemize costs."*

The taxonomy already names costs it cannot hold: `attire`, `rings`, `officiant`,
`wedding_paperwork` and `travel_honeymoon` are live plan groups with seeded benchmarks. The page
recommends a rings budget and offers no way to record buying rings.

## Build

- A cost that exists with no vendor, carrying `plan_group_id` so it lands in BA3's ledger.
- A new `MoneySource` in `resolveEventMoney`. The invariant `committed + overpaid === paid +
  stillOwed` must still hold exactly — `checkMoneyInvariant` is there for this.
- **Naming a supplier saves it LOCKED**, mirrors a row into the Merkado, and returns a QR to invite
  them. Owner, 2026-09-02: *"if they add a budget it means it is automatically locked. and it will
  automatically be on the marketplace as well. then they also get a QR Code to add that vendor to
  the app (already planned before)."*
- The QR is a RENDER of the existing claim link — `/vendor/claim/[token]`, `applyClaimAutoLink` in
  `vendor-invite-actions.ts`, already shared today by `ClaimLinkShare`. Do not build new plumbing.
- A cost with NO supplier named (licence, tips, ang pao) is just recorded: no Merkado row, no QR.

## Care

- RLS enabled at `CREATE TABLE` time, canonical pattern from the corpus mapping table only.
- Allocate the migration prefix with `pnpm migration:new` — forward, for the PGlite replay's
  filename-order rule and the UNIQUE check. NOT because a low prefix "will not apply": that belief
  is false, `db push --include-all` applies it, and it has been re-invented twice.
- Touching `supabase/migrations/` means the Ugat map must keep up. Two required db-tests enforce it.
  Add the node to `UGAT_TYPES` or one reasoned baseline line. Never weaken the check.

## Done when

Rings, the marriage licence and ang pao can be recorded with no supplier invented; a supplier added
here appears in the Merkado already locked with an invite QR; and the money invariant still holds.

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
