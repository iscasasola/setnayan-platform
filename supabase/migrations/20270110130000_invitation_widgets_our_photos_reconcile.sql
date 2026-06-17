-- ============================================================================
-- 20270110130000_invitation_widgets_our_photos_reconcile.sql
--
-- Reconcile the invitation_widgets CHECK constraint and seed trigger to the
-- canonical 15-type set (including 'our_photos').
--
-- WHY: Migration 20260919000000_invitation_widgets_our_photos.sql was written
-- to prod's schema_migrations ledger under a different (parallel-session)
-- migration, so the CHECK and trigger may be at 14 types while the codebase
-- treats 15 as the source of truth. Any new event INSERT triggers
-- populate_default_invitation_widgets() — if that function tries to insert
-- 'our_photos' while the CHECK still only accepts 14 types, the trigger
-- raises a constraint violation and the INSERT fails silently (the couple sees
-- "Something went wrong" on the onboarding commit screen).
--
-- This migration is the safe re-application at a fresh timestamp:
--   1. events.our_photos column (NOT NULL DEFAULT '[]') + its jsonb_typeof
--      array CHECK (idempotent via IF NOT EXISTS / DROP … IF EXISTS guards).
--   2. invitation_widgets.widget_type CHECK → 15 types (cumulative, atomic).
--   3. populate_default_invitation_widgets() → 15 rows (CREATE OR REPLACE).
--   4. Backfill: insert the missing 'our_photos' row for every existing event.
--
-- IDEMPOTENT: every step is guarded; re-running is a no-op.
-- ============================================================================

BEGIN;

-- 1. events.our_photos — couple-curated gallery JSONB array (r2:// refs).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS our_photos JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_our_photos_is_array_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_our_photos_is_array_check
  CHECK (jsonb_typeof(our_photos) = 'array');

COMMENT ON COLUMN public.events.our_photos IS
  'Couple-curated photo gallery: JSONB array of r2:// refs in display order. '
  'Rendered by OurPhotosWidget. Empty array → section hides. '
  'Distinct from the guest-tagged your_photos widget.';

-- 2. Extend invitation_widgets.widget_type CHECK to 15 types (cumulative).
ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp',
    'venue_map','dress_code','photo_moments','your_photos','tier_comparison',
    'special_message','what_to_bring','our_photos'
  ));

-- 3. Seed trigger — 15 rows (CREATE OR REPLACE so it replaces any prior
--    version regardless of how many rows it had).
CREATE OR REPLACE FUNCTION public.populate_default_invitation_widgets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.invitation_widgets
    (event_id, widget_type, display_order, is_visible, is_always_on)
  VALUES
    (NEW.event_id, 'hero',            1,  TRUE, TRUE),
    (NEW.event_id, 'greeting',        2,  TRUE, TRUE),
    (NEW.event_id, 'qr_card',         3,  TRUE, TRUE),
    (NEW.event_id, 'event_details',   4,  TRUE, FALSE),
    (NEW.event_id, 'countdown',       5,  TRUE, FALSE),
    (NEW.event_id, 'schedule',        6,  TRUE, FALSE),
    (NEW.event_id, 'rsvp',            7,  TRUE, TRUE),
    (NEW.event_id, 'venue_map',       8,  TRUE, FALSE),
    (NEW.event_id, 'dress_code',      9,  TRUE, FALSE),
    (NEW.event_id, 'photo_moments',  10,  TRUE, FALSE),
    (NEW.event_id, 'your_photos',    11,  TRUE, FALSE),
    (NEW.event_id, 'tier_comparison',12,  TRUE, FALSE),
    (NEW.event_id, 'special_message',13,  TRUE, FALSE),
    (NEW.event_id, 'what_to_bring',  14,  TRUE, FALSE),
    (NEW.event_id, 'our_photos',     15,  TRUE, FALSE)
  ON CONFLICT (event_id, widget_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Backfill 'our_photos' for existing events that predate this migration.
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT e.event_id, 'our_photos', 15, TRUE, FALSE
FROM public.events e
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMIT;
