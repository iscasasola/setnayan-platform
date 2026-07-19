## 2026-07-02 · feat(vendor): service-card redesign Phase 3a — pricing basis + included flags

Phase 3a of the service-card redesign (P1 schema #2640 · P2 coverage #2641). Lets
vendors actually set the new pricing data the schema holds — the "3 ways to price"
+ what's-included flags — on both the create and edit service forms in My Shop.

**New client editor** `_components/pricing-basis-editor.tsx`:
- `PricingBasisEditor` — a segmented **Fixed / Per guest / Per hour** control that
  mounts only the active basis's inputs (Fixed = flat price + adaptive-pax base &
  surcharge · Per guest = rate + minimum pax · Per hour = base + minimum hours +
  per-extra-hour). Request-a-quote stays the process; this only sets the anchor.
- `IncludedFlags` — crew meal + transport **Included** toggles (transport reveals
  an optional flat fee when not included).

**Server actions** (`actions.ts`, both `createVendorService` + `updateVendorService`):
- `parsePricingFields()` nulls the inactive-basis columns and recomputes
  `starting_price_php` as the synced "from ₱X" anchor Explore + the couple budget
  read (per-pax → rate × min; per-hour → base; fixed → entered).
- Writes `pricing_basis` / `per_pax_price_php` / `min_pax` / `hour_base_php` /
  `min_hours` / `extra_hour_php` / `crew_meal_included` / `transport_included` /
  `transport_flat_fee_php`. `crew_meal_required` is kept as the **inverse** of
  `crew_meal_included` so the 0007 budget's Crew-Meal line still triggers.

**Read layer** — `lib/vendor-services.ts` `VendorServiceRow` + `FULL_SELECT` +
legacy fallback now carry the nine Phase-1 pricing scalars (so the edit form shows
current values).

**Migration `20270502996302_backfill_crew_meal_included.sql`** (data-only, applied
to prod): sets `crew_meal_included = NOT crew_meal_required` for existing rows
(Phase-1 defaulted it FALSE without deriving it). Prevents legacy cards reading
"not included" and stops an edit from flipping the couple's budget. Idempotent,
order-independent (all 45 prod rows reconciled → 0 inconsistent).

Verified: tsc (0) · next lint (0) · prod build.

SPEC IMPACT: activates the Phase-1 pricing schema (see `DECISION_LOG` 2026-07-02).
Multi-tier Fixed brackets · inclusions/add-on/multi-discount list editors · showcase
media uploader = Phase 3b/3c (shared list-editor pattern). Phase 4 = Explore surfacing.
