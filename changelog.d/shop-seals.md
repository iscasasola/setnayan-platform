## 2026-11-15 · feat(badges): J2 — the seals engine (shop_seals, the yearly picks, Verified Partner's ten rules)

The badge build's seals (owner-approved prototypes 15 Nov, DECISION_LOG 7d6c8129; contract `badge-milestones_v86`).
Engine only: no UI, no new server action, no new route.

- **Migration `20271348504364`** (adds only): `shop_seals` — once per shop + seal + year; Verified Partner once per
  shop for life; one No. 1 a year; RLS at create (the shop's own members read, admins read and write, the engine writes
  with the service role). Setnayan Verified is NOT stored — it is read live from the shop's verification. Two
  service-role counting functions: `shop_seal_year_facts(from, to)` (one read for the platform: events completed that year,
  refunded, recorded shop cancellations, inquiries, second bookings; never a demo shop) and `shop_verified_partner_facts(shop)` (completed
  booking value minus refunds, bookings by Find / website / QR import, Booking QR events from the claimed token, accepted recommenders). A
  "real booking" is `shop_booked_loop_count`'s, copied.
- **Migration `20271348269771`**: `seal_awarded` added IF NOT EXISTS (J0, #7753, adds it too — whichever lands first wins).
- **`lib/shop-seals.ts`** (pure) + **`lib/shop-seals.server.ts`**: Top 10 (≥ 10 events that year, none cancelled by the
  shop, the ten highest review scores) · No. 1 (the first of them) · Most In-Demand (top 10% by completed bookings,
  refunds not counted) · Verified Partner (ten rules; rules 9 and 10 as ruled 15 Nov, 7fbff0cd, in one list `PARTNER_RULES_9_AND_10`) ·
  `displayedSeals` (Verified Partner permanently replaces Setnayan Verified) · No. 1's ONE FREE YEAR of the shop's
  current plan (7fbff0cd (6)) recorded `plan_gift_state = 'owed'` on its row with the plan at award, for G3's
  gift-to-shop flow (#7674, not merged) to give — no new money path. They extend the Spotlight engine: same
  pool, same score (`topPickScore`, now exported from `lib/vendor-badges.ts`), same top-10% rule. `RETIRED_SPOTLIGHT_AWARDS`
  names the three monthly awards the seals replace; `vendor_spotlight_awards` is not touched.
- **Ruled 15 Nov (11d044c0) and built:** the seal year runs 18 Dec → 17 Dec and the seals are given on 18 Dec (the
  first year from launch to 17 Dec 2026, `sealWindow`) · Clients' Choice = the most second bookings among shops with
  ≥ 10 completed events, ties to the higher rating, one shop a year · Verified Partner rule 2 = completed bookings'
  contract value, all years, minus refunds · the Top 10 plaque line with the exact rank ("No. 4 of the Top 10
  Suppliers of 2026", stored in `facts.plaque_line`).
- **Named gaps (nothing invented):** a booking has no booked-at date, so a second booking falls in the seal year of
  its EVENT's date · "cancelled by the shop" is recorded only for schedule-pool bookings · the yearly rating (trusted
  stats are lifetime) · rule 10's Invites counter (ruled, but the supplier-import door is not built ⇒ unread ⇒
  Verified Partner cannot be given yet).
- Tests: `lib/shop-seals.test.ts` (24) and `tests/db/the-seals-are-counted-and-given-once.db.test.ts` (8), each claim
  sabotage-checked. `tests/db/ugat-both-ends.baseline.txt` gains one named row (`seal_awarded`, paid down by J4).

SPEC IMPACT: None — implements the 15 Nov rulings as written; the open points are listed for the owner in the PR body.
