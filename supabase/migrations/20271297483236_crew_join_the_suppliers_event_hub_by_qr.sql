-- ============================================================================
-- CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE ONLY THE EVENT HUB.
--
-- Owner, verbatim (2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB
-- BY QR — AND SEE ONLY THE EVENT HUB"): "they can create a qr code and the phone
-- of their crew can scan it to launch the event hub. since they are just crew,
-- they do not need to see today, customers and shop and the settings of their
-- event hub". Controller's calls, as approved with the v13 prototype:
--   (1) ONE crew QR per event per shop, on Hub › Crew;
--   (2) a scan opens that shop's Event Hub for THAT event only, with only the
--       tools the crew role allows (Member: run of show + scanner; Helper:
--       scanner only) — no Today, Customers, Shop, money or settings;
--   (3) no account needed: the first scan asks a name;
--   (4) the supplier taps Allow per new phone, so a forwarded QR admits nobody;
--   (5) the pass ends after the event; the supplier can remove a phone any time.
--
-- ── WHY NOT `vendor_event_access_grants` ────────────────────────────────────
-- That table (20270810694086) grants an ACCOUNT the shop's whole day-of console,
-- and five live policies read it (`current_vendor_dayof_grant_event_ids()` and
-- the song desk's EXISTS — measured in 20271228546306). A crew pass must open
-- LESS than that, must END on its own, and is held by a phone that may have no
-- account but an anonymous one. Writing crew into that table would hand a
-- helper with "scanner only" the band's song desk. So a crew pass is its OWN
-- row, read by NO existing policy, and every crew read goes through the two
-- SECURITY DEFINER functions below — each scoped to ONE event and ONE shop.
--
-- ── WHAT A CREW PHONE CAN READ — the whole list ────────────────────────────
--   · its OWN pass row (RLS: crew_user_id = auth.uid());
--   · `current_vendor_crew_pass(event)` — its own pass for that event, effective
--     or not, and nothing about anybody else;
--   · `crew_seat_by_guest_qr(event, token)` — ONE guest's table label for a QR
--     it is physically holding, under the coordinator scanner's own gates plus
--     an allowed, unexpired pass. Never a name, never a list.
-- Nothing else: no grant, membership or moderator row is written, so every
-- existing policy still answers "no" for a crew user. `crew-pass-sees-only-its-
-- event.db.test.ts` proves it as the crew session.
--
-- RLS at CREATE TABLE time; idempotent; no data touched.
-- ============================================================================

BEGIN;

-- ── 1 · the crew QR — one per (shop, event) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_crew_codes (
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- 32 lowercase hex chars (16 random bytes). Rotating it kills the printed QR;
  -- phones already allowed keep their pass.
  token             TEXT NOT NULL UNIQUE
                    DEFAULT encode(extensions.gen_random_bytes(16), 'hex')
                    CHECK (token ~ '^[0-9a-f]{32}$'),
  -- When every pass under this QR ends: the midnight after the event's last day,
  -- Philippine time. DERIVED by the trigger below from `events` — never written
  -- by a client, so a pass cannot be stretched past the event.
  ends_at           TIMESTAMPTZ NOT NULL,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, event_id)
);

COMMENT ON TABLE public.vendor_crew_codes IS
  'The crew QR — ONE per (shop, event) (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER''S EVENT HUB BY QR"). A phone that scans it asks to join (crew_pass_request); the shop''s admin Allows it. ends_at is derived from the event''s dates by trigger. Shop admins manage it; crew never read it.';

-- ── 2 · the crew passes — one per (shop, event, phone's account) ───────────
CREATE TABLE IF NOT EXISTS public.vendor_crew_passes (
  pass_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL,
  event_id          UUID NOT NULL,
  -- The phone's account — an anonymous one when the crew member has none.
  crew_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60),
  crew_role         TEXT NOT NULL DEFAULT 'helper' CHECK (crew_role IN ('member', 'helper')),
  status            TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'allowed', 'removed')),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at        TIMESTAMPTZ,
  decided_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Turning the crew QR off (deleting it) ends every pass under it.
  FOREIGN KEY (vendor_profile_id, event_id)
    REFERENCES public.vendor_crew_codes(vendor_profile_id, event_id) ON DELETE CASCADE,
  UNIQUE (vendor_profile_id, event_id, crew_user_id)
);

CREATE INDEX IF NOT EXISTS vendor_crew_passes_crew_idx
  ON public.vendor_crew_passes (crew_user_id, event_id);

COMMENT ON TABLE public.vendor_crew_passes IS
  'A crew member''s pass into ONE shop''s Event Hub for ONE event (owner 2026-10-29). Written only by crew_pass_request (SECURITY DEFINER); the shop''s admin Allows / removes / sets the role (member = run of show + scanner, helper = scanner only). Ends with its crew QR''s ends_at. Read by no other table''s policy — a crew pass opens nothing but what current_vendor_crew_pass and crew_seat_by_guest_qr return.';

-- ── 3 · triggers: derived end, immutable identity, who decided ─────────────

-- The end of the event, Philippine time: the midnight after its last day.
-- No date yet → refused: a crew pass needs a day to end on.
CREATE OR REPLACE FUNCTION public.vendor_crew_codes_derive_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last DATE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.vendor_profile_id IS DISTINCT FROM OLD.vendor_profile_id
                           OR NEW.event_id IS DISTINCT FROM OLD.event_id) THEN
    RAISE EXCEPTION 'a crew QR cannot be moved to another shop or event' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(e.event_end_date, e.event_date) INTO v_last
    FROM public.events e WHERE e.event_id = NEW.event_id;
  IF v_last IS NULL THEN
    RAISE EXCEPTION 'the event has no date yet — a crew pass needs a day to end on' USING ERRCODE = '22023';
  END IF;
  NEW.ends_at := ((v_last + 1)::timestamp AT TIME ZONE 'Asia/Manila');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    -- Who issued it never changes — except to NULL, which is the FK's own ON DELETE SET NULL when that account is
    -- erased (forcing OLD back here would make the account undeletable).
    IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      NEW.created_by := OLD.created_by;
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;

-- A trigger function is not a door: nobody calls it (a trigger needs no EXECUTE to fire).
REVOKE ALL ON FUNCTION public.vendor_crew_codes_derive_end() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_crew_codes_derive_end ON public.vendor_crew_codes;
CREATE TRIGGER vendor_crew_codes_derive_end
  BEFORE INSERT OR UPDATE ON public.vendor_crew_codes
  FOR EACH ROW EXECUTE FUNCTION public.vendor_crew_codes_derive_end();

-- RLS IS ROW-LEVEL, NEVER VALUE-LEVEL (20271228546306): the admin's UPDATE may
-- change only the decision — status and role. Who asked, for which shop and
-- event, under what name and when, never moves. A refusal RAISES (a zero-row
-- update would be indistinguishable from "done").
CREATE OR REPLACE FUNCTION public.vendor_crew_passes_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_profile_id IS DISTINCT FROM OLD.vendor_profile_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.crew_user_id IS DISTINCT FROM OLD.crew_user_id
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'a crew pass cannot be moved' USING ERRCODE = '42501';
  END IF;
  -- The name is the crew member's own: only their own (re)request changes it.
  IF NEW.display_name IS DISTINCT FROM OLD.display_name AND auth.uid() IS DISTINCT FROM OLD.crew_user_id THEN
    RAISE EXCEPTION 'only the crew member names themselves' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.crew_role IS DISTINCT FROM OLD.crew_role THEN
    NEW.decided_at := NOW();
    NEW.decided_by := auth.uid();
  ELSE
    NEW.decided_at := OLD.decided_at;
    -- The decider's stamp may only go to NULL — the FK's ON DELETE SET NULL when that account is erased.
    IF NEW.decided_by IS NOT NULL THEN
      NEW.decided_by := OLD.decided_by;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.vendor_crew_passes_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_crew_passes_guard ON public.vendor_crew_passes;
CREATE TRIGGER vendor_crew_passes_guard
  BEFORE UPDATE ON public.vendor_crew_passes
  FOR EACH ROW EXECUTE FUNCTION public.vendor_crew_passes_guard();

-- ── 4 · RLS at create time ─────────────────────────────────────────────────
ALTER TABLE public.vendor_crew_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_crew_passes ENABLE ROW LEVEL SECURITY;

-- Nobody signed out touches either table; the crew's way in is the RPC below.
REVOKE ALL ON public.vendor_crew_codes FROM anon;
REVOKE ALL ON public.vendor_crew_passes FROM anon;
-- A crew pass is never INSERTed by a browser, nor deleted (removal is a status).
REVOKE INSERT, DELETE ON public.vendor_crew_passes FROM authenticated;

-- The crew QR: the shop's admins, on events the shop is booked on (the same
-- fence as vendor_event_access_grants_manage_insert).
DROP POLICY IF EXISTS vendor_crew_codes_admin_read ON public.vendor_crew_codes;
CREATE POLICY vendor_crew_codes_admin_read
  ON public.vendor_crew_codes FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_crew_codes_admin_insert ON public.vendor_crew_codes;
CREATE POLICY vendor_crew_codes_admin_insert
  ON public.vendor_crew_codes FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids('admin'))
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

DROP POLICY IF EXISTS vendor_crew_codes_admin_update ON public.vendor_crew_codes;
CREATE POLICY vendor_crew_codes_admin_update
  ON public.vendor_crew_codes FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_crew_codes_admin_delete ON public.vendor_crew_codes;
CREATE POLICY vendor_crew_codes_admin_delete
  ON public.vendor_crew_codes FOR DELETE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_crew_codes_platform_admin_read ON public.vendor_crew_codes;
CREATE POLICY vendor_crew_codes_platform_admin_read
  ON public.vendor_crew_codes FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- The passes: the shop's admins read and decide; a crew member reads ONLY their own.
DROP POLICY IF EXISTS vendor_crew_passes_admin_read ON public.vendor_crew_passes;
CREATE POLICY vendor_crew_passes_admin_read
  ON public.vendor_crew_passes FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_crew_passes_own_read ON public.vendor_crew_passes;
CREATE POLICY vendor_crew_passes_own_read
  ON public.vendor_crew_passes FOR SELECT TO authenticated
  USING (crew_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS vendor_crew_passes_admin_update ON public.vendor_crew_passes;
CREATE POLICY vendor_crew_passes_admin_update
  ON public.vendor_crew_passes FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_crew_passes_platform_admin_read ON public.vendor_crew_passes;
CREATE POLICY vendor_crew_passes_platform_admin_read
  ON public.vendor_crew_passes FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- ── 5 · the crew's three doors (SECURITY DEFINER, one event, one shop) ──────

-- Is this shop still booked on this event (the shipped "booked" set)?
CREATE OR REPLACE FUNCTION public.crew_shop_is_booked(p_vendor_profile_id UUID, p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = p_vendor_profile_id
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  );
$$;
REVOKE ALL ON FUNCTION public.crew_shop_is_booked(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- (a) A phone asks to join. Signed in (an anonymous account is enough); the QR
--     must be live and its shop still booked. A phone already asked keeps its
--     row (re-asking only updates the name while it waits); a removed phone
--     stays removed. A shop's own people are told to use their own access.
CREATE OR REPLACE FUNCTION public.crew_pass_request(p_token TEXT, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code public.vendor_crew_codes%ROWTYPE;
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_pass public.vendor_crew_passes%ROWTYPE;
  v_waiting INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  SELECT * INTO v_code FROM public.vendor_crew_codes WHERE token = p_token;
  IF NOT FOUND OR NOT public.crew_shop_is_booked(v_code.vendor_profile_id, v_code.event_id) THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  IF NOW() >= v_code.ends_at THEN
    RETURN jsonb_build_object('status', 'ended');
  END IF;
  IF v_code.vendor_profile_id IN (
       SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = v_uid
       UNION
       SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = v_uid) THEN
    RETURN jsonb_build_object('status', 'team', 'event_id', v_code.event_id);
  END IF;

  SELECT * INTO v_pass FROM public.vendor_crew_passes
   WHERE vendor_profile_id = v_code.vendor_profile_id AND event_id = v_code.event_id AND crew_user_id = v_uid;
  IF FOUND THEN
    IF v_pass.status = 'waiting' AND char_length(v_name) BETWEEN 1 AND 60 AND v_name <> v_pass.display_name THEN
      UPDATE public.vendor_crew_passes SET display_name = v_name WHERE pass_id = v_pass.pass_id;
    END IF;
    RETURN jsonb_build_object('status', v_pass.status, 'event_id', v_code.event_id, 'crew_role', v_pass.crew_role);
  END IF;

  IF char_length(v_name) NOT BETWEEN 1 AND 60 THEN
    RETURN jsonb_build_object('status', 'needs_name');
  END IF;
  -- A forwarded QR cannot flood the shop's Allow list.
  SELECT COUNT(*) INTO v_waiting FROM public.vendor_crew_passes
   WHERE vendor_profile_id = v_code.vendor_profile_id AND event_id = v_code.event_id AND status = 'waiting';
  IF v_waiting >= 30 THEN
    RETURN jsonb_build_object('status', 'full');
  END IF;
  INSERT INTO public.vendor_crew_passes (vendor_profile_id, event_id, crew_user_id, display_name)
  VALUES (v_code.vendor_profile_id, v_code.event_id, v_uid, v_name);
  RETURN jsonb_build_object('status', 'waiting', 'event_id', v_code.event_id, 'crew_role', 'helper');
END $$;
REVOKE ALL ON FUNCTION public.crew_pass_request(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_pass_request(TEXT, TEXT) TO authenticated;

-- (b) The caller's OWN pass for ONE event — and whether it opens anything now:
--     allowed, before its end, and the shop still booked.
CREATE OR REPLACE FUNCTION public.current_vendor_crew_pass(p_event_id UUID)
RETURNS TABLE (
  vendor_profile_id UUID,
  display_name TEXT,
  crew_role TEXT,
  status TEXT,
  ends_at TIMESTAMPTZ,
  effective BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.vendor_profile_id, p.display_name, p.crew_role, p.status, c.ends_at,
         (p.status = 'allowed' AND NOW() < c.ends_at
          AND public.crew_shop_is_booked(p.vendor_profile_id, p.event_id)) AS effective
    FROM public.vendor_crew_passes p
    JOIN public.vendor_crew_codes c
      ON c.vendor_profile_id = p.vendor_profile_id AND c.event_id = p.event_id
   WHERE p.event_id = p_event_id
     AND p.crew_user_id = auth.uid()
   ORDER BY (p.status = 'allowed') DESC, p.requested_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_vendor_crew_pass(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_vendor_crew_pass(UUID) TO authenticated;

-- The hosts' answer for one area, for ONE named person — the SAME per-row rule
-- as moderator_area_level (20271166697898), which asks it of auth.uid(). Not
-- callable by anyone: only the crew scanner below asks it, of the person who
-- issued the crew QR. `crew-pass-sees-only-its-event.db.test.ts` proves the two
-- agree on every branch.
CREATE OR REPLACE FUNCTION public.moderator_area_level_of(p_event_id UUID, p_user_id UUID, p_area TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN m.permissions_json -> 'areas' ? p_area
      THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
    WHEN m.permissions_json ? 'areas'
      THEN NULL
    WHEN p_area = 'budget'
      THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                THEN 'view' ELSE NULL END
    WHEN p_area = 'mood_board' THEN 'view'
    WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
      THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                THEN 'edit' ELSE 'view' END
    ELSE NULL
  END
  FROM public.event_moderators m
  WHERE m.event_id = p_event_id
    AND m.user_id = p_user_id
    AND m.accepted_at IS NOT NULL
    AND m.removed_at IS NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.moderator_area_level_of(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- (c) The crew's scanner: ONE guest's table for a QR the crew member is holding.
--     The coordinator scanner's own gates (coordinator_seat_by_guest_qr), asked
--     of the SHOP and the person who issued the QR instead of the caller, plus
--     an effective pass. Same answer shape: found + table label, nothing else.
CREATE OR REPLACE FUNCTION public.crew_seat_by_guest_qr(p_event_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
  v_issuer UUID;
  v_guest_id UUID;
  v_table_label TEXT;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  -- 1 · an allowed, unexpired pass on THIS event
  SELECT p.vendor_profile_id, c.created_by INTO v_shop, v_issuer
    FROM public.vendor_crew_passes p
    JOIN public.vendor_crew_codes c
      ON c.vendor_profile_id = p.vendor_profile_id AND c.event_id = p.event_id
   WHERE p.event_id = p_event_id
     AND p.crew_user_id = auth.uid()
     AND p.status = 'allowed'
     AND NOW() < c.ends_at
   LIMIT 1;
  IF v_shop IS NULL THEN
    RAISE EXCEPTION 'no_crew_pass' USING ERRCODE = '42501';
  END IF;

  -- 2 + 3 · that shop is booked on THIS event, carrying the coordinator tile
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = v_shop
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND public.services_make_a_coordinator(vp.services)
  ) THEN
    RAISE EXCEPTION 'not_the_coordinator' USING ERRCODE = '42501';
  END IF;

  -- 4 · the hosts shared the seat plan with the person who issued the crew QR
  IF v_issuer IS NULL OR public.moderator_area_level_of(p_event_id, v_issuer, 'seat_plan') IS NULL THEN
    RAISE EXCEPTION 'seat_plan_not_shared' USING ERRCODE = '42501';
  END IF;

  -- 5 · guests may see their seats now — the ONE seat rule
  IF NOT public.guests_may_see_seats(p_event_id) THEN
    RAISE EXCEPTION 'not_published' USING ERRCODE = 'P0002';
  END IF;

  SELECT g.guest_id INTO v_guest_id
    FROM public.guests g
   WHERE g.qr_token = p_token AND g.event_id = p_event_id AND g.deleted_at IS NULL;
  IF v_guest_id IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  SELECT et.table_label INTO v_table_label
    FROM public.event_seat_assignments a
    JOIN public.event_tables et ON et.table_id = a.table_id
   WHERE a.event_id = p_event_id AND a.guest_id = v_guest_id;

  RETURN jsonb_build_object('found', TRUE, 'table_label', v_table_label);
END $$;
REVOKE ALL ON FUNCTION public.crew_seat_by_guest_qr(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_seat_by_guest_qr(UUID, TEXT) TO authenticated;

COMMIT;
