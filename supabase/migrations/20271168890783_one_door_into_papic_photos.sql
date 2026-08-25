-- one_door_into_papic_photos
--
-- ⚠ A COUPLE COULD PUT A PHOTO IN THEIR OWN GALLERY WITHOUT SPENDING A CREDIT.
--
-- `papic_photos_couple_full` is FOR ALL with a WITH CHECK that asks one thing:
-- *are you a couple on this event?* It never asks whether the photo was paid
-- for. Combined with the column-wise INSERT grant `authenticated` holds on 39
-- of this table's columns, a signed-in couple could POST a row straight to
-- PostgREST — no order, no payment, no admin approval, no grant, no metering.
--
-- 🔑 THE MONEY SIDE IS NOT THE PROBLEM AND IS NOT TOUCHED. Credits can only
-- arrive two ways, both correct: the automatic 50-point `free_grant`, and a
-- `topup_order` grant written by SKU activation after an admin has compared the
-- payment and approved it. `lib/papic-free-grant.ts` states plainly that the
-- client has no INSERT policy on `papic_event_point_grants` "and it must not".
-- Nobody can mint credits. The hole is that a PHOTO could arrive without one
-- ever being SPENT — the balance never moves, because the photo went around it.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────
-- Splits the couple's FOR ALL into SELECT / UPDATE / DELETE with the SAME
-- predicate. A couple keeps every power any shipped code actually uses — read
-- their gallery, hide a photo, delete one — and loses only INSERT, which
-- nothing has ever used under a couple session.
--
-- ✅ VERIFIED SAFE BEFORE WRITING THIS. Every insert into `papic_photos` in the
-- entire app is in `app/papic/actions.ts` (recordSeatCapture), three call sites,
-- all under the CLAIMER's session — satisfied by `papic_photos_claimer_own`,
-- which is untouched. Grep for `from('papic_photos')` and check each `.insert(`.
--
-- ⛔ AND A BLANKET `REVOKE INSERT … FROM authenticated` WOULD HAVE BEEN WRONG.
-- The claimer holding a camera IS an `authenticated` user, so revoking the
-- grant would break every camera in the product. Policies are OR-ed, so
-- narrowing the couple policy is what leaves exactly one door: the camera's.
--
-- ── ⚠ WHAT THIS DOES *NOT* CLOSE, STATED SO NOBODY READS IT AS FINISHED ─────
-- Whoever holds a CLAIMED CAMERA can still insert a row for that camera through
-- PostgREST, because `papic_photos_claimer_own` must permit exactly that for
-- capture to work. Today no couple holds a camera, so this closes the whole
-- reachable gap. The moment uploading ships, the couple WILL hold an "Uploads"
-- camera and that gap reopens.
--
-- 🔑 THE REAL FIX THEN IS ATOMICITY, NOT PERMISSION: a SECURITY DEFINER
-- function that reserves the credit and inserts the row in ONE transaction, with
-- direct INSERT revoked. That also deletes the unwind problem outright — there
-- is nothing to give back if the reserve and the insert cannot come apart. It
-- belongs in the upload PR, where the camera that reopens the gap is created,
-- and NOT here, where it would rewrite a live capture path for no present gain.

-- ⚠ `TO authenticated` ON ALL THREE, MATCHING WHAT THEY REPLACE. A CREATE
-- POLICY with no TO clause defaults to PUBLIC, which includes `anon` — and
-- `anon` holds SELECT on all 45 columns of this table. The predicate saves it
-- (an anon caller has no `auth.uid()`, so the EXISTS can never match), but a
-- policy that is only safe because of its predicate is one edit away from not
-- being. The exposure-freeze guard caught this on the first run and it is the
-- guard doing exactly its job on a change that was otherwise a narrowing.

BEGIN;

DROP POLICY IF EXISTS papic_photos_couple_full ON public.papic_photos;

CREATE POLICY papic_photos_couple_read ON public.papic_photos
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_photos.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'::member_type
    )
  );

CREATE POLICY papic_photos_couple_update ON public.papic_photos
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_photos.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'::member_type
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_photos.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'::member_type
    )
  );

CREATE POLICY papic_photos_couple_delete ON public.papic_photos
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_photos.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'::member_type
    )
  );

COMMENT ON TABLE public.papic_photos IS
  'Papic captures. INSERT is permitted by papic_photos_claimer_own ONLY — a '
  'camera''s own claimer. The couple''s policies are SELECT/UPDATE/DELETE '
  'deliberately (20271168890783): a photo must not be able to exist without a '
  'credit having been spent, and the app-side meter is the only thing that '
  'spends one. Do not restore a FOR ALL couple policy here.';

COMMIT;
