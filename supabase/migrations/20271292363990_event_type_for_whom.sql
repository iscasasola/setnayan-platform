-- event_type_for_whom
--
-- WHO an event type can be FOR — the rule the create-event grid's "For ▾" reads
-- (owner 2026-10-26, verbatim: "if i click for you, and it i don't have a debut,
-- it should not show. same concept to the christening, wake, and whatever is not
-- needed for that person … If it is for a business, only business related events
-- … For someone else, shows everything." · "wake is if your declared passed away.
-- so the event you can only make is anniversary or wake/funeral.").
--
-- One column on the roster table, admin-editable on Admin › Categories › Event
-- types ("Who it's for"). The grid shows a type for the chosen answer only when
-- that answer is in this list:
--   self      — For you (the signed-in person is the celebrant)
--   someone   — For someone else (a living person; also a loved one on file)
--   memorial  — For someone who passed away
--   business  — For a business
-- The debut AGE band (women 17–18, men 20–21, 17–21 when sex is unknown, shown
-- when the birth date is unknown) stays the measured-type rule in
-- lib/life-event-gate.ts — it narrows WITHIN `self`/`someone`, it is not a mode.
--
-- A type added later gets {self,someone}: shown to people, hidden for a business
-- and for a memorial until an admin ticks them.
--
-- Idempotent: the column is added, and the starting values seeded, ONLY on the
-- first apply — a re-apply never overwrites what an admin has since edited.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_type_vocab' AND column_name = 'for_whom'
  ) THEN
    ALTER TABLE public.event_type_vocab
      ADD COLUMN for_whom text[] NOT NULL DEFAULT ARRAY['self', 'someone']::text[];

    -- Never for yourself: a christening (an infant's), a wake (only once someone
    -- has passed away). Never for a business either.
    UPDATE public.event_type_vocab SET for_whom = ARRAY['someone']::text[]
      WHERE event_type = 'christening';
    UPDATE public.event_type_vocab SET for_whom = ARRAY['memorial']::text[]
      WHERE event_type = 'wake';

    -- An anniversary is open to everyone — incl. a death anniversary and a
    -- company's anniversary.
    UPDATE public.event_type_vocab SET for_whom = ARRAY['self', 'someone', 'memorial', 'business']::text[]
      WHERE event_type = 'anniversary';

    -- The types a business throws.
    UPDATE public.event_type_vocab SET for_whom = ARRAY['self', 'someone', 'business']::text[]
      WHERE event_type IN (
        'celebration', 'travel', 'corporate', 'tournament', 'gala_night',
        'simple_event', 'concert', 'open_house', 'grand_opening'
      );
    -- Everything else (wedding · debut · gender_reveal · birthday · graduation ·
    -- reunion · date · hangout) keeps the default {self,someone}.
  END IF;
END $$;

ALTER TABLE public.event_type_vocab
  DROP CONSTRAINT IF EXISTS event_type_vocab_for_whom_vocab;
ALTER TABLE public.event_type_vocab
  ADD CONSTRAINT event_type_vocab_for_whom_vocab
  CHECK (for_whom <@ ARRAY['self', 'someone', 'memorial', 'business']::text[]);

COMMENT ON COLUMN public.event_type_vocab.for_whom IS
  'Who this event type can be FOR on the create-event grid''s "For" choice: self (For you) · someone (someone else, living) · memorial (someone who passed away) · business. Admin-editable on Admin › Categories › Event types. Empty = shown for nobody unless "Show all event types" is tapped.';
