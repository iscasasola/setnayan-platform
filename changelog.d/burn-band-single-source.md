## 2026-07-01 · fix(vendor/token-burn): unify region→burn-band on one source, fix 6-region silent under-charge

Two min-wage region→burn-band maps had diverged on the *key*, not the value:
`token_burn_bands` (what `unlock_vendor_event` actually charged) was seeded with
underscore/PSGC-style slugs (`central_luzon`, `central_visayas`,
`northern_mindanao`, `cagayan_valley`, `western_visayas`, …) while
`events.region` stores canonical hyphen slugs (`c-luzon`, `c-visayas`,
`n-mindanao`, `cagayan`, `w-visayas`, `nir`). The RPC's exact-match lookup
silently missed 6 regions, which fell through to the band-1 floor and
UNDER-CHARGED — worst case c-luzon collected ₱100 instead of ₱300. Owner
approved shipping the correction (raises only those 6 to their intended band;
correctly-charged regions are untouched).

Reconciled onto `public.regions.burn_band` (Option 1 — single source, the same
map `lib/region-source.ts` already reads):

- Migration `20270331100000_burn_band_single_source.sql`:
  - `CREATE OR REPLACE unlock_vendor_event` copied verbatim from the live body
    (`20270307985604`) with EXACTLY ONE change — the band lookup now
    alias-resolves `events.region` against `public.regions`
    (`lower(slug)= OR lower(psgc_code)= OR aliases @> ARRAY[lower(region)]`,
    using the `regions_aliases_gin` index), mirroring `resolveRegion()`. Every
    tier gate preserved byte-for-byte (FREE blocked · VERIFIED ≤10/week AND
    burns · solo/pro/enterprise burn). The live body has NO `is_founder` bypass
    and NO `__resync__` branch — both were dropped at `20270221294989`; this
    migration does NOT reintroduce them (see PR sign-off flags).
  - Adds `regions.min_wage_php` (the wage rationale the admin ratifies against)
    and a `regions_set_updated_at` BEFORE UPDATE touch trigger.
  - Deprecates `token_burn_bands` via COMMENT only; the `DROP` is a separate
    follow-up migration sequenced AFTER this admin-page repoint ships.
- `app/admin/token-bands/{page,actions}.ts` — repointed to `public.regions`
  (reads/writes `burn_band`; all 19 regions now editable — the old table was
  missing 8). `tokens` collapses to `= band` (flat 1:1 economy); the separate
  editable tokens input is removed.
- Corrected stale "as-built" comments that still described dropped behavior as
  live: `lib/v2/region-token-burn.ts` (band-source-split note → reconciled; "PRO/
  ENTERPRISE only" → verified/solo/pro/enterprise burn) and `lib/chat-actions.ts`
  (`acceptInquiry` — removed the false "FREE-VERIFIED answers free" + returning-
  customer FLAT-1 resync claims; both gone from the live RPC).

No new tables → no new RLS (`regions` already has public-read + admin-write).
No prices hardcoded (band map stays admin-managed in `public.regions`).

SPEC IMPACT: Yes — burn-economy mechanics. The region→burn-band source is unified
to `public.regions.burn_band`; `token_burn_bands` retired; the RPC alias-resolves
`events.region`. DECISION_LOG.md row appended in the corpus.
