-- ============================================================================
-- 20270311724095_guest_seniority.sql
--
-- Adds fine seniority data to public.guests so the Chinese (Tsinoy) wedding
-- tea-ceremony serving-order helper can order elders correctly — the rite has
-- the couple serve tea to elders groom's side first, then bride's, in order of
-- seniority (grandparents → parents → eldest uncle → younger aunt …). Today the
-- roster only carries a `side` plus the four VIP-family roles (bride_parents /
-- groom_parents / *_immediate_family), which can't express intra-tier order.
--
--   seniority_rank  — within-side serve order; LOWER serves first; NULL = unset
--                     (the helper falls back to roleImportanceRank() for unranked
--                     guests, then sorts NULLs last). Couple-set, optional.
--   relation        — free text relationship label ("Grandparents", "Parents",
--                     "Eldest Uncle", "Aunt"). Deliberately NO hardcoded CHECK:
--                     per the categories-are-DB-driven rule the relationship
--                     vocabulary stays soft so it never needs a migration to
--                     extend, and admin-governed vocab can layer on later.
--
-- Both columns are additive + NULLABLE — a metadata-only catalog change on
-- PG 11+ (no table rewrite, fast on big tables) and a no-op for every existing
-- row and every non-Chinese event. We deliberately do NOT add new guest_role
-- enum values (e.g. grandparent / uncle / aunt): ALTER TYPE … ADD VALUE is
-- irreversible and each new role ripples into role-groups.ts, the seating
-- auto-fill tiers, and the bulk role picker. A nullable column is the locked,
-- reversible choice.
--
-- RLS already lives on public.guests (Pattern B — event members read; couple /
-- admin write — enabled at CREATE TABLE in iteration 0001), so these columns
-- inherit the table's policies. No new policy is added. The serving order is
-- family-sensitive and stays on the couple-only dashboard surface; it is never
-- exposed on public / guest-facing routes.
-- ============================================================================

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS seniority_rank int,
  ADD COLUMN IF NOT EXISTS relation text;

COMMENT ON COLUMN public.guests.seniority_rank IS
  'Within-side serve order for the Chinese tea ceremony (lower serves first; NULL = unset, falls back to role importance). Couple-set, optional.';
COMMENT ON COLUMN public.guests.relation IS
  'Free-text relationship label (e.g. Grandparents, Parents, Eldest Uncle). Soft vocabulary — no CHECK, per categories-are-DB-driven. Optional.';
