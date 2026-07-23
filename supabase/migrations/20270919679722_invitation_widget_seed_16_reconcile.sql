-- ============================================================================
-- 20270919679722_invitation_widget_seed_16_reconcile.sql
--
-- Reconcile populate_default_invitation_widgets() to the canonical 16-type
-- WIDGET_TYPES list (apps/web/lib/invitation-widgets.ts).
--
-- WHY (verified on prod 2026-07-23, read-only probe): migration
-- 20270110320023_invitation_widgets_our_love_story.sql rebuilt the trigger
-- CREATE OR REPLACE from a STALE 13-type list AFTER
-- 20270110130000_invitation_widgets_our_photos_reconcile.sql had already
-- fixed the seed to 15 — so the live trigger seeds only 14 types, missing
-- 'what_to_bring' and 'our_photos', and placed 'our_love_story' at
-- display_order 14 (colliding with what_to_bring's canonical slot). The
-- later 20270125028817 repaired only the CHECK constraint, not the trigger.
-- All 4 prod events hold exactly 14 widget rows each; new events inherit
-- the gap, so those two sections never appear in the couple's widget editor.
--
-- Same reconcile class as 20270110130000 (the precedent):
--   1. CREATE OR REPLACE the trigger with the full canonical 16-row seed
--      (what_to_bring 14 · our_photos 15 · our_love_story 16).
--   2. Re-number existing our_love_story rows 14 → 16 (the stale rebuild's
--      collision with what_to_bring; guarded so custom re-orders are kept).
--   3. Backfill missing rows for existing events — defensively ALL 16 via
--      INSERT..SELECT ON CONFLICT DO NOTHING (heals what_to_bring +
--      our_photos on prod's 4 events and any other historical gap).
--
-- NOTE: deliberately no reference to invitation_widgets.mode — if/when the
-- open-browse PR4 column exists, seeded/backfilled rows pick up its DEFAULT
-- 'auto' (correct); this migration is order-independent with PR4. The CHECK
-- constraint already admits all 16 (20270125028817) — untouched.
-- IDEMPOTENT: every step is guarded; re-running is a no-op.
-- ============================================================================

BEGIN;

-- 1. Seed trigger — the canonical 16 rows (CREATE OR REPLACE supersedes the
--    stale 14-row version regardless of what it held).
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
    (NEW.event_id, 'our_photos',     15,  TRUE, FALSE),
    (NEW.event_id, 'our_love_story', 16,  TRUE, FALSE)
  ON CONFLICT (event_id, widget_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Re-number the stale rebuild's our_love_story rows 14 → 16 so backfilled
--    what_to_bring can take its canonical slot 14. Guarded to display_order
--    14 only — a couple's custom re-order (any other value) is left alone.
UPDATE public.invitation_widgets
   SET display_order = 16
 WHERE widget_type = 'our_love_story'
   AND display_order = 14;

-- 3. Defensive full-16 backfill for existing events (heals what_to_bring +
--    our_photos on the 4 prod events, and any other historical drift).
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT e.event_id, w.widget_type, w.display_order, TRUE, w.is_always_on
FROM public.events e
CROSS JOIN (VALUES
  ('hero',            1,  TRUE),
  ('greeting',        2,  TRUE),
  ('qr_card',         3,  TRUE),
  ('event_details',   4,  FALSE),
  ('countdown',       5,  FALSE),
  ('schedule',        6,  FALSE),
  ('rsvp',            7,  TRUE),
  ('venue_map',       8,  FALSE),
  ('dress_code',      9,  FALSE),
  ('photo_moments',  10,  FALSE),
  ('your_photos',    11,  FALSE),
  ('tier_comparison',12,  FALSE),
  ('special_message',13,  FALSE),
  ('what_to_bring',  14,  FALSE),
  ('our_photos',     15,  FALSE),
  ('our_love_story', 16,  FALSE)
) AS w(widget_type, display_order, is_always_on)
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMIT;
