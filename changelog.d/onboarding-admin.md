## 2026-06-24 · feat(admin): per-type onboarding profile surface + non-wedding seed — iteration 0053 Phase 3 (PR4 of 4, final)

The HQ admin surface to manage each event type's `event_type_profiles` row, plus a seed so every enabled non-wedding type has real per-type terminology (instead of the `GENERIC_PROFILE` fallback). Closes the onboarding engine. Wedding stays byte-identical — including the wedding profile row.

- **`supabase/migrations/20270221005058_seed_nonwedding_event_type_profiles.sql`** — `INSERT … ON CONFLICT (event_type) DO NOTHING` for the 8 enabled non-wedding types (debut, gender_reveal, birthday, celebration, travel, corporate, tournament, christening): per-type terminology + the generic surface set (`seating/budget/schedule/day_of/gallery`) + `onboarding_flow_key`=type + `role_set_key`='generic'. Idempotent, additive, **excludes wedding** (cannot touch its row). Applied to prod via MCP + ledger repaired; wedding row verified untouched.
- **`app/admin/event-types/actions.ts`** — new `upsertEventTypeProfile` (`requireAdmin()` first; `is_admin()` RLS is defense-in-depth). Writes terminology + enabled_surfaces + `onboarding_flow_key` + `role_set_key`; a **partial upsert preserves the other pack keys** (template/monogram/reveal/budget/schedule/statutory) on conflict. Audit-logged.
- **`app/admin/event-types/[eventType]/profile/page.tsx`** — the editor (terminology fields, a checkbox per surface, engine-wiring keys), prefilled from the row or sensible defaults (wedding → all 9 surfaces; else generic 5).
- **`app/admin/event-types/page.tsx`** — an "Onboarding profile →" link per non-retired roster row.

**Verify:** typecheck + lint clean · unit **421/421** · 2-lens adversarial review (admin-RLS/action safety · migration + wedding-isolation + form↔action alignment) → **ship, zero issues**. Proven: the admin write has no RLS bypass; a wedding-profile round-trip save is lossless (all terminology + 9 surfaces + flow/role keys + the 6 pack keys preserved — verified via a rolled-back transaction); SURFACES ≡ PROFILE_SURFACES; the seed cannot alter wedding.

This completes **iteration 0053 Phase 3** (the per-type onboarding engine): PR1 spine · PR2 flow UI · PR3 picker-wire + taxonomy plan · PR4 admin surface.

SPEC IMPACT: Iteration 0053 Phase 3, PR4 of 4 (final). Logged in `DECISION_LOG.md`. [[project_setnayan_onboarding_engine]]
