## 2026-07-10 · pricing(catalog): comprehensive pricing finalization (owner)

Reprices across `platform_retail_catalog_v2` + `vendor_billing_catalog` (migration `20270712300000`, applied to prod), with all display/GEO/fallback surfaces reconciled in lockstep.

- **Setnayan AI → one-time.** `billing_period` `per_28d` → `one_time` (price ₱499 unchanged); the ₱799 `SETNAYAN_AI_RENEW` row deactivated. Deliberately a cheap, wedding-anchored engagement driver — access until the event date. Safe: the entitlement gate reads `setnayan_ai_active` (+ a window only the flag-off per-event flow ever writes), so `billing_period` is display-only. Homepage overlay + `/pricing` AI card copy collapsed from the two-tier "₱499 first → ₱799/28 days" to "₱499 · one-time".
- **À-la-carte reprices:** Animated Monogram ₱1,999 → **₱999** · 3D Plan ₱2,499 → **₱2,999** · Editorial PRO ₱3,499 → **₱2,999** · Cinematic Reveal ₱1,499 → **₱999**.
- **Couple Website PRO ₱4,999 umbrella deactivated/unbundled** — Editorial PRO + Cinematic Reveal now sell standalone; the free 4-in-1 website + unlimited RSVP is unchanged. Existing owners keep their entitlement grants (order-based); only new sales stop.
- **Vendor Enterprise ₱7,499 → ₱7,999 / 28d**, annual ₱74,999 → **₱79,999** (~23% prepay).
- Reconciled: `llms.txt` + `llms-price-fixture.ts` (lockstep drift guard), `pricing-data.ts` fallbacks, `v2-catalog.ts` vendor fallbacks, `pricing/page.tsx` AI card. Typecheck + 1388 unit tests + drift guard + retired-strings lint all green.
- **Deferred (recurring-billing dependency):** the `xxx.setnayan.com` subdomain ₱999/year SKU — no annual `billing_period` and no recurring-billing rail exists; ships with the recurring-billing build.

SPEC IMPACT: Applied — DECISION_LOG 2026-07-10 "COMPREHENSIVE PRICING FINALIZATION" + Pricing.md § 00 forward banner (spec corpus). Recurring billing (gateway + card-on-file + scheduler + dunning) logged as the required unbuilt dependency for all recurring revenue.
