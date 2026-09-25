## 2026-09-25 · feat(pricing): Event Hub Pro is ₱5,000 regular, ₱3,000 at sign-up

Owner ruling, verbatim: *"make it 5000 with 40% off becoming 3000 on
onboarding."* Supersedes the same-day ₱3,500 regular / ₱2,100 sign-up.

- Migration `20271247699024_event_hub_pro_is_5000_and_3000_at_sign_up.sql`
  moves `platform_retail_catalog_v2.retail_price_php` → 5000 and
  `.onboarding_price_php` → 3000 for `COUPLE_WEBSITE_PRO` (idempotent UPDATE +
  post-condition DO-block, same pattern as `20271245494068`).
- `lib/llms-txt-guard-input.ts` — the one hand-typed mirror of the catalog —
  updated its `COUPLE_WEBSITE_PRO` row to `retail_price_php: 5000`.
- `lib/event-hub-pro-price-is-never-typed.test.ts` — added `'3000'` and
  `'5000'` to `PRO_FIGURES` so the guard can catch a stray future typing of
  either figure near the product's name.
- `lib/event-hub-pro-signup-price.test.ts` — repointed at the new migration
  file and re-asserted the math: `setupPricePhp(5000, 3000, …) === 3000`,
  and `(5000 − 3000) / 5000 === 0.4`.
- `tests/db/onboarding-basket-one-bill.db.test.ts` — re-asserted the live row
  settles at 5000 / 3000 / `is_active = true`.
- Every surface that RENDERS the price (`/pricing`, the onboarding services
  step, the studio buy page, the Event Hub controller offer, llms.txt) already
  reads `platform_retail_catalog_v2` live and needed no code change — only the
  catalog-mirroring test fixtures above pin a figure on purpose.
- The "40% off" label on the onboarding card is computed from the two catalog
  prices (`savingPct` in `app/onboarding/_shared/services-step.tsx`), not
  typed, so it comes out at 40% automatically.

SPEC IMPACT: yes — `~/Documents/Claude/Projects/Setnayan/Pricing.md` (Event Hub
Pro row + the § 00 summary line) updated to ₱5,000 / ₱3,000; the
`DECISION_LOG.md` row for this ruling was already recorded by the Redesign
Controller before this PR.
