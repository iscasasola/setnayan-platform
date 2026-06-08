-- ============================================================================
-- 20260919000000_invitation_widgets_our_photos.sql
--
-- Increment A.4 — add the "Our Photos" content block to the invitation site
-- (Wedding_Website_Lifecycle_Spec_2026-06-07 §6.5). A couple-curated photo
-- gallery (engagement / pre-wedding shots) the couple uploads themselves and
-- that renders on the public invitation page. Distinct from `your_photos`
-- (the GUEST's tagged photos, post-event) — this is the COUPLE's own gallery.
--
-- Adds events.our_photos (JSONB array of r2:// refs) + the 'our_photos'
-- widget_type (CHECK + seed trigger + backfill). Cumulative with
-- special_message (20260913000000) + what_to_bring (20260918000000).
-- Image bytes upload via the existing /api/upload presigned path (images are
-- already whitelisted) — no shared-route change. Idempotent + additive.
-- ============================================================================

BEGIN;

-- 1. Content column — JSONB array of r2:// ref strings, in display order.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS our_photos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Guard against a malformed write clobbering the column with a non-array.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_our_photos_is_array_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_our_photos_is_array_check
  CHECK (jsonb_typeof(our_photos) = 'array');

COMMENT ON COLUMN public.events.our_photos IS
  'Couple-curated photo gallery: JSONB array of r2:// refs in display order. Edited at /dashboard/[eventId]/website/our-photos; rendered by OurPhotosWidget. Empty array → section hides. Distinct from the guest-tagged your_photos widget.';

-- 2. Extend the widget_type CHECK (cumulative — includes special_message + what_to_bring).
ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp',
    'venue_map','dress_code','photo_moments','your_photos','tier_comparison',
    'special_message','what_to_bring','our_photos'
  ));

-- 3. Seed trigger — add our_photos (display_order 15, hideable).
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

-- 4. Backfill existing events.
INSERT INTO public.invitation_widgets
  (event_id, widget_type, display_order, is_visible, is_always_on)
SELECT e.event_id, 'our_photos', 15, TRUE, FALSE
FROM public.events e
ON CONFLICT (event_id, widget_type) DO NOTHING;

COMMIT;
