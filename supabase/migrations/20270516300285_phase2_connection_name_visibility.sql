-- phase2 connection name visibility
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE OR REPLACE FUNCTION …
--   • GRANT/REVOKE are idempotent

-- ============================================================================
-- Person-spine · PHASE 2 · CROSS-PERSON NAME VISIBILITY (the one RLS decision
-- that was deferred to counsel — owner sign-off 2026-07-05: "mutual confirmation
-- IS enough consent to store a connection + show each other's name").
--
-- Implements the MOST CONSERVATIVE reading of that answer:
--   • NAME ONLY — this function returns only person_id + display_name. It never
--     exposes email / phone / birth_date / photo. The base `people` RLS stays
--     owner-only (claimer/creator/admin); this does NOT broaden it.
--   • CONFIRMED CONNECTIONS ONLY — a name is visible only when the two people
--     share a person_connections edge with status='confirmed'. Pending/declined
--     edges reveal nothing (the requester stays "Someone" until both confirm),
--     matching "MUTUAL confirmation = consent".
--   • SELF-SCOPED — resolves the caller's own claimed person via auth.uid(); a
--     caller can only ever see names of people THEY are confirmed-connected to.
--     Never a browsable directory.
--
-- SECURITY DEFINER is required precisely because base `people` RLS would hide
-- the other person's row — but the function's WHERE clause is the guard: it can
-- only return a name for a confirmed edge that includes the caller's own person.
--
-- Inertness: with the Phase-2 flag OFF, nothing writes person_connections, so
-- there are no confirmed edges and this function returns zero rows. The caller
-- (connections page) also flag-guards. Going LIVE is the owner's Vercel flag
-- flip, not this migration. Plan: People_Graph_and_Lifelong_Identity_2026-07-04 §11.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.visible_connection_names(p_person_ids UUID[])
RETURNS TABLE (person_id UUID, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.person_id, p.display_name
  FROM public.people p
  JOIN public.people me
    ON me.claimed_by_user_id = auth.uid()
   AND me.deleted_at IS NULL
  WHERE p.person_id = ANY(p_person_ids)
    AND p.deleted_at IS NULL
    AND p.person_id <> me.person_id
    AND EXISTS (
      SELECT 1
      FROM public.person_connections pc
      WHERE pc.status = 'confirmed'
        AND pc.deleted_at IS NULL
        AND (
             (pc.from_person_id = p.person_id  AND pc.to_person_id   = me.person_id)
          OR (pc.to_person_id   = p.person_id  AND pc.from_person_id = me.person_id)
        )
    );
$$;

COMMENT ON FUNCTION public.visible_connection_names(UUID[]) IS
  'Person-spine PHASE 2 (owner-signed-off name-visibility rule 2026-07-05): returns display_name ONLY, and ONLY for people the caller (auth.uid()''s claimed person) shares a CONFIRMED person_connections edge with. Name-only, confirmed-only, self-scoped — never contact details, never a browsable directory. SECURITY DEFINER; the WHERE clause is the guard. Inert while the Phase-2 flag is off (no confirmed edges exist).';

REVOKE ALL ON FUNCTION public.visible_connection_names(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visible_connection_names(UUID[]) TO authenticated, service_role;
