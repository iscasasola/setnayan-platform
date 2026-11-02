## 2026-06-23 · feat(event-type): Event-Type Profile spine — iteration 0053 Phase 0

The keystone for generalizing Setnayan from wedding-only to all event types (spec `0053_event_type_engine`). Today every couple-facing surface hard-codes "wedding"; the plan is to make each surface read a per-type config object — the Event-Type Profile — instead. This is Phase 0: the spine, built to change NOTHING.

- **Migration `20270220834284_event_type_profiles.sql`** (NOT applied) — new `public.event_type_profiles` table: `event_type` (PK, FK → `event_type_vocab`), `terminology` JSONB, `enabled_surfaces` TEXT[], and pack-key columns (`onboarding_flow_key`, `role_set_key`, `template_pack_key`, `monogram_set_key`, `reveal_pack_key`, `budget_taxonomy_key`, `schedule_seed_key`, `statutory_pack_key`). RLS mirrors `event_type_vocab`: public read, `is_admin()` write. Seeds **ONLY the wedding row**, mirroring today's hard-coded values exactly — every other active type intentionally has no row yet.
- **`apps/web/lib/event-type-profile.ts`** (new) — `resolveProfile(eventType)` (React `cache()`, server-only) returns the typed `EventTypeProfile`. Degrade-to-yesterday contract identical to `lib/event-types-db.ts`: on any error OR missing row it falls back to a hard-coded profile — `WEDDING_PROFILE` for wedding, `GENERIC_PROFILE` for anything else — so a DB hiccup, or a prod where the migration hasn't run yet, never throws. Plus `surfaceEnabled()` helper.

Zero consumers: no surface imports `resolveProfile` yet, so behaviour is byte-identical with or without the migration. The wedding seed mirrors the current hard-coded terminology/surfaces, so when Phase 1 starts repointing surfaces at the profile, wedding renders exactly as it does today. Non-wedding types stay on their current (generic) behaviour via the fallback until the Phase-1 admin editor seeds their rows.

⚠ This is a V1 scope expansion (V1 is wedding-locked). Owner greenlit starting the spine; the load-bearing decisions for later phases (relaxing the `events_wedding_fields_consistency` CHECK, dropping PH statutory scaffolding for non-weddings, the generic-tier launch strategy, all pricing) are still open and tracked in the spec §6.

SPEC IMPACT: New iteration 0053 (`0053_event_type_engine/`). Complements 0041 (vendor-taxonomy data layer, shipped) + 0043 (wedding-type picker). Logged in `DECISION_LOG.md` (2026-06-23 row).
