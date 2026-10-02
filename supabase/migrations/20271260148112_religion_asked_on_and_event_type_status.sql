-- religion_asked_on_and_event_type_status
-- Created via `pnpm migration:new`. Idempotent.
--
-- The database half of the "Categories & event types" admin page (owner
-- approval, DECISION_LOG 2026-10-02 — "the DB changes are OK").
--
-- 1. faith_vocab.asked_on_event_types — WHICH EVENT TYPES ASK "WHICH RELIGION?"
--    Rule 0 first: nothing encoded this. faith_vocab had no event-type column,
--    event_type_profiles has no faith column, and lib/faith-rites.ts is a
--    per-religion rite ladder with no event-type key. Everything assumed the
--    wedding. NULL keeps exactly that meaning — wedding only — so no live
--    behaviour changes until an admin edits a religion. '{}' = asked on nothing.
--    Validated by the same rule validate_applicable_event_types applies to the
--    category columns: every member must be an ACTIVE event_type_vocab key. A
--    separate function because the trigger body names its column.
--
-- 2. event_type_vocab — the merged Status ▾. Two columns (status + enabled)
--    already carry the three legal states the page offers:
--      In the picker       = active  + enabled
--      Hidden from couples = active  + NOT enabled
--      Retired             = retired + NOT enabled
--    The fourth combination (retired + enabled) is unreachable through the
--    shared cores (retire forces enabled=false; enable refuses a retired type)
--    and measured ZERO rows in production on 2026-10-02. This makes it
--    unreachable for every writer, and locks the wedding row the same way the
--    cores already do (it can be neither hidden nor retired).
--
-- 3. canonical_service_aliases.source gains 'admin' — a search word an admin
--    typed on the service panel ("+ Add a word"). None of the three existing
--    values is true of it: 'mined' is our own schema, 'collected' is a real
--    supplier's pick, 'proposed' is a model.
--
-- NOT HERE, on purpose: wedding_tradition_items' ceremony_type CHECK already
-- admits all 17 religions + 'mixed' (20261120000000, measured in production
-- 2026-10-02). Only the admin action's own list was 8 long; that is a code fix.

-- ── 1. Religion ↔ event type ────────────────────────────────────────────────
ALTER TABLE public.faith_vocab
  ADD COLUMN IF NOT EXISTS asked_on_event_types text[];

COMMENT ON COLUMN public.faith_vocab.asked_on_event_types IS
  'Event types whose setup asks "Which religion?" and offers this faith. NULL = wedding only (the behaviour before this column existed); empty = asked on none. Members must be active event_type_vocab keys. Edited on /admin/categories (Religions › Asked on). 2026-10-02.';

CREATE OR REPLACE FUNCTION public.validate_faith_asked_on_event_types()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bad TEXT;
BEGIN
  IF NEW.asked_on_event_types IS NULL
     OR cardinality(NEW.asked_on_event_types) = 0 THEN
    RETURN NEW;
  END IF;
  SELECT string_agg(et, ', ') INTO bad
    FROM unnest(NEW.asked_on_event_types) AS et
   WHERE et NOT IN (SELECT event_type FROM public.event_type_vocab WHERE status = 'active');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'asked_on_event_types has unknown or retired event type(s): %', bad;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_faith_asked_on_event_types ON public.faith_vocab;
CREATE TRIGGER validate_faith_asked_on_event_types
  BEFORE INSERT OR UPDATE OF asked_on_event_types ON public.faith_vocab
  FOR EACH ROW EXECUTE FUNCTION public.validate_faith_asked_on_event_types();

-- ── 2. Event type status: three legal states, wedding locked ────────────────
ALTER TABLE public.event_type_vocab
  DROP CONSTRAINT IF EXISTS event_type_vocab_retired_is_hidden;
ALTER TABLE public.event_type_vocab
  ADD CONSTRAINT event_type_vocab_retired_is_hidden
  CHECK (status <> 'retired' OR enabled = false);

ALTER TABLE public.event_type_vocab
  DROP CONSTRAINT IF EXISTS event_type_vocab_wedding_stays_in_picker;
ALTER TABLE public.event_type_vocab
  ADD CONSTRAINT event_type_vocab_wedding_stays_in_picker
  CHECK (event_type <> 'wedding' OR (status = 'active' AND enabled = true));

-- ── 3. An admin-typed search word ───────────────────────────────────────────
ALTER TABLE public.canonical_service_aliases
  DROP CONSTRAINT IF EXISTS canonical_service_aliases_source_chk;
ALTER TABLE public.canonical_service_aliases
  ADD CONSTRAINT canonical_service_aliases_source_chk
  CHECK (source IN ('mined', 'collected', 'proposed', 'admin'));

COMMENT ON COLUMN public.canonical_service_aliases.source IS
  'How the phrase was obtained: mined (from our own attribute schemas) | collected (a real supplier confirmed it, or a supplier''s request was mapped to this trade) | proposed (a model suggested it) | admin (an admin typed it on /admin/categories, reviewed in the same act) — not who typed it.';
