-- samahan_name_and_photo
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- Owner 2026-08-24: "we also want to rename our samahan anytime. anyone can
-- rename. and also place a photo/logo as their samahan group photo."
--
-- Two changes, and the boundary between them is the point:
--   · communities.photo_url — the group's face (r2:// stored-asset ref).
--   · the UPDATE policy widens from organizer-only to EVERY MEMBER — but a
--     policy is ROW-level, and the row carries fields that are NOT the
--     member's to touch (the row-is-yours-field-is-not lesson, 2026-08-12):
--     `archived` is the organizer's retire switch, `created_by` is identity,
--     and community_id/public_id are the address other tables FK. A BEFORE
--     UPDATE trigger scopes the widened policy to name · description ·
--     photo_url for plain members; organizers keep archived; identity stays
--     immutable for everyone below the service role.

BEGIN;

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.communities.photo_url IS
  'The samahan''s group photo/logo — an r2://bucket/key stored-asset ref (displayUrlForStoredAsset presigns it). Settable by ANY member (owner 2026-08-24); the member-field trigger below is what keeps the widened UPDATE policy from also handing members archived/kind/identity.';

-- Field scope for the widened policy. Privileged = service_role / owner jobs:
-- derived from current_user, never auth.role() (the replay shim returns
-- 'anon' where prod returns NULL, so auth.role() branches are dead in tests).
-- ⚠ Deliberately NOT SECURITY DEFINER: inside a definer function current_user
-- is the function OWNER, so the privileged check below would read EVERY
-- caller as the service role and the guard would never fire. The two helper
-- functions it calls are definer themselves, which is all the elevation the
-- membership reads need.
CREATE OR REPLACE FUNCTION public.communities_member_field_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  privileged BOOLEAN := current_user NOT IN ('authenticated', 'anon');
  is_org BOOLEAN;
BEGIN
  IF privileged OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Identity is nobody's to edit through the API.
  IF NEW.community_id IS DISTINCT FROM OLD.community_id
     OR NEW.public_id IS DISTINCT FROM OLD.public_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'communities: identity fields are immutable';
  END IF;

  SELECT OLD.community_id IN (SELECT public.current_organizer_community_ids())
    INTO is_org;
  IF NOT is_org THEN
    -- A plain member may change the group's face and words — nothing else.
    -- (No `kind` clause: that column was DROPPED 2026-07-17 — the platform
    -- never classifies groups.)
    IF NEW.archived IS DISTINCT FROM OLD.archived THEN
      RAISE EXCEPTION 'communities: only an organizer may change that';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communities_member_field_guard ON public.communities;
CREATE TRIGGER communities_member_field_guard
  BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.communities_member_field_guard();

-- The widened policy: any MEMBER may update their samahan's row (the trigger
-- above decides which fields). Organizer/admin arms are subsumed — a member
-- check admits organizers too, and is_admin() keeps the console working.
DROP POLICY IF EXISTS organizer_can_update_community ON public.communities;
DROP POLICY IF EXISTS member_can_update_community ON public.communities;
CREATE POLICY member_can_update_community ON public.communities
  FOR UPDATE TO authenticated
  USING (community_id IN (SELECT public.current_community_ids()) OR public.is_admin())
  WITH CHECK (community_id IN (SELECT public.current_community_ids()) OR public.is_admin());

COMMIT;
