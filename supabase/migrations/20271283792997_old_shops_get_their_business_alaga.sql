-- ============================================================================
-- 20271283792997_old_shops_get_their_business_alaga.sql
--
-- A SHOP OPENED BEFORE THE RULE IS STILL SOMEBODY'S BUSINESS.
--
-- Owner ruling 2026-09-30 (DECISION_LOG "ONLY PEOPLE CAN BE INVITED…"):
-- "if you create a business. it also creates a beloved that is your business."
-- Since #6779 every door that makes an account own a shop, or names one, calls
-- `ensureBusinessAlaga` (apps/web/lib/business-alaga-ensure.ts). That is a rule
-- for the NEXT write. Shops that were already owned and named when it shipped
-- never pass through a door again, so their owners still cannot pick
-- "For · <shop>" when they create an event, and People says they care for
-- nothing. Owner 2026-10-22 ("A"): give those shops their record.
--
-- Measured read-only in production before this was written (2026-10-22):
-- 3 owned, named shops; 1 has its record; 2 do not — both opened in July,
-- before the rule, neither claimed. The PR lists them; this file names nobody.
-- It is the GENERIC rule, so a shop the measurement missed is covered too.
--
-- ── WHAT IT WRITES — EXACTLY THE ROW `buildBusinessAlagaInsert` BUILDS ──────
--   owner_user_id     = vendor_profiles.user_id
--   vendor_profile_id = vendor_profiles.vendor_profile_id
--   dependent_kind    = 'business'
--   name              = business_name, whitespace-trimmed, cut to 128
--                       characters (ALAGA_NAME_MAX, lib/business-alaga.ts)
-- Every other column takes its default. NO birth_date (the wizard never asked
-- for a founding date; inventing one would print "founded today" forever), no
-- sex, religion or relationship, and NO consent stamp — a business is not a
-- person.
--
-- ── WHEN IT WRITES NOTHING — THE HELPER'S OWN REFUSALS ─────────────────────
--   · no owner (vendor_profiles.user_id IS NULL)            → nothing;
--   · a blank name (a trigger-opened EMPTY shop)            → nothing — it gets
--     its record the moment it is named, from the naming door;
--   · the (owner, shop) record already exists              → nothing (the key
--     `dependents_owner_vendor_profile_key`, 20271186070892, plus NOT EXISTS);
--   · the People control `dependent_minor_profiles` is not 'active' → nothing.
--     That is the half of `peopleGateOpen` the database can read. The other
--     half, `NEXT_PUBLIC_DEPENDENT_PEOPLE`, is a Vercel env var no SQL can see;
--     the control is the switch the owner flips in-app, and it fails closed
--     here exactly as `isDataPrivacyControlActive` fails closed in the app.
-- Plus the one gate the owner added for this backfill: an owner whose account
-- is deleted (users.deleted_at set) gets nothing — a record nobody will open.
--
-- ⚠ IT NEVER RENAMES. `ensureBusinessAlaga` also keeps an EXISTING record's name
--   in step with the shop; that is the naming doors' job and is not backfilled
--   here — an existing row is left exactly as it is.
--
-- ── RE-RUNNING IS A NO-OP ──────────────────────────────────────────────────
-- The second run finds every record the first wrote (NOT EXISTS), and the
-- ON CONFLICT on the partial unique key makes a concurrent writer the winner,
-- never a duplicate. No table, view, function, policy or grant is created or
-- touched, so the exposure baseline and the Ugat map have nothing new to say.
-- ============================================================================

BEGIN;

INSERT INTO public.dependents (owner_user_id, vendor_profile_id, dependent_kind, name)
SELECT vp.user_id,
       vp.vendor_profile_id,
       'business',
       left(regexp_replace(vp.business_name, '^\s+|\s+$', '', 'g'), 128)
  FROM public.vendor_profiles vp
  JOIN public.users u
    ON u.user_id = vp.user_id
   AND u.deleted_at IS NULL
 WHERE vp.user_id IS NOT NULL
   AND regexp_replace(coalesce(vp.business_name, ''), '^\s+|\s+$', '', 'g') <> ''
   AND EXISTS (
         SELECT 1
           FROM public.data_privacy_controls c
          WHERE c.control_key = 'dependent_minor_profiles'
            AND c.status = 'active'
       )
   AND NOT EXISTS (
         SELECT 1
           FROM public.dependents d
          WHERE d.owner_user_id     = vp.user_id
            AND d.vendor_profile_id = vp.vendor_profile_id
       )
ON CONFLICT (owner_user_id, vendor_profile_id) WHERE vendor_profile_id IS NOT NULL
DO NOTHING;

-- Post-condition: when the gate is open, no live owner of a named shop is left
-- without its record. Fails the migration loudly instead of reporting success
-- over a row it did not write.
DO $$
DECLARE
  missing BIGINT;
BEGIN
  IF EXISTS (
       SELECT 1 FROM public.data_privacy_controls
        WHERE control_key = 'dependent_minor_profiles' AND status = 'active'
     ) THEN
    SELECT count(*) INTO missing
      FROM public.vendor_profiles vp
      JOIN public.users u ON u.user_id = vp.user_id AND u.deleted_at IS NULL
     WHERE regexp_replace(coalesce(vp.business_name, ''), '^\s+|\s+$', '', 'g') <> ''
       AND NOT EXISTS (
             SELECT 1 FROM public.dependents d
              WHERE d.owner_user_id = vp.user_id
                AND d.vendor_profile_id = vp.vendor_profile_id
           );
    IF missing > 0 THEN
      RAISE EXCEPTION
        'old_shops_get_their_business_alaga: % owned, named shop(s) still have no business alaga.', missing;
    END IF;
  END IF;
END $$;

COMMIT;
