## 2026-11-14 · perf(server): one speed pass on the seven slowest pages — reads that waited in line now leave together

Server side only: no markup, no class names, no component changes, and **no read added** (prod Supabase is on the free
plan). Every page shows exactly what it showed; every "couldn't read" stays a "couldn't read". Reads that ran one after
another now start together and are still awaited where they were (`startRead`), and repeats of the same row are asked
once per render (`askedOnce`, React `cache()`, `eventRowOnce`).

- **Event Hub Maker** (`/dashboard/[eventId]/launch`) — six repeated reads answered once per render (the guest-pass
  list, role words, the print event row, the entourage order, the catalogue price, the membership gate), and the part
  prices leave with the first batch. Measured with the page's own harness (150 ms per answer): **103 → 95 requests,
  page depth 7 → 6, 1,570 → 1,407 ms**.
- **Supplier client hub and its Files tab** (`/vendor-dashboard/clients/[eventId]`) — thirteen reads at the tail
  (payout readiness, the fee forecast, fee bills, waived fees, the deposit rows, the booked money, the review, the
  plans, refunds, change orders, payment asks, handovers, notes) start in one wave instead of one after another; the
  fee gate and the supplier's own grants are asked together; the page and its grant reads use the render's one sign-in
  answer. Inside shared helpers: `resolveEventFeeGate` (charge ∥ switch), `fetchVendorSpecializationSubscription`
  (tier ∥ row), `readBookedMoney` (accepted quote ∥ ledger).
- **Couple–supplier workspace** — the event date (three reads a view) is answered from the layout's one read of the
  row; the booking-money RPC (twice a view) is asked once per render.
- **Couple Suppliers list** — the one-per-event groups start with the page's other reads; Compare dates asks each
  column at once instead of one column after another.
- **Shop page** (`/v/{slug}` and the bare `/{slug}` that renders it) — "Trusted by", the typical price, the favourites
  count and the awards start together; the card records and the shop's work are asked together; `fetchVendor` is
  `cache()`d, so the metadata and the page body share one read of the shop row.
- **Admin › Website media** — the seven folder listings and the reference reads run at once (they were listed one
  folder after another, after the reads); the Event Hub music list and its "who plays it" read are asked together.

Guards: `lib/event-row-once.test.ts` §5 now reads through an `askedOnce` wrapper (keyed by the same client and event
id; the inner read is held to every existing rule — two sabotages red); `lib/read-retry.test.ts` and
`lib/card-portfolio-albums.test.ts` re-pointed at the new shapes, same properties.

SPEC IMPACT: None — no behaviour, copy or data change.
