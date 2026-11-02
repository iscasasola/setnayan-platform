## 2026-09-19 · fix(booking): a couple's booking screens say "couldn't load" instead of "none" on a refused read (S41 · booking 1/5)

`result-dropped-silently` (S26 both-ends baseline, #5625), BOOKING tier, the
couple's side — 14 sites under `app/dashboard/**`, `app/[slug]/**`,
`app/_actions/run-of-show.ts` and wedding onboarding.

**What a person now sees (join the missing end — the failure reaches the render):**

- Supplier workspace · Reviews — a refused review read said *"<Supplier> still
  has no review."* `fetchMarketplaceReviews` now returns `reviewsMeasured`, and
  the card says it could not load them.
- Library · Saved vendors — *"No saved vendors yet."* to a couple whose plans
  hold suppliers. `fetchSavedVendors` returns `SAVED_VENDORS_UNREADABLE`.

**Reason kept (logged `[supabase-error] <file> · <target>`), behaviour unchanged:**
the editorial story's challenge answers + kwento quotes, "your own day"
messages, the run-of-show console read, activity-pick block inserts, the
workspace's deposit-refusal read (a deliberate degrade during a deploy race —
now visible), the marketplace-search already-linked filter, the category
decision's archive sweep (2), the ripe-review sweep's status update, and the
onboarding shortlist insert.

Pinned by `lib/booking-reads-are-honest.test.ts` (the reviews decision executed
against a stub; render order pinned by position; mutation-checked).

SPEC IMPACT: None
