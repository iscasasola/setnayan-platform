-- ============================================================================
-- 20271203855754_moodboard_part_finalization_holds_the_design.sql
--
-- MB15 — THE OTHER HALF OF MB12'S FREEZE: THE DESIGN, NOT ONLY THE COLOURS.
--
-- `vendor_agree_to_part` freezes what an agreement means for `events.role_palette`
-- — `touched_roles` entries and `room_dressing` overrides — and
-- `events_hold_part_finalization_freeze` (20271202859312) re-asserts that on
-- every write, from every writer. `events.reception_design` got neither.
--
-- 🔑 THE ZONE IS WHAT A ROOM SUPPLIER ACTUALLY AGREED TO. `room:ceiling`'s
-- snapshot carries the ceiling TREATMENT the stylist said yes to, not just the
-- colours it is dressed in. Freezing the colours and leaving the treatment
-- editable produces the failure MB12's own header names, one field over: the
-- row says `agreed`, the couple re-picks "Fairy lights" over the draped canopy
-- the stylist quoted, nothing renders differently anywhere, and the supplier
-- builds what they agreed to — which is now wrong on the day.
--
-- ── WHY A TRIGGER AND NOT A CHECK IN THE SERVER ACTION ─────────────────────
-- `events.reception_design` has more than one writer: `saveReceptionDesign`
-- (the Reception Designer in the Seat Plan) and `applyMoodboardTemplate` (which
-- merges a whole theme's design onto the event). A guard on one writer is a
-- guard on one writer, and the second one would silently overwrite an agreed
-- ceiling the first refuses to touch. Same reasoning, same shape and
-- deliberately the same NAMING as the palette backstop it parallels.
--
-- ⚠ IT RESTORES THE PART OBJECT, NOT THE WHOLE DESIGN. A finalized `room:stage`
-- must not stop a couple dressing their ceiling — only the agreed part's own
-- sub-object is put back, key by key, from `design_snapshot -> 'reception_design'`.
--
-- ⚠ `people:` AND `place:` FINALIZATIONS TOUCH NOTHING HERE. They freeze
-- colours, which `role_palette` already carries. Only a `room:<zone>` part has
-- a `reception_design` sub-object of its own, so only those are re-asserted.
-- The prefix is stripped from `part_id`; the remainder is the zone key exactly
-- as `RECEPTION_PARTS` spells it (`apps/web/lib/moodboard-render-parts.ts`
-- derives the id as `room:` || the part id, and its own test pins that shape).
--
-- ⚠ A SNAPSHOT WITH NO ENTRY FOR ITS OWN ZONE RESTORES NOTHING, DELIBERATELY.
-- `buildDesignSnapshot` stores the whole sanitized `reception_design`, so a zone
-- the couple had left at DEFAULT_DESIGN is simply absent from it. Writing an
-- empty object back would be a claim the supplier never made; leaving the key
-- alone means an untouched zone stays untouched, which is what "they agreed to
-- the default" honestly is.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. The pipeline pushes the committed
-- file; a direct apply orphans the prod ledger and jams `db push` for every
-- subsequent merge (see CLAUDE.md, 2026-09-02).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reassert_part_finalization_design(
  p_event_id UUID,
  p_design   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $reassert_design$
DECLARE
  v_design JSONB := COALESCE(p_design, '{}'::jsonb);
  v_row    RECORD;
  v_zone   TEXT;
  v_agreed JSONB;
BEGIN
  IF jsonb_typeof(v_design) <> 'object' THEN v_design := '{}'::jsonb; END IF;

  FOR v_row IN
    SELECT part_id, design_snapshot
      FROM public.moodboard_part_finalizations
     WHERE event_id = p_event_id
       AND state = 'agreed'
  LOOP
    -- Only room zones own a reception_design sub-object; people/place parts
    -- freeze colours and are handled by reassert_part_finalization_freeze.
    IF v_row.part_id NOT LIKE 'room:%' THEN CONTINUE; END IF;
    v_zone := substring(v_row.part_id FROM 6);
    IF v_zone IS NULL OR v_zone = '' THEN CONTINUE; END IF;

    v_agreed := v_row.design_snapshot -> 'reception_design' -> v_zone;
    -- Absent (or a non-object, from a snapshot written by a shape we no longer
    -- speak) → leave the couple's value alone rather than blanking a zone.
    IF v_agreed IS NULL OR jsonb_typeof(v_agreed) <> 'object' THEN CONTINUE; END IF;

    v_design := jsonb_set(v_design, ARRAY[v_zone], v_agreed, TRUE);
  END LOOP;

  RETURN v_design;
END;
$reassert_design$;

-- 🛑 NOT CALLABLE BY ANYBODY HOLDING THE PUBLISHABLE KEY, for exactly the
-- reason its palette twin is not: SECURITY DEFINER + it reads
-- moodboard_part_finalizations with RLS bypassed, so a caller choosing its own
-- arguments could read back another couple's agreed design. The GRANT decides,
-- not the caller — `tests/db/anon-rpc-surface.db.test.ts` catches this class.
-- Its only caller is the trigger function below, which is itself SECURITY
-- DEFINER, so no role needs EXECUTE at all.
REVOKE ALL ON FUNCTION public.reassert_part_finalization_design(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reassert_part_finalization_design(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.reassert_part_finalization_design(UUID, JSONB) FROM authenticated;

COMMENT ON FUNCTION public.reassert_part_finalization_design(UUID, JSONB) IS
  'MB15 backstop. Given an event and a proposed reception_design, returns it '
  'with every AGREED room: part''s own zone object put back from its '
  'design_snapshot. Zones nobody agreed to are untouched, and people:/place: '
  'finalizations are ignored here (their freeze lives in role_palette). Called '
  'by the BEFORE UPDATE trigger on events, so no design writer can drop a '
  'freeze by not knowing finalization exists.';

CREATE OR REPLACE FUNCTION public.events_hold_part_finalization_design()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $hold_design$
BEGIN
  NEW.reception_design := public.reassert_part_finalization_design(NEW.event_id, NEW.reception_design);
  RETURN NEW;
END;
$hold_design$;

DROP TRIGGER IF EXISTS events_hold_part_finalization_design ON public.events;
CREATE TRIGGER events_hold_part_finalization_design
  BEFORE UPDATE OF reception_design ON public.events
  FOR EACH ROW
  WHEN (OLD.reception_design IS DISTINCT FROM NEW.reception_design)
  EXECUTE FUNCTION public.events_hold_part_finalization_design();

-- Same REVOKEs, same reason as the palette twin: a SECURITY DEFINER trigger
-- function left with Supabase's default grant is a definer-privileged function
-- on the publishable-key surface. A trigger function needs EXECUTE only at
-- CREATE TRIGGER time, and the trigger above is created by the owner one
-- statement earlier, so firing is unaffected.
REVOKE ALL ON FUNCTION public.events_hold_part_finalization_design() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.events_hold_part_finalization_design() FROM anon;
REVOKE ALL ON FUNCTION public.events_hold_part_finalization_design() FROM authenticated;

COMMENT ON FUNCTION public.events_hold_part_finalization_design() IS
  'BEFORE UPDATE OF reception_design on events. Runs every proposed design '
  'through reassert_part_finalization_design, so a room zone a supplier agreed '
  'to build cannot be re-dressed by any writer. Fires only when '
  'reception_design actually changes.';

COMMIT;
