-- a_venue_holds_its_chapter_hours
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- 🏛 VENUE HOURS (owner 2026-11-04; approved prototype "Event chapters — 4 Nov 2026", frames 2, 7b): *"The venue that
-- mainly controls the chapter keeps its hours 🔒; the host asks it to change."* · *"no venue holds this chapter, so the
-- host places and adjusts the time … The 🔒 only appears once a venue is booked to the chapter."*
--
-- EXTEND, NEVER RE-MODEL — every piece is the shipped request/lock machinery with one more case:
--   1 · A NEW REQUEST KIND, `hours`, on `event_schedule_suggestions` (the table every supplier request already rides):
--       a VENUE booked to a chapter (its booking's category is a venue — `VENUE_CATEGORIES`, lib/supplier-where.ts)
--       proposes the chapter's Starts · Ends · setup from (`proposed_ingress_minutes`) · pack-up until
--       (`proposed_egress_minutes`). Only on a top-level chapter it is booked to; only to the host.
--   2 · THE HOST APPROVES IT through the one accept path (lib/schedule-suggestion-decide.server.ts), which calls
--       `apply_venue_hours` — one SECURITY DEFINER function that writes the hours and marks the chapter as HELD by
--       that venue (`event_schedule_blocks.hours_vendor_id`). Auto-agree applies it the same way.
--   3 · HELD HOURS ARE LOCKED TO THE HOST (`event_schedule_blocks_venue_hours_lock`, the part lock's pattern): a change
--       to a held chapter's start, end, Time TBA, ingress or egress is refused with "<venue> holds this chapter's
--       hours. Ask them to change." — except
--         · the venue's own change applied by `apply_venue_hours` (its request approved, or the host's ask that the venue
--           ACCEPTED — "Ask <venue> to change" is the shipped host ask, `direction = 'to_supplier'`);
--         · the event's date moving (every block shifts by whole days onto the live date);
--         · Running late (`app.running_late_minutes`, 20271303571970).
--       The hold LIFTS when the venue is no longer on the chapter (taken off its Where, or its booking deleted) — then
--       the host sets the hours as before. With no venue on a chapter nothing here applies.
--   4 · The supplier part lock gets the matching pass (the hours of a chapter, applied by `apply_venue_hours`).
--
-- RLS: no new table. The new suggestion columns ride its policies; one RESTRICTIVE insert policy limits `hours` to a
-- venue on its own top-level chapter. Held by apps/web/tests/db/a-venue-holds-its-chapter-hours.db.test.ts.

BEGIN;

-- ── 1 · the request ────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_schedule_suggestions
  ADD COLUMN IF NOT EXISTS proposed_ingress_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS proposed_egress_minutes  INTEGER;

ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_proposed_window_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_proposed_window_check CHECK (
    (proposed_ingress_minutes IS NULL OR proposed_ingress_minutes BETWEEN 0 AND 1440)
    AND (proposed_egress_minutes IS NULL OR proposed_egress_minutes BETWEEN 0 AND 2880)
    AND (kind = 'hours' OR (proposed_ingress_minutes IS NULL AND proposed_egress_minutes IS NULL))
  );

ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_kind_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_kind_check CHECK (kind IN ('adjust', 'new', 'remove', 'hours'));

ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_hours_shape_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_hours_shape_check CHECK (
    kind <> 'hours' OR (block_id IS NOT NULL AND proposed_start_at IS NOT NULL AND direction = 'to_host')
  );

-- Only a VENUE, on a top-level chapter it is booked to (the permissive insert policy already requires its own item).
-- A definer helper, as `current_vendor_owns_schedule_block`: the supplier's session cannot read the chapter rows.
CREATE OR REPLACE FUNCTION public.current_vendor_is_chapter_venue(p_block_id UUID, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
     AND EXISTS (
       SELECT 1
         FROM public.event_schedule_blocks b
         JOIN public.event_vendors ev
           ON ev.event_id = b.event_id
          AND ev.vendor_id = ANY (b.responsible_vendor_ids)
        WHERE b.block_id = p_block_id
          AND b.parent_block_id IS NULL
          AND ev.marketplace_vendor_id = p_vendor_profile_id
          AND ev.category::text IN ('venue', 'religious_venue')
     );
$$;
REVOKE ALL ON FUNCTION public.current_vendor_is_chapter_venue(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_vendor_is_chapter_venue(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS schedule_suggestions_hours_only_from_its_venue ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_hours_only_from_its_venue
  ON public.event_schedule_suggestions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (kind <> 'hours' OR public.current_vendor_is_chapter_venue(block_id, vendor_profile_id));

-- ── 2 · who holds a chapter's hours ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS hours_vendor_id UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL;

ALTER TABLE public.event_schedule_blocks DROP CONSTRAINT IF EXISTS event_schedule_blocks_hours_on_a_chapter_check;
ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_hours_on_a_chapter_check CHECK (hours_vendor_id IS NULL OR parent_block_id IS NULL);

COMMENT ON COLUMN public.event_schedule_blocks.hours_vendor_id IS
  'The venue booking (event_vendors.vendor_id) that HOLDS this chapter''s hours — set only by apply_venue_hours when '
  'the host approves its hours request; while set, the host cannot change start/end/ingress/egress (they ask the venue). '
  'Lifts when that booking is no longer on the chapter. 20271307658341.';

-- ── 3 · the one door that writes held hours ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_venue_hours(p_suggestion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s         public.event_schedule_suggestions%ROWTYPE;
  v_uid     UUID := auth.uid();
  v_booking UUID;
  v_block   public.event_schedule_blocks%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.event_schedule_suggestions WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'open' THEN
    RAISE EXCEPTION 'schedulehours:gone' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_block FROM public.event_schedule_blocks WHERE block_id = s.block_id AND event_id = s.event_id;
  IF NOT FOUND OR v_block.parent_block_id IS NOT NULL THEN
    RAISE EXCEPTION 'schedulehours:not_a_chapter' USING ERRCODE = 'P0002';
  END IF;

  IF s.kind = 'hours' AND s.direction = 'to_host' THEN
    -- The host decides (or auto-agree, on the service role).
    IF v_uid IS NOT NULL AND NOT coalesce(
         s.event_id IN (SELECT public.current_couple_event_ids())
         OR public.moderator_area_level(s.event_id, 'schedule') = 'edit', false) THEN
      RAISE EXCEPTION 'schedulehours:not_allowed' USING ERRCODE = '42501';
    END IF;
    SELECT ev.vendor_id INTO v_booking
      FROM public.event_vendors ev
     WHERE ev.event_id = s.event_id
       AND ev.vendor_id = ANY (v_block.responsible_vendor_ids)
       AND ev.marketplace_vendor_id = s.vendor_profile_id
       AND ev.category::text IN ('venue', 'religious_venue')
     LIMIT 1;
    IF v_booking IS NULL THEN
      RAISE EXCEPTION 'schedulehours:not_the_venue' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('app.venue_hours_apply', s.suggestion_id::text, true);
    UPDATE public.event_schedule_blocks
       SET start_at               = s.proposed_start_at,
           end_at                 = s.proposed_end_at,
           time_tba               = FALSE,
           ingress_minutes_before = s.proposed_ingress_minutes,
           egress_minutes_after   = s.proposed_egress_minutes,
           hours_vendor_id        = v_booking,
           updated_at             = now()
     WHERE block_id = v_block.block_id;
  ELSIF s.kind = 'adjust' AND s.direction = 'to_supplier' AND v_block.hours_vendor_id IS NOT NULL THEN
    -- "Ask <venue> to change": the VENUE accepted the host's ask on the chapter it holds.
    IF v_uid IS NOT NULL AND NOT (s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())) THEN
      RAISE EXCEPTION 'schedulehours:not_allowed' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.event_vendors ev
       WHERE ev.vendor_id = v_block.hours_vendor_id AND ev.marketplace_vendor_id = s.vendor_profile_id
    ) THEN
      RAISE EXCEPTION 'schedulehours:not_the_venue' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('app.venue_hours_apply', s.suggestion_id::text, true);
    UPDATE public.event_schedule_blocks
       SET start_at   = coalesce(s.proposed_start_at, start_at),
           end_at     = CASE WHEN s.proposed_end_at IS NOT NULL THEN s.proposed_end_at ELSE end_at END,
           time_tba   = CASE WHEN s.proposed_start_at IS NOT NULL THEN FALSE ELSE time_tba END,
           updated_at = now()
     WHERE block_id = v_block.block_id;
  ELSE
    RAISE EXCEPTION 'schedulehours:not_hours' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.venue_hours_apply', '', true);
  RETURN jsonb_build_object('block_id', v_block.block_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_venue_hours(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_venue_hours(UUID) TO authenticated, service_role;

-- ── 4 · held hours are locked to the host ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_venue_hours_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_applying BOOLEAN := coalesce(current_setting('app.venue_hours_apply', true), '') <> '';
  v_days     INTEGER;
  v_late     INTEGER;
  v_shop     TEXT;
BEGIN
  -- Only apply_venue_hours puts a venue on a chapter's hours.
  IF NEW.hours_vendor_id IS NOT NULL AND NEW.hours_vendor_id IS DISTINCT FROM OLD.hours_vendor_id AND NOT v_applying THEN
    RAISE EXCEPTION 'Only the venue''s own hours, approved, can hold a chapter.' USING ERRCODE = '42501';
  END IF;
  -- The venue is no longer on the chapter: the hold lifts, and the host sets the hours as before.
  IF NEW.hours_vendor_id IS NOT NULL AND NOT (NEW.hours_vendor_id = ANY (coalesce(NEW.responsible_vendor_ids, '{}'::uuid[]))) THEN
    NEW.hours_vendor_id := NULL;
    RETURN NEW;
  END IF;
  IF OLD.hours_vendor_id IS NULL OR NEW.hours_vendor_id IS NULL OR v_applying THEN
    RETURN NEW;
  END IF;
  IF (OLD.start_at, OLD.end_at, OLD.time_tba, OLD.ingress_minutes_before, OLD.egress_minutes_after)
     IS NOT DISTINCT FROM
     (NEW.start_at, NEW.end_at, NEW.time_tba, NEW.ingress_minutes_before, NEW.egress_minutes_after) THEN
    RETURN NEW;
  END IF;
  -- The window stays as it was in every pass below.
  IF (OLD.time_tba, OLD.ingress_minutes_before, OLD.egress_minutes_after)
     IS NOT DISTINCT FROM (NEW.time_tba, NEW.ingress_minutes_before, NEW.egress_minutes_after) THEN
    -- The event's date moved: every block shifts by exactly (live date − the day the schedule stands on) — the part
    -- lock's own test (20271305628470) — or, for a new undated event, from its default chapters' placeholder day
    -- (20271306532960 §2).
    SELECT e.event_date - a.anchor_day INTO v_days
      FROM public.events e
      JOIN public.event_schedule_day_anchor a ON a.event_id = e.event_id
     WHERE e.event_id = OLD.event_id;
    IF v_days IS NULL THEN
      SELECT e.event_date - p.placeholder_day INTO v_days
        FROM public.events e
        JOIN public.event_default_chapters_pending p ON p.event_id = e.event_id
       WHERE e.event_id = OLD.event_id AND p.placeholder_day IS NOT NULL;
    END IF;
    IF coalesce(v_days, 0) <> 0
       AND NEW.start_at = OLD.start_at + make_interval(hours => 24 * v_days)
       AND NEW.end_at IS NOT DISTINCT FROM OLD.end_at + make_interval(hours => 24 * v_days) THEN
      RETURN NEW;
    END IF;
    -- 🏃 Running late: exactly that many minutes on start and end.
    v_late := nullif(current_setting('app.running_late_minutes', true), '')::integer;
    IF v_late IS NOT NULL AND v_late <> 0
       AND NEW.start_at = OLD.start_at + make_interval(mins => v_late)
       AND NEW.end_at IS NOT DISTINCT FROM OLD.end_at + make_interval(mins => v_late) THEN
      RETURN NEW;
    END IF;
  END IF;
  SELECT coalesce(nullif(trim(ev.vendor_name), ''), 'The venue') INTO v_shop
    FROM public.event_vendors ev WHERE ev.vendor_id = OLD.hours_vendor_id;
  RAISE EXCEPTION '% holds this chapter''s hours. Ask them to change.', coalesce(v_shop, 'The venue')
    USING ERRCODE = 'P0001', HINT = 'venue_hours_locked';
END;
$$;

REVOKE ALL ON FUNCTION public.event_schedule_blocks_venue_hours_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_venue_hours_lock ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_venue_hours_lock
  BEFORE UPDATE ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_blocks_venue_hours_lock();

-- ── 5 · the part lock lets the venue's hours through (one clause added to 20271305628470's body) ─────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_part_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_ids UUID[] := coalesce(OLD.responsible_vendor_ids, '{}'::uuid[]);
  v_new_ids UUID[];
  v_fields  BOOLEAN;
  v_rest    BOOLEAN;
  v_ids     UUID[];
  v_days    INTEGER;
  v_shop    RECORD;
  v_clock_same BOOLEAN;
  v_clock_set  BOOLEAN;
  v_late       INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- The event itself is being deleted (a cascade): nothing is left to protect.
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = OLD.event_id) THEN
      RETURN OLD;
    END IF;
    v_ids := v_old_ids;
  ELSE
    v_new_ids := coalesce(NEW.responsible_vendor_ids, '{}'::uuid[]);
    -- The supplier's part: when, where, what, and inside which chapter. NOT is_public, sort_order, on_invitation,
    -- visibility, audience or the photo settings — none of those changes what the supplier does.
    v_fields := (OLD.label, OLD.start_at, OLD.end_at, OLD.time_tba, OLD.location, OLD.spot, OLD.notes, OLD.block_type,
                 OLD.ingress_minutes_before, OLD.egress_minutes_after, OLD.call_lead_minutes, OLD.parent_block_id, OLD.event_id,
                 OLD.follows_block_id, OLD.time_shape, OLD.time_or_minutes)
       IS DISTINCT FROM
                (NEW.label, NEW.start_at, NEW.end_at, NEW.time_tba, NEW.location, NEW.spot, NEW.notes, NEW.block_type,
                 NEW.ingress_minutes_before, NEW.egress_minutes_after, NEW.call_lead_minutes, NEW.parent_block_id, NEW.event_id,
                 NEW.follows_block_id, NEW.time_shape, NEW.time_or_minutes);
    IF v_fields THEN
      -- Every shop on the moment, before or after.
      v_ids := v_old_ids || v_new_ids;
    ELSE
      -- Only the shops put on or taken off: another supplier's presence is not a locked shop's part.
      v_ids := ARRAY(SELECT x FROM unnest(v_old_ids) x WHERE NOT (x = ANY (v_new_ids))
                     UNION SELECT y FROM unnest(v_new_ids) y WHERE NOT (y = ANY (v_old_ids)));
    END IF;
  END IF;
  IF cardinality(v_ids) = 0 THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  FOR v_shop IN SELECT * FROM public.schedule_locked_shops(OLD.event_id, v_ids) LOOP
    IF TG_OP = 'DELETE' THEN
      -- The supplier's own "remove this", being applied.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.event_schedule_suggestions s
         WHERE s.block_id = OLD.block_id AND s.vendor_profile_id = v_shop.vendor_profile_id
           AND s.status = 'open' AND s.kind = 'remove');
    ELSE
      -- Everything that is not the four fields a request may propose stays exactly as it was.
      v_rest := (OLD.spot, OLD.notes, OLD.block_type, OLD.ingress_minutes_before, OLD.egress_minutes_after,
                 OLD.call_lead_minutes, OLD.parent_block_id, OLD.event_id, v_old_ids, OLD.time_shape, OLD.time_or_minutes)
         IS NOT DISTINCT FROM
                (NEW.spot, NEW.notes, NEW.block_type, NEW.ingress_minutes_before, NEW.egress_minutes_after,
                 NEW.call_lead_minutes, NEW.parent_block_id, NEW.event_id, v_new_ids, NEW.time_shape, NEW.time_or_minutes);
      -- ⏭ "Time TBA" / "right after" (20271302727358) unchanged — or ended by a real time (a request's proposed start).
      v_clock_same := (OLD.time_tba, OLD.follows_block_id) IS NOT DISTINCT FROM (NEW.time_tba, NEW.follows_block_id);
      v_clock_set  := OLD.time_tba AND NOT NEW.time_tba AND NEW.follows_block_id IS NULL;
      -- 🏛 Venue hours being applied (20271307658341): the chapter's hours, through `apply_venue_hours` only — the one
      -- function that sets this flag. The venue is the one who controls those hours.
      CONTINUE WHEN coalesce(current_setting('app.venue_hours_apply', true), '') <> '' AND OLD.parent_block_id IS NULL;
      -- The supplier's own request, being applied: exactly what it proposed, nothing else.
      CONTINUE WHEN v_rest AND EXISTS (
        SELECT 1 FROM public.event_schedule_suggestions s
         WHERE s.block_id = OLD.block_id AND s.vendor_profile_id = v_shop.vendor_profile_id
           AND s.status = 'open' AND s.kind = 'adjust'
           AND (v_clock_same OR (v_clock_set AND s.proposed_start_at IS NOT NULL))
           AND NEW.start_at IS NOT DISTINCT FROM coalesce(s.proposed_start_at, OLD.start_at)
           AND NEW.end_at   IS NOT DISTINCT FROM coalesce(s.proposed_end_at, OLD.end_at)
           AND NEW.location IS NOT DISTINCT FROM coalesce(s.proposed_location, OLD.location)
           AND NEW.label    IS NOT DISTINCT FROM coalesce(s.proposed_label, OLD.label));
      -- The event's date moved: the whole day shifts by exactly (live date − the day the schedule stands on).
      SELECT e.event_date - a.anchor_day INTO v_days
        FROM public.events e
        JOIN public.event_schedule_day_anchor a ON a.event_id = e.event_id
       WHERE e.event_id = OLD.event_id;
      CONTINUE WHEN v_rest AND v_clock_same AND coalesce(v_days, 0) <> 0
        AND NEW.label IS NOT DISTINCT FROM OLD.label
        AND NEW.location IS NOT DISTINCT FROM OLD.location
        AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at + make_interval(hours => 24 * v_days)
        AND NEW.end_at   IS NOT DISTINCT FROM OLD.end_at   + make_interval(hours => 24 * v_days);
      -- 🏃 Running late (owner 2026-11-03, 20271303571970): the host's shift of the day, inside
      -- `running_late_shift_schedule` only — exactly that many minutes on start and end, the clock flags untouched.
      v_late := nullif(current_setting('app.running_late_minutes', true), '')::integer;
      CONTINUE WHEN v_rest AND v_clock_same AND v_late IS NOT NULL AND v_late <> 0
        AND NEW.label IS NOT DISTINCT FROM OLD.label
        AND NEW.location IS NOT DISTINCT FROM OLD.location
        AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at + make_interval(mins => v_late)
        AND NEW.end_at   IS NOT DISTINCT FROM OLD.end_at   + make_interval(mins => v_late);
    END IF;
    RAISE EXCEPTION '% isn''t taking changes. Send them a request instead.', v_shop.shop
      USING ERRCODE = 'P0001', HINT = 'supplier_part_locked';
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_blocks_part_lock() FROM PUBLIC, anon, authenticated;

COMMIT;
