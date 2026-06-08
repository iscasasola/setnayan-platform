-- ============================================================================
-- 20260913000000_invitation_widgets_special_message.sql
--
-- Increment A.1 — add the "Special Message" content block to the invitation
-- site (Wedding_Website_Lifecycle_Spec_2026-06-07 · §6.5). Reads the
-- events.special_message TEXT column shipped in 20260912000000.
--
-- Adds the 'special_message' widget_type to the CHECK, the seed trigger, and
-- backfills a row for every existing event so the new section appears in the
-- couple's widget editor (show/hide/reorder). Idempotent + additive.
-- ============================================================================

BEGIN;

-- 1. Extend the widget_type CHECK (the original was an inline column check →
--    auto-named invitation_widgets_widget_type_check).
ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp',
    'venue_map','dress_code','photo_moments','your_photos','tier_comparison',
    'special_message'
  ));

-- 2. Seed trigger — add special_message (display_order 13, hideable) so new
--    events get the row automatically.
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
    (NEW.event_id, 'special_message',13,  TRUE, FALSE)
  ON CONFLICT (event_id, widget_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Backfill existing events.
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT e.event_id, 'special_message', 13, TRUE, FALSE
FROM public.events e
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMIT;
