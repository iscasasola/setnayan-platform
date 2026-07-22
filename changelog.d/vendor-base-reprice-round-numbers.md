# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-22 · chore(pricing): vendor base-tier reprice to round numbers — Solo/Pro/Enterprise ₱1,000/₱2,500/₱8,000

Owner (2026-07-22) moved the vendor subscription base tiers off the charm "Ladder B" (₱999/₱2,499/₱7,999) to round numbers, as the first, self-contained piece of the 2026-07-22 vendor base + add-on restructure. The four new add-ons (Vendor AI ₱1,500 · 3D Plan ₱1,500 · Photo Challenge ₱400/event · Deep Search ₱500/search), the two free-first-cycle trials, and the token-pack retirement ship in follow-on PRs.

- **Migration `20270905000000_vendor_base_reprice_round_numbers.sql`** — 6 UPDATEs on `vendor_billing_catalog` (the price SSOT): Solo `999→1000`/`9999→10000`, Pro `2499→2500`/`24999→25000`, Enterprise `7999→8000`/`79999→80000`. Annual stays = 10× the 28-day fee. Nothing else touched (add-ons/tokens are separate PRs).
- **App fallbacks synced so nothing drifts if the DB read returns empty:** `lib/v2-catalog.ts` `getVendorPrices` fallback strings + JSON-LD `num` block + annual-save fallbacks; `lib/vendor-tier-caps.ts` `TIER_PRICE_PHP` + its ladder doc-comment.
- **AI-crawler surface:** `public/llms.txt` — repriced only the seven vendor-tier lines (the shared ₱999/₱2,499 figures on Animated Monogram / Cinematic Reveal / branch / Pakanta / Thank You / Live Studio Desktop are left untouched); `lib/llms-price-fixture.ts` `APPROVED_LLMS_PRICES` updated to match (added ₱8,000 / ₱25,000 / ₱80,000, removed ₱9,999 / ₱24,999 / ₱7,999 / ₱79,999; re-tagged the shared ₱1,000 / ₱2,500 / ₱10,000). Verified the `llms-price-drift` body-vs-fixture sets are equal.
- **Vendor-dashboard copy:** `subscription-cards.tsx` `webPricesCopy` + the native-IAP ladder doc-comment (the ₱3,750/₱12,000 IAP prices are unchanged — they are 1.5× the new round web prices); `web-nudge-banner.tsx` example comment.

The `help-no-hardcoded-prices` guard is unaffected (it scans help-article bodies only, not `llms.txt`/fixture; the retired-ladder blocklist `6,000/10,000/100,000` targets help copy, and no help body cites the new figures).

SPEC IMPACT: Vendor base tiers ₱999/₱2,499/₱7,999 → ₱1,000/₱2,500/₱8,000 (annuals 10k/25k/80k). Per the owner-locked "pricing follows code" rule, the corpus `Pricing.md § 00` canonical vendor line + `§ 00.G` item 8 will be updated to mirror this merged state post-merge (they currently record the charm ladder as "code today"). Canonical decision doc: `Vendor_Subscription_Ladder_2026-07-22.md`.
