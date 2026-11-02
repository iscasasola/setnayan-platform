## 2026-06-29 · feat(setnayan-ai): flip Setnayan AI to a ₱499 / 28-day subscription on every customer surface

Setnayan AI was a one-time ₱3,999 catalog unlock; the owner reframed it to a
**₱499 per 28-day cycle** subscription that stays active until the wedding day,
then auto-ends (corpus `Setnayan_AI_Subscription_Decisions_2026-06-29.md`
Decision 1 · OWNER). This PR makes the price + recurrence + access-window RULE
correct everywhere a couple sees it. Auto-CHARGING stays out of scope (V1.5).

**Schema — add a recurrence concept, then flip price + period atomically**

- Migration `20270322883953_setnayan_ai_per_28d_billing_period.sql` adds a
  nullable `billing_period text` to `platform_retail_catalog_v2` (DEFAULT
  `'one_time'`, CHECK `one_time|per_28d`) and, in the SAME transaction, flips
  `SETNAYAN_AI` → `billing_period='per_28d'` + `retail_price_php=499`. Column
  lands and the row flips together, so there is no window where ₱499 renders as
  a one-time fire-sale. Additive + idempotent; RLS/public-read grants untouched
  (the new column rides the existing catalog read policy). Applied to
  setnayan-prod (33 rows stay `one_time`, 1 row `per_28d`).

**Display — number + "/ 28 days" both come from the catalog, never hardcoded**

- `lib/v2-catalog.ts`: new `BillingPeriod` type + `billing_period` on
  `V2CustomerSku`, threaded through `fetchV2CustomerCatalog`. New
  `formatBillingPeriodSuffix()` ("" for one-time, " / 28 days" for per_28d,
  matching the vendor 28-day house style) and `getCustomerSkuPriceLabel()`
  (full "₱499 / 28 days"). `formatSkuPriceLabel()` now appends the suffix, so
  every à-la-carte catalog reader picks it up automatically; one-time SKUs are
  byte-identical to before.
- Homepage (`_components/marketing/_sections.tsx`): the Setnayan AI narrative +
  the pricing-grid card now render "₱499 / 28 days" + "active until your wedding
  day" copy.
- `/pricing` (`app/pricing/page.tsx`): the Setnayan AI tier card renders the
  suffix; the JSON-LD Offer gains a recurring `UnitPriceSpecification`
  (`billingDuration: P28D`) so structured data matches the rendered unit.
- Onboarding (`onboarding-pricing.ts` → `onboarding-shell.tsx`): the keep-card
  label flows through `formatSkuPriceLabel` (now "₱499 / 28 days") + "active
  until your wedding day" unit.
- Buy surface (`dashboard/[eventId]/studio/setnayan-ai/page.tsx`): display price
  via `getCustomerSkuPriceLabel`; copy de-"one purchase"-ified.
- Help Center (`lib/help.ts`): the two cost articles now state the ₱499/28d
  subscription instead of ₱3,999 one-time (also dropped the just-removed
  Essentials/Complete bundle mention).

**Access model (wedding-anchored)**

- The access mechanism already exists: `user_ai_subscription.active_until`
  (per-user window, PR #2407). The owner's "active until the event day, then
  auto-ends" rule = the window is anchored to `events.event_date`. This PR
  records that as the `active_until` stamping RULE (refined column comment in
  the migration); no row is stamped here — activation is a later flag-gated PR
  (`platform_settings.setnayan_ai_per_user_enabled`, default OFF).
- **Known limitation:** `user_ai_subscription` is ONE window per user, but a
  user can host multiple events with different dates. "Anchor to the event day"
  is unambiguous for the common single-event couple; the multi-event tie-break
  (latest date? per-event windows?) is left to the activation PR and flagged.

**V1.5 (flagged, not built):** recurring per-cycle auto-charge until the wedding
day. Hook points carry `// V1.5:` notes: `lib/sku-activation.ts` (the
`SETNAYAN_AI` activation handler — stamp `active_until` + schedule next charge)
and the studio buy page header. Couples pay one 28-day term up front via the
existing manual apply-then-pay rails today.

SPEC IMPACT: Setnayan AI billing model: one-time ₱3,999 → ₱499 per 28-day cycle,
wedding-anchored (active until event day, then auto-ends). Already canonical in
`Setnayan_AI_Subscription_Decisions_2026-06-29.md` (owner-locked); a date-ordered
row appended to `DECISION_LOG.md` records that the term-pass price + the catalog
`billing_period` flip landed in code. Public `/pricing` + homepage + Help Center
now reconciled to ₱499/28d (the doc flagged these as still-showing the old
one-time price). `llms.txt` pricing line should be re-synced on the next pass.
