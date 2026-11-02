## 2026-07-22 · feat(setnayan-ai): per-event-type pricing ladder (owner-locked ₱1,499/999/499/99/0)

Setnayan AI was a flat ₱1,499 for every event type — the wedding price charged to a birthday that gets far less AI (`followRoadmap: eventType === 'wedding'`, wedding-only statutory guards). Owner locked the per-event-type ladder ("go", 2026-07-22), priced by AI load — *"how much data is needed to help them"* — as a **discrete** ladder, not a range:

| Price | Event types |
|---|---|
| ₱1,499 | Wedding |
| ₱999 | Debut · Corporate |
| ₱499 | Christening · Birthday · Celebration · Travel · Tournament · Anniversary · Graduation · Reunion |
| ₱99 | Gender reveal · Dinner Date |
| ₱0 | Simple Event / any digital-services-only (no vendors → AI not present) |

Anniversary/Graduation/Reunion weren't in the 2026-07-17 load study — assigned to C (standard) pending owner review.

**Implementation (catalog-authoritative, no hardcoded live price):**

- Migration `20270831869367_setnayan_ai_per_type_tier_prices.sql` — seeds price-source rows `SETNAYAN_AI_B` (₱999) · `SETNAYAN_AI_C` (₱499) · `SETNAYAN_AI_D` (₱99), all `is_active=FALSE` (never their own buy card; the resolver reads `retail_price_php` directly, same as `SETNAYAN_AI_RENEW`). Tier A = the existing sellable `SETNAYAN_AI` ₱1,499 row. Idempotent; `ON CONFLICT` never touches `is_active`.
- `lib/setnayan-ai-type-pricing.ts` (new, pure) — the deterministic `event_type → tier → SKU` map + last-resort fallback ladder. Unknown types → C.
- `lib/setnayan-ai-event-pricing.ts` — `resolveSetnayanAiTypePricePhp` / `resolveSetnayanAiTypeChargeCentavos` read the tier SKU's catalog price (fallback only if unreadable). The order's `service_key` stays `SETNAYAN_AI` (the entitlement that stamps `setnayan_ai_active`); only the CHARGE is per-type.
- `checkout/actions.ts` — the SETNAYAN_AI charge re-resolve now uses the per-type resolver (server-authoritative by the event's STORED type), gated by the existing `setnayan_ai_per_event_pricing_enabled` flag. Supersedes the intro/renew cadence formerly resolved here (kept for lineage, no longer wired).
- `studio/setnayan-ai/page.tsx` — the buy price now shows the event type's tier price.

**Default OFF → live behavior byte-identical** (flat SETNAYAN_AI catalog charge stands; paywall is off so it's free during launch). The owner flips `setnayan_ai_per_event_pricing_enabled` alongside the paywall to activate per-type prices.

Tests — `setnayan-ai-type-pricing.test.ts` (all 14 canonical types → locked tier + price; unknown/null → C; Tier E no-SKU; the ladder values). Typecheck + lint + build clean; full unit suite green (2512); migration-doctor + timestamp + entitlement-gates + retired-strings guards clean.

SPEC IMPACT: Applied — `Setnayan_AI_Gap_Leaves_Travel_Dinner_Date_2026-07-17.md` §D tier table updated to the locked numbers; DECISION_LOG 2026-07-22 row added; memory `project_setnayan_ai_per_type_pricing` updated. Supersedes the flat ₱1,499, the ₱899/₱199 load-ripple numbers, and the interim ₱100–₱1,500 range.
