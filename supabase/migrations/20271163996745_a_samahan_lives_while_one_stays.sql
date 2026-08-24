-- a_samahan_lives_while_one_stays
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- TWO things, found together because the owner tried to leave his own samahan.
--
-- ══ 1 · 🚨 NOBODY COULD LEAVE A SAMAHAN. NOBODY. ════════════════════════════
--
-- `community_members` has a DELETE POLICY (`community_member_leave_or_remove`,
-- shipped with the table) and NO DELETE GRANT. Postgres checks the GRANT
-- FIRST, so the statement is refused before RLS is ever consulted — the
-- policy has never once been reached. Both shipped callers were dead:
-- "Leave this samahan" for every member, and an organizer removing anybody.
--
-- 🔑 WHERE IT CAME FROM, and it is a rule not a mishap: migration
-- 20271023100000 revoked ALL and granted back, in its own words, "the three
-- verbs the shipped paths actually use … creating a samahan, joining via an
-- invite token, and renaming/archiving one." That list was written from
-- REMEMBERED PATHS while a DELETE POLICY sat in the same schema declaring
-- that DELETE is a shipped path. **Enumerate the verbs from the POLICIES,
-- never from a list of paths you can recall.** Same family as the phantom
-- column / enum value / RPC argument: refused, not thrown, and the only
-- symptom is a button that does nothing.
--
-- ══ 2 · A SAMAHAN LIVES WHILE ANYONE IS STILL IN IT ════════════════════════
--
-- Owner 2026-08-24: "the only way to close a group/samahan is when all
-- members leave the samahan. but for as long as there is one, the group
-- lives." So closing is not an act a person performs on other people — it is
-- a CONSEQUENCE of the last one walking out. Today an organizer can archive
-- a samahan full of members, taking a group away from people who never
-- agreed to lose it.
--
-- 🔑 THE BUTTON IS NOT THE DOOR. Removing the organizer's archive control
-- closes the CONTROL; `communities` is served at /rest/v1/communities and the
-- anon key is public by construction, so an UPDATE setting archived = TRUE
-- stays reachable with curl. The rule is enforced HERE; the UI follows it.

BEGIN;

-- 1 · The missing verb. Scoping is already correct and untouched: the
--     existing DELETE policy admits `user_id = auth.uid()` (leave), an
--     organizer of that community (remove), or an admin.
GRANT DELETE ON TABLE public.community_members TO authenticated;

COMMENT ON TABLE public.community_members IS
  'Samahan roster. ⚠ DELETE is GRANTED to authenticated on purpose — leaving a samahan and an organizer removing a member are both shipped paths, scoped by community_member_leave_or_remove. It was missing from 20271023100000 (which granted "the three verbs the shipped paths actually use", written from remembered paths rather than from the policies), and leaving was refused for every member until 2026-08-24. Do not revoke it without deleting those two paths.';

-- 2 · The archive rule, replacing the guard from 20271162795119.
CREATE OR REPLACE FUNCTION public.communities_member_field_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  privileged BOOLEAN := current_user NOT IN ('authenticated', 'anon');
  remaining  INTEGER;
BEGIN
  -- ⚠ NOT SECURITY DEFINER, on purpose: inside a definer function
  -- current_user is the function OWNER, so every caller would read as
  -- privileged and this guard would never fire.
  IF privileged OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Identity is nobody's to edit through the API.
  IF NEW.community_id IS DISTINCT FROM OLD.community_id
     OR NEW.public_id IS DISTINCT FROM OLD.public_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'communities: identity fields are immutable';
  END IF;

  -- CLOSING (owner 2026-08-24). No role may close a samahan that still holds
  -- anybody — organizer and plain member alike. The count is taken HERE
  -- rather than trusted from the app, because the app's own count is read
  -- BEFORE its delete and a refused delete would leave it stale.
  IF NEW.archived AND NOT OLD.archived THEN
    SELECT count(*) INTO remaining
      FROM public.community_members
     WHERE community_id = OLD.community_id;
    IF remaining > 0 THEN
      RAISE EXCEPTION
        'communities: a samahan lives while anyone is still in it (% member(s) remain)',
        remaining;
    END IF;
  END IF;

  -- Re-opening stays organizer-only. It is a decision about a group that
  -- currently holds nobody, and it is not what this ruling is about.
  IF OLD.archived AND NOT NEW.archived THEN
    IF OLD.community_id NOT IN (SELECT public.current_organizer_community_ids()) THEN
      RAISE EXCEPTION 'communities: only an organizer may change that';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.communities_member_field_guard() IS
  'Scopes the member-wide UPDATE policy on communities. Members may change name / description / photo_url. CLOSING is refused while ANY membership row remains (owner 2026-08-24: "for as long as there is one, the group lives") — it is a consequence of the last person leaving, written by the service role once the roster is empty, never an act performed on other people. Re-opening is organizer-only. Identity columns are immutable below the service role.';

COMMIT;
