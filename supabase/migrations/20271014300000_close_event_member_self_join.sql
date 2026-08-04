-- ============================================================================
-- CLOSE THE OPEN SELF-JOIN — the privilege escalation that turned every
-- "event member" check in the database into "anyone with a login".
--
-- THE HOLE
-- --------
-- public.event_members carried:
--
--   member_can_self_join  FOR INSERT TO authenticated WITH CHECK (
--     ((user_id = auth.uid()) AND (member_type = 'guest')
--       AND (guest_id IS NULL) AND (vendor_id IS NULL))
--     OR (event_id IN (SELECT current_couple_event_ids()))
--     OR is_admin())
--
-- The FIRST disjunct never constrains `event_id`. Any authenticated account
-- could therefore INSERT itself as a 'guest' of ANY event — no join token, no
-- invitation, no couple approval, no relationship of any kind.
--
-- That alone would be a nuisance. What makes it an escalation is
-- `current_event_ids()`, which has NO member_type filter:
--
--   SELECT event_id FROM public.event_members WHERE user_id = auth.uid();
--
-- So one forged row promotes the attacker into every
-- `event_id IN current_event_ids()` predicate in the schema. Measured against
-- production on 2026-07-27: **47 policies over 29 distinct tables** — 29 SELECT,
-- 8 UPDATE, 6 INSERT, 3 ALL, 1 DELETE. Among them, in RA 10173 terms:
--
--   • events                       — partner birth dates, budget, venue coords
--   • households                   — guest names + postal addresses
--   • user_reports                 — harassment reports, INCLUDING the reporter's
--                                    identity, readable by the person reported
--   • coordinator_access_consents  — the consent record lib/coordinator-money-
--                                    scope.ts reads to authorise CHECKOUT;
--                                    writable AND deletable by the attacker
--   • patiktok_source_clips        — another guest's media, repointable
--
-- THE FIX, AND WHY IT COSTS NOTHING
-- ---------------------------------
-- Drop the policy. It is not load-bearing: EVERY membership write in the app
-- goes through the service-role client, which bypasses RLS entirely — 14
-- mutating call sites, all `admin.from('event_members')` (join/accept,
-- create-event ×2, the three onboarding paths, guest-claim link, autosurface,
-- account-link, and the delete/update paths). The one database function that
-- inserts memberships, `finalize_guest_claim`, is SECURITY DEFINER and likewise
-- unaffected. Legitimate joining is gated in those server actions, where the
-- token is actually validated — which is where the check belongs, because RLS
-- cannot see a QR token.
--
-- Reads are untouched: `member_reads_membership` (user_id = auth.uid() OR couple
-- OR admin) still lets a member see their own row. This migration removes only
-- the ability to MINT a membership from the client.
--
-- ⚠ `current_event_ids()` is deliberately NOT narrowed here. Adding a
-- member_type filter would change the meaning of all 47 policies at once, and
-- legitimate guests are exactly the rows it must keep returning. Closing the
-- entry point is the surgical fix; the function's breadth is a separate design
-- question and should not ride along with a security patch.
--
-- Regression: tests/db/event-member-self-join.db.test.ts asserts the INSERT is
-- refused for a stranger, still permitted for the couple on their own event,
-- and that the downstream reads/writes it used to unlock are all denied.
-- ============================================================================

DROP POLICY IF EXISTS member_can_self_join ON public.event_members;

-- The couple's own legitimate INSERT path (adding members to an event they own)
-- was the SECOND disjunct of the dropped policy. It is preserved here on its
-- own, without the unconstrained self-join branch. `is_admin()` is kept for the
-- console. Note this is INSERT-only; UPDATE/DELETE already have their own
-- couple-scoped policies (couple_can_update_member / couple_can_delete_member).
CREATE POLICY couple_can_add_member
  ON public.event_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.event_members IS
  'Event membership. ⚠ There is deliberately NO client-side self-join policy: '
  'until 2026-07-27 `member_can_self_join` let any authenticated user insert '
  'itself as a guest of ANY event_id, which promoted them into every '
  '`event_id IN current_event_ids()` predicate (47 policies / 29 tables). '
  'Membership is minted ONLY by service-role server actions that validate a '
  'join token, or by the couple for their own event via couple_can_add_member.';
