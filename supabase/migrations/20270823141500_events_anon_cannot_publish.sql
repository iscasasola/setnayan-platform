-- ============================================================================
-- Anonymous-draft onboarding · restrictive RLS: anon cannot publish or schedule
-- (anon-onboarding hardening PR-4 · 2026-07-18)
-- ============================================================================
--
-- WHY: a Supabase native anonymous user holds a real `authenticated` JWT, so a
-- determined actor could call the PostgREST API DIRECTLY (bypassing our server
-- actions and the PR-1 guards) and write their OWN event to
-- landing_page_visibility = 'public'/'unlisted' or set scheduled_launch_at —
-- which the read-time launch gate in app/[slug]/page.tsx would then turn into a
-- public, indexable page + a guest-email fan-out, before the account is secured
-- or RA 10173 consent is given. PR-1 guards the server-action path; this closes
-- the direct-API path at the database layer, per Supabase's anonymous-auth
-- access-control guidance (differentiate is_anonymous via auth.jwt(), enforce
-- with a RESTRICTIVE policy so it ANDs with — never weakens — the permissive
-- couple policies).
--
-- Both write paths are covered because the base policies are permissive:
--   authenticated_can_create_event  FOR INSERT  WITH CHECK (TRUE)   -- direct create
--   couple_can_update_event         FOR UPDATE  USING (couple|admin) -- direct publish
--
-- SCOPE: this ONLY forbids an ANONYMOUS principal from writing a NON-private
-- visibility or a scheduled launch. Every other event edit (names, date, guest
-- list, seating, mood board, …) stays open, so anon drafting is unaffected.
-- Permanent (secured) users and admins are NEVER restricted:
--   * anon JWT  → is_anonymous = 'true'  → must be private + no schedule
--   * secured   → is_anonymous = 'false' → IS NOT TRUE → unrestricted
--   * legacy/absent claim → NULL → NULL IS NOT TRUE → unrestricted (fail-open
--     for permanent accounts; we only ever restrict a KNOWN anonymous principal)
-- The onboarding commit + create-event insert through the service-role client
-- (RLS bypassed), so legitimate creation is unaffected either way.
--
-- SAFE TO APPLY BEFORE the feature flips on: with no anonymous users in the
-- system, the is_anonymous branch is never true, so both policies are a no-op
-- for every existing (permanent) account.
-- ============================================================================

BEGIN;

-- Direct-create vector: forbid an anon from INSERTing a non-private / scheduled event.
DROP POLICY IF EXISTS anon_cannot_create_public_event ON public.events;
CREATE POLICY anon_cannot_create_public_event ON public.events
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
    OR (landing_page_visibility = 'private' AND scheduled_launch_at IS NULL)
  );

-- Direct-publish vector: forbid an anon from UPDATEing an event to non-private /
-- scheduled. USING (TRUE) leaves row selection to the permissive policies; only
-- the resulting row values are constrained.
DROP POLICY IF EXISTS anon_cannot_publish_event ON public.events;
CREATE POLICY anon_cannot_publish_event ON public.events
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (TRUE)
  WITH CHECK (
    (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
    OR (landing_page_visibility = 'private' AND scheduled_launch_at IS NULL)
  );

COMMIT;
