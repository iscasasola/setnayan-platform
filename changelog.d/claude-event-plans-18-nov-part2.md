## 2026-11-19 · feat(plans): event plan re-cut part 2 — Pro themes and the Cinematic Reveal openings on Event Plus; Pro 3,000 credits + 6 months; Ultra 6,000

Owner rulings 34 · 36 · 38 (specs `PLAN_RULINGS_2026-11-18.md`). SKU codes and display names unchanged; no price written.

- **Gate 13 (a ready-made Pro theme) and gate 1 (a Cinematic Reveal opening) pass on Event Plus** — and nothing else of the
  Style or Reveal part. `HUB_PRO_GATES` marks them `plan: 'plus'`; `HUB_PLAN_GATES`, `ownsHubGate` and
  `HUB_EVENT_COLUMN_GATE` (lib/hub-parts.ts) are the one rule. `eventHubOwnership` fills `HubOwnership.gates` from Event
  Plus (any path: order, basket, comp, supplier gift) and the openings' own unlock. Consumers moved onto the one helper:
  `resolveHubTheme`, `coverOwnershipFrom`, the details page, the invite share panel, the Maker theme picker, the Maker's
  ✓ Apply (`planHubDraftApply`), its change lines and effects, the toolbar after a save (`hubSummaryFor`, hub-draft-bar),
  `eventStdOpeningsActive` / `eventOwnsStdOpenings`, and the editor page's Reveal panel ◆.
- `SKU_OWNERSHIP_ALIASES.STD_PREMIUM_OPENINGS` gains `EVENT_PLUS`.
- Migration `20271350979842_event_plans_recut_part2_credits_and_keep.sql` (data only): Event Pro
  `included_papic_credits` 3,000 and `fullres_extra_keep_days` 92 (≈ 6 months); Event Ultra 6,000. Three stale
  descriptions fixed (Pro's "The cinematic reveal comes only with this", Ultra's typed "3,500 Papic credits", Plus's
  "Setnayan AI"), each only when the stored text is exactly the stale one.
- Copy: Event Plus now lists the ready-made Pro themes and a cinematic Save the Date (/features, /pricing, front door,
  llms.txt, help).
- **A–C, built after the owner's 19 Nov answer** (DECISION_LOG 2026-11-19 "Event plans part 2 (#8004) — four calls",
  verbatim "all your picks"):
  - **(A) Everything is Event Ultra.** The 11 Hub parts and Editorial move from Event Pro to Event Ultra for new buyers.
    `eventHubOwnership` answers everything for an Ultra (any path), or for a Pro held through a path dated before
    19 Nov 00:00 PHT — new service-role reader `event_hub_pro_kept_lines` (migration
    `20271352097874_event_hub_pro_keeps_everything_before_19_nov.sql`: its order, a bundle, a basket line, a live comp,
    a supplier's gift). A newer Pro is the Pro PLAN (`HubOwnership.proPlan`, `holdsProPlan`): new readers
    `eventProPlanActive` / `eventOwnsProPlan` / `proPlanActiveFor` serve the plan's own perks — the Setnayan mark, the
    footer and watermark (guest page, print, editorial colophon), Schedule Release, View as and its PDF, and onboarding's
    "never sell Pro twice". The Pro aliases on `ANIMATED_MONOGRAM` and `EDITORIAL_PRO` are gone (undated; a kept Pro
    reaches both through the parts).
  - **(B)** The cap is measured against Ultra's row (`hubPartPrices().everything`); a paid Pro counts toward it.
  - **The plan page** (studio/website-pro): Pro is a plain plan card — "Everything in Plus · Setnayan AI · no Setnayan
    mark · N credits", N read from `included_papic_credits`; Event Ultra is the "Everything" card with the parts list
    under it; a kept Pro reads "Your Event Pro keeps all 11 Hub parts and Editorial".
  - **(C) The Maker asks for Ultra**: "Apply needs Event Ultra", "Unlock Ultra and Apply · ₱X" where X is this event's
    own difference (`readUltraUpgradeCharge`) or Ultra's row; the Maker's ◆ marks read ULTRA (`PaidMark` `word`). The
    monogram page and Panood setup sell the animation inside Event Ultra.
  - **iPhone**: the Apple screen sells `com.setnayan.app.event_ultra`, and to an event with a paid Pro the new
    `com.setnayan.app.event_ultra_upgrade_from_pro` (consumable), priced at Ultra's row less Pro's (`priceLessRow`; the
    delivery's one-price check reads the difference). ⚠ The owner creates both in App Store Connect.
  - Copy: /pricing, the front door, llms.txt and help say the parts are Event Ultra's, and that a Pro bought before
    19 Nov keeps them.
  - Tests: `lib/everything-is-event-ultra.test.ts` (new, sabotage-checked); 14 guards re-aimed to the ruling; the
    store-shell paid-name net now also knows "Event Ultra"; the Prints golden re-recorded with its reason.

SPEC IMPACT: None in this PR — the rulings already live in the specs repo (`PLAN_RULINGS_2026-11-18.md` 34 · 36 · 38,
and DECISION_LOG 2026-11-19 "Event plans part 2 (#8004) — four calls", specs `ad44b079`). App Store Connect needs
`com.setnayan.app.event_ultra_upgrade_from_pro` created by the owner.
