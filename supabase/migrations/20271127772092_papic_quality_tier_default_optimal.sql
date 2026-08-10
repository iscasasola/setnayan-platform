-- ============================================================================
-- Papic — NEW events start on Optimal photo quality (owner ruling 2026-08-10)
-- ============================================================================
-- Owner, verbatim: "photo quality starts at optimal and not full resolution."
--
-- ALL THREE CHOICES STAY. Optimal · Full resolution · High efficiency remain
-- exactly as they are; the CHECK constraint added by 20270825539466 is left
-- untouched so every tier is still selectable. Only the STARTING POINT for an
-- event nobody has touched yet moves from Full resolution to Optimal.
--
-- ── WHY EXISTING EVENTS DO NOT MOVE ─────────────────────────────────────────
-- `papic_quality_tier` is NOT NULL, so every row that already exists carries a
-- materialized value — a column DEFAULT is only ever consulted at INSERT time
-- for a row that omits the column. Changing it therefore cannot reach a single
-- stored row. This migration deliberately contains NO UPDATE: the five
-- production events stay on Full resolution, which is what they were promised.
--
-- ── WHY THIS IS NOT A DOWNSCALE OF ANYTHING ────────────────────────────────
-- The tier applies at INGEST, to captures recorded AFTER it is read — nothing
-- already stored is ever re-processed. A future event that starts on Optimal
-- stores ~12 MP originals (phone-native; guests' phones shoot ≈12 MP), and its
-- couple can move to Full resolution at any time from the Papic setup screen.
--
-- ⚠ The TypeScript half of this ruling is a SPLIT, not a flip. `lib/papic-
--   fidelity.ts` now exports TWO constants where it exported one:
--     NEW_EVENT_PAPIC_FIDELITY = 'optimal'   ← mirrors THIS default
--     FIDELITY_READ_FAILSAFE   = 'full_res'  ← what ingest falls back to when
--                                              the tier READ fails
--   The fail-safe must never become 'optimal': a failed database read would
--   then silently downscale someone's originals on an error path. The two
--   values are unit-tested against each other and this file's text, and the DB
--   default below is asserted by an executing PGlite test
--   (apps/web/tests/db/papic-quality-tier-default.db.test.ts).
--
-- Idempotent. No drops. No data touched.
-- ============================================================================

ALTER TABLE public.events
  ALTER COLUMN papic_quality_tier SET DEFAULT 'optimal';

COMMENT ON COLUMN public.events.papic_quality_tier IS
  'Per-event Papic photo fidelity tier (brief PR-4). Written by the couple''s Papic setup surface, read by capture ingest — one column, both seams. optimal = ~4256px/~12MP ingest downscale (DEFAULT for new events since 2026-08-10, owner ruling; wedding recommended) · full_res = originals kept 1:1 (the pre-2026-08-10 default; events created before that date keep it and are never migrated) · high_efficiency = ~2560px/~4MP (Papic Lite). Stills only — clips are never transcoded server-side. See apps/web/lib/papic-fidelity.ts.';
