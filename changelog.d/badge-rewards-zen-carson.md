## 2026-11-05 · feat(badge-rewards): each badge pays a reward into the gift stock, and 1,000+ events pay a free booking fee

Owner ruling DECISION_LOG 2026-11-05 ("BADGE REWARDS — WHAT EACH BADGE GIVES, WHERE IT LANDS, AND THE NEXT ONE
SHOWN") and the same day's aim ("in-app service to guests → automatic sales"). Stacked on #7297 (supplier gifts slice 2),
which is stacked on #7279 and #7262. Draft — nothing goes live until the owner approves.

- **One reward table** (`lib/badge-rewards.ts`, pure): Verified → Papic 150 · first booking through Setnayan → Papic 150
  · 1st Pick per ladder step · Reviews each step → Papic 150 · Booked Loop → Event Plus · each new branch → Papic 150 ·
  a card's first booking → Papic 150 · Inspiration box top steps → Papic 150 · Most Booked / Top Pick → Event Plus,
  Rising → 2 × Papic 150 (once per award per month) · Events 10 → 2 × Papic 150, 50 → Event Plus, 100 → 2 × Event Plus,
  500 → Event Pro, 1,000 / 5,000 / 10,000 → a free booking fee. The badge page and the granting both read it. No price
  and no pack size is typed — "Papic 150" is the smallest pack on the live catalogue.
- **Migration `badge_rewards_land_in_the_gift_stock`** (RLS at CREATE TABLE): `shop_badge_rewards` (one row per reward,
  UNIQUE (shop, reward_key) — every badge and every step pays exactly once, even after it is lost and earned again;
  never expires) · `shop_gift_stock_entries` takes a `badge_reward` kind (+) pointing at its reward · quote lines get
  `from_badge_reward` · `shop_gift_reward_stock_status` (reward stock earned − used) · the one door
  `shop_badge_reward_grant` · `shop_badge_fee_waiver_revoke` (admin, unused only) · `booking_fee_charges.badge_reward_id`.
- **The free booking fee applies by itself** — `booking_fee_open_lock_charge` gains one arm BELOW the free first
  booking, the ₱0 fee and the promo window (so it never touches a booking that is already free): the shop's oldest
  unused free fee pays the fee; the charge is a ₱0 `paid` that names its reward (no new status — eight functions carry
  hard-coded status lists). One per booking; extras wait. `booking_fee_rederive_lock_fee` gains `badge_noop` — without
  it an amended badge-paid booking would have been billed the whole fee as a delta.
- **Badge rewards sit outside the 40% gift limit** (`judgeQuoteGifts`): reward stock pays whole quote lines first, the
  most valuable first; only bought lines are measured. The quote line says "Badge reward".
- **Granting**: badges are worked out live, so a reward is paid when a read finds its badge earned — the badge page
  (Shop › Page › Awards and badges), Today's badge-facts read (after Today has drawn), and the admin's manual award.
  Only measured badges grant: Verified, Events, Reviews, first booking, branches, service cards, monthly awards.
  1st Pick, Booked Loop and the Inspiration box have no counter yet — drawn with their reward, never granted.
- **Supplier screens**: the badge page shows, per row, "Gave you: … · in your gifts" and "Next: 100 events · Gold · 4 to
  go → 2 × Event Plus"; rows added for the badges that pay but had none. Plan › Your gifts marks reward stock, adds the
  "Free booking fee · your next customer · from 1,000 events" row and a Badge rewards fold with the free fee's history
  (earned when · used on which booking · ₱0 fee · Badge reward). The fee forecast and the Plan fee row say "₱0 · Badge
  reward". In-app only — no new e-mail (a badge-paid fee is a `paid` charge, so no waived-fee receipt is sent).
- **Admin › Gifts & comps › Badge rewards**: every reward, its badge step and where it stands; take back an unused free
  booking fee (audited). The supplier gift ledger names badge-reward rows.
- Tests: `tests/db/badge-rewards-pay-once.db.test.ts` (exactly once, the free fee skips free bookings, amend stays free,
  revoke, reward stock, RLS) · `lib/badge-rewards.test.ts` (the table, keys, lines, the 40% exemption).
- Server-action ceiling 1227 → 1228 (`revokeBadgeFeeWaiver`, reason in the script).

SPEC IMPACT: DECISION_LOG 2026-11-05 "BADGE REWARDS" row's State moves from "sent to cloud session" to "built as a
draft PR, not live". Open readings flagged in the PR for the owner (not ruled in the corpus): Reviews' steps are the
spec's PROPOSED numbers; "Inspiration box top steps" read as the top two; "Booked Loop → Event Plus" read as each step;
Pro/Ultra plan gifts not built (they lapse; badge rewards never do).
