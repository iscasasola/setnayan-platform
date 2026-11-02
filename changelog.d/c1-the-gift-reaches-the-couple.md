## 2026-09-11 · feat(gift): the Setnayan gift reaches the bill and the couple's Papic pot (C1 · EX-2)

A supplier's "yes" to the Setnayan gift (#5373) promised free Papic photos that
nothing computed, billed or granted. Now it is the whole promise:

- **The arithmetic** — `lib/setnayan-gift.ts` (pure) and its SQL mirror
  `public.setnayan_gift_for_fee`: 40% of the booking fee (from `lib/booking-fee.ts`
  / `booking_fee_centavos`, never a re-typed rate), floored to the centavo, spent
  PROPORTIONALLY along the LIVE `PAPIC_GUEST*` ladder (regular price × tier points,
  read at call time), capped at 50,000 CREDITS with the charge capped at that
  rung's live price, and nothing below the smallest rung (₱3,500 today). Owner
  sanity numbers reproduced exactly: ₱20k → 571 · ₱50k → 1,429 · ₱100k → 3,571 ·
  ₱500k → 6,429 · ₱1M → 14,074 · ₱3.35M+ → 50,000.
- **The bill** — a trigger on `booking_fee_charges` sizes the gift on the primary
  lock charge while it is pending (and re-sizes it when the pending fee is
  re-derived), freezes it once paid, and zeroes it everywhere else. The card's
  yes/no is snapshotted when the charge opens (the booking's own
  `event_vendors.service_id` card, same supplier only). `amount_charged_centavos`
  stays the fee; the gift rides in `gift_credits` / `gift_centavos`. The order the
  supplier pays is fee + gift and names the photos (TS mint and SQL
  `booking_fee_upsert_vendor_order` write the same clause).
- **The pot** — on approval of the paid fee order, `booking_fee_grant_setnayan_gift`
  lands the photos as ONE `papic_event_point_grants` row (seat NULL, source
  `comp`, the order's id) — the same ledger a paid Papic rung writes, so an order
  reversal takes it back. Idempotent by a partial unique index.
- **The quote** — the proposal page names the count in PHOTOGRAPHS to the couple
  ("you get 1,429 free Papic photos") and shows the supplier what it adds to their
  bill, only when the bill will really carry it (`setnayan_gift_quote_applies`:
  card yes · Setnayan-sourced · past the first five free bookings).

Guards: `lib/setnayan-gift.test.ts` (10), `tests/db/the-gift-reaches-the-couple.db.test.ts`
(13), two new arms in `tests/db/booking-fee-order-postconditions.db.test.ts`.

SPEC IMPACT: DECISION_LOG.md row appended 2026-09-11 (the gift's bill + grant are
built; four engineering readings recorded for owner sight — frozen at payment,
snapshot at the supplier's acknowledge, the booking's inquiry card, source `comp`).
