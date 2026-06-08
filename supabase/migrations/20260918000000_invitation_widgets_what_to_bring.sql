-- ============================================================================
-- 20260918000000_invitation_widgets_what_to_bring.sql
--
-- Increment A.3 — add the "What to Bring" content block to the invitation
-- site (Wedding_Website_Lifecycle_Spec_2026-06-07). A gift / registry /
-- no-gift note from the couple. Fully self-contained — its own TEXT column,
-- its own editor; NOT collected by onboarding.
--
-- Adds events.what_to_bring (TEXT) + the 'what_to_bring' widget_type
-- (CHECK + seed trigger + backfill). Cumulative with special_message
-- (20260913000000). Idempotent + additive.
-- ============================================================================

BEGIN;

-- 1. Content column.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS what_to_bring TEXT;

COMMENT ON COLUMN public.events.what_to_bring IS
  'Host-curated "what to bring" note (gifts / registry / no-gift). Edited at /dashboard/[eventId]/website/what-to-bring; rendered by WhatToBringWidget. Blank → section hides.';

-- 2. Extend the widget_type CHECK (cumulative — includes special_message).
ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp',
    'venue_map','dress_code','photo_moments','your_photos','tier_comparison',
    'special_message','what_to_bring'
  ));

-- 3. Seed trigger — add what_to_bring (display_order 14, hideable).
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
    (NEW.event_id, 'what_to_bring',  14,  TRUE, FALSE)
  ON CONFLICT (event_id, widget_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Backfill existing events.
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT e.event_id, 'what_to_bring', 14, TRUE, FALSE
FROM public.events e
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMIT;
