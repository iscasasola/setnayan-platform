## 2026-11-20 · feat(plans): event plan re-cut part 2 — Event Plus is the whole Event Hub; Pro ₱5,490 + 3,000 credits + 6 months; Ultra 6,000

Owner rulings 34 · 36 · 38 (specs `PLAN_RULINGS_2026-11-18.md`), then the 20 Nov ruling "EVENT PLUS = 1,000 PAPIC
CREDITS + THE WHOLE EVENT HUB" (specs DECISION_LOG 2026-11-20, `Pricing.md` §1.1). SKU codes and display names unchanged.

- **Event Plus holds the whole Event Hub.** `eventHubOwnership` answers everything for an Event Plus, Pro or Ultra held
  through any path (order, basket, bundle, comp, gift, internal host). `EVERYTHING_SKU` is `EVENT_PLUS`; the cap (parts
  paid toward everything) is measured against the Plus row. Pro and Ultra also hold the **Pro PLAN**
  (`HubOwnership.proPlan`, `holdsProPlan`): new readers `eventProPlanActive` / `eventOwnsProPlan` / `proPlanActiveFor`
  serve the plan's own perks — no Setnayan mark (guest page, print, editorial colophon), Schedule Release, View as and its
  PDF, and onboarding's "never sell Pro twice". Plus keeps its one small mark.
- `SKU_OWNERSHIP_ALIASES`: `EDITORIAL_PRO`, `STD_PREMIUM_OPENINGS` and `ANIMATED_MONOGRAM` gain `EVENT_PLUS` (read side;
  a grant only widens). The plan gates (`HUB_PLAN_GATES`, `ownsHubGate`) stay, and the openings' own unlock still passes
  gate 1; consumers ask the one helper.
- **The Maker asks for Plus**: "Apply needs Event Plus", "Unlock Plus and Apply · ₱X" (the Plus row), "Apply without the
  Plus effects"; the ◆ marks read PLUS (`PaidMark` `word`). The monogram page sells the animation inside Event Plus;
  its owned note reads "Included with your plan". Prints say "your Event Hub look on paper is Event Plus".
- **The plan page** (studio/website-pro): Event Plus is the whole-Hub card ("the whole Event Hub"); Event Pro is a plain
  card — "Everything in Plus · Setnayan AI · no Setnayan mark · N credits", N read from `included_papic_credits`; Event
  Ultra is a plain card after it, no Patiktok.
- **iPhone**: the Apple screen sells `event_plus` (the existing product); no new App Store product. The `event-hub-pro`
  start refuses "owned" on the Pro plan, not on the Hub alone.
- Migration `20271356433378_event_plans_recut_part2_plus_holds_the_hub.sql` (data): Event Pro ₱5,690 → **₱5,490**, guarded
  on the old figure, and its 10 + 1 gift bundle follows as 10 × the new row (the bundle rule; guarded on 10 × ₱5,690); Event Pro `included_papic_credits` 3,000 and `fullres_extra_keep_days` 92 (≈ 6 months); Event Ultra
  6,000. Descriptions: Plus says the whole Event Hub; Pro is Plus + Setnayan AI; Ultra loses Patiktok (and its typed
  "3,500"). Each UPDATE matches only the exact stale text, so an admin-written description is left alone.
- **A paid Plus counts toward Pro and Ultra** (ship-controller review, 20 Nov): `eventHubOwnership` step 1 carries a
  PAID Event Plus (its own order or a basket line, in the mode's status; never a comp or a gift) in `paidPhp`, so a Plus
  event is sold Pro at ₱2,500 (Pro row less Plus) and Ultra at ₱7,000 (Ultra row less Plus) — before, Pro was refused and
  Ultra charged in full. `hubPartsCharge` sells `'full'` (the Pro plan) to a whole-Hub event that lacks the plan, never as
  a ₱0 order. Pinned on the replay's catalogue rows (`event-hub-pro-parts-and-the-cap.db.test.ts`) and in source
  (`event-plans-recut-part2.test.ts` H, sabotage-checked).
- The iPhone app's held line reads "◆ N waiting for Plus" / "Remove Plus changes" (the plan's new name; owner wording of
  2026-10-08 otherwise kept). /features' Plus card says "the whole Event Hub".
- Copy: /pricing, the front door, llms.txt (Setnayan AI is in Pro and Ultra, not "all three"), help and the add-ons blurb
  say the whole Hub is Event Plus; nothing says Ultra carries Patiktok.
- Tests: re-aimed to the ruling — entitlements, animated-monogram, pro-parts-in-the-app, scene-upload-media,
  try-pro-pay-at-apply, the toolbar test, supplier-plan-table, says-what-it-includes, event-hub-pro-is-sold-whole,
  event-plans-recut-part2; the store-shell paid-name net now also knows "Event Plus" and "Event Ultra"; the Prints golden
  re-recorded with its reason; a DB test pins Pro at ₱5,490 after the replay and no plan description selling Patiktok.

- **Review fixes (20 Nov, stand-in).** The migration sets `lock_timeout = '5s'`; Event Pro's
  supplier-gift price moves ₱5,190 → ₱5,490 (guarded: only from ₱5,190). The DB test now pins Pro's
  3,000 credits and ₱5,490 gift price on the catalogue row (Ultra's 6,000 was already pinned).

SPEC IMPACT: None in this PR — the rulings already live in the specs repo (`PLAN_RULINGS_2026-11-18.md` 34 · 36 · 38,
DECISION_LOG 2026-11-19 "four calls" and 2026-11-20 "Event Plus = 1,000 Papic credits + the whole Event Hub",
`Pricing.md` §1.1). Open for the owner: Event Pro's `gift_price_php` (₱5,190) was set against ₱5,690.

### Event Plus's gift price is its list price (20 Nov, controller ruling on review)
- Migration § 2c: `EVENT_PLUS.gift_price_php` = its own `retail_price_php` (₱2,690 → ₱2,990, read from the row, guarded to the old value). DECISION_LOG 14 Nov "EVERYONE PAYS THE REGULAR PRICE" and 16 Nov "every shop pays the list price for a bought gift".
- DB test `every-plan-gift-is-its-list-price.db.test.ts`: red on the old line (₱2,690 ≠ ₱2,990), green on the fix (2/2).
SPEC IMPACT: None (the rulings are already in DECISION_LOG).

- **Ship review, 22 Nov (ship controller).** /features' Event Pro column still listed Plus's items (themes, reveals,
  your own media, prints — and "tickets", which are free). It now says only what Pro adds, from the owner's 21 Nov
  table: Setnayan AI · full-size photos kept 6 months · 1 GB, no Setnayan mark; the front page's Pro card says the
  6 months too. Guard: `lib/the-pro-column-says-only-what-pro-adds.test.ts`. Prod has no single hub-part orders, so no
  old part-holder is affected by the re-cut. No migration changed.
