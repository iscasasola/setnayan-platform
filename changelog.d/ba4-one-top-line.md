## 2026-09-03 · fix(budget): one money summary, not two — and a pinned condensed bar that follows you down

`/dashboard/[eventId]/budget` used to print two headline cards on one screen:
"Current commitments" (Target / Committed / Budget left) above "Payment
progress" (Total to pay / Paid so far / Balance) — four overlapping words for
different quantities, plus a "What this unlocks" hint card that explained a
feature instead of showing one, sitting between the couple and their numbers.

Both cards are now one: **Target · Agreed · Paid · Owed** (BA3's own ledger
vocabulary), the live progress bar, and the upcoming-payments list, all inside
one card. The hint card is gone.

A condensed bar now pins once that card scrolls away — Agreed · Paid · Owed, a
hairline paid/agreed meter, tap to scroll back up — and flips to an
over-target tone the moment Agreed passes Target. It docks below the shared
hide-on-scroll top bar (`var(--fd-bar)`) rather than stacking a third
independent bar.

Two traps this stream had already shipped bugs from, both avoided here:

* The pinned bar uses `position: fixed`, not `sticky` — an `overflow: hidden`
  ancestor silently kills `sticky` on every descendant, and `fixed` has no such
  dependency. Its horizontal box is measured from the summary card's own
  `<header>` (no border of its own), never the outer `.sn-tile` card — that
  card's rect includes a 1px border, and a pin drawn from it drifts a pixel
  off the real content edge.
* Every headline figure (Target/Agreed/Paid/Owed, and the pinned bar's
  Agreed/Paid/Owed) is written by the render path. Nothing here is gated on an
  effect having run — the `IntersectionObserver` that pins the condensed bar
  defaults to `false` (not pinned), which is also the correct behaviour with
  JavaScript disabled: the full summary above renders in full either way, and
  the pinned bar — a bonus, not primary content — simply never appears.

Not touched: `budget-ledger-table.tsx` and `buildBudgetLedger()` (BA6 is
in-flight on that file, adding its own due roll-up to the ledger's header —
disjoint from this PR's top line); the resolver (`lib/budget-truth.ts`); the
per-vendor itemization list.

Verified: root `turbo run typecheck` clean (two passes, against a base
re-fetched immediately before each); the full `money-wears-the-ledger-face`,
`the-plan-meets-the-ledger`, `the-skeleton-matches-the-page`,
`the-supplier-ledger-collapses` and `gold-is-not-text` suites (29 tests) plus
`flag-chokepoint-scan` (13 tests), all green; `next lint` on every touched
file, clean.

### Why three controls left the port baseline

`lint-port-no-lost-controls` flagged `/dashboard/[eventId]/budget` as having lost
`<BudgetSummaryStrip>`, `<Stat>` and `<UnlocksHint>`. All three removals are
deliberate and are the point of this change:

- **`BudgetSummaryStrip` + `Stat`** — the page carried TWO money summaries with four
  overlapping words for different quantities ("Committed"/"Budget left" above,
  "total to pay"/"balance" below). They are now one `BudgetTopSummary`, so the reader
  is no longer asked to work out which pair means what.
- **`UnlocksHint`** — a card that explained a feature instead of showing one, sitting
  between the couple and their numbers above the fold.

The baseline was regenerated with `pnpm --filter @setnayan/web port:baseline` in this
same PR, which is the guard's own sanctioned route for a deliberate removal: it puts
each lost control in the diff as one readable line rather than preventing the change.
The guard was NOT weakened, allow-listed or thresholded.

SPEC IMPACT: None — presentation-only restructuring of an existing surface;
no schema, no new decision, no change to what money means or how it is
computed.
