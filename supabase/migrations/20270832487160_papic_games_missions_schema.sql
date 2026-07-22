-- Papic Games / Photo Challenge — Phase 1 schema (missions + completions).
-- Spec: ~/Documents/Claude/Projects/Setnayan/0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md
-- Flag-gated by NEXT_PUBLIC_PAPIC_GAMES_V1 (default OFF); no behaviour ships in this migration.
-- Follows the Papic convention: id BIGSERIAL PK + <x>_id UUID UNIQUE public key; event_id cascade;
-- guest-facing writes go through SECURITY DEFINER RPCs (later phase) — tables carry only couple/
-- coordinator + admin policies (guests are the zero-account model, identified by guest_id, never auth.uid()).

BEGIN;

-- ============================================================================
-- 1) papic_missions — a mission on an event (auto from event_vendors, or couple/vendor authored).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.papic_missions (
  id             BIGSERIAL PRIMARY KEY,
  mission_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  mission_type   TEXT NOT NULL CHECK (mission_type IN
                   ('prompt','roster','video_greeting','toast_or_dance','vendor_booth','face_verified')),
  -- how the mission came to exist: auto-generated from event_vendors, couple-authored, or vendor-authored.
  source         TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','couple','vendor')),
  -- BOOKED-VENDORS-ONLY (spec §3.3): a booth/custom mission may only name a vendor the couple hired.
  -- Enforced in the auto-gen + vendor-authoring RPCs (later phase); the FK guarantees it's an event_vendor.
  vendor_id      UUID REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  prompt         TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 280),
  -- optional targeting (roster missions): a specific guest and/or a role class.
  target_guest_id UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  target_role    public.guest_role,
  -- couple approval (spec §3.6): auto/couple missions are pre-approved; vendor custom copy lands false
  -- until the couple taps approve (the vendor-authoring RPC will insert approved=false).
  approved       BOOLEAN NOT NULL DEFAULT true,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.papic_missions IS 'Papic game missions (spec §5). Booth/custom missions name only booked event_vendors (§3.3); vendor custom copy needs couple approval (§3.6). Guests read via a later SECURITY DEFINER RPC.';

CREATE INDEX IF NOT EXISTS idx_papic_missions_event ON public.papic_missions (event_id);
CREATE INDEX IF NOT EXISTS idx_papic_missions_vendor ON public.papic_missions (vendor_id);

ALTER TABLE public.papic_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS papic_missions_member_all ON public.papic_missions;
CREATE POLICY papic_missions_member_all ON public.papic_missions
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.event_members em
               WHERE em.event_id = papic_missions.event_id
                 AND em.user_id = auth.uid()
                 AND em.member_type IN ('couple','coordinator'))
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.event_members em
               WHERE em.event_id = papic_missions.event_id
                 AND em.user_id = auth.uid()
                 AND em.member_type IN ('couple','coordinator'))
  );
-- (Auto-generation + vendor authoring run server-side / via SECURITY DEFINER RPCs; guest reads via RPC.)

-- ============================================================================
-- 2) papic_mission_completions — a guest completed a mission (one per guest per mission).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.papic_mission_completions (
  id               BIGSERIAL PRIMARY KEY,
  completion_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  mission_id       UUID NOT NULL REFERENCES public.papic_missions(mission_id) ON DELETE CASCADE,
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE, -- denormalized for RLS + queries
  guest_id         UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  capture_id       UUID REFERENCES public.papic_guest_captures(capture_id) ON DELETE SET NULL,
  -- §4 per-photo consent: the guest explicitly taps "Share this photo with <vendor>" at completion.
  -- RA 10173: explicit opt-in, never inferred from completion; DEFAULT false.
  consent_to_share BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, guest_id)
);
COMMENT ON TABLE public.papic_mission_completions IS 'A guest completing a Papic mission (spec §5). consent_to_share = the §4 per-photo tap that lets a photo reach the vendor (RA 10173, explicit opt-in). Guest writes via a later SECURITY DEFINER RPC.';

CREATE INDEX IF NOT EXISTS idx_papic_mission_completions_mission ON public.papic_mission_completions (mission_id);
CREATE INDEX IF NOT EXISTS idx_papic_mission_completions_event ON public.papic_mission_completions (event_id);
CREATE INDEX IF NOT EXISTS idx_papic_mission_completions_guest ON public.papic_mission_completions (guest_id);

ALTER TABLE public.papic_mission_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS papic_mission_completions_member_read ON public.papic_mission_completions;
CREATE POLICY papic_mission_completions_member_read ON public.papic_mission_completions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.event_members em
               WHERE em.event_id = papic_mission_completions.event_id
                 AND em.user_id = auth.uid()
                 AND em.member_type IN ('couple','coordinator'))
  );

DROP POLICY IF EXISTS papic_mission_completions_admin_all ON public.papic_mission_completions;
CREATE POLICY papic_mission_completions_admin_all ON public.papic_mission_completions
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- (Guests record completions via a later SECURITY DEFINER RPC granted to anon — mirrors papic_record_guest_capture.
--  Vendor-side reads of completion counts + consented photos are a later phase, DPO-gated.)

-- ============================================================================
-- 3) Same-event guard — a mission's optional vendor_id / target_guest_id MUST
--    belong to the SAME event as the mission. The FKs prove existence, not
--    same-event scoping; the couple/coordinator member policy is FOR ALL, so a
--    direct INSERT/UPDATE could otherwise attach another event's vendor
--    (violating booked-vendors-only §3.3) or another event's guest. Enforced
--    here at the DB level, regardless of write path (direct member write, RPC,
--    or service_role auto-gen).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.papic_missions_same_event_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_id IS NOT NULL
     AND (SELECT event_id FROM public.event_vendors WHERE vendor_id = NEW.vendor_id)
         IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'papic_missions.vendor_id % is not a vendor of event %', NEW.vendor_id, NEW.event_id;
  END IF;
  IF NEW.target_guest_id IS NOT NULL
     AND (SELECT event_id FROM public.guests WHERE guest_id = NEW.target_guest_id)
         IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'papic_missions.target_guest_id % is not a guest of event %', NEW.target_guest_id, NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papic_missions_same_event_guard_trg ON public.papic_missions;
CREATE TRIGGER papic_missions_same_event_guard_trg
  BEFORE INSERT OR UPDATE ON public.papic_missions
  FOR EACH ROW EXECUTE FUNCTION public.papic_missions_same_event_guard();

COMMIT;
