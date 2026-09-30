-- ============================================================================
-- a_connection_shows_the_account_name
--
-- ⚖ OWNER RULING 2026-09-30 (DECISION_LOG): "we should not ask if they are my
-- connected people. again, we only add our connect people." A connected
-- person goes onto a guest list under their REAL name, taken from their
-- account, and the host is never asked to type it.
--
-- WHY, MEASURED ON PROD 2026-09-30: the host's confirmed connection to Claire
-- resolved to "buanhogclaire" in "Add from your people". Her `people` node has
-- display_name NULL, so `visible_connection_names` returned nothing, and the
-- roster fell back to the name the HOST had typed when connecting
-- (`declared_name`), a handle. Her claimed account carries "Claire Buanhog".
-- The picker then demanded a surname for a one-word handle, and the guest
-- was saved as "buanhogclaire B".
--
-- THE CHANGE: the name this function returns falls back, in order, to
--   1. the person node's own display_name (unchanged: what it always returned);
--   2. the person node's first_name + last_name;
--   3. the claimed account's first_name + last_name (the formal name parts);
--   4. the claimed account's display_name.
-- 🔒 THE FENCE IS UNCHANGED. The WHERE clause, which decides WHO may be named,
-- is copied byte-for-byte from 20271151915662 (verified identical to prod's
-- pg_get_functiondef on 2026-09-30). Only WHICH string names an already-
-- visible person changed, and it is still a name ONLY: no email, no phone, no
-- id beyond the person_id the caller passed in.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.visible_connection_names(p_person_ids uuid[])
RETURNS TABLE(person_id uuid, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT p.person_id,
         COALESCE(
           NULLIF(btrim(p.display_name), ''),
           NULLIF(btrim(concat_ws(' ', NULLIF(btrim(p.first_name), ''), NULLIF(btrim(p.last_name), ''))), ''),
           NULLIF(btrim(concat_ws(' ', NULLIF(btrim(u.first_name), ''), NULLIF(btrim(u.last_name), ''))), ''),
           NULLIF(btrim(u.display_name), '')
         ) AS display_name
  FROM public.people p
  JOIN public.people me
    ON me.claimed_by_user_id = auth.uid()
   AND me.deleted_at IS NULL
  LEFT JOIN public.users u
    ON u.user_id = p.claimed_by_user_id
  WHERE p.person_id = ANY(p_person_ids)
    AND p.deleted_at IS NULL
    AND p.person_id <> me.person_id
    AND EXISTS (
      SELECT 1
      FROM public.person_connections pc
      WHERE pc.deleted_at IS NULL
        AND (
          -- (a) CONFIRMED, either direction — the 2026-07-05 rule, unchanged.
          (
            pc.status = 'confirmed'
            AND (
                 (pc.from_person_id = p.person_id AND pc.to_person_id   = me.person_id)
              OR (pc.to_person_id   = p.person_id AND pc.from_person_id = me.person_id)
            )
          )
          -- (b) PENDING, ONE direction only: I am the person being asked, and
          --     the name I get back is whoever asked me. Reversing the two ids
          --     here is the defect this leg exists to prevent.
          OR (
            pc.status = 'pending'
            AND pc.from_person_id = p.person_id
            AND pc.to_person_id   = me.person_id
          )
        )
    );
$function$;

COMMENT ON FUNCTION public.visible_connection_names(uuid[]) IS
  'Person-spine PHASE 2 name visibility. Returns a NAME ONLY — never contact details, never a browsable directory — for (a) people the caller shares a CONFIRMED edge with, either direction (owner-signed-off rule 2026-07-05), and (b) the DECLARER of a PENDING claim about the caller, one direction only, so somebody asked to confirm a relationship can see who is asking (2026-08-21). The reverse of (b) is deliberately absent: a declarer must never learn the name behind an address they typed. Drafts and declined edges resolve nothing. The name is the person node''s display_name, else its first+last, else the claimed account''s first+last, else the account''s display_name (2026-09-30: a connected person is added to a guest list under their real name, never a handle the host typed). SECURITY DEFINER; the WHERE clause is the guard.';

COMMIT;
