## 2026-11-20 · feat(trust): a shop counts as trusted only after a completed, paid booking — and trust ranks it higher in search

Owner, 21 Nov 2026 (specs DECISION_LOG "A SHOP SHOWS AS YOUR TRUSTED SHOP ONLY AFTER ONE COMPLETED, PAID BOOKING" and
"TRUSTED SHOPS RANK HIGHER IN SEARCH"; keeps 16 Nov "No one can pay to rank above you").

- **One reader.** Migration `20271356577600` adds `shop_qualified_trust(uuid[])` (who trusts a shop AND qualifies: a
  live two-way partnership; the other shop verified, published, papers current, not demo, owner not internal; not the
  same business — `booking_fee_business_matches` — or the same people; at least one completed, paid booking; each shop
  once), `shop_completed_paid_booking_counts(uuid[])` (delivered + payment received through Setnayan; never refunded,
  cancelled, internal, test, supplier-brought or self-dealing — built from the vetted completed-events view, payday's
  money-received rule and `event_vendor_refunds`), and `shop_qualified_trust_counts(uuid[])` derived from the reader.
  Service role only. `lib/vendor-trusted-by.ts` is the only TS caller.
- **Trusted by** (`/v/[slug]`) now lists only qualified shops. A pending hand add or a shop only served with is a link,
  not trust. A refused read keeps the shipped honest "couldn't load" line.
- **Partners** (supplier dashboard): a linked shop not yet qualified reads "Waiting for their first completed booking"
  and loses the Live tag. Text only.
- **Search.** Trust is a key right after the fit keys in Explore/Discover (`MarketplaceView`, all three sort passes),
  Find's tier ladder (`searchCategoryVendors`, inside each rung) and the whole-marketplace box
  (`searchMarketplaceForBench`). Doubling steps (`lib/trust-rank.ts`, 0 · 1 · 2–3 · 4–7 …) give diminishing returns;
  the step shape is OWNER TO CONFIRM. It only reorders rows that already fit and reads nothing bought.
- Guards: `lib/trust-has-one-reader.test.ts` (a second derivation fails), `tests/db/trust-shows-only-after-a-completed-paid-booking.db.test.ts`.

SPEC IMPACT: None in the corpus text — implements the two 21 Nov DECISION_LOG rows as written. Narrows the 16 Nov
"Trusted by gathers every supplier tie": worked-together-only shops and pending hand adds no longer show in Trusted by
(flagged for the controller in the PR).
