-- ============================================================================
-- 20270924201580_anon_sweep_skip_cursor.sql
--
-- Gap audit 2026-07-23. Fix the anon-draft RA 10173 deletion sweep's WEDGE.
-- runAnonDraftSweep selects abandoned anon-draft `users` rows (placeholder email
-- + created_at past the TTL) with `.limit(50)` and NO `.order()`, so Postgres
-- returns the same physical-order rows every run. Four `continue` paths skip a
-- row WITHOUT mutating it — most importantly a CONVERTED account whose real email
-- never overwrote the placeholder (a permanent skip). Once ≥50 such sticky rows
-- sit at the head of the unordered window, the sweep re-reads them forever and
-- never reaches the deletable drafts behind them → abandoned third-party guest
-- PII persists indefinitely.
--
-- Fix (the audit's cursor option): add a durable skip marker. The sweep now
-- orders by (anon_sweep_skipped_at ASC NULLS FIRST, created_at ASC) and stamps
-- this column = now() on every skip, so a skipped row rotates to the BACK of the
-- window and never-/least-recently-skipped rows are processed first. A row that
-- becomes deletable stops being re-stamped, keeps its older cursor, and gets
-- swept; a permanently-stuck row is re-stamped each pass and never blocks.
--
-- Additive + idempotent: defaults NULL (= "never skipped", sorts first), so the
-- sweep behaves exactly as before until it stamps a skip. The whole anon-draft
-- feature is flag-gated (NEXT_PUBLIC_ANON_ONBOARDING_ENABLED), so no live rows
-- are affected today.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS anon_sweep_skipped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.anon_sweep_skipped_at IS
  'Anon-draft cleanup sweep cursor: last time runAnonDraftSweep SKIPPED this row '
  '(non-anonymous / legal-hold / delete failed). NULL = never skipped. The sweep '
  'orders candidates by this ASC NULLS FIRST so skipped rows rotate to the back '
  'and never starve deletable drafts (gap audit 2026-07-23 · anon-draft-sweep.ts).';
