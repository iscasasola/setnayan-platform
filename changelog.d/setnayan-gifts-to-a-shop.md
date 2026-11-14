## 2026-11-14 · feat(gifts): G3 — Setnayan sends a shop gift stock or 28 days of a plan, opened once on Today

Owner rulings 14 Nov 2026 (DECISION_LOG "SETNAYAN CAN GIFT A SUPPLIER TWO KINDS OF THING" · "A GIFTED SUPPLIER PLAN:
THE SHOP CHOOSES" · "STRATEGIC TASTE OF THE HIGHER TIER" · "FINAL — … 28 DAYS" · "A SHOP ALREADY ON SUPPLIER ULTRA …
ADDS 28 DAYS" · "PRESSING REDEEM IS THE CLAIM" · "GIFT DESIGN APPROVED").

- **Admin › Gifts**, in the shop's existing comp panel: "Send a gift from Setnayan" — a live catalogue pack (Papic,
  Event Plus, Event Pro) × 1–10, or 28 days of Supplier Plus / Pro / Ultra. A branch of `setVendorTier` (no new
  server action). The shop's sent gifts are listed under it with where each stands.
- **The shop's Today**: "🎁 A gift from Setnayan is waiting · Open" until claimed → the tap-to-open moment with
  Setnayan's mark. Stock: *Add to my gifts* (lands through `shop_badge_reward_grant`, outside the 40% limit). Plan:
  *Start it* (no plan) · *Upgrade now* / *Start it when my plan ends* (a lower plan) · *28 more days* (the same plan).
  While it runs: "Ultra · gift · N of 28 days left"; in the last 7 days "Your Ultra gift ends in N days" with
  *Stay on Ultra* (the catalogue's 28-day price) and *Go back to Pro*. A branch of `startBadgeUpgrade` (no new action).
- **Nothing is lost**: Upgrade now PAUSES the shop's plan; when the gift ends, the shipped lapse sweep
  (`sweep_vendor_tier_expiry`) hands it back with exactly the days it had left (`setnayan_plan_gift_return`).
- **Exactly once**: `setnayan_shop_gift_claim` sets `claimed_at` in one conditional UPDATE; a repeat answers
  `already`. `tests/db/a-setnayan-gift-is-claimed-once.db.test.ts` (8 tests).
- Migration `20271345573127_setnayan_gifts_to_a_shop.sql` — adds one table (RLS at create), five functions, and two
  branches in `sweep_vendor_tier_expiry` (body copied from the object's newest definition, 20271310256381). Ugat map:
  `setnayan_shop_gifts` on the Papic ↔ Vendor joint.
- The moment stands in for G2's GiftMoment (not merged when this was built) — same words, swap the shell.

SPEC IMPACT: None — builds the approved 14 Nov rulings and drawing as ruled. Open items for the owner are in the PR
body (a "Stay" bought while a paid plan is paused; Event Ultra stock waits on #7652).
