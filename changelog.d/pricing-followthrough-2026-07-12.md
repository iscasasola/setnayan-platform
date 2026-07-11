## 2026-07-12 · feat(pricing): Setnayan AI ₱4,999 Event Pass + ₱200 token display sync

Pricing follow-through for the 2026-07-12 owner locks. TWO parts:

**Part A — Setnayan AI SKU restructure (migration + activation).** The live `SETNAYAN_AI` is a ₱499 one-time permanent unlock (per-event-pricing flag OFF since `20270714262264`). Added a premium door WITHOUT disturbing the cheap one:

- `supabase/migrations/20270729719932_setnayan_ai_event_pass_sku.sql`: seeds a NEW `SETNAYAN_AI_EVENT_PASS` — ₱4,999 · `billing_period='one_time'` · `is_active=true`. The existing ₱499 `SETNAYAN_AI` entry SKU is left untouched (the deliberate low-friction door). Idempotent `ON CONFLICT` re-syncs display fields only and never touches `is_active` (mirrors the `SETNAYAN_AI_RENEW` seed). CHECK constraints satisfied (`one_time` ∈ billing_period check; `is_pax_priced=FALSE` passes pax-config check). Timestamped after PR #3138's `20270728*` files.
- `apps/web/lib/sku-activation.ts`: `SETNAYAN_AI_EVENT_PASS` activation hook stamps `events.setnayan_ai_active=true` PERMANENTLY (no lapsing window, regardless of the per-event-pricing flag) — reuses the same boolean gate as the ₱499 SKU. Reversal path (`deactivateSetnayanAiIfUnowned` / `deactivateOrderSku`) extended so an EVENT_PASS refund re-derives the flag and an EVENT_PASS keeps AI alive if the ₱499 order is reversed.
- Deliberately NOT changed: `SETNAYAN_AI` stays ₱499 one-time; `SETNAYAN_AI_SUB` (dormant ₱499/mo per-user sub) stays `is_active=false` (recurring deferred); no feature flag flipped (per-event-pricing, per-user, paywall all left as-is).

**Part B — token ₱200 display sync (display only, no charge logic).** After PR #3138 the CHARGE is 1 token = ₱200 (DB migrations `20270728100000`/`20270728200000`), but display constants still showed ₱100 × old 1–3 region bands. Synced every vendor/admin/public display to a flat ₱200 / flat-1-token burn:

- `apps/web/lib/v2/region-token-burn.ts`: `TOKEN_PRICE_PHP` 100 → 200; header/band docs updated to note the flat-1 burn (band machinery kept intact — DB column + resolver still support 1–3 for a future admin re-band).
- `apps/web/lib/region-source.ts`: `STATIC_REGIONS` fallback `burn_band` flattened to 1 for all 19 regions (mirrors live `regions.burn_band=1` after #3138); type + DB hydrator untouched.
- `apps/web/app/admin/pricing/_surfaces/token-bands-surface.tsx`: hardcoded `burn_band * 100` → `burn_band * TOKEN_PRICE_PHP` (now ₱200); header/intro copy → ₱200/token (1/2/3 = ₱200/400/600, currently flat 1).
- `peso-per-lead-card.tsx` (vendor) + `peso-per-lead-admin-card.tsx` (admin): the ₱/token figures derive from `TOKEN_PRICE_PHP` (auto ₱200); "1–3 region-banded" hints → flat 1 token (₱200).
- `vendor-dashboard/page.tsx`: cost-to-answer banner → "flat 1 token (₱200), anywhere".
- `buy-tokens-cta.tsx`: fallback per-token price 100 → 200 (primary value already derives from the live pack catalog); SRP doc refreshed to ₱200/token packs.
- `vendor-dashboard/earnings/page.tsx` + `web-nudge-banner.tsx`: ₱100 → ₱200 in copy/prop-doc.
- `public/llms.txt` (AI-crawler surface) + `lib/llms-price-fixture.ts` (drift-guard allow-list): token section synced to ₱200 flat + flat-1-token unlock; pack table repriced (₱800/₱2,000/₱5,000/₱10,000/₱20,000); footer changelog entry added; drift guard reconciled and re-verified GREEN (no unapproved/unused/duplicate figures).

DID NOT: run `supabase db push`; touch PR #3138's migrations; enable any flag; auto-merge (DRAFT PR). No charge logic changed — Part B is display only.

SPEC IMPACT: DECISION_LOG.md 2026-07-12 (PRICING LOCK — token ₱100→₱200 + flat-1-token burn) covers Part B. **Part A (₱4,999 Setnayan AI EVENT PASS above the ₱499 entry) is a NEW load-bearing pricing decision surfaced for owner sign-off — a DECISION_LOG row + Pricing.md § 00 update should be applied on approval/merge (held back here because this is a DRAFT proposal, not a landed lock).**
