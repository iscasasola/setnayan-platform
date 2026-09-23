-- THE COUPLE WRITES THEIR OWN SECTION — six slots, on the table that already
-- orders the page.
--
-- Owner, 2026-09-23: *"they can add a blank screen in between, to create
-- content on the website as well, correct?"* — "IN BETWEEN" is the whole
-- requirement, and it is why this widens an existing CHECK instead of adding a
-- table.
--
-- ── WHAT WAS MEASURED, NOT READ ─────────────────────────────────────────────
-- `invitation_widgets.display_order` is what puts a section between two others.
-- A separate `event_custom_sections` table would carry its OWN order, and the
-- two would have to be interleaved by something — a second source of truth for
-- one fact, which is the competing-mechanism trap. A custom section IS a
-- widget, so it is one, and it inherits move-up / move-down, the
-- Auto·Shown·Hidden three-state, the phase fence and the new canvas for free.
--
-- ── WHY SIX, AND WHY THE CEILING IS A SHAPE ─────────────────────────────────
-- This table is `UNIQUE (event_id, widget_type)` — one row per type per event,
-- documented at its birth (20260607030000). Several sections therefore need
-- several TYPES. Dropping that UNIQUE to allow N rows of one type would weaken
-- an invariant the whole table rests on, for a feature whose own recommended
-- ceiling (2026-09-23 plan) is six. So six slots, and a seventh cannot be
-- created by ANY path — including a hand-crafted POST — because this CHECK
-- does not name one. The owner has not ruled on the ceiling; if he raises it,
-- the change is this list and `CUSTOM_SECTION_TYPES`, together.
--
-- ── NO SEEDING, DELIBERATELY ────────────────────────────────────────────────
-- The seed trigger is NOT widened and no rows are backfilled. Six empty rows on
-- every event would be six empty rows in every couple's editor, forever, for a
-- feature most will never use. A row is inserted the first time a couple adds a
-- section. Empty slots that DO exist stay invisible to guests: no body, no
-- content, and the Auto machinery already hides a section with no content.
--
-- Additive + idempotent → safe on the live pilot.

ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_widget_type_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_widget_type_check CHECK (widget_type IN (
    'hero','greeting','qr_card','event_details','countdown','schedule','rsvp','venue_map','dress_code','photo_moments','your_photos','tier_comparison','special_message','what_to_bring','our_photos','our_love_story',
    'custom_1','custom_2','custom_3','custom_4','custom_5','custom_6'
  ));

COMMENT ON COLUMN public.invitation_widgets.widget_type IS
  'Which section this row is. The sixteen shipped types plus custom_1..custom_6 — the '
  'couple''s own sections (owner 2026-09-23), whose heading and words live in '
  'config_json.custom and whose vocabulary is apps/web/lib/custom-sections.ts. One row per '
  'type per event (UNIQUE), which is why the custom sections are six fixed slots rather '
  'than an unbounded list.';

-- ── PROVE IT ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  ev UUID;
BEGIN
  -- Every shipped type must still be accepted: a widened CHECK that dropped an
  -- existing value would refuse writes to sections couples already use, and the
  -- first sign would be a save failing on a live event.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'invitation_widgets_widget_type_check'
       AND pg_get_constraintdef(oid) LIKE '%our_love_story%'
       AND pg_get_constraintdef(oid) LIKE '%special_message%'
       AND pg_get_constraintdef(oid) LIKE '%custom_6%'
  ) THEN
    RAISE EXCEPTION 'the widget_type CHECK lost a shipped type or never gained the custom slots';
  END IF;

  -- A seventh slot must be refused by the DATABASE, not only by the app — the
  -- ceiling is the point, and an app-side limit is not one.
  SELECT event_id INTO ev FROM public.events LIMIT 1;
  IF ev IS NOT NULL THEN
    BEGIN
      INSERT INTO public.invitation_widgets (event_id, widget_type, display_order)
      VALUES (ev, 'custom_7', 999);
      RAISE EXCEPTION 'custom_7 was accepted — the ceiling is not enforced by the CHECK';
    EXCEPTION
      WHEN check_violation THEN NULL;   -- the refusal we wanted
    END;
  END IF;
END $$;
