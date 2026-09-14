-- ============================================================================
-- A DAY-OF GRANT CANNOT BE MOVED.
--
-- SUP-1 (ROOM-12). The per-event day-of grant (20270810694086) fenced its
-- INSERT on BOTH the shop and the booking, and then re-checked only the shop on
-- UPDATE:
--
--   vendor_event_access_grants_manage_insert  WITH CHECK
--       vendor_profile_id IN current_vendor_ids('admin')
--   AND event_id          IN current_vendor_booked_event_ids()   ← the fence
--
--   vendor_event_access_grants_manage_update  USING / WITH CHECK
--       vendor_profile_id IN current_vendor_ids('admin')          ← and only that
--
-- `authenticated` holds UPDATE on `event_id` (measured on prod: the column
-- carries the grant, and there was no trigger on this table), so a shop admin
-- could INSERT a legitimate grant on a celebration they ARE booked on and then
-- UPDATE that row's `event_id` to one they never were. `vendor_profile_id` does
-- not move, so both halves of the UPDATE policy pass and the INSERT fence is
-- simply walked around.
--
-- 🔑 RLS IS ROW-LEVEL, NEVER VALUE-LEVEL. A policy that admits you to your own
-- row cannot govern what you write INTO that row unless the WITH CHECK names the
-- column. This one did not.
--
-- ── WHAT THE MOVED ROW BUYS ────────────────────────────────────────────────
-- `current_vendor_dayof_grant_event_ids()` reads exactly this column, and five
-- live policies read that helper. Re-measure the list, do not trust this one:
--
--     SELECT tablename, policyname, cmd FROM pg_policies
--      WHERE coalesce(qual,'') || coalesce(with_check,'')
--            LIKE '%current_vendor_dayof_grant_event_ids%';
--
-- At the time of writing that is a FOR ALL (read AND write) on
-- `vendor_event_sets` and `vendor_event_set_songs`, plus SELECT on
-- `event_playlist_picks`, `event_playlist_slot_vibes` and `event_song_picks`.
-- So a moved grant is not a cosmetic mis-label: it hands the grantee a
-- stranger's song desk and lets them author that stranger's sets.
--
-- ── SIZE, HONESTLY ─────────────────────────────────────────────────────────
-- `vendor_event_access_grants` had ZERO rows and ZERO distinct grantees in
-- production when this was written. The register's "2 people" belongs to
-- `vendor_event_unlocks`, a different table. This is a dormant gap: it is
-- invisible until the first real grant is written, and the number is small
-- because the product is young, not because the policy is sound.
--
-- ── WHY THIS IS A TRIGGER AND NOT THE SYMMETRIC `WITH CHECK` ────────────────
-- ⚠ The obvious fix — copy the INSERT's `event_id IN
-- current_vendor_booked_event_ids()` into the UPDATE's WITH CHECK — IS WORSE,
-- and was rejected deliberately.
--
-- The ONLY legitimate UPDATE on this table is the soft revoke:
-- `on-the-day/actions.ts` writes `{ revoked_at }` and nothing else (its grant
-- path is an upsert on the identity triple, which re-writes those columns to the
-- values they already hold). `current_vendor_booked_event_ids()` admits an event
-- only while `event_vendors.status` is contracted/deposit_paid/delivered/
-- complete. So the moment the booking leaves that set, that WITH CHECK refuses
-- the revoke — and the outstanding grant stays ACTIVE, on a wedding the
-- shop no longer serves, with nobody able to withdraw it. That trades a dormant
-- escalation for a live one.
--
-- 🔬 MEASURED, not reasoned. The alternative was written into the PGlite replay
-- and probed two ways a booking realistically ends -- status downgraded to
-- shortlisted, and the event_vendors row deleted by the couple. Both times:
--     revoke      -> "new row violates row-level security policy"
--     revoked_at  -> still NULL
--     the grantee -> STILL resolved by current_vendor_dayof_grant_event_ids()
-- (There is no 'cancelled' in vendor_status -- the labels are considering,
-- shortlisted, contracted, deposit_paid, delivered, complete -- so those two ARE
-- how a booking ends.) Re-run it by pasting that policy into a scratch migration
-- and repeating the fixture in a-day-of-grant-cannot-be-moved.db.test.ts.
--
-- WITH CHECK also cannot see OLD, so it can express "an event you are booked
-- on" but never "the event this grant has always named" — which is the actual
-- rule. A BEFORE UPDATE trigger can, and it refuses EXPLICITLY: an exception
-- with a code, not a predicate that quietly matches zero rows. A zero-row UPDATE
-- raises nothing, and "refused" then looks exactly like "already done".
--
-- ── NO ESCAPE HATCH, ON PURPOSE ────────────────────────────────────────────
-- `guard_business_slug_immutable` (20271124956492) carries a per-statement
-- `SET LOCAL` hatch because a wrong shop address has NO remedy — not even for
-- Setnayan. A mis-targeted grant has a complete one that already ships: revoke
-- it and issue the right one, both from the launcher. A hatch here would be a
-- door nothing walks through, so the rule is unconditional. A future data
-- repair can `ALTER TABLE … DISABLE TRIGGER`, which is loud and deliberate.
--
-- WHAT STAYS OPEN, deliberately:
--   • `revoked_at` — the revoke, and the upsert's un-revoke.
--   • `granted_by` — `lib/erasure/coverage.ts` NULLS this when the issuer asks
--     to be deleted, and its FK is ON DELETE SET NULL, which fires as an UPDATE
--     on this row. Refusing it would break an RA 10173 erasure to enforce a rule
--     about retargeting. (Same correction CI forced on the slug guard.)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_vendor_event_grant_target_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- IS NOT DISTINCT FROM, so the launcher's upsert — which re-states the
  -- identity triple unchanged on conflict — is not mistaken for a move.
  IF NEW.event_id          IS NOT DISTINCT FROM OLD.event_id
     AND NEW.vendor_profile_id IS NOT DISTINCT FROM OLD.vendor_profile_id
     AND NEW.grantee_user_id   IS NOT DISTINCT FROM OLD.grantee_user_id
     AND NEW.grant_id          IS NOT DISTINCT FROM OLD.grant_id
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'DAYOF_GRANT_TARGET_IMMUTABLE: grant % names (shop %, celebration %, account %) '
    'and a day-of grant cannot be repointed. The UPDATE policy re-checks only the '
    'shop, so moving event_id would walk around the INSERT fence '
    '(current_vendor_booked_event_ids) and hand the grantee a celebration this shop '
    'was never booked on — its song desk, and write access to its sets. Revoke this '
    'grant and issue a new one instead. Attempted: (shop %, celebration %, account %).',
    OLD.grant_id, OLD.vendor_profile_id, OLD.event_id, OLD.grantee_user_id,
    NEW.vendor_profile_id, NEW.event_id, NEW.grantee_user_id
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vendor_event_grant_target_immutable()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.guard_vendor_event_grant_target_immutable() IS
  'Refuses any UPDATE that changes which (shop, celebration, account) a day-of '
  'access grant names. revoked_at (the soft revoke) and granted_by (nulled by '
  'RA 10173 erasure) stay writable. No escape hatch: the remedy for a wrong '
  'grant is to revoke it and issue another. SUP-1 / ROOM-12.';

DROP TRIGGER IF EXISTS vendor_event_access_grants_target_immutable
  ON public.vendor_event_access_grants;
CREATE TRIGGER vendor_event_access_grants_target_immutable
  BEFORE UPDATE OF grant_id, vendor_profile_id, event_id, grantee_user_id
  ON public.vendor_event_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_event_grant_target_immutable();

-- `UPDATE OF …` fires only when one of those columns appears in the SET list, so
-- the soft revoke (`SET revoked_at = now()`) and the erasure null of granted_by
-- pay nothing at all. The launcher's upsert DOES name them on conflict, and
-- lands on the IS NOT DISTINCT FROM branch above.

COMMIT;
