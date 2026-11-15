## 2026-11-15 · feat(badges): one reward ladder, the new tier names, award dates, two new counters, and badges that pay the moment they are earned

Owner rulings of 15 Nov (corpus DECISION_LOG 2026-11-15, "SUPPLIER BADGES, SEALS AND REWARDS"). Slice A of the controller's badges build map — schema, grant and notify; no screen is redrawn here.

- **Tier names** (`lib/badge-tiers.ts`): Bronze · Silver · Gold · **Ruby · Emerald · Diamond** · Black Diamond. Keys `tier1`…`tier7` unchanged. Emerald's paint is the prototype's stone, held to AA on light and dark. The dashboard row's materials (`lib/shop-badge-row.ts`, `lib/badge-art.ts`) follow.
- **One reward ladder** (`lib/badge-rewards.ts` `TIER_REWARDS`): Bronze Papic 150 · Silver Papic 150 · Gold Papic 1000 · Ruby Papic 3000 · Emerald Event Plus · Diamond Event Pro · Black Diamond Event Ultra, on every laddered badge, by the step's position on its own ladder. Supersedes the 8 Nov per-step table. Keys unchanged, so a step already paid is never paid again. No new free booking fee is earned; the ones already earned still wait. Once-rewards (Verified, the firsts) and the monthly awards are unchanged.
- **Pack sizes are read, never typed**: Papic 1000 / 3000 are the catalogue packs named by code (`PAPIC_GUEST_1K`, `PAPIC_GUEST`, the codes the app already sells under those names, guarded by a test). Their credits are read at grant time.
- 💎 **Black Diamond gives the real Event Ultra** (owner 15 Nov, "Event ultra"): migration `20271348181787_black_diamond_gives_event_ultra` mirrors slice 2 (`20271319497337`) for Ultra. The three gift tables, `unlocks_sku` and `shop_badge_rewards.reward_kind` accept it. The grant door, both stock readers and the delivery door take it. An Ultra line on a quote is given at the couple's first payment as `EVENT_ULTRA` (it upgrades an event holding Pro), with Setnayan AI on and the included Papic credits topped up to the `EVENT_ULTRA` catalogue row's number (read, never typed). The gifted-access readers then answer for what an Ultra order confers (`EVENT_ULTRA_GRANTS`). App: `event_ultra` is a gift kind (tray row, quote menu, admin ledger, card word, `EventHolds` 'ultra') and is grantable. A gifted Ultra is **FULL Ultra** (owner 15 Nov, "yes"): `papic_events_past_fullres_clock` also adds the `fullres_extra_keep_days` of a plan a SUPPLIER GAVE the event (the delivered gift row's `unlocks_sku`, days read from the row); an admin comp, all-services or per-SKU, keeps the plain 3 months (owner 15 Nov, "keep them at 3 months"), and canvas prints open through `canvasPrintsUnlockedFrom(…, ultraHeld)` from the moment it is delivered. It is **earned only**: its catalogue row has no gift price, so the buy sheet and the gift-order key leave it out (`shopGiftBuyable`).
- **Counters**: the first 5★ review is measured (new `shop_trusted_five_star_count`, which uses the public stars' own predicates); **Trusted by** (accepted, active partnerships, steps 1·5·10·25·50·100·250) is a new laddered badge.
- **Award dates + claim**: `readBadgeAwards` returns each earned step's `grantedAt` and `claimedAt` for the UI. The claim reuses the shipped 14 Nov door (`gift_moment_claim` / `POST /api/unwrap`, source `badge_reward`), which is already idempotent and limited to the shop's own members. No second claim column was added.
- **Firing when earned** (`lib/badge-earned.server.ts`): `after()` sweeps run when a booking turns delivered/complete (couple status, couple confirm, admin force-complete), when a review is posted, when a partnership is accepted, and when a gift is given. A daily `badge-reward-sweep` backstop (`claim_periodic_job`) runs from admin traffic. A new grant sends ONE `badge_earned` notice + email ("You earned {Tier} {Badge}, {Shop}!") naming the highest tier the sweep paid, plus the existing Lane S post. An existing grant is never told again.

Migrations: `20271346425846_notification_type_badge_earned` (enum value, its own file) · `20271347341362_a_shop_counts_its_five_star_reviews` (read-only function, service_role only) · `20271348181787_black_diamond_gives_event_ultra` (Ultra gift path).

SPEC IMPACT: None new — implements DECISION_LOG 2026-11-15 as written. Flagged for the owner in the PR: Event Ultra is earned-only (not sold to shops as a bought gift — no gift price set); canvas prints still open for an admin comp of Ultra (a deliberate full-plan grant at every gate), while the photo hold does not; one notice per sweep (the highest tier).

## 2026-11-15 · feat(badges): J0 — five shop badges by tier, gift points, rewards claimed at the grant, the award queue and its resume point

Controller's J0 brief on the later 15 Nov rulings (corpus DECISION_LOG 2026-11-15, e5ec685d · bc148e4e · 4b8cc3a3). Supersedes two lines of the block above: **Trusted by is no longer partnerships**, and **there is no claim step**.

- **The five shop badges** (`SHOP_BADGE_STEPS` in `lib/badge-tiers.ts`, one per tier Bronze → Black Diamond):
  - **Completed bookings** — 5 · 25 · 50 · 100 · 250 · 500 · 1,000
  - **Five-star reviews** — 50 · 250 · 500 · 1,000 · 2,500 · 5,000 · 10,000
  - **Gifts given** — 150 · 750 · 1,500 · 3,000 · 5,000 · 10,000 · 20,000 points
  - **Trusted by** — 1 · 5 · 10 · 25 · 50 · 100 · 250 clients who booked the shop again for another event, each counted once (`shop_booked_loop_count`)
  - **Invites** — the same steps. It ships as "Not counted yet", because no record of a supplier bringing in another supplier exists.
  - `MILESTONE_THRESHOLDS` is untouched; its readers are unchanged.
- **Retired ladders grant nothing new, and keep what they gave**: Booked Loop · 1st Pick · Service cards · Inspiration box · Branches · the Firsts · the old Reviews and Events ladders. This is code only, so no row is revoked.
  - A new reward key is `badge:tierN`.
  - A step already paid on the old Events, Reviews or Trusted-by ladder blocks the same tier on the new ladder, so nothing pays twice.
- **Gift points** (`lib/gift-points.ts` + SQL twin `gift_points_for_price`): one point per ₱10 of the gift's regular price, rounded off to one significant figure. ₱99 → 10 · ₱499 → 50 · ₱999 → 100 · ₱2,990 → 300 · ₱5,690 → 600 · ₱9,990 → 1,000.
  - `shop_gift_points(shop)` (service role only) counts a gift only once it was given, and only on an event whose booking with the shop is delivered or complete.
  - Prices come from `platform_retail_catalog_v2` only.
- **Rewards are claimed at the grant**: `shop_badge_rewards_auto_claim(shop)` claims every unclaimed reward through the same once-only key (`gift_moment_claims_once`). It runs after every grant sweep. A second run claims nothing, and no stock moves.
- **"See it", not "tap to claim"**: the notice and email button reads See it and opens Today. It never links to Promote.
- **The award queue** (`lib/award-queue.ts`, pure): No. 1 → the other seals → badges in the order earned.
  - One Today line: News until opened.
  - A flow left midway becomes a To do, "Continue … · 4 of 9", and resumes at that exact step (`shop_award_flow_progress`, RLS at create; the shop reads its own; no session writes it).
  - Both are written and read through the existing `/api/vendor/badges` (GET `?view=awards`, POST `{flow, step, total, done}`). No new route and no new server action.
- **New notice types** `seal_awarded` and `card_badge_earned`, in the enum and the TS union. They are named debt in `ugat-both-ends.baseline.txt` until J4 (the seal player) and J3 (the service-card badges) emit them. Today's grant keeps sending `badge_earned`, which is the one on the email allowlist.
- A read that fails answers null, never 0: the gift-points read, the queue and the flow progress.

Migrations: `20271348804021_notification_types_seal_and_card_badge` (enum values, their own file) · `20271349129379_award_flow_gift_points_and_auto_claim` (add-only).

SPEC IMPACT: None new — implements the controller's J0 brief from DECISION_LOG 2026-11-15. Flagged for the owner in the PR:
- Event Ultra's gift points use its regular price (₱9,990 → 1,000, as ruled); the brief had said to leave it empty.
- Trusted by counts a returning client from their second booking (contracted or later), not only once the second event is complete.
- A Booked Loop reward already given does not block Trusted by Bronze.
- Invites is not counted yet.
