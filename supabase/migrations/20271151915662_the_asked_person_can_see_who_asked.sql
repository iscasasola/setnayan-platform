-- ============================================================================
-- the_asked_person_can_see_who_asked
--
-- ── THE DEFECT, IN ONE SENTENCE ────────────────────────────────────────────
-- A person asked to confirm a family relationship could not see WHO WAS ASKING.
-- `/dashboard/people` rendered "Someone added you as their spouse" with a
-- Confirm and a Decline under it, because `visible_connection_names` resolves a
-- name only across a CONFIRMED edge — and the edge being answered is, by
-- definition, not confirmed yet. Nobody sane confirms an anonymous claim about
-- their own family, so the flow could not complete.
--
-- ── THE RULE THIS AMENDS, AND EXACTLY HOW FAR ──────────────────────────────
-- Owner-signed-off name-visibility rule, 2026-07-05: name only, confirmed only,
-- self-scoped, never a browsable directory. Everything in that sentence stands.
-- ONE case is added, and it is strictly one-directional:
--
--     the person a PENDING claim is ABOUT may see the name of the person who
--     made it.
--
-- ⚠ NOT the reverse, and the asymmetry is the whole design. Resolving the
-- OTHER direction — letting a declarer see the name behind an address they
-- typed — would turn the add box into a name lookup for any email on earth.
-- The `pc.to_person_id = me.person_id` leg below is the guard; a future edit
-- that "simplifies" the two legs into one symmetric OR reopens exactly that.
--
-- ── WHY THIS DISCLOSES NOTHING NEW ─────────────────────────────────────────
-- The same change makes every request send an invitation that already names the
-- sender ("Ana added you on Setnayan") — the declarer typed that address
-- themselves, intending to be known by it. The recipient therefore learns the
-- name in their inbox either way; without this, the APP is the only place that
-- hides it, which is not privacy — it is a broken screen.
--
-- Pending only. A `draft` (nothing sent, private to its author) and a `declined`
-- edge resolve NOTHING here, in either direction.
--
-- IDEMPOTENT: CREATE OR REPLACE + COMMENT ON.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.visible_connection_names(p_person_ids uuid[])
RETURNS TABLE(person_id uuid, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
  'Person-spine PHASE 2 name visibility. Returns display_name ONLY — never contact details, never a browsable directory — for (a) people the caller shares a CONFIRMED edge with, either direction (owner-signed-off rule 2026-07-05), and (b) the DECLARER of a PENDING claim about the caller, one direction only, so somebody asked to confirm a relationship can see who is asking (2026-08-21). The reverse of (b) is deliberately absent: a declarer must never learn the name behind an address they typed. Drafts and declined edges resolve nothing. SECURITY DEFINER; the WHERE clause is the guard.';
