-- ============================================================================
-- 20270729120000_coordinator_access_consents.sql
--
-- RA 10173 consent record for the coordinator host-invite flow.
-- Spec: corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 3a
-- ("Consent gate at coordinator lock (RA 10173) — the grant half").
--
-- WHY: bringing a coordinator into an event grants them read parity over the
-- couple's planning surfaces — including GUEST PII (guest list, RSVP, seating).
-- Before the couple sends a coordinator (wedding_planner_external) host invite,
-- they must give an explicit data-privacy consent. This table is the audit
-- record of that consent — the *grant* half that mirrors the shipped
-- revoke-with-reason (event_moderators.removed_at + reason). It parallels
-- thread_join_authorizations (per-thread chat-join audit) at the event scope.
--
-- The consent is captured at INVITE-CREATION (the couple's explicit share
-- decision). Access itself only begins when the coordinator accepts the invite
-- (/host/accept), so consent precedes access.
--
-- ENFORCEMENT is behind the NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED flag
-- (default OFF) pending DPO review of two open sub-decisions (biometric
-- scope-out · decline-path lawful basis). This migration ships the record
-- regardless — an empty, harmless table until the flag flips.
--
-- Idempotent: CREATE TABLE / INDEX / POLICY all IF NOT EXISTS / DROP-then-CREATE.
-- No data mutation; reversible by DROP TABLE public.coordinator_access_consents.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.coordinator_access_consents (
  id                    BIGSERIAL PRIMARY KEY,
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The pending host invite this consent authorizes. SET NULL (not CASCADE) so
  -- the consent audit survives even if the invite row is later deleted.
  moderator_id          UUID REFERENCES public.event_moderators(moderator_id) ON DELETE SET NULL,
  -- The couple/host member who gave consent.
  consented_by_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Denormalised so the audit row is self-describing if the invite is gone.
  coordinator_email     TEXT,
  coordinator_label     TEXT,
  -- Which version of the disclosed scope was consented to (guest list · seating
  -- · schedule · vendor chats; budget/payments excluded). Bump when scope changes.
  scope_version         TEXT NOT NULL DEFAULT 'v1',
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Stamped when the couple later removes the coordinator's access.
  revoked_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS coordinator_access_consents_event_idx
  ON public.coordinator_access_consents (event_id);

CREATE INDEX IF NOT EXISTS coordinator_access_consents_moderator_idx
  ON public.coordinator_access_consents (moderator_id)
  WHERE moderator_id IS NOT NULL;

ALTER TABLE public.coordinator_access_consents ENABLE ROW LEVEL SECURITY;

-- Event-scoped host read (couple/host sees the consent log for their own event);
-- admin observes. Pattern B (current_event_ids()).
DROP POLICY IF EXISTS coordinator_access_consents_host_select ON public.coordinator_access_consents;
CREATE POLICY coordinator_access_consents_host_select
  ON public.coordinator_access_consents FOR SELECT
  TO authenticated
  USING ( event_id IN (SELECT public.current_event_ids()) OR public.is_admin() );

-- Writes go through an admin client in the server action (like the invite
-- insert), but scope the RLS write path to hosts anyway for defense-in-depth.
DROP POLICY IF EXISTS coordinator_access_consents_host_write ON public.coordinator_access_consents;
CREATE POLICY coordinator_access_consents_host_write
  ON public.coordinator_access_consents FOR ALL
  TO authenticated
  USING  ( event_id IN (SELECT public.current_event_ids()) OR public.is_admin() )
  WITH CHECK ( event_id IN (SELECT public.current_event_ids()) OR public.is_admin() );

COMMENT ON TABLE public.coordinator_access_consents IS
  'RA 10173 consent record: the couple''s explicit data-privacy consent to share event planning data (guest list · seating · schedule · vendor chats; budget excluded) with a coordinator, captured when the coordinator host invite is created. Audit/grant half of the coordinator access model; enforcement behind NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED (default OFF, DPO-gated). See corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 3a.';

COMMIT;
