-- ============================================================================
-- A SHOP ADDRESS IS PERMANENT — BUT NOBODY COULD CORRECT ONE, INCLUDING US.
--
-- `vendor_profiles_business_slug_immutable` is live and CORRECT: an address on
-- printed save-the-dates and in the sitemap must not move. Its own migration
-- (20271124956492) named the remedy — "a deliberate correction must set
-- setnayan.allow_slug_change = 'on' for that statement" — and then nothing was
-- built that does. The escape hatch had ZERO callers outside its own test.
--
-- So a typo minted at registration, a trademark complaint, or an address the
-- auto-mint derived from a name the vendor has since corrected, had **no
-- remedy at all**. Not for the vendor (by design) and not for the Setnayan team
-- (by omission). The only "fix" available was a hand-written UPDATE by whoever
-- had the database password.
--
-- ⛔ THE TRIGGER IS NOT WEAKENED. Permanent-by-design stays. This adds the ONE
-- deliberate door the trigger already anticipated, behind the service role.
--
-- ── AND IT LEAVES FORWARDING BEHIND IT ──────────────────────────────────────
-- Correcting an address without a forwarding row is the very harm the trigger
-- exists to prevent — it just moves who causes it. Every correction writes a
-- `slug_change_log` row (`entity_type='vendor'`, permitted since the table was
-- created and NEVER ONCE WRITTEN), so the old address keeps resolving.
-- `resolveRenamedPath` reads vendor rows.
--
-- ── 🚨 AND A LIVE DEFECT FOUND WHILE BUILDING THIS ──────────────────────────
-- `location_city` was added to `LOCKED_IDENTITY_FIELD_KEYS` on 2026-08-10, and
-- to the admin apply path — but NOT to this CHECK constraint, whose own source
-- comment says "MUST mirror ... never widen one without the other". Prod's
-- constraint still listed eight fields. A city correction would have been
-- REJECTED BY THE DATABASE, and the writer turns any insert error into the same
-- friendly "please try again shortly" — so it would have failed forever while
-- reading like a hiccup. Rejected, not thrown: the only symptom is an absence.
-- ============================================================================

BEGIN;

-- ── 1 · The CHECK catches up with the code it claims to mirror ──────────────
ALTER TABLE public.vendor_correction_requests
  DROP CONSTRAINT IF EXISTS vendor_correction_requests_field_key_check;

ALTER TABLE public.vendor_correction_requests
  ADD CONSTRAINT vendor_correction_requests_field_key_check
  CHECK (field_key IN (
    'business_name',
    'business_owner_name',
    'hq_address',
    'contact_phone',
    'contact_email',
    'services',
    'in_business_since_year',
    'logo_url',
    'location_city',   -- added to the code 2026-08-10, never to this constraint
    'business_slug'    -- the correction path this migration builds
  ));

-- ── 2 · The one deliberate door ─────────────────────────────────────────────
--
-- 🔑 THE HATCH IS OPENED BY THE FUNCTION'S OWN `SET`, NOT BY `SET LOCAL`.
-- `SET LOCAL` inside a function body lasts until the end of the surrounding
-- TRANSACTION, not the end of the function — so a caller that did more work
-- afterwards would still be holding the hatch open without knowing it. A
-- function-level `SET` is scoped to this call exactly and reverts on exit,
-- including on an exception.
--
-- SECURITY DEFINER + EXECUTE granted to `service_role` ONLY. There is
-- deliberately no `is_admin()` check inside: this is called with the service
-- client from a server action that has already run `requireAdmin()`, and
-- `auth.uid()` is NULL under that client — an `is_admin()` gate here would
-- refuse every legitimate call and look like a permissions bug.
CREATE OR REPLACE FUNCTION public.admin_correct_business_slug(
  p_vendor_profile_id uuid,
  p_new_slug          text,
  p_changed_by        uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET setnayan.allow_slug_change TO 'on'
AS $function$
DECLARE
  v_old TEXT;
  v_new TEXT := lower(trim(coalesce(p_new_slug, '')));
BEGIN
  IF v_new !~ '^[a-z0-9-]{3,32}$' THEN
    RAISE EXCEPTION 'SHOP_ADDRESS_FORMAT: % is not a valid address', p_new_slug
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT business_slug INTO v_old
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND: no shop %', p_vendor_profile_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Nothing to do, and nothing to log. Returning the value rather than raising
  -- keeps the caller idempotent on a double-submit.
  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN v_old;
  END IF;

  -- ⚠ AVAILABILITY IS NOT RE-DERIVED HERE. The caller asks `findSlugConflict`
  -- — the ONE availability answer, which checks reserved words, weddings,
  -- shops, people AND live ledger holds, and fails closed. A second, thinner
  -- copy of that logic in SQL is exactly how the mint and the wizard came to
  -- disagree. The UNIQUE index below is the last-resort backstop, not the check.
  UPDATE public.vendor_profiles
     SET business_slug = v_new,
         updated_at    = now()
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- The old address keeps working. Without this the correction would inflict
  -- precisely the damage the immutability trigger was written to prevent.
  IF v_old IS NOT NULL THEN
    INSERT INTO public.slug_change_log
      (entity_type, entity_id, old_slug, new_slug, changed_by)
    VALUES ('vendor', p_vendor_profile_id, v_old, v_new, p_changed_by);
  END IF;

  RETURN v_old;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_correct_business_slug(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_correct_business_slug(uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_correct_business_slug(uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.admin_correct_business_slug(uuid, text, uuid) IS
  'The ONE deliberate door through vendor_profiles_business_slug_immutable, which '
  'stays closed to everyone else. Opens the hatch via a function-level SET (scoped '
  'to this call, not the transaction), moves the address, and writes the vendor '
  'forwarding row so the old one keeps resolving. Availability is decided by the '
  'CALLER (findSlugConflict), never re-derived here. service_role only.';

COMMIT;
