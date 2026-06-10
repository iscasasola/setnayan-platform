-- ============================================================================
-- 20261021000000_iteration_0008_seating_publish_qr.sql
-- Iteration 0008 — Phase 0 foundations: publish flow + per-table QR + print pack.
--
-- The seating editor lets couples lay out tables and seat guests, but there was
-- no way to (a) turn a finished plan into a printable venue pack, or (b) mint
-- the per-table QR that 0012 Papic's table-tag fan-out + the day-of find-my-seat
-- path will resolve a scan to. This adds both, matching the existing
-- guests.qr_token convention (encode(gen_random_bytes(16),'hex'), 32-hex, UNIQUE).
--
-- Token model: the token EXISTS from table creation (like guests.qr_token) so
-- there is never a null-token race; `qr_published_at` (per table) +
-- event_floor_plan.published_at (per event) mark the moment the couple published
-- the pack. Re-publish is idempotent — it stamps timestamps, never re-rolls a
-- token, so a sign already at the venue keeps working.
--
-- Additive + nullable/defaulted + idempotent — safe on a live DB. The volatile
-- default backfills a distinct token into every existing row (table rewrite);
-- the UNIQUE index then guarantees no collisions. RLS on event_tables /
-- event_floor_plan is unchanged — these columns inherit the existing per-couple
-- policies.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS qr_token        TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS qr_published_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS event_tables_qr_token_idx
  ON public.event_tables(qr_token);

ALTER TABLE public.event_floor_plan
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_tables.qr_token IS
  'Per-table QR token (32-hex, like guests.qr_token). Printed on the table sign sheet; future Papic table-tag fan-out + day-of find-my-seat resolve a scan to this table. Exists from creation; qr_published_at marks publication.';
COMMENT ON COLUMN public.event_tables.qr_published_at IS
  'When this table was last included in a published seating pack. NULL = not yet published.';
COMMENT ON COLUMN public.event_floor_plan.published_at IS
  'When the couple last published the seating pack. NULL = never published.';

COMMIT;
