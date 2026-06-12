-- ============================================================================
-- 20261123000000_jewish_coming_soon.sql
--
-- Owner decision (2026-06-12 batch session): "Seed Chinese, pause Jewish" —
-- Jewish stays pickable-with-notify (coming_soon) rather than a live chip,
-- until its seeded content (jewish_rabbi + chuppah_rental, migration
-- 20261120000100) plus venue coverage are judged launch-ready. Reversible in
-- one click from /admin/wedding-types (the per-faith launch lever) — no code
-- rides on this row.
-- ============================================================================

UPDATE public.wedding_type_launch_status
SET status = 'coming_soon', updated_at = NOW()
WHERE ceremony_type = 'jewish' AND status = 'active';
