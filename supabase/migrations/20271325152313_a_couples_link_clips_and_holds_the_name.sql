-- a_couples_link_clips_and_holds_the_name
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION · COMMENT · REVOKE/GRANT.
-- No table, no column, no policy — so no RLS to add.
--
-- ── WHY: two migrations re-created ONE function, and the later prefix dropped the other's rule ─────────────────────
-- `claim_ready_the_shop` (a supplier joining from a couple's link) was re-created by two migrations written in
-- parallel, each "byte for byte from 20271287347520" plus ONE change of its own:
--   · 20271320018288_a_held_shop_name_holds_its_core  (#7359) — a name whose core is HELD is left blank, not copied
--     onto the joining supplier's shop (owner 2026-11-06, the Bulgogi rule);
--   · 20271320245383_a_shop_name_is_fifty_characters  (main) — the couple's typed name is clipped to the shop's 50,
--     so the claim never fails on `vendor_profiles_business_name_max_50` (owner 2026-11-06, "50 characters").
-- Replay and prod both apply in prefix order, so 20271320245383 ran LAST and silently put back the copy-a-held-name
-- behaviour (caught by tests/db/a-held-shop-name-holds-its-core.db.test.ts and lib/shop-name-hold.test.ts on the
-- train, PR #7394). Neither applied migration is edited; this one re-creates the function with BOTH changes.
--
-- The body is 20271320018288's, byte for byte, except the SELECT that reads the invite's name, which is
-- 20271320245383's clip (`NULLIF(btrim(left(btrim(…), 50)), '')`). Order inside the body: clip first, then ask
-- whether the clipped name is held — the clipped text is what would be written, so it is what must be asked.
-- `claim_ready_the_invited_shop` (Setnayan's OWN invite) is untouched: 20271320245383 is still its latest definition,
-- and 20271320018288 deliberately left it alone (an admin staged that name).

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

  -- 📏 20271320245383: the couple's typed name is clipped to the shop's 50 HERE, at the boundary — never refused.
  SELECT status::text, NULLIF(btrim(left(btrim(business_name), 50)), ''), email, NULLIF(btrim(service_category), ''),
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

  -- ▼ 20271320018288 · A HELD CORE IS NOT COPIED (owner 2026-11-06). Left blank, never refused.
  IF v_name IS NOT NULL AND public.shop_name_is_held(v_name, v_shop) THEN
    v_name := NULL;
  END IF;
  -- ▲

  IF v_shop IS NULL THEN
    -- `business_name` is NOT NULL DEFAULT '' — blank is the empty string. (Unreachable today: the vendor sign-up
    -- trigger always opens a shop first. Kept honest now that v_name can be cleared just above.)
    INSERT INTO public.vendor_profiles (user_id, business_name, contact_email, services, is_published)
    VALUES (p_user_id, COALESCE(v_name, ''), v_email, v_services, FALSE)
    RETURNING vendor_profile_id INTO v_shop;
  ELSE
    -- Blanks only. A name or a service the supplier already set is theirs.
    -- (`, business_name` at the end: a cleared v_name must leave the blank '' standing, never write NULL into a
    -- NOT NULL column while the service or email arm runs the UPDATE.)
    UPDATE public.vendor_profiles
       SET business_name = COALESCE(NULLIF(btrim(business_name), ''), v_name, business_name),
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
  'A name whose core is held (shop_name_is_held, 2026-11-06) is left blank, not copied; '
  'the couple''s typed name is clipped to the shop''s 50 first (2026-11-06). '
  'Service role only (the finalize page, after proving the session user).';

REVOKE ALL ON FUNCTION public.claim_ready_the_shop(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_the_shop(uuid, text) TO service_role;

COMMIT;
