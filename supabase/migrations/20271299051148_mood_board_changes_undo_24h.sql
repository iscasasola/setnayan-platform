-- ============================================================================
-- 20271299051148_mood_board_changes_undo_24h.sql
-- Created via `pnpm migration:new`. Idempotent.
--
-- 🖼⏱ MOOD BOARD CHANGES: SUPPLIERS ASK, COORDINATORS APPLY, THE OWNERS HAVE 24
-- HOURS TO UNDO (owner 2026-10-30, DECISION_LOG row of that name). Owner,
-- verbatim: *"Suppliers need approval and coordinators auto apply and owners of
-- the events has 24 hrs to undo that change"* — and, the same day: *"So the
-- changes made will show on home and the hosts need to approve it. Coordinators
-- can also approve the changes made by suppliers?"* → *"Yes we want that because
-- we can allow coordinators to give access to speficic parts of the app."*
--
-- ── WHAT 20271297714074 LEFT ───────────────────────────────────────────────
-- A person the hosts set to Mood Board Edit (current_moderator_area_levels
-- ('mood_board') = 'edit') writes event_inspiration_assets directly, as a host
-- does. Nothing recorded it, nobody was told, nothing could take it back.
--
-- ── WHERE A CHANGE IS RECORDED — NO EXISTING HOME FITS ────────────────────
-- Searched (2026-10-30): `/activity` (lib/activity.ts) is DERIVED from source
-- tables, it stores nothing; the audit tables (order/fraud/pax/price history)
-- are each one domain's append-only ledger with no undo; the guests' undo
-- (20271262484188) restores a deleted guest; the suggestion Keep's Undo
-- (couple_undo_kept_inspiration_suggestion) remembers ONE replaced row on the
-- suggestion itself. None records "who moved which photos, from where to
-- where" for a board. So: ONE table, `event_mood_board_changes`.
--
-- ── HOW A CHANGE IS CAUGHT — BY THE TABLE, NOT BY THE CALLER ───────────────
-- An AFTER trigger on event_inspiration_assets records every write by a person
-- who is NOT an owner of the event (not current_couple_event_ids(), not an
-- admin, not the service role): the row's slot_key · slot_position ·
-- removed_at BEFORE (its first sight in this change) and AFTER (its latest), or
-- "did not exist" for an upload's new row. A caller cannot skip it: a direct
-- PostgREST write is recorded exactly like the app's.
--   One change = one user action. The app's actions are several requests
--   (replace = soft-remove + insert; move = park + land), so the server action
--   OPENS the change first (`begin_mood_board_change`, which is also the photo
--   gate) and the trigger attaches every write by that person on that event in
--   the next 5 minutes to it. A write with no change open opens its own.
--
-- ── WHO IS TOLD ────────────────────────────────────────────────────────────
-- On a change's FIRST row, ONE notice per owner (every `couple` member — the
-- creator and every full co-host), type 'mood_board_changed', in-app only:
-- "Coordinator Ana changed the Mood Board · Stage". The owners' own changes
-- record nothing and tell nobody.
--
-- ── UNDO ───────────────────────────────────────────────────────────────────
-- `undo_mood_board_change(change)` is SECURITY INVOKER: the restore is written
-- under the OWNER'S own session, through 20271297469032's policies and its
-- three-column grant (removed_at · slot_key · slot_position) — no new write
-- path into the board. Two SECURITY DEFINER halves around it, each deciding in
-- SQL: `mood_board_change_undo_plan` (an owner of THIS event · within 24 hours
-- of the change · not undone · the board has not moved on) and
-- `mood_board_change_mark_undone` (marks it only once every row really is back
-- where it was). One transaction: a refused write rolls the whole Undo back.
--   🔑 THE BOARD MOVED ON → REFUSED IN WORDS, NEVER CLOBBERED: every row must
--   still be where this change left it, and no other photo may now hold a place
--   it would give back. Otherwise 'moved_on'.
--
-- ── SUPPLIER SUGGESTIONS ───────────────────────────────────────────────────
-- A booked supplier WITHOUT Edit still only suggests (vendor_begin_inspiration_
-- suggestion, unchanged). Keep / No thanks / the Keep toast's Undo now admit a
-- person with Mood Board Edit as well as the hosts (`can_change_mood_board_
-- photos` replaces `colour_access_caller_is_couple` in exactly those two
-- functions — that gate itself does NOT move: it still guards the colour
-- grants). A Keep by such a person is a recorded change like any other: the
-- owners are told and have 24 hours to Undo it (the suggestion then waits
-- again). Edit holders also READ the suggestions (one SELECT policy).
--
-- ── HOME ───────────────────────────────────────────────────────────────────
-- `mood_board_home_asks(event)` — ONE read for Home's Today list: the waiting
-- suggestions (for whoever may Keep them) and the last 24 hours of changes
-- (for the owners, who alone may Undo them).
--
-- In-app only: nothing here sends an email (owner rule — no new emails).
-- ⚠ Never apply directly to production — the pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · THE CHANGES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_mood_board_changes (
  change_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  actor_user_id      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  -- "Coordinator Ana" AS IT READ when the change was made — the notice's words.
  actor_label        TEXT NOT NULL,
  kind               TEXT NOT NULL
                       CONSTRAINT event_mood_board_changes_kind_chk
                       CHECK (kind IN ('upload', 'replace', 'move', 'remove', 'keep', 'change')),
  slot_key           TEXT NOT NULL,
  part_label         TEXT NOT NULL,
  -- A Keep of a supplier's suggestion: which one, and whose (the credit).
  suggestion_id      UUID REFERENCES public.event_inspiration_suggestions(suggestion_id) ON DELETE SET NULL,
  shop_label         TEXT,
  -- { "<inspiration_id>": { "before": {existed, slot_key, slot_position, removed_at},
  --                         "after":  {slot_key, slot_position, removed_at} } }
  touched            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The first row this change wrote (NULL = it changed nothing). The notices go
  -- then, and the 24 hours run from then.
  first_row_at       TIMESTAMPTZ,
  undone_at          TIMESTAMPTZ,
  undone_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT event_mood_board_changes_undone_after_change
    CHECK (undone_at IS NULL OR first_row_at IS NOT NULL)
);

COMMENT ON TABLE public.event_mood_board_changes IS
  'One Mood Board change by a person who is NOT an owner of the event (a coordinator, helper or supplier the hosts set '
  'to Mood Board Edit): who, when, which part, and the before/after of every photo row it touched. Written only by the '
  'event_inspiration_assets trigger and the SECURITY DEFINER functions of 20271299051148; read by the owners; undone '
  'within 24 hours by undo_mood_board_change (owner 2026-10-30, "THE OWNERS HAVE 24 HOURS TO UNDO").';

CREATE INDEX IF NOT EXISTS event_mood_board_changes_event_idx
  ON public.event_mood_board_changes (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_mood_board_changes_open_idx
  ON public.event_mood_board_changes (event_id, actor_user_id, created_at DESC)
  WHERE undone_at IS NULL;
CREATE INDEX IF NOT EXISTS event_mood_board_changes_suggestion_idx
  ON public.event_mood_board_changes (suggestion_id)
  WHERE suggestion_id IS NOT NULL;

ALTER TABLE public.event_mood_board_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_mood_board_changes_owner_read ON public.event_mood_board_changes;
CREATE POLICY event_mood_board_changes_owner_read
  ON public.event_mood_board_changes
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- The person who MADE a change reads their own record of it — what they did on somebody's board is their data too
-- (RA 10173: the personal-data export reads it author-scoped, as it reads event_colour_changes). Nobody else's.
DROP POLICY IF EXISTS event_mood_board_changes_actor_read ON public.event_mood_board_changes;
CREATE POLICY event_mood_board_changes_actor_read
  ON public.event_mood_board_changes
  FOR SELECT TO authenticated
  USING (actor_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS event_mood_board_changes_admin_all ON public.event_mood_board_changes;
CREATE POLICY event_mood_board_changes_admin_all
  ON public.event_mood_board_changes FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON TABLE public.event_mood_board_changes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_mood_board_changes FROM authenticated;

-- ── 2 · WHOSE WRITES ARE RECORDED ───────────────────────────────────────────
-- A signed-in person who is not an owner of this event and not an admin. The
-- service role (no auth.uid()) and the owners record nothing.
CREATE OR REPLACE FUNCTION public.mood_board_change_is_recorded_for(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_event_id IS NOT NULL
     AND (SELECT auth.uid()) IS NOT NULL
     AND p_event_id NOT IN (SELECT public.current_couple_event_ids())
     AND NOT public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.mood_board_change_is_recorded_for(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mood_board_change_is_recorded_for(UUID) TO authenticated;

-- ── 3 · OPEN A CHANGE (internal — no signed-in role may call it) ───────────
CREATE OR REPLACE FUNCTION public.mood_board_change_open(
  p_event_id      UUID,
  p_kind          TEXT,
  p_slot_key      TEXT,
  p_suggestion_id UUID DEFAULT NULL,
  p_shop_label    TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_name  TEXT;
  v_part  TEXT;
  v_id    UUID;
BEGIN
  -- The seat the hosts gave: a coordinator (the planner seat) or a helper.
  SELECT CASE WHEN m.role_subtype = 'wedding_planner_external' THEN 'Coordinator' ELSE 'Helper' END,
         NULLIF(btrim(m.display_label), '')
    INTO v_role, v_name
    FROM public.event_moderators m
   WHERE m.event_id = p_event_id AND m.user_id = v_uid
     AND m.accepted_at IS NOT NULL AND m.removed_at IS NULL
   ORDER BY (m.role_subtype = 'wedding_planner_external') DESC, m.accepted_at
   LIMIT 1;
  IF v_name IS NULL THEN
    SELECT NULLIF(btrim(u.display_name), '') INTO v_name FROM public.users u WHERE u.user_id = v_uid;
  END IF;

  SELECT NULLIF(btrim(p.label_en), '') INTO v_part FROM public.inspiration_parts p WHERE p.slot_key = p_slot_key;

  INSERT INTO public.event_mood_board_changes
    (event_id, actor_user_id, actor_label, kind, slot_key, part_label, suggestion_id, shop_label)
  VALUES (
    p_event_id, v_uid,
    left(btrim(COALESCE(v_role, 'Helper') || ' ' || COALESCE(v_name, 'Someone')), 80),
    p_kind, p_slot_key,
    COALESCE(v_part, initcap(replace(p_slot_key, '_', ' '))),
    p_suggestion_id, NULLIF(btrim(p_shop_label), '')
  )
  RETURNING change_id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mood_board_change_open(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 4 · THE SERVER ACTION'S DOOR: THE PHOTO GATE + OPEN THE CHANGE ─────────
-- One call, asked FIRST by every photo action: 'refused' (said in words by the
-- action) · 'host' (an owner — nothing recorded) · 'recorded' (a change is open).
CREATE OR REPLACE FUNCTION public.begin_mood_board_change(
  p_event_id UUID,
  p_kind     TEXT,
  p_slot_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  -- Who may write is asked BEFORE the shape of the request, so a refusal is never mistaken for bad input.
  IF NOT public.can_change_mood_board_photos(p_event_id) THEN
    RETURN jsonb_build_object('status', 'refused');
  END IF;
  IF p_kind IS NULL OR p_slot_key IS NULL OR p_kind NOT IN ('upload', 'replace', 'move', 'remove') THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  IF NOT public.mood_board_change_is_recorded_for(p_event_id) THEN
    RETURN jsonb_build_object('status', 'host');
  END IF;
  RETURN jsonb_build_object(
    'status', 'recorded',
    'change_id', public.mood_board_change_open(p_event_id, p_kind, p_slot_key)
  );
END;
$$;

COMMENT ON FUNCTION public.begin_mood_board_change(UUID, TEXT, TEXT) IS
  'Asked first by every Mood Board photo action (upload · replace · move · remove): refused unless '
  'can_change_mood_board_photos; ''host'' for an owner (nothing recorded); else opens the change the next writes attach '
  'to (20271299051148).';

REVOKE ALL ON FUNCTION public.begin_mood_board_change(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_mood_board_change(UUID, TEXT, TEXT) TO authenticated;

-- ── 5 · THE TRIGGER — EVERY NON-OWNER WRITE, RECORDED ──────────────────────
CREATE OR REPLACE FUNCTION public.mood_board_change_record_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_change  public.event_mood_board_changes%ROWTYPE;
  v_key     TEXT := NEW.inspiration_id::TEXT;
  v_before  JSONB;
  v_what    TEXT;
  v_opened  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  -- A Keep toast's Undo by the person who kept it closes their own change (§ 8).
  IF COALESCE(current_setting('app.mood_board_change_quiet', TRUE), '') = 'on' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.slot_key IS NOT DISTINCT FROM NEW.slot_key
     AND OLD.slot_position IS NOT DISTINCT FROM NEW.slot_position
     AND OLD.removed_at IS NOT DISTINCT FROM NEW.removed_at THEN
    RETURN NULL;
  END IF;
  IF NOT public.mood_board_change_is_recorded_for(NEW.event_id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_change
    FROM public.event_mood_board_changes c
   WHERE c.event_id = NEW.event_id AND c.actor_user_id = v_uid
     AND c.undone_at IS NULL AND c.created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY c.created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    -- Opened FIRST, into a variable: a volatile call inside the WHERE would run once per scanned row (and never on an
    -- empty table), and the row it inserts is not in that scan's snapshot.
    v_opened := public.mood_board_change_open(NEW.event_id, 'change', NEW.slot_key);
    SELECT * INTO v_change FROM public.event_mood_board_changes WHERE change_id = v_opened FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'mood_board_change_not_opened' USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_before := jsonb_build_object('existed', FALSE);
  ELSE
    v_before := jsonb_build_object(
      'existed', TRUE, 'slot_key', OLD.slot_key, 'slot_position', OLD.slot_position, 'removed_at', OLD.removed_at);
  END IF;

  -- An upload whose place was taken is a replace: the soft-remove of the photo there is its first write.
  IF v_change.kind = 'upload' AND TG_OP = 'UPDATE' THEN
    v_change.kind := 'replace';
  END IF;

  UPDATE public.event_mood_board_changes c
     SET kind = v_change.kind,
         touched = c.touched || jsonb_build_object(v_key, jsonb_build_object(
                     'before', COALESCE(c.touched -> v_key -> 'before', v_before),
                     'after', jsonb_build_object(
                       'slot_key', NEW.slot_key, 'slot_position', NEW.slot_position, 'removed_at', NEW.removed_at))),
         first_row_at = COALESCE(c.first_row_at, NOW())
   WHERE c.change_id = v_change.change_id;

  -- ONE notice per owner, on the change's first row.
  IF v_change.first_row_at IS NULL THEN
    v_what := CASE v_change.kind
      WHEN 'upload'  THEN 'Added a photo'
      WHEN 'replace' THEN 'Replaced a photo'
      WHEN 'move'    THEN 'Moved a photo'
      WHEN 'remove'  THEN 'Removed a photo'
      WHEN 'keep'    THEN 'Kept a photo from ' || COALESCE(v_change.shop_label, 'a supplier')
      ELSE 'Changed the photos'
    END;
    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    SELECT DISTINCT em.user_id,
           'mood_board_changed'::public.notification_type,
           left(format('%s changed the Mood Board · %s', v_change.actor_label, v_change.part_label), 160),
           v_what || '. You can undo it from Home for 24 hours.',
           '/dashboard/' || NEW.event_id::TEXT,
           NEW.event_id
      FROM public.event_members em
     WHERE em.event_id = NEW.event_id
       AND em.member_type = 'couple'
       AND em.user_id IS NOT NULL
       AND em.user_id <> v_uid;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mood_board_change_record_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_inspiration_assets_record_change ON public.event_inspiration_assets;
CREATE TRIGGER event_inspiration_assets_record_change
  AFTER INSERT OR UPDATE OF removed_at, slot_key, slot_position
  ON public.event_inspiration_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.mood_board_change_record_row();

-- ── 6 · UNDO — THE PLAN (definer: decides), THE RESTORE (invoker: writes) ──
CREATE OR REPLACE FUNCTION public.mood_board_change_undo_plan(p_change_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.event_mood_board_changes%ROWTYPE;
BEGIN
  IF p_change_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v FROM public.event_mood_board_changes WHERE change_id = p_change_id FOR UPDATE;
  -- 🔑 Only an OWNER of this event — not the coordinator, not an admin, not a co-planner.
  IF NOT FOUND OR v.event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;
  IF v.first_row_at IS NULL OR v.touched = '{}'::jsonb THEN
    RETURN jsonb_build_object('status', 'empty');
  END IF;
  -- 🔑 The 24 hours, on the server's clock.
  IF v.first_row_at <= NOW() - INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v.event_id::TEXT || ':board-undo', 0));

  -- 🔑 THE BOARD MOVED ON? Every row must be where this change left it…
  IF EXISTS (
    SELECT 1
      FROM jsonb_each(v.touched) r(id, x)
      LEFT JOIN public.event_inspiration_assets a ON a.inspiration_id = r.id::UUID
     WHERE a.inspiration_id IS NULL
        OR a.event_id <> v.event_id
        OR a.slot_key IS DISTINCT FROM (x -> 'after' ->> 'slot_key')
        OR a.slot_position::INT IS DISTINCT FROM (x -> 'after' ->> 'slot_position')::INT
        OR a.removed_at IS DISTINCT FROM (x -> 'after' ->> 'removed_at')::TIMESTAMPTZ
  )
  -- …and no other photo may now hold a place this Undo would give back.
  OR EXISTS (
    SELECT 1
      FROM jsonb_each(v.touched) r(id, x)
      JOIN public.event_inspiration_assets b
        ON b.event_id = v.event_id
       AND b.slot_key = (x -> 'before' ->> 'slot_key')
       AND b.slot_position::INT = (x -> 'before' ->> 'slot_position')::INT
       AND b.removed_at IS NULL
     WHERE (x -> 'before' ->> 'existed')::BOOLEAN
       AND (x -> 'before' ->> 'removed_at') IS NULL
       AND NOT (v.touched ? b.inspiration_id::TEXT)
  ) THEN
    RETURN jsonb_build_object('status', 'moved_on');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'event_id', v.event_id, 'touched', v.touched);
END;
$$;

REVOKE ALL ON FUNCTION public.mood_board_change_undo_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mood_board_change_undo_plan(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mood_board_change_mark_undone(p_change_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.event_mood_board_changes%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.event_mood_board_changes WHERE change_id = p_change_id FOR UPDATE;
  IF NOT FOUND OR v.event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v.undone_at IS NOT NULL OR v.first_row_at IS NULL THEN
    RAISE EXCEPTION 'not_undoable' USING ERRCODE = '55000';
  END IF;
  -- 🔑 Marked ONLY when every row really is back: a row that existed is exactly where it was; a row this change added
  -- is off the board. Calling this without the restore marks nothing.
  IF EXISTS (
    SELECT 1
      FROM jsonb_each(v.touched) r(id, x)
      LEFT JOIN public.event_inspiration_assets a ON a.inspiration_id = r.id::UUID
     WHERE a.inspiration_id IS NULL
        OR CASE WHEN (x -> 'before' ->> 'existed')::BOOLEAN
             THEN a.slot_key IS DISTINCT FROM (x -> 'before' ->> 'slot_key')
               OR a.slot_position::INT IS DISTINCT FROM (x -> 'before' ->> 'slot_position')::INT
               OR a.removed_at IS DISTINCT FROM (x -> 'before' ->> 'removed_at')::TIMESTAMPTZ
             ELSE a.removed_at IS NULL
           END
  ) THEN
    RAISE EXCEPTION 'not_restored' USING ERRCODE = '55000';
  END IF;

  UPDATE public.event_mood_board_changes
     SET undone_at = NOW(), undone_by_user_id = auth.uid()
   WHERE change_id = p_change_id;

  -- A coordinator's Keep, undone: the supplier's photo waits for an answer again.
  IF v.suggestion_id IS NOT NULL THEN
    UPDATE public.event_inspiration_suggestions
       SET state = 'waiting', decided_at = NULL, decided_by_user_id = NULL, replaced_inspiration_id = NULL
     WHERE suggestion_id = v.suggestion_id AND state = 'kept';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mood_board_change_mark_undone(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mood_board_change_mark_undone(UUID) TO authenticated;

-- The owner's Undo. SECURITY INVOKER: every board write below is the OWNER's own, under the board's RLS and its
-- three-column grant. Two passes, because the partial UNIQUE(event, slot_key, slot_position) WHERE removed_at IS NULL
-- would refuse a swap put back one row at a time: first every touched row steps OFF the board (taking its old place
-- while it is off), then the rows that were on the board come back on.
CREATE OR REPLACE FUNCTION public.undo_mood_board_change(p_change_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plan JSONB;
  r      RECORD;
  n      INT;
BEGIN
  v_plan := public.mood_board_change_undo_plan(p_change_id);
  IF v_plan ->> 'status' <> 'ok' THEN
    RETURN v_plan;
  END IF;

  FOR r IN SELECT e.id::UUID AS id, e.x FROM jsonb_each(v_plan -> 'touched') AS e(id, x) LOOP
    IF (r.x -> 'before' ->> 'existed')::BOOLEAN THEN
      UPDATE public.event_inspiration_assets
         SET slot_key = r.x -> 'before' ->> 'slot_key',
             slot_position = (r.x -> 'before' ->> 'slot_position')::SMALLINT,
             removed_at = COALESCE(removed_at, NOW())
       WHERE inspiration_id = r.id;
    ELSE
      UPDATE public.event_inspiration_assets
         SET removed_at = COALESCE(removed_at, NOW())
       WHERE inspiration_id = r.id;
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'undo_refused' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOR r IN SELECT e.id::UUID AS id, e.x FROM jsonb_each(v_plan -> 'touched') AS e(id, x)
            WHERE (e.x -> 'before' ->> 'existed')::BOOLEAN LOOP
    UPDATE public.event_inspiration_assets
       SET removed_at = (r.x -> 'before' ->> 'removed_at')::TIMESTAMPTZ
     WHERE inspiration_id = r.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'undo_refused' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  PERFORM public.mood_board_change_mark_undone(p_change_id);
  RETURN jsonb_build_object('status', 'ok', 'event_id', v_plan ->> 'event_id');
END;
$$;

COMMENT ON FUNCTION public.undo_mood_board_change(UUID) IS
  'An owner''s Undo of a non-owner''s Mood Board change, within 24 hours: puts every photo row it touched back exactly '
  'as it was, as the OWNER (SECURITY INVOKER — the board''s RLS and column grant decide every write). Answers already · '
  'empty · expired · moved_on without writing; raises not_your_event for anyone but an owner (20271299051148).';

REVOKE ALL ON FUNCTION public.undo_mood_board_change(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_mood_board_change(UUID) TO authenticated;

-- ── 7 · KEEP / NO THANKS — THE HOSTS, AND WHOEVER HAS MOOD BOARD EDIT ──────
-- Re-issued from 20271279311294 with two changes only: the gate is
-- can_change_mood_board_photos (the hosts + the Edit grant + admin — the hosts
-- and admin exactly as before) instead of colour_access_caller_is_couple, and a
-- Keep by a non-owner opens its recorded change first (kind 'keep').
CREATE OR REPLACE FUNCTION public.couple_decide_inspiration_suggestion(
  p_suggestion_id    UUID,
  p_keep             BOOLEAN,
  p_replace_position SMALLINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      public.event_inspiration_suggestions%ROWTYPE;
  v_pos      SMALLINT;
  v_replaced UUID;
  v_asset    UUID;
BEGIN
  IF p_suggestion_id IS NULL OR p_keep IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.event_inspiration_suggestions
   WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_change_mood_board_photos(v_row.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v_row.state <> 'waiting' THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;

  IF NOT p_keep THEN
    UPDATE public.event_inspiration_suggestions
       SET state = 'declined', decided_at = NOW(), decided_by_user_id = auth.uid()
     WHERE suggestion_id = p_suggestion_id;
    RETURN jsonb_build_object('status', 'ok', 'kept', FALSE);
  END IF;

  -- One writer per part at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.event_id::TEXT || ':board:' || v_row.slot_key, 0));

  IF p_replace_position IS NULL THEN
    SELECT p INTO v_pos
    FROM unnest(ARRAY[1, 2, 3]::SMALLINT[]) AS p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_inspiration_assets a
      WHERE a.event_id = v_row.event_id AND a.slot_key = v_row.slot_key
        AND a.slot_position = p AND a.removed_at IS NULL
    )
    ORDER BY p
    LIMIT 1;
    -- 🔑 FULL: nothing is replaced unless the couple names which photo.
    IF v_pos IS NULL THEN
      RETURN jsonb_build_object('status', 'full');
    END IF;
  ELSE
    IF p_replace_position NOT IN (1, 2, 3) THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_pos := p_replace_position;
  END IF;

  -- 🖼⏱ A Keep by a coordinator / helper / supplier with Mood Board Edit is a recorded change: the writes below attach
  -- to it (the trigger), the owners are told and have 24 hours to Undo it.
  IF public.mood_board_change_is_recorded_for(v_row.event_id) THEN
    PERFORM public.mood_board_change_open(v_row.event_id, 'keep', v_row.slot_key, v_row.suggestion_id, v_row.shop_label);
  END IF;

  IF p_replace_position IS NOT NULL THEN
    UPDATE public.event_inspiration_assets
       SET removed_at = NOW()
     WHERE event_id = v_row.event_id AND slot_key = v_row.slot_key
       AND slot_position = v_pos AND removed_at IS NULL
    RETURNING inspiration_id INTO v_replaced;
  END IF;

  INSERT INTO public.event_inspiration_assets
    (event_id, added_by_user_id, slot_key, slot_position, source_kind, from_suggestion_id,
     image_url, r2_key,
     sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
  VALUES
    (v_row.event_id, auth.uid(), v_row.slot_key, v_pos, 'supplier_suggestion', v_row.suggestion_id,
     v_row.image_url, v_row.r2_key,
     v_row.sampled_hex_1, v_row.sampled_hex_2, v_row.sampled_hex_3,
     v_row.sampled_hex_4, v_row.sampled_hex_5, v_row.sampled_hex_6)
  RETURNING inspiration_id INTO v_asset;

  UPDATE public.event_inspiration_suggestions
     SET state = 'kept', decided_at = NOW(), decided_by_user_id = auth.uid(),
         replaced_inspiration_id = v_replaced
   WHERE suggestion_id = p_suggestion_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'kept', TRUE,
    'inspiration_id', v_asset,
    'slot_position', v_pos,
    'replaced', v_replaced IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) IS
  '✓ Keep / ✕ No thanks on one waiting suggestion, by the hosts or anyone they set to Mood Board Edit '
  '(can_change_mood_board_photos, 20271299051148). Keep takes the part''s first free place; on a part holding three it '
  'answers ''full'' and CHANGES NOTHING unless p_replace_position names the photo to replace (soft-deleted, so Undo '
  'restores it). A Keep by a non-owner is a recorded change the owners may Undo for 24 hours.';

REVOKE ALL ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) TO authenticated;

-- ── 8 · THE KEEP TOAST'S UNDO — the same people ─────────────────────────────
-- Re-issued from 20271279311294: gate → can_change_mood_board_photos. When the
-- person who KEPT it (a non-owner) takes it back from their own toast, their
-- recorded change is closed with it (undone by them) instead of a second
-- change being recorded for the take-back.
CREATE OR REPLACE FUNCTION public.couple_undo_kept_inspiration_suggestion(
  p_suggestion_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    public.event_inspiration_suggestions%ROWTYPE;
  v_pos    SMALLINT;
  v_change UUID;
BEGIN
  IF p_suggestion_id IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.event_inspiration_suggestions
   WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_change_mood_board_photos(v_row.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v_row.state <> 'kept' THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.event_id::TEXT || ':board:' || v_row.slot_key, 0));

  IF public.mood_board_change_is_recorded_for(v_row.event_id) THEN
    SELECT c.change_id INTO v_change
      FROM public.event_mood_board_changes c
     WHERE c.suggestion_id = p_suggestion_id AND c.kind = 'keep'
       AND c.actor_user_id = auth.uid() AND c.undone_at IS NULL
     ORDER BY c.created_at DESC
     LIMIT 1
     FOR UPDATE;
    IF v_change IS NOT NULL THEN
      PERFORM set_config('app.mood_board_change_quiet', 'on', TRUE);
    END IF;
  END IF;

  UPDATE public.event_inspiration_assets
     SET removed_at = NOW()
   WHERE from_suggestion_id = p_suggestion_id AND removed_at IS NULL
  RETURNING slot_position INTO v_pos;

  -- The photo it replaced comes back — only into a place still free.
  IF v_row.replaced_inspiration_id IS NOT NULL THEN
    UPDATE public.event_inspiration_assets a
       SET removed_at = NULL
     WHERE a.inspiration_id = v_row.replaced_inspiration_id
       AND a.removed_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.event_inspiration_assets b
         WHERE b.event_id = a.event_id AND b.slot_key = a.slot_key
           AND b.slot_position = a.slot_position AND b.removed_at IS NULL
       );
  END IF;

  IF v_change IS NOT NULL THEN
    PERFORM set_config('app.mood_board_change_quiet', 'off', TRUE);
    UPDATE public.event_mood_board_changes
       SET undone_at = NOW(), undone_by_user_id = auth.uid()
     WHERE change_id = v_change AND first_row_at IS NOT NULL;
  END IF;

  UPDATE public.event_inspiration_suggestions
     SET state = 'waiting', decided_at = NULL, decided_by_user_id = NULL,
         replaced_inspiration_id = NULL
   WHERE suggestion_id = p_suggestion_id;

  RETURN jsonb_build_object('status', 'ok', 'slot_position', v_pos);
END;
$$;

REVOKE ALL ON FUNCTION public.couple_undo_kept_inspiration_suggestion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_undo_kept_inspiration_suggestion(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_undo_kept_inspiration_suggestion(UUID) TO authenticated;

-- ── 9 · EDIT HOLDERS READ THE SUGGESTIONS THEY MAY NOW ANSWER ───────────────
DROP POLICY IF EXISTS event_inspiration_suggestions_mood_board_editor_read ON public.event_inspiration_suggestions;
CREATE POLICY event_inspiration_suggestions_mood_board_editor_read
  ON public.event_inspiration_suggestions
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT l.event_id FROM public.current_moderator_area_levels('mood_board') l WHERE l.level = 'edit'
    )
  );

-- ── 10 · HOME — ONE READ FOR BOTH LISTS ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mood_board_home_asks(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_editor BOOLEAN;
  v_owner  BOOLEAN;
  v_sugg   JSONB := '[]'::jsonb;
  v_chg    JSONB := '[]'::jsonb;
BEGIN
  IF p_event_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('editor', FALSE, 'owner', FALSE, 'suggestions', v_sugg, 'changes', v_chg);
  END IF;
  v_editor := public.can_change_mood_board_photos(p_event_id);
  v_owner := p_event_id IN (SELECT public.current_couple_event_ids());

  IF v_editor THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'suggestion_id', s.suggestion_id,
             'slot_key', s.slot_key,
             'part_label', COALESCE(NULLIF(btrim(p.label_en), ''), initcap(replace(s.slot_key, '_', ' '))),
             'shop_label', s.shop_label,
             'image_url', s.image_url,
             'at', s.created_at
           ) ORDER BY s.created_at DESC), '[]'::jsonb)
      INTO v_sugg
      FROM (
        SELECT * FROM public.event_inspiration_suggestions
         WHERE event_id = p_event_id AND state = 'waiting'
         ORDER BY created_at DESC
         LIMIT 20
      ) s
      LEFT JOIN public.inspiration_parts p ON p.slot_key = s.slot_key;
  END IF;

  IF v_owner THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'change_id', c.change_id,
             'actor_label', c.actor_label,
             'kind', c.kind,
             'part_label', c.part_label,
             'shop_label', c.shop_label,
             'at', c.first_row_at,
             'undo_until', c.first_row_at + INTERVAL '24 hours'
           ) ORDER BY c.first_row_at DESC), '[]'::jsonb)
      INTO v_chg
      FROM (
        SELECT * FROM public.event_mood_board_changes
         WHERE event_id = p_event_id
           AND undone_at IS NULL
           AND first_row_at IS NOT NULL
           AND first_row_at > NOW() - INTERVAL '24 hours'
         ORDER BY first_row_at DESC
         LIMIT 20
      ) c;
  END IF;

  RETURN jsonb_build_object('editor', v_editor, 'owner', v_owner, 'suggestions', v_sugg, 'changes', v_chg);
END;
$$;

COMMENT ON FUNCTION public.mood_board_home_asks(UUID) IS
  'Home''s ONE Mood Board read: the waiting supplier suggestions (for whoever may Keep them — '
  'can_change_mood_board_photos) and the last 24 hours of non-owner changes not undone (for the owners, who alone may '
  'Undo them). 20271299051148.';

REVOKE ALL ON FUNCTION public.mood_board_home_asks(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mood_board_home_asks(UUID) TO authenticated;

-- ── 11 · POST-CONDITIONS ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'event_inspiration_assets_record_change' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'the Mood Board change trigger is missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.event_mood_board_changes', 'INSERT')
     OR has_table_privilege('authenticated', 'public.event_mood_board_changes', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.event_mood_board_changes', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated may write event_mood_board_changes directly';
  END IF;
  IF has_function_privilege('authenticated', 'public.mood_board_change_open(uuid, text, text, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated may open a Mood Board change directly';
  END IF;
  -- Nothing here may have widened what UPDATE reaches on the board.
  IF has_column_privilege('authenticated', 'public.event_inspiration_assets', 'image_url', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated may UPDATE event_inspiration_assets.image_url';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.undo_mood_board_change(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'undo_mood_board_change must be SECURITY INVOKER — the owner''s own write path';
  END IF;
END;
$$;

COMMIT;
