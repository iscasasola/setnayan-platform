-- invitation_widgets_widget_type_check_complete
--
-- Forward-fix: the CHECK constraint on invitation_widgets.widget_type had drifted
-- incomplete. The 20270110320023_invitation_widgets_our_love_story migration
-- rebuilt the constraint from a STALE list that omitted `our_photos` and
-- `what_to_bring` (both already shipped + present in prod rows). On prod the
-- constraint was repaired by hand (2026-06-18) to the full set; this migration
-- makes the repo match for any fresh setup so the rebuild can't drop those types.
--
-- The authoritative list is `WIDGET_TYPES` in apps/web/lib/invitation-widgets.ts
-- (16 types). Idempotent: DROP IF EXISTS + ADD.

ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;

ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp',
    'venue_map','dress_code','photo_moments','your_photos','our_photos',
    'tier_comparison','special_message','what_to_bring','our_love_story'
  ));
