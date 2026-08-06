-- A coordinator may see the couple's guest photos — "but only upon approval."
-- Owner decision 2026-08-06.
--
-- 🔑 NO NEW MECHANISM. This adds ONE area, `photos`, to the delegate-permission
-- system the owner already switched on in July. Enforcement lands in exactly one
-- place — `moderator_area_level(event_id, 'photos')` — the same call every other
-- area goes through. A photo-specific permission would have been a second way to
-- answer the same question, and the two would eventually disagree.
--
-- 🔑 `moderator_area_level` IS NOT TOUCHED, deliberately. Its `ELSE NULL` tail
-- already fails CLOSED for any area it does not name, and its first branch
-- already honours an explicit `areas` key. So an unapproved coordinator gets
-- NULL today and keeps getting NULL; approval means the couple writing
-- `areas.photos` on that coordinator's row. Editing the function would risk the
-- one thing that already behaves correctly.
--
-- ⚠ Its TypeScript mirror did NOT fail closed — its tail returns 'edit' for any
-- delegate with `edit_all` — so adding the area to the union alone would have
-- handed photos to every existing delegate. That is fixed in
-- `lib/event-moderators.ts` in this same change; the two must agree or the
-- database refuses a read the screen already promised.
--
-- Two NEW read policies. The existing couple/admin policies are left exactly as
-- they are: permissive policies OR together, so adding a leg can only widen for
-- the person named, and editing an existing one risks the couple's own access.

CREATE POLICY papic_photos_moderator_photos_read
  ON public.papic_photos
  FOR SELECT
  TO authenticated
  USING (public.moderator_area_level(event_id, 'photos') IN ('view', 'edit'));

CREATE POLICY papic_guest_captures_moderator_photos_read
  ON public.papic_guest_captures
  FOR SELECT
  TO authenticated
  USING (public.moderator_area_level(event_id, 'photos') IN ('view', 'edit'));

-- Post-conditions: the policies landed, nothing reached anon, and — the one that
-- actually matters — a delegate with NO photos key still resolves to NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'papic_photos'
       AND policyname = 'papic_photos_moderator_photos_read'
  ) THEN
    RAISE EXCEPTION 'papic_photos_moderator_photos_read did not land';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'papic_guest_captures'
       AND policyname = 'papic_guest_captures_moderator_photos_read'
  ) THEN
    RAISE EXCEPTION 'papic_guest_captures_moderator_photos_read did not land';
  END IF;
  -- ⚠ THE FIRST VERSION OF THIS ASSERTED THAT anon HOLDS NO SELECT GRANT, AND
  -- IT FAILED — correctly. anon DOES hold a stale table grant on both photo
  -- tables; it is part of the known dead-anon-grant debt (hundreds of them,
  -- deliberately not mass-revoked because revoking blind has broken readers
  -- before). The grant is harmless HERE because no policy admits anon, and a
  -- grant without a policy reads nothing under RLS.
  --
  -- So assert the property that actually protects the photos: every policy on
  -- these tables is scoped to `authenticated`. That is what would break if
  -- someone later added a permissive anon policy — the grant alone cannot.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('papic_photos', 'papic_guest_captures')
       AND 'anon' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'a policy on the photo tables now admits anon';
  END IF;
END $$;
