-- ============================================================================
-- 20270731291090_event_anchor_foundation.sql
--
-- The DATE-ANCHOR model, foundation layer (owner "build it" · 2026-07-12).
-- Design: Event_Anchor_Model_Council_Verdict_2026-07-12.md +
--         Event_Anchor_Minimalist_Setup_Design_2026-07-12.md (spec corpus).
--
-- Anchors are the primitive that turns one-off events into a recurring family
-- relationship. Per the council verdict they ship as per-event ATTRIBUTES with
-- per-type DEFAULTS held in a PURE TS MAP (lib/event-anchor.ts ANCHOR_BY_TYPE)
-- — NOT a picker regrouping, NOT a taxonomy/vocab rewrite (Conflict-E ruling:
-- "pure map first; promote to a vocab/profile column only when admin-
-- editability is actually needed"), NOT an RRULE engine (recurrence is a
-- suggestion flag; the Year view derives future occurrences at read time —
-- cron-free at the model layer, Rule-1 deterministic).
--
-- THIS migration is the UN-GATED foundation only: events gains the per-event
-- anchor attributes. The per-TYPE defaults stay in code (ANCHOR_BY_TYPE) and
-- the server action stamps anchor_kind at insert from that map.
--
-- DELIBERATELY OUT OF SCOPE (owner-locked counsel gate — do NOT add here):
--   - NO person/dependent table, NO stored birthdates. The dependent People
--     layer (PR-D) stores minors' birthdates for <=18 years and is counsel-
--     gated (RA 10173). Milestone derivation lives in lib/event-anchor.ts as
--     PURE functions over a caller-supplied date — this migration stores none.
--
-- RLS: no new tables -> no new policies. events already has RLS enabled (base
-- migration, Pattern B event-scoped); adding columns inherits it unchanged.
-- Idempotent: ADD COLUMN IF NOT EXISTS + guarded ADD CONSTRAINT (re-runnable).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Per-event anchor attributes on events
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS anchor_kind   TEXT,
  ADD COLUMN IF NOT EXISTS anchor_date   DATE,
  ADD COLUMN IF NOT EXISTS anchor_origin TEXT,
  ADD COLUMN IF NOT EXISTS recurs        BOOLEAN NOT NULL DEFAULT FALSE;

-- anchor_kind: the semantic nature of the date, per event. Fixed engineering
-- enum (not admin-created) -> a CHECK is safe and catches typos. NULL = unset.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_anchor_kind_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_anchor_kind_check CHECK (
        anchor_kind IS NULL OR anchor_kind IN (
          'person_birthdate',   -- birthday · debut · christening (derived/windowed)
          'union_date',         -- anniversary (consumes a wedding date)
          'expected_due_date',  -- gender reveal (capture DEFERRED — counsel)
          'fixed_date',         -- chosen date is the anchor
          'date_range',         -- travel
          'calendar_holiday',   -- Christmas / Valentine's (authored ruleset)
          'none'                -- wedding (anchor PRODUCER · date is an output)
        )
      );
  END IF;
END $$;

-- anchor_origin: for anniversaries, WHAT is celebrated. POSITIVE origins only —
-- the DB itself refuses a memorial/death origin, honoring the burial retirement
-- (2026-05-16) and keeping generalized anniversaries from backdooring babang-luksa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_anchor_origin_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_anchor_origin_check CHECK (
        anchor_origin IS NULL OR anchor_origin IN (
          'wedding',       -- the union
          'relationship',  -- the day you met / dating anniversary
          'milestone',     -- first house, business founding, a proud date
          'matters'        -- a date that matters to us (labeled, positive)
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.events.anchor_kind IS
  'Date-anchor model: the semantic nature of this event''s date. Stamped at insert from lib/event-anchor.ts ANCHOR_BY_TYPE (the per-type default), overridable per event. See Event_Anchor_Minimalist_Setup_Design_2026-07-12.md.';
COMMENT ON COLUMN public.events.anchor_date IS
  'The date this event''s anchor commemorates (union/wedding date, or a chosen memorable date). Drives derivation (Nth anniversary, next occurrence). NOT a person''s birthdate — those are never stored on events (counsel gate).';
COMMENT ON COLUMN public.events.anchor_origin IS
  'Anniversary only: the typed origin of a recurring memorable date. POSITIVE origins only (CHECK-enforced) — no memorial/death option, per the burial retirement.';
COMMENT ON COLUMN public.events.recurs IS
  'Per-event yearly toggle (owner: "travel can be annual or one-time"). TRUE = the Year view derives + suggests the next occurrence. NOT an RRULE engine, NEVER auto-creates event rows.';

COMMIT;
