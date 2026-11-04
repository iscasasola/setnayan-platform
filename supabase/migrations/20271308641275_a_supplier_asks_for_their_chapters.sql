-- a_supplier_asks_for_their_chapters
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📍 CHAPTERS: THE SUPPLIER PICKS, AND THE HOST CAN ALSO PICK FOR THEM (owner 2026-11-04, DECISION_LOG row of that
-- name). Owner, verbatim: *"They can pick and we can also pick for them."*
--
--   · A BOOKED supplier picks the chapters they serve (their Where) on Customer › Schedule. The pick is a REQUEST: it
--     waits for the host or a coordinator holding The Day = Edit, who OK it — or the host's Auto-agree applies it.
--   · The host still sets Where directly through `set_supplier_where` (20271300598766), which applies at once.
--   · A supplier who LOCKED their part (20271303409352) can only have Where changed by request: the part lock already
--     refuses `set_supplier_where` putting that shop on or off a chapter, so the host ASKS (`host_ask_supplier_where`)
--     and the supplier answers on their Schedule.
--
-- 🔑 EXTEND, DO NOT REBUILD. `event_schedule_suggestions` already IS "a proposed change waiting on a yes from the other
-- side", both ways (`direction`, 20271303655108), with Take back (`withdraw_schedule_request`) and the ONE accept path
-- (lib/schedule-suggestion-decide.server.ts). Where becomes ONE more request kind on it — the venue-hours kind
-- (20271307658341) is the precedent, step for step:
--
--   1 · kind 'where' + two columns: `where_vendor_id` (the BOOKING whose Where it is — a shop booked twice has two) and
--       `proposed_block_ids` (the chapters asked for, the whole set). No block of its own (a Where spans chapters).
--   2 · Written ONLY by two SECURITY DEFINER doors — never a raw INSERT (a RESTRICTIVE policy holds every direct
--       insert of kind 'where'):
--         `supplier_ask_where`        the booked shop asks the host       (direction 'to_host')
--         `host_ask_supplier_where`   a host / coordinator asks the shop  (direction 'to_supplier')
--       Each refuses what `set_supplier_where` refuses (a coordinator · not a chapter · none for a booked supplier) and
--       an ask that changes nothing. A new ask REPLACES the asker's own open one for that booking (withdrawn), so a
--       re-pick never leaves two answers waiting.
--   3 · APPLIED ONLY by `apply_supplier_where`, called by the accept path: the host's OK on a 'to_host' request, the
--       supplier's Accept on a 'to_supplier' ask (service role, after `may_answer_schedule_ask`), or Auto-agree (service
--       role). It writes `responsible_vendor_ids` exactly as `set_supplier_where` does — the ONE fact of Where — and it
--       never tells the supplier "changed where you go" (the accept path tells each side its answer).
--   4 · THE PART LOCK LETS THE REQUEST THROUGH by a data signature, the venue-hours way: `apply_supplier_where` sets
--       `app.supplier_where_apply` to the request's id, and the lock passes ONLY when that request is open, from the
--       locked shop, on this event, and the write puts that one booking on / off exactly the proposed chapters and
--       nothing else (one clause added to 20271307658341's body, reproduced verbatim).
--   5 · A 'where' request's facts are FIXED once written (a BEFORE UPDATE trigger): the resolve policy lets a host flip
--       a request's status, and without this they could rewrite what the supplier asked and then approve it past the
--       lock.
--
-- No email anywhere: the host's notice is `supplier_where_asked` (20271308386601, in-app only); the supplier's is the
-- shipped `schedule_ask`. The price is never touched.
--
-- RLS: no new table. The new columns ride `event_schedule_suggestions`' policies (supplier reads its own org's rows,
-- host and moderators read their event's). Held by apps/web/tests/db/a-supplier-asks-for-their-chapters.db.test.ts.

BEGIN;

-- ── 1 · the request ────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_schedule_suggestions
  ADD COLUMN IF NOT EXISTS where_vendor_id    UUID REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS proposed_block_ids UUID[];

COMMENT ON COLUMN public.event_schedule_suggestions.where_vendor_id IS
  'On a Where request (kind = ''where''): the booking (event_vendors.vendor_id) whose chapters it asks to set. 20271308641275.';
COMMENT ON COLUMN public.event_schedule_suggestions.proposed_block_ids IS
  'On a Where request: the whole set of chapters (top-level event_schedule_blocks) asked for. 20271308641275.';

ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_kind_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_kind_check CHECK (kind IN ('adjust', 'new', 'remove', 'hours', 'where'));

ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_where_shape_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_where_shape_check CHECK (
    (kind = 'where') = (where_vendor_id IS NOT NULL)
    AND (kind = 'where') = (proposed_block_ids IS NOT NULL)
    AND (
      kind <> 'where'
      OR (
        block_id IS NULL
        AND proposed_label IS NULL
        AND proposed_start_at IS NULL
        AND proposed_end_at IS NULL
        AND proposed_location IS NULL
        AND proposed_parent_block_id IS NULL
        AND proposed_crew IS NULL
        AND cardinality(proposed_block_ids) BETWEEN 1 AND 40
      )
    )
  );

-- One open Where request per booking per direction (a re-pick replaces it inside the doors below).
CREATE UNIQUE INDEX IF NOT EXISTS event_schedule_suggestions_one_open_where
  ON public.event_schedule_suggestions (where_vendor_id, direction)
  WHERE kind = 'where' AND status = 'open';

-- Only the two doors below write a Where request.
DROP POLICY IF EXISTS schedule_suggestions_where_only_by_its_doors ON public.event_schedule_suggestions;
CREATE POLICY schedule_suggestions_where_only_by_its_doors
  ON public.event_schedule_suggestions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (kind <> 'where');

-- ── 5 · a Where request's facts are fixed once written ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_schedule_suggestions_where_fixed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.kind = 'where' OR NEW.kind = 'where')
     AND (OLD.kind, OLD.direction, OLD.event_id, OLD.vendor_profile_id, OLD.where_vendor_id, OLD.proposed_block_ids,
          OLD.suggested_by_user_id, OLD.asked_as)
         IS DISTINCT FROM
         (NEW.kind, NEW.direction, NEW.event_id, NEW.vendor_profile_id, NEW.where_vendor_id, NEW.proposed_block_ids,
          NEW.suggested_by_user_id, NEW.asked_as) THEN
    RAISE EXCEPTION 'whereask:fixed: a Where request says what was asked; answer it, never rewrite it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_schedule_suggestions_where_fixed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_suggestions_where_fixed ON public.event_schedule_suggestions;
CREATE TRIGGER event_schedule_suggestions_where_fixed
  BEFORE UPDATE ON public.event_schedule_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_suggestions_where_fixed();

-- ── 2 · the shared checks: what set_supplier_where refuses, plus "nothing changes" ─────────────────────────────────
-- Internal (no grant): read only by the doors below. Returns the asked set, deduplicated and sorted.
CREATE OR REPLACE FUNCTION public.supplier_where_ask_checked(p_ev public.event_vendors, p_block_ids UUID[])
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids      UUID[];
  v_chapters UUID[];
  v_before   UUID[];
BEGIN
  IF p_ev.category::text = 'planner_coordinator' THEN
    RAISE EXCEPTION 'whereask:everywhere: a coordinator is on every chapter' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::uuid[]) INTO v_ids
    FROM unnest(COALESCE(p_block_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL;
  SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_chapters
    FROM public.event_schedule_blocks b
   WHERE b.event_id = p_ev.event_id AND b.parent_block_id IS NULL;
  IF cardinality(v_chapters) = 0 THEN
    RAISE EXCEPTION 'whereask:no_chapters: the event has no chapter yet' USING ERRCODE = '22023';
  END IF;
  IF NOT (v_ids <@ v_chapters) THEN
    RAISE EXCEPTION 'whereask:not_a_chapter: every Where must be a chapter of this event' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'whereask:keep_one: a booked supplier keeps at least 1 chapter' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_before
    FROM public.event_schedule_blocks b
   WHERE b.event_id = p_ev.event_id AND b.parent_block_id IS NULL
     AND p_ev.vendor_id = ANY (b.responsible_vendor_ids);
  IF v_before = v_ids THEN
    RAISE EXCEPTION 'whereask:unchanged: those are already their chapters' USING ERRCODE = '22023';
  END IF;
  RETURN v_ids;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_where_ask_checked(public.event_vendors, UUID[]) FROM PUBLIC, anon, authenticated;

-- The chapters' names, in time order — the words of a request and its notices.
CREATE OR REPLACE FUNCTION public.supplier_where_names(p_block_ids UUID[])
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(string_agg(COALESCE(NULLIF(btrim(b.label), ''), 'Untitled chapter'), ', ' ORDER BY b.start_at, b.sort_order), '')
    FROM public.event_schedule_blocks b
   WHERE b.block_id = ANY (COALESCE(p_block_ids, '{}'::uuid[]));
$$;
REVOKE ALL ON FUNCTION public.supplier_where_names(UUID[]) FROM PUBLIC, anon, authenticated;

-- ── 2a · the supplier asks ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_ask_where(p_vendor_id UUID, p_block_ids UUID[], p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_ev    public.event_vendors%ROWTYPE;
  v_ids   UUID[];
  v_names TEXT;
  v_shop  TEXT;
  v_id    UUID;
BEGIN
  SELECT * INTO v_ev FROM public.event_vendors WHERE vendor_id = p_vendor_id FOR UPDATE;
  -- Only the booked shop itself (owner or team). A stranger cannot tell "not yours" from "not there".
  IF NOT FOUND OR v_uid IS NULL OR v_ev.marketplace_vendor_id IS NULL
     OR NOT (v_ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids()))
     OR v_ev.archived_at IS NOT NULL
     OR v_ev.status::text NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RAISE EXCEPTION 'whereask:not_yours: only the booked supplier can ask for their chapters' USING ERRCODE = '42501';
  END IF;

  v_ids := public.supplier_where_ask_checked(v_ev, p_block_ids);
  v_names := public.supplier_where_names(v_ids);
  SELECT NULLIF(btrim(vp.business_name), '') INTO v_shop
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_ev.marketplace_vendor_id;

  -- A re-pick replaces their own request still waiting.
  UPDATE public.event_schedule_suggestions
     SET status = 'withdrawn', resolved_at = now()
   WHERE where_vendor_id = v_ev.vendor_id AND kind = 'where' AND direction = 'to_host' AND status = 'open';

  INSERT INTO public.event_schedule_suggestions
    (event_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, direction, where_vendor_id,
     proposed_block_ids, note, status)
  VALUES
    (v_ev.event_id, v_ev.marketplace_vendor_id, v_uid, COALESCE(v_shop, NULLIF(btrim(v_ev.vendor_name), '')), 'where',
     'to_host', v_ev.vendor_id, v_ids,
     left(COALESCE(NULLIF(btrim(p_note), ''), format('Asks to work %s', v_names)), 1000), 'open')
  RETURNING suggestion_id INTO v_id;

  RETURN jsonb_build_object('suggestion_id', v_id, 'event_id', v_ev.event_id, 'names', v_names);
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_ask_where(UUID, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_ask_where(UUID, UUID[], TEXT) TO authenticated;
COMMENT ON FUNCTION public.supplier_ask_where(UUID, UUID[], TEXT) IS
  'A booked supplier asks to serve these chapters (their Where): a ''where'' request to the host, replacing their own '
  'open one for that booking. Refuses what set_supplier_where refuses, and an ask that changes nothing. 20271308641275.';

-- ── 2b · a host or coordinator asks the supplier (the way to change a LOCKED supplier's Where) ─────────────────────
CREATE OR REPLACE FUNCTION public.host_ask_supplier_where(
  p_vendor_id UUID,
  p_block_ids UUID[],
  p_note TEXT DEFAULT NULL,
  p_by_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_ev    public.event_vendors%ROWTYPE;
  v_as    TEXT;
  v_ids   UUID[];
  v_names TEXT;
  v_id    UUID;
  v_owner UUID;
  v_host  TEXT;
BEGIN
  SELECT * INTO v_ev FROM public.event_vendors WHERE vendor_id = p_vendor_id FOR UPDATE;
  IF FOUND AND v_uid IS NOT NULL THEN
    IF v_ev.event_id IN (SELECT public.current_couple_event_ids()) THEN
      v_as := 'host';
    ELSIF EXISTS (
      SELECT 1 FROM public.current_moderator_area_levels('schedule') l(event_id, level)
       WHERE l.event_id = v_ev.event_id AND l.level = 'edit'
    ) THEN
      v_as := 'coordinator';
    END IF;
  END IF;
  IF v_as IS NULL THEN
    RAISE EXCEPTION 'whereask:not_yours: this supplier is not on an event you can edit' USING ERRCODE = '42501';
  END IF;
  -- A supplier the couple added by hand has no shop: nobody to ask — the host sets their Where directly.
  IF v_ev.marketplace_vendor_id IS NULL OR v_ev.archived_at IS NOT NULL
     OR v_ev.status::text NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RAISE EXCEPTION 'whereask:no_shop: only a booked supplier on Setnayan can be asked' USING ERRCODE = '22023';
  END IF;

  v_ids := public.supplier_where_ask_checked(v_ev, p_block_ids);
  v_names := public.supplier_where_names(v_ids);

  UPDATE public.event_schedule_suggestions
     SET status = 'withdrawn', resolved_at = now()
   WHERE where_vendor_id = v_ev.vendor_id AND kind = 'where' AND direction = 'to_supplier' AND status = 'open';

  INSERT INTO public.event_schedule_suggestions
    (event_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, direction, asked_as, where_vendor_id,
     proposed_block_ids, note, status)
  VALUES
    (v_ev.event_id, v_ev.marketplace_vendor_id, v_uid, left(NULLIF(btrim(p_by_name), ''), 120), 'where', 'to_supplier',
     v_as, v_ev.vendor_id, v_ids,
     left(COALESCE(NULLIF(btrim(p_note), ''), format('Asks you to work %s', v_names)), 1000), 'open')
  RETURNING suggestion_id INTO v_id;

  -- 🔔 The asked shop's owner hears it in the app (`schedule_ask`, in-app only — never email), written HERE so no door
  -- that asks can skip it (the precedent: set_supplier_where's own notice).
  SELECT vp.user_id INTO v_owner FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_ev.marketplace_vendor_id;
  IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
    SELECT NULLIF(btrim(e.display_name), '') INTO v_host FROM public.events e WHERE e.event_id = v_ev.event_id;
    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    VALUES (
      v_owner,
      'schedule_ask'::public.notification_type,
      left(format('%s asks you to change your chapters', COALESCE(v_host, CASE v_as WHEN 'coordinator' THEN 'The coordinator' ELSE 'The host' END)), 160),
      -- ✍ The host's optional one-line note (answer 4 on #7260) rides the notice, so the supplier knows why.
      left(format('They ask you to work %s.%s Accept or decline on your Schedule. Your price doesn’t change by itself.',
                  v_names,
                  CASE WHEN NULLIF(btrim(p_note), '') IS NULL THEN '' ELSE format(' “%s”', left(btrim(p_note), 200)) END), 500),
      '/vendor-dashboard/clients/' || v_ev.event_id::text || '?tab=schedule',
      v_ev.event_id
    );
  END IF;

  RETURN jsonb_build_object('suggestion_id', v_id, 'event_id', v_ev.event_id, 'names', v_names, 'shop', v_ev.marketplace_vendor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.host_ask_supplier_where(UUID, UUID[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_ask_supplier_where(UUID, UUID[], TEXT, TEXT) TO authenticated;
COMMENT ON FUNCTION public.host_ask_supplier_where(UUID, UUID[], TEXT, TEXT) IS
  'A host (asked_as host) or a seat holding The Day = Edit (coordinator) asks a booked supplier to serve these chapters '
  '— the door for a supplier who locked their part. The supplier answers on their Schedule. 20271308641275.';

-- ── 3 · the one door that applies a Where request ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_supplier_where(p_suggestion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s          public.event_schedule_suggestions%ROWTYPE;
  v_uid      UUID := auth.uid();
  v_ev       public.event_vendors%ROWTYPE;
  v_ids      UUID[];
  v_chapters UUID[];
  v_after    UUID[];
BEGIN
  SELECT * INTO s FROM public.event_schedule_suggestions WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'open' OR s.kind <> 'where' THEN
    RAISE EXCEPTION 'whereask:gone: that request was already answered' USING ERRCODE = 'P0002';
  END IF;

  -- The OTHER side decides: the host or coordinator a supplier's request, the asked supplier a host's ask. No caller =
  -- the service role (Auto-agree, or a supplier's Accept after may_answer_schedule_ask said yes).
  IF v_uid IS NOT NULL THEN
    IF s.direction = 'to_host' AND NOT coalesce(
         s.event_id IN (SELECT public.current_couple_event_ids())
         OR public.moderator_area_level(s.event_id, 'schedule') = 'edit', false) THEN
      RAISE EXCEPTION 'whereask:not_allowed: this account cannot answer that request' USING ERRCODE = '42501';
    END IF;
    IF s.direction = 'to_supplier' AND NOT (s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())) THEN
      RAISE EXCEPTION 'whereask:not_allowed: this account cannot answer that request' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_ev FROM public.event_vendors WHERE vendor_id = s.where_vendor_id FOR UPDATE;
  IF NOT FOUND OR v_ev.event_id <> s.event_id OR v_ev.marketplace_vendor_id IS DISTINCT FROM s.vendor_profile_id
     OR v_ev.archived_at IS NOT NULL
     OR v_ev.status::text NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RAISE EXCEPTION 'whereask:not_booked: that supplier is no longer booked on this event' USING ERRCODE = '22023';
  END IF;
  IF v_ev.category::text = 'planner_coordinator' THEN
    RAISE EXCEPTION 'whereask:everywhere: a coordinator is on every chapter' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::uuid[]) INTO v_ids FROM unnest(s.proposed_block_ids) AS x;
  SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_chapters
    FROM public.event_schedule_blocks b WHERE b.event_id = s.event_id AND b.parent_block_id IS NULL;
  -- A chapter deleted since the ask: the request no longer says one true thing — it is re-asked, never half-applied.
  IF NOT (v_ids <@ v_chapters) OR cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'whereask:not_a_chapter: a chapter in that request is gone' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.supplier_where_apply', s.suggestion_id::text, true);
  UPDATE public.event_schedule_blocks b
     SET responsible_vendor_ids = array_append(b.responsible_vendor_ids, v_ev.vendor_id)
   WHERE b.block_id = ANY (v_ids)
     AND NOT (v_ev.vendor_id = ANY (b.responsible_vendor_ids));
  UPDATE public.event_schedule_blocks b
     SET responsible_vendor_ids = array_remove(b.responsible_vendor_ids, v_ev.vendor_id)
   WHERE b.event_id = s.event_id AND b.parent_block_id IS NULL
     AND NOT (b.block_id = ANY (v_ids))
     AND v_ev.vendor_id = ANY (b.responsible_vendor_ids);
  PERFORM set_config('app.supplier_where_apply', '', true);

  SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_after
    FROM public.event_schedule_blocks b
   WHERE b.event_id = s.event_id AND b.parent_block_id IS NULL AND v_ev.vendor_id = ANY (b.responsible_vendor_ids);
  IF v_after IS DISTINCT FROM v_ids THEN
    RAISE EXCEPTION 'whereask:not_saved: the chapters did not change' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object('after', to_jsonb(v_after), 'names', public.supplier_where_names(v_after), 'vendor_id', v_ev.vendor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_supplier_where(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_supplier_where(UUID) TO authenticated, service_role;
COMMENT ON FUNCTION public.apply_supplier_where(UUID) IS
  'Applies an OPEN ''where'' request exactly as asked: the booking goes on the proposed chapters and off every other '
  '(responsible_vendor_ids — the one fact of Where). The other side only (host/coordinator for to_host, the asked shop '
  'for to_supplier) or the service role. Passes the part lock for that one request. The accept path flips the status '
  'after. 20271308641275.';

-- ── 4 · the part lock lets a Where request through (one clause added to 20271307658341's body) ─────────────────────
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
      -- 📍 A Where request being applied (20271308641275): through `apply_supplier_where` only — the one function that
      -- sets this flag — and only for the request it names: open, from this locked shop, on this event, putting that one
      -- booking on / off exactly the chapters it proposed, nothing else on the chapter moving.
      CONTINUE WHEN NOT v_fields
        AND OLD.parent_block_id IS NULL
        AND coalesce(current_setting('app.supplier_where_apply', true), '') <> ''
        AND EXISTS (
          SELECT 1 FROM public.event_schedule_suggestions s
           WHERE s.suggestion_id::text = current_setting('app.supplier_where_apply', true)
             AND s.status = 'open' AND s.kind = 'where'
             AND s.event_id = OLD.event_id
             AND s.vendor_profile_id = v_shop.vendor_profile_id
             AND v_ids <@ ARRAY[s.where_vendor_id]
             AND (s.where_vendor_id = ANY (v_new_ids)) = (OLD.block_id = ANY (s.proposed_block_ids)));
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

-- ── 6 · the host picks for them: their waiting request is ANSWERED BY THE HOST (owner 2026-11-04, answer 1 on #7260) ─
-- A new status, never "declined" — the supplier must not read the host's own pick as a refusal of theirs.
ALTER TABLE public.event_schedule_suggestions DROP CONSTRAINT IF EXISTS event_schedule_suggestions_status_check;
ALTER TABLE public.event_schedule_suggestions
  ADD CONSTRAINT event_schedule_suggestions_status_check
  CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn', 'answered_by_host'));

-- `set_supplier_where`, reproduced from 20271300598766 (its only definition) with ONE addition: it closes the booking's
-- waiting Where request as 'answered_by_host' (and withdraws the host's own ask), then sends ONE notice that says so in
-- place of the change notice. Everything else — the gate, the three refusals, the writes, the notice — word for word.
CREATE OR REPLACE FUNCTION public.set_supplier_where(
  p_vendor_id UUID,
  p_block_ids UUID[],
  p_covered_group TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_owner    UUID;
  v_host     TEXT;
  v_told     BOOLEAN := false;
  v_ev       public.event_vendors%ROWTYPE;
  v_ids      UUID[];
  v_chapters UUID[];
  v_before   UUID[];
  v_after    UUID[];
  v_booked   BOOLEAN;
  v_n        INT;
  v_names    TEXT[];
  v_answered INT := 0;
BEGIN
  SELECT * INTO v_ev FROM public.event_vendors WHERE vendor_id = p_vendor_id FOR UPDATE;
  -- Only a host of this supplier's event. A stranger cannot tell "not yours" from "not there".
  IF NOT FOUND OR v_uid IS NULL OR NOT (v_ev.event_id IN (SELECT public.current_couple_event_ids())) THEN
    RAISE EXCEPTION 'supplier_not_found: this supplier is not on an event you can edit' USING ERRCODE = 'P0002';
  END IF;

  -- Coordinators are on every chapter (owner 2026-11-01): there is no Where to set.
  IF v_ev.category = 'planner_coordinator' OR p_covered_group = 'coordinator' THEN
    RAISE EXCEPTION 'coordinators_are_everywhere: a coordinator is on every chapter' USING ERRCODE = '22023';
  END IF;

  -- An in-house group is named by its plan group (`catering`) or its row (`tile:food_truck`). What a booking covers
  -- has two authors (the couple's `covers_plan_groups` on a supplier they added; the shop's own linked services on a
  -- supplier on Setnayan), so the key is checked for shape here and offered only from what the page read.
  IF p_covered_group IS NOT NULL AND p_covered_group !~ '^[a-z0-9_:]{1,64}$' THEN
    RAISE EXCEPTION 'not_covered: % is not an in-house group', p_covered_group USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::uuid[]) INTO v_ids
    FROM unnest(COALESCE(p_block_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL;

  SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_chapters
    FROM public.event_schedule_blocks b
   WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL;

  IF NOT (v_ids <@ v_chapters) THEN
    RAISE EXCEPTION 'not_a_chapter: every Where must be a chapter of this event' USING ERRCODE = '22023';
  END IF;

  v_booked := v_ev.archived_at IS NULL
          AND v_ev.status::text IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  -- Required once booked: at least one chapter, whenever the event has any (plan §3 "Suppliers").
  IF v_booked AND cardinality(v_ids) = 0 AND cardinality(v_chapters) > 0 THEN
    RAISE EXCEPTION 'a_booked_supplier_needs_a_chapter: keep at least 1 chapter for a booked supplier' USING ERRCODE = '23514';
  END IF;

  IF p_covered_group IS NULL THEN
    SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_before
      FROM public.event_schedule_blocks b
     WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL
       AND p_vendor_id = ANY (b.responsible_vendor_ids);

    UPDATE public.event_schedule_blocks b
       SET responsible_vendor_ids = array_append(b.responsible_vendor_ids, p_vendor_id)
     WHERE b.block_id = ANY (v_ids)
       AND NOT (p_vendor_id = ANY (b.responsible_vendor_ids));

    UPDATE public.event_schedule_blocks b
       SET responsible_vendor_ids = array_remove(b.responsible_vendor_ids, p_vendor_id)
     WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL
       AND NOT (b.block_id = ANY (v_ids))
       AND p_vendor_id = ANY (b.responsible_vendor_ids);

    SELECT COALESCE(array_agg(b.block_id ORDER BY b.block_id), '{}'::uuid[]) INTO v_after
      FROM public.event_schedule_blocks b
     WHERE b.event_id = v_ev.event_id AND b.parent_block_id IS NULL
       AND p_vendor_id = ANY (b.responsible_vendor_ids);
  ELSE
    SELECT COALESCE(array_agg(x::uuid ORDER BY x::uuid), NULL) INTO v_before
      FROM jsonb_array_elements_text(v_ev.covered_where -> p_covered_group) AS x;

    UPDATE public.event_vendors
       SET covered_where = jsonb_set(COALESCE(covered_where, '{}'::jsonb), ARRAY[p_covered_group], to_jsonb(v_ids), true)
     WHERE vendor_id = p_vendor_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_after := CASE WHEN v_n = 1 THEN v_ids ELSE v_before END;
  END IF;

  IF v_after IS DISTINCT FROM v_ids THEN
    RAISE EXCEPTION 'not_saved: this account cannot change where this supplier goes' USING ERRCODE = '42501';
  END IF;

  -- 📍 THE HOST PICKED FOR THEM (owner 2026-11-04, answer 1 on #7260): the booking's own Where request still waiting is
  -- closed as ANSWERED BY THE HOST — never "declined", so the supplier does not read it as a refusal — and the host's
  -- own ask of them is moot (withdrawn). Same statement, so no door that sets Where can leave a stale request behind.
  IF p_covered_group IS NULL THEN
    UPDATE public.event_schedule_suggestions
       SET status = 'answered_by_host', resolved_by_user_id = v_uid, resolved_at = now()
     WHERE where_vendor_id = p_vendor_id AND kind = 'where' AND direction = 'to_host' AND status = 'open';
    GET DIAGNOSTICS v_answered = ROW_COUNT;
    UPDATE public.event_schedule_suggestions
       SET status = 'withdrawn', resolved_at = now()
     WHERE where_vendor_id = p_vendor_id AND kind = 'where' AND direction = 'to_supplier' AND status = 'open';
  END IF;

  -- The chapters it is on now, by name and in time order — the words of the notice.
  SELECT COALESCE(array_agg(b.label ORDER BY b.start_at, b.sort_order), '{}'::text[]) INTO v_names
    FROM public.event_schedule_blocks b WHERE b.block_id = ANY (v_ids);

  -- 🔔 Their request was answered by the host's own pick → ONE notice that says so (in place of the change notice
  -- below, never both), even when the set the host picked is the one they already had.
  IF v_answered > 0 AND v_ev.marketplace_vendor_id IS NOT NULL THEN
    SELECT vp.user_id INTO v_owner FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_ev.marketplace_vendor_id;
    IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
      SELECT NULLIF(btrim(e.display_name), '') INTO v_host FROM public.events e WHERE e.event_id = v_ev.event_id;
      INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
      VALUES (
        v_owner,
        'supplier_where_changed'::public.notification_type,
        left(format('%s picked your chapters for you', COALESCE(v_host, 'The host')), 160),
        format(
          'Your request was answered by the host: you are on %s. Your price doesn’t change by itself — if it should, tell them in your chat.',
          CASE WHEN cardinality(v_names) = 0 THEN 'no chapter yet' ELSE array_to_string(v_names, ', ') END
        ),
        '/vendor-dashboard/clients/' || v_ev.event_id::text || '?tab=schedule',
        v_ev.event_id
      );
      v_told := true;
    END IF;
  END IF;

  -- 🔔 Booked, and the set changed (order never matters) → tell the shop's owner, in the app.
  IF v_answered = 0 AND v_booked
     AND v_ev.marketplace_vendor_id IS NOT NULL
     AND NOT (COALESCE(v_before, '{}'::uuid[]) @> v_ids AND v_ids @> COALESCE(v_before, '{}'::uuid[])) THEN
    SELECT vp.user_id INTO v_owner FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_ev.marketplace_vendor_id;
    IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
      SELECT NULLIF(btrim(e.display_name), '') INTO v_host FROM public.events e WHERE e.event_id = v_ev.event_id;
      INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
      VALUES (
        v_owner,
        'supplier_where_changed'::public.notification_type,
        left(format('%s changed where you go', COALESCE(v_host, 'The host')), 160),
        format(
          '%syou are now on %s. Your price doesn’t change by itself — if it should, tell them in your chat.',
          CASE WHEN p_covered_group IS NULL THEN '' ELSE initcap(replace(regexp_replace(p_covered_group, '^(label|tile):', ''), '_', ' ')) || ': ' END,
          CASE WHEN cardinality(v_names) = 0 THEN 'no chapter yet' ELSE array_to_string(v_names, ', ') END
        ),
        '/vendor-dashboard/clients/' || v_ev.event_id::text,
        v_ev.event_id
      );
      v_told := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_ev.event_id,
    'after_names', to_jsonb(v_names),
    'booked', v_booked,
    'shop', v_ev.marketplace_vendor_id,
    'covered_group', p_covered_group,
    'told', v_told,
    'answered_request', v_answered > 0,
    'before', to_jsonb(v_before),
    'after', to_jsonb(v_after)
  );
END;
$$;

COMMENT ON FUNCTION public.set_supplier_where(UUID, UUID[], TEXT) IS
  'The ONE door that writes a supplier''s Where (owner 2026-11-01): their chapters = top-level event_schedule_blocks whose responsible_vendor_ids hold them; an in-house group''s changed chapters = event_vendors.covered_where. Hosts only (current_couple_event_ids). Refuses a coordinator (on every chapter), a non-chapter, and an empty Where for a booked supplier while the event has chapters. A change to a BOOKED supplier writes ONE in-app notice (supplier_where_changed) to the shop owner — never email, never the actor; the price is never touched.';

REVOKE ALL ON FUNCTION public.set_supplier_where(UUID, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_supplier_where(UUID, UUID[], TEXT) TO authenticated;

COMMIT;
