-- a_claim_picks_its_shop
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION · COMMENT · REVOKE/GRANT.
--
-- ── WHY (owner review 2026-10-23, personal supplier invite PR) ───────────────
-- "When a person owns several shops, pick the shop explicitly (the invite's prepared shop, else the oldest), in both
-- claim functions." `claim_ready_the_shop` (the couple's link, 20271280303462) found the claimant's shop with a bare
-- `SELECT … INTO … WHERE user_id = …` — with more than one row, plpgsql silently takes whichever comes first.
-- `vendor_profiles.user_id` is UNIQUE today (measured on production 2026-10-23: 0 people own two shops), so this
-- changes nothing that runs now; it writes the order down so the day that changes, the claim cannot land in the
-- wrong shop. The admin twin, `claim_ready_the_invited_shop`, carries the same order (20271286262047).
--
-- The body is 20271280303462's, byte for byte, except the three marked lines (the prepared shop is read with the
-- invite, and the shop is picked with ORDER BY … LIMIT 1).

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_ready_the_shop(p_user_id uuid, p_claim_token text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status   text;
  v_name     text;
  v_email    text;
  v_category text;
  v_services text[];
  v_shop     uuid;
  v_prepared uuid;
BEGIN
  IF p_user_id IS NULL OR p_claim_token IS NULL OR length(p_claim_token) = 0 THEN
    RAISE EXCEPTION 'claim_ready_the_shop: a user and a claim token are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT status::text, NULLIF(btrim(business_name), ''), email, NULLIF(btrim(service_category), ''),
         claimed_vendor_profile_id
    INTO v_status, v_name, v_email, v_category, v_prepared
    FROM public.vendor_invites
   WHERE claim_token = p_claim_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_ready_the_shop: no such link' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'claim_ready_the_shop: this link is %', v_status USING ERRCODE = '55000';
  END IF;

  v_services := CASE WHEN v_category IS NULL THEN ARRAY[]::text[] ELSE ARRAY[v_category] END;

  -- 🔒 PICKED EXPLICITLY (20271287347520): the invite's prepared shop if it is theirs, else their OLDEST — never
  -- "whichever row came first". One row today (`vendor_profiles.user_id` is UNIQUE); written down for the day it isn't.
  SELECT vendor_profile_id INTO v_shop FROM public.vendor_profiles
   WHERE user_id = p_user_id
   ORDER BY (vendor_profile_id = v_prepared) DESC NULLS LAST, created_at, vendor_profile_id
   LIMIT 1;

  IF v_shop IS NULL THEN
    INSERT INTO public.vendor_profiles (user_id, business_name, contact_email, services, is_published)
    VALUES (p_user_id, v_name, v_email, v_services, FALSE)
    RETURNING vendor_profile_id INTO v_shop;
  ELSE
    -- Blanks only. A name or a service the supplier already set is theirs.
    UPDATE public.vendor_profiles
       SET business_name = COALESCE(NULLIF(btrim(business_name), ''), v_name),
           services      = CASE WHEN COALESCE(cardinality(services), 0) = 0 THEN v_services ELSE services END,
           contact_email = COALESCE(contact_email, v_email),
           updated_at    = NOW()
     WHERE vendor_profile_id = v_shop
       AND (
         (NULLIF(btrim(business_name), '') IS NULL AND v_name IS NOT NULL)
         OR (COALESCE(cardinality(services), 0) = 0 AND v_category IS NOT NULL)
         OR (contact_email IS NULL AND v_email IS NOT NULL)
       );
  END IF;

  INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
  VALUES (v_shop, p_user_id, 'admin')
  ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;

  RETURN v_shop;
END;
$$;

COMMENT ON FUNCTION public.claim_ready_the_shop(uuid, text) IS
  'Finalize step 1 of a supplier joining from a couple''s link: find or open the '
  'user''s shop, fill ONLY its blank name and service from the couple''s record, '
  'and make sure it has its admin seat. Refuses a link that is not pending. '
  'Service role only (the finalize page, after proving the session user).';

REVOKE ALL ON FUNCTION public.claim_ready_the_shop(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_the_shop(uuid, text) TO service_role;

COMMIT;
