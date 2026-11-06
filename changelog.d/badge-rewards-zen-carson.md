## 2026-11-06 · feat(badge-rewards): the owner's approved table — Event Plus for three rows, and 4-week badge upgrades ready until Start

Owner approved the table 6 Nov ("Approve as proposed"), DECISION_LOG 2026-11-06 "BADGE REWARDS — THE APPROVED TABLE
(6 NOV)". Supersedes the three rows of the 5 Nov block below that it names.

- **Gift stock — Event Plus replaces 2 × Papic 150** at 10 events, 1st Pick 25 and 50, and Rising of the month
  (`lib/badge-rewards.ts`). Every other row is unchanged; each still pays once, never expires, sits outside the 40%
  limit.
- **Personal upgrades — four weeks of a catalogue add-on for the shop itself** (`lib/badge-upgrades.ts`, its own table,
  never gift stock): Verified → Papic Challenges · first booking → 3D Booth (below Solo → Papic Challenges, decided at
  Start; the booth logo only shows on Solo+) · 5 reviews → AI Chatbot · Top Pick / Most Booked of the month → the
  supplier's choice of the three (booth hidden below Solo), on top of the Event Plus that award already gives. Rising
  gives none.
- **Migration `badge_upgrades_ready_to_start`** (RLS at CREATE TABLE): `shop_badge_upgrades` (UNIQUE (shop, reward_key) —
  once per badge step; READY until Start, never expires unused) · `shop_badge_upgrade_grant` (service role) ·
  `shop_badge_upgrade_start` (service role; row-locked; re-checks the pick and the plan via `vendor_tier_rank`; extends
  the add-on's OWN column — papic_challenge_expires_at / booth_addon_expires_at / ai_addon_expires_at — from the later
  of now and its current expiry, so paid time is kept; starts once).
- **Granted in the same sweep** as the gift-stock rewards (`grantOwedBadgeRewards` now runs `grantOwedBadgeUpgrades`),
  so the badge page, Today and the admin's manual award give both.
- **Start** — Shop › Promote › **Your upgrades** (new section under Your gifts): a row per upgrade; a ready row taps open
  a sheet (Upgrade ▾ when there is a choice · Start); a started row shows "on until …". Server action
  `startBadgeUpgrade` (owner or admin of the shop; the client sends only the id and the pick). The product must be on
  the catalogue (`vendor_billing_catalog.is_active` for the add-on's price rows); off sale → the upgrade stays ready.
  ⚠ `vendor_billing_catalog` has **no duration column** — the four weeks come from each add-on's own period constant
  (`VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS` · `VENDOR_3D_BOOTH_PERIOD_DAYS` · `VENDOR_AI_ADDON_PERIOD_DAYS`), the same ones a
  paid purchase uses.
- **Badge page** rows for Verified, first booking, Reviews and Monthly awards add one line: "Also → 4 weeks of …
  · ready to start in Promote". **Admin › Gifts** gains a read-only **Badge upgrades** table.
- `DatesRow` gains `onOpen` (the whole row opens a sheet in place — no row buttons). Maps: Ugat claims, export
  completeness, exposure baseline (SELECT own rows only; neither door reachable by a session).
- Tests: `lib/badge-upgrades.test.ts` (10) · `tests/db/badge-upgrades-start-once.db.test.ts` (4 — once, stacking Start,
  the plan rule, RLS; sabotage-verified) · `lib/badge-rewards.test.ts` updated to the approved rows.

SPEC IMPACT: DECISION_LOG.md — new row 2026-11-06 "BADGE REWARDS — THE APPROVED TABLE (6 NOV)" (the owner's approved
table, verbatim summary), applied in the corpus in the same change.

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

- **Owner answers on the draft (2026-11-05), all applied:** Reviews' steps 5 · 10 · 25 · 50 · 100 · 250 · 500, the
  Inspiration box's top two steps and Booked Loop at every step are **ruled** (the code notes say so now). Pro / Ultra
  plan gifts are **built later as their own kind** (they lapse; badge rewards never do). **A booking cancelled before
  its day gives its free booking fee back** (`booking_fee_expires_when_booking_cancelled` gains that arm; the charge
  lets go as `cancelled_unbilled`, the fee waits again; the history says "back Nov 8"). **A badge-paid booking still
  gives the couple the Setnayan gift** — it lands on their event the moment the free fee is used, sized as the card /
  quote promised, with no bill (Setnayan covers it); `setnayan_gift_quote_applies` answers `badge_reward` /
  `badge_reward_card_says_no`, so the quote promises the photos and says "nothing is billed to you".

SPEC IMPACT: DECISION_LOG 2026-11-05 "BADGE REWARDS" row's State moves from "sent to cloud session" to "built as a
draft PR, not live", plus a new row for the owner's seven answers on the draft (steps, plan gifts later, a cancelled
booking gives the free fee back, a badge-paid booking keeps the Setnayan gift). The 2026-10-12 #7 rule "no fee, no
couple gift" now has one exception: a fee paid by a badge reward.

**Merged with #7297 after main moved gifts to Shop › Promote (2026-11-06):** the badge-reward reads (reward stock,
rewards given, reward names) moved with the section from the Plan page into the Promote loader
(`shop/promote/_components/shop-gifts-data.ts`); the section draws them unchanged. The plan lab keeps its reward
fixture and gains #7297's `&app=1` (no Buy in the iPhone app).
