-- ============================================================================
-- 20261222000000_invitation_widgets_our_love_story.sql
--
-- Increment A.2 — add the "Our Love Story" content block to the invitation
-- site. The wedding onboarding's Love Stage already COLLECTS the story into
-- events.love_story (JSONB · how_we_met / proposal / milestones / anchors / …,
-- see 20260914000000_love_story_covert_renames). This adds the public-site
-- WIDGET that renders it.
--
-- Adds the 'our_love_story' widget_type to the CHECK, the seed trigger, and
-- backfills a row for every existing event so the section appears in the
-- couple's widget show/hide/reorder editor. Idempotent + additive.
-- ============================================================================

BEGIN;

-- 1. Extend the widget_type CHECK (cumulative — includes special_message from
--    20260913000000).
ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp',
    'venue_map','dress_code','photo_moments','your_photos','tier_comparison',
    'special_message','our_love_story'
  ));

-- 2. Seed trigger — add our_love_story (display_order 14, hideable).
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
    (NEW.event_id, 'our_love_story', 14,  TRUE, FALSE)
  ON CONFLICT (event_id, widget_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Backfill existing events.
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT e.event_id, 'our_love_story', 14, TRUE, FALSE
FROM public.events e
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMIT;
