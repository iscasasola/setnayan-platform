-- ═══════════════════════════════════════════════════════════════════════════
-- A HOST CAN ACTUALLY SHARE, AND TAKE BACK, A COORDINATOR'S ACCESS.
--
-- 🔴 WHAT WAS WRONG, MEASURED IN PRODUCTION BY THE OBJECT (2026-09-09):
--   event_moderators — RLS enabled, 5 LIVE ROWS, and exactly ONE policy:
--     event_moderators_select_own_events  [r]   ← SELECT only
--   while `authenticated` holds INSERT, UPDATE and DELETE grants with no policy
--   behind any of them. So every write the host's own screen makes is refused:
--     • GRANTING throws 42501 and the host reads a raw Postgres sentence.
--     • REVOKING matches ZERO ROWS and returns error = NULL, so the action's
--       `if (error)` never fires and it reports SUCCESS.
--   ⇒ A host who takes the guest list back from a coordinator is told it worked
--   and keeps handing it over. The screen ships and is reachable from the event
--   dashboard and from the supplier's day-of screen.
--
-- 🔑 A REFUSED WRITE IS NOT A THROWN ERROR. An UPDATE with no matching policy is
-- not an error — it is an update of nothing. This is the same family as the
-- phantom column, the phantom enum value, the phantom RPC argument and the
-- blocked iframe, now on a WRITE: refused, not thrown, and the only symptom is
-- an absence. The app half of this fix stops trusting `error === null`.
--
-- ⚖ HOST-ONLY, AND THE HELPER MATTERS MORE THAN THE POLICY.
-- The write scope is `current_couple_event_ids()` — `member_type = 'couple'`.
-- ⛔ NOT `current_event_ids()`, which is `SELECT event_id FROM event_members
--    WHERE user_id = auth.uid()` with NO member_type filter — it admits a GUEST
--    who merely scanned the event QR. Using it here would let any guest grant
--    themselves the guest list. ⚠ The action file's own docblock names that
--    wrong function while describing the right intent; the sibling policy on
--    event_access_requests already uses the couple-scoped one. Read the object.
-- ⛔ NOT `HOST_MEMBER_TYPES` (= couple + coordinator) either. That set is for
--    reading the celebration page. Admitting a coordinator here would let a
--    coordinator widen their own grant — the exact thing the shipped docblock
--    says must never happen: "a coordinator who could answer requests could
--    answer their own."
--
-- 🔒 WHAT THIS DOES NOT DO, deliberately: it adds NO self-service. A moderator
-- still cannot delete their own row to walk away. Leaving is a product
-- decision, not a side effect of repairing a refusal.
--
-- 🔢 SAFE BY ARITHMETIC: 5 rows, 7 couple memberships, 1 coordinator membership,
-- 0 guest and 0 vendor memberships in production. Nobody gains a read they did
-- not have — the SELECT policy is untouched — and the only new capability is the
-- one the host's own screen already tries to use.
-- ═══════════════════════════════════════════════════════════════════════════

-- The host may share an area. WITH CHECK only: there is no prior row to test.
DROP POLICY IF EXISTS event_moderators_host_insert ON public.event_moderators;
CREATE POLICY event_moderators_host_insert
  ON public.event_moderators
  FOR INSERT
  TO authenticated
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- The host may change what is shared — and may not move a row onto another
-- celebration. USING decides which rows are visible to the update; WITH CHECK
-- decides what they may become. Both are required: USING alone would let a host
-- rewrite `event_id` to a celebration they do not host.
DROP POLICY IF EXISTS event_moderators_host_update ON public.event_moderators;
CREATE POLICY event_moderators_host_update
  ON public.event_moderators
  FOR UPDATE
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- The host may take it back entirely.
DROP POLICY IF EXISTS event_moderators_host_delete ON public.event_moderators;
CREATE POLICY event_moderators_host_delete
  ON public.event_moderators
  FOR DELETE
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

COMMENT ON TABLE public.event_moderators IS
  'Who a host has shared parts of their celebration with, and which areas. '
  'Readable by the moderator themselves and by the event''s couple; writable '
  'ONLY by the couple (current_couple_event_ids), never by a coordinator — a '
  'coordinator who could write here could widen their own grant. Until '
  '2026-09-09 this table had a SELECT policy and no others while authenticated '
  'held INSERT/UPDATE/DELETE grants, so revoking an area silently affected zero '
  'rows and the host was told it had worked.';
