## 2026-10-25 · feat(pricing): /pricing is ours only and quality-led · the questionnaire at /pricing/plan

Owner 2026-10-25, verbatim: *"Yes, build this pricing page and the questionnaire into the app."* Earlier the same day:
*"I was told never to compare so i do not look cheap"* · *"Just focus on our free and prices and do not compare"* ·
*"no saying free. let us promote premium quality … why it is the best place to build your events"* · *"the paid parts
look like event hub does not have a free version"*. Built on the prototype `prototypes/pricing_ours_only_2026-10-25/`
(index.html revision 5 · quiz.html with the controller's "Start your event" / "Included…" wording).

- **/pricing** — replaced the comparison version ("Free here. Paid elsewhere.", the "elsewhere" lines, "One place,
  instead of several tools", the add-ons grid, the Papic estimator, "Everything you get for free", the apply-then-pay
  band, the storytellers callout) with the prototype's five parts: hero ("The best place to build your event.") ·
  Why Setnayan (four pictures — the real `feature-shots` captures cropped as drawn, plus the lock tile — and "See
  everything Setnayan does →" to /features) · Better together (three rows) · Prices ("Included with every event", six
  shown + "See all included ↓" on a phone, then Make it yours / On the day / After / Help planning; Event Hub Pro with
  its Everything / Just the parts dropdown and the "while you set up your event" line) · Close ("Paid once…", Start your
  event → /start, "See what Setnayan does for you →" → /pricing/plan). Every peso is read from
  `platform_retail_catalog_v2` (`app/(shell)/pricing/_pricing-reads.ts`, which now holds `readPricingExtras`); a missing
  row draws no figure. The structured data (Products + supplier plans with the fee sentence) is unchanged. Metadata
  says the quality message and keeps the supplier booking-fee sentence.
- **/pricing/plan** — the questionnaire: event type (house dropdown) · guest count slider 10–500 · one yes/no per screen
  · result "Your event, built with Setnayan." with our prices, "N of M included with every event", the set-up switch,
  Start your event (/start), and "What Setnayan does for you" (1 place instead of N tools · Money kept against printing
  it yourself · "about 9 hours" only on a yes to the guest list). Included answers say "Included", never ₱0. A paid
  question whose price cannot be read is not asked. Old-way figures: `lib/old-way-costs.ts` (Paperbug invitation,
  Feliz Studio place card / table number / welcome sign, the 2019 UK survey — each with its source and read date
  2026-10-25). Added to the store shell's web-only doorways (it quotes prices).
- **Spotlight tour** `pricing_page_v1` (`lib/tours.ts`, `GuestSpotlight`): Why Setnayan → Prices → the quiz link.
- **Deleted:** `lib/pricing-elsewhere.ts` + its test, `_papic-estimator.tsx`, `_pricing-motion.tsx`,
  `pricing-free-plus-addons.test.ts`, the "other event sites" house-words allowance, the `AiTypeItem` picker.
- Guards: new `app/(shell)/pricing/pricing-ours-only.test.ts` and `lib/old-way-costs.test.ts` (each seen red under
  sabotage); updated `setnayan-ai-two-prices`, `live-studio-pricing-row`, `patiktok-paid-verification-free-copy`,
  `papic-copy-guardrails`, `papic-is-one-service`, `spotlight-anchors-exist`. Port baseline regenerated (removed:
  /creators and /signup doors and the old components); Ugat screens regenerated (+ /pricing/plan).

NOT BUILT: carrying the questionnaire's answers into event creation ("Start your event" opens /start).

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "PRICING — OURS ONLY + THE QUESTIONNAIRE, BUILT" (owner quoted).
