-- a_claimed_shop_carries_the_couples_record
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION +
-- REVOKE/GRANT only. No table, no column, no policy.
--
-- ── WHY (owner 2026-10-19, "have you tested an account and shop creation
--    step?" → "can't you test it first?") ──────────────────────────────────────
-- The couple adds their supplier by hand (Suppliers → Add your own), shares the
-- link, and the supplier signs up from it: `/vendor/claim/<token>` →
-- `/signup?as=vendor&next=…/finalize` → the finalize page. Nobody had walked it
-- end to end. Walked in SQL (apps/web/tests/db/
-- a-supplier-joins-from-the-couples-link.db.test.ts), the shop came out
-- NAMELESS AND WITH NO SERVICE:
--
--   1. `/signup?as=vendor` posts `account_type = 'vendor'`, so
--      `handle_new_auth_user` writes `public.users.account_type = 'vendor'`, and
--      `on_users_vendor_created` → `handle_new_vendor_user()` (20270401574089)
--      at once inserts an EMPTY shop — `INSERT INTO vendor_profiles (user_id)`,
--      no name, `services = '{}'` — plus its admin seat.
--   2. The finalize page then looked for "the signed-in user's shop", FOUND that
--      empty row, and took its "already has a shop" branch — which writes
--      nothing. The branch that copies the couple's record onto the shop
--      (`business_name` + `services = [category]`) only ran when NO shop
--      existed, which after a vendor sign-up is never.
--
-- So every supplier who joined through a couple's link arrived with a shop
-- called nothing, in no category.
--
-- ── THE FIX: ONE CALL THAT READIES THE SHOP ──────────────────────────────────
-- `claim_ready_the_shop(user, token)` is the finalize page's step 1, in SQL, so
-- the db test exercises the very statement the page runs:
--   · finds the user's shop, or opens one (a sign-up that arrives as
--     'customer' — Google, or an existing couple account — has none);
--   · FILLS ONLY BLANKS from the couple's record: the name when it has none,
--     the service when it has none. A shop that already has a name and a
--     service (an existing supplier connecting a new couple) is untouched;
--   · makes sure the shop has its admin seat — the free unlock that seats the
--     couple as a customer checks the caller is an answering member, and a
--     shop opened here had none;
--   · refuses a link that is not pending (the page already branches on that;
--     this is the boundary behind it).
-- The service written is the couple's own `service_category` — exactly what
-- the finalize page's create branch has written since 2026-05. Nothing new is
-- invented here.
--
-- Service role only: the page calls it on the admin client after proving the
-- session user.

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
BEGIN
  IF p_user_id IS NULL OR p_claim_token IS NULL OR length(p_claim_token) = 0 THEN
    RAISE EXCEPTION 'claim_ready_the_shop: a user and a claim token are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT status::text, NULLIF(btrim(business_name), ''), email, NULLIF(btrim(service_category), '')
    INTO v_status, v_name, v_email, v_category
    FROM public.vendor_invites
   WHERE claim_token = p_claim_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_ready_the_shop: no such link' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'claim_ready_the_shop: this link is %', v_status USING ERRCODE = '55000';
  END IF;

  v_services := CASE WHEN v_category IS NULL THEN ARRAY[]::text[] ELSE ARRAY[v_category] END;

  SELECT vendor_profile_id INTO v_shop FROM public.vendor_profiles WHERE user_id = p_user_id;

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
