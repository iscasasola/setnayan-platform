## 2026-07-22 · refactor(papic): naming/pricing FOUNDATION — "Papic One" (dedicated camera) + "Papic Pool" (shared shot-pool), retire Papic Max/Buong Araw

The owner-decided 2026-07-22 Papic model swaps two shipped display names and reprices the shared-pool passes. The DB half already landed in migration `20270830568357_papic_pool_one_rename_retire_max_buongaraw.sql` (catalog retitle + Papic Pool reprice + tier deactivations). This change is the **code half** — every surface that hard-coded the old names/prices, so nothing reads stale after the migration. Never-rename lock respected throughout: **display title + price only, zero `service_code`/`tier_code` moves, deactivate never drop**. Metering is untouched this cycle (Papic One's per-day→6-month-window + bundled face-tag change is a separate, later PR).

The model, as applied to the display surfaces:
- **Papic One** — the dedicated per-camera product (was "Papic Mini"): **₱100 per camera**, first 3 free, buy as many as you like.
- **Papic Pool** — the shared shot-pool passes for every guest phone (was the "Papic One" point buckets / "Papic Buong Araw" doorway): **₱999 / 3,000 shots · ₱1,999 / 6,000 · ₱2,999 / 10,000 · ₱2,999 +10,000 top-up**.
- **Retired display names:** "Papic Max" (the `unlimited` tier) and the legacy `roll` meter → deactivated; "Papic Buong Araw" doorway label → folded into "Papic Pool". Currency unchanged (photo = 1 pt · 5-second clip = 3 pts · 5-second cap).

Surfaces updated:
- `lib/papic-tier-copy.ts` — `PAPIC_TIER_CONFIG_FALLBACK`: `mini` displayTitle → **'Papic One'**; `roll` + `unlimited` `isActive` → **false** (mirrors the migration; the fallback tracks the live display title).
- `lib/add-ons-catalog.ts` — the `'Papic Buong Araw'` doorway label + its comments → **'Papic Pool'**.
- `app/papic/page.tsx` — rewrote the "Who takes the photos?" FAQ + the "Two ways to run it" cards, which had the mapping **backwards** (they called the every-guest pass "Papic One"). Now: **Papic One = the 1-camera dedicated shooter**, **Papic Pool = the every-guest shared pass**.
- `app/papic/guest/page.tsx` — header comment de-staled (dropped the "₱30 Ltd / ₱100 Unli per camera/day" per-camera framing; "Papic Buong Araw" → "Papic Pool"; it is the shared-pool surface).
- `public/llms.txt` + `lib/llms-price-fixture.ts` — removed the ₱30 Mini / ₱50 Ltd / ₱100 Unli per-camera-per-day figures, the ₱6,000/₱15,000 wedding caps, and the Mini/Ltd/Unli/Max names; added the flat figures (Papic One ₱100 · Papic Pool ₱999/₱1,999/₱2,999) and the ₱100 retail floor. **Both directions of `llms-price-drift.test.ts` pass** (no unapproved figure in the file; no unused fixture entry).
- `app/pricing/page.tsx` + `app/pricing/_papic-estimator.tsx` — retitled the synthetic Papic card to **'Papic One'** (flat "per camera", no per-day/cap framing) and **reworked the estimator to the flat model**: a Papic One / Papic Pool toggle — Papic One is a flat per-camera price (first N free, **no days multiplier**), Papic Pool is a flat bucket pick (3k/6k/10k). Dropped the days slider, the `cameras × rate × days` math, and the removed-"Papic Max" cap. Pool buckets derive from the live catalog and degrade to no-picker while the `PAPIC_GUEST*` rows stay coming-soon.
- `lib/papic-copy-guardrails.test.ts` — updated the three expectations that pinned the old names/active-set (public ladder now `['mini','ltd']`; `papicCapLadderPhrase` → `'Papic One ₱6,000 · Papic Ltd ₱10,000'`; the seed-mirror check applies the post-seed `mini` → 'Papic One' rename).

Out of scope (later PRs, per the spec): `lib/papic-cameras.ts` charge engine + `extra-cameras-picker.tsx` studio picker (metering-coupled), and the vendor on-the-day `vendor-papic-tier.ts` tiers (a separate subsystem — its 'Papic Lite/Ltd/Unli' readouts are not the customer camera ladder).

Verification: `tsc --noEmit` 0 errors · `next lint` clean on every changed file · full `lib/**/*.test.ts` green (2507 tests).

SPEC IMPACT: Applies the display/pricing half of `0012_papic/Papic_One_Pool_Model_Spec_2026-07-22.md` (§4 PR1/PR2) + the file-touch list in `0012_papic/Papic_Storage_Sustainability_Spec_2026-07-22.md`. Corpus is the archive/decision record (code is canonical per the ground-truth `CLAUDE.md`); no stub re-expansion. Owner sign-offs still open in the spec (Papic One flat metering, free-tier number, currency deferral, provisional-pricing/purge acknowledgment) are NOT in this foundation PR.
