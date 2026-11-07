-- a_shop_name_is_fifty_characters
-- Created via `pnpm migration:new`. Idempotent: DROP/ADD CONSTRAINT · VALIDATE · CREATE OR REPLACE FUNCTION ·
-- COMMENT · REVOKE/GRANT. No new table, no new column, no new policy.
--
-- ── WHY (owner ruling 2026-11-06: "50 characters") ───────────────────────────────────────────────────────────────
-- A supplier's SHOP NAME (`vendor_profiles.business_name`) is 50 characters at most, everywhere. The boxes
-- (`SHOP_NAME_MAX`, apps/web/lib/business-slug.ts) and every server writer refuse past it; this CHECK is the floor
-- under them, so a writer nobody remembered — a script, an RPC, a future screen — cannot go around the boxes.
--
-- Measured on production before writing this (read-only, 2026-11-06): 5 shops, the longest name 20 characters.
-- So the data fits: NOT VALID then VALIDATE is used anyway, so the check is attached without a long lock and then
-- proven against every existing row in the same migration.
--
-- ── THE CLAIM MUST NEVER FAIL ON IT ──────────────────────────────────────────────────────────────────────────────
-- Two functions PREFILL a shop's name from text that is NOT a shop name and was never held to 50:
--   · `claim_ready_the_shop`         — the couple's link: the name the couple typed for their supplier
--                                       (`vendor_invites.business_name`, a snapshot of their record — free text);
--   · `claim_ready_the_invited_shop` — Setnayan's own invite: `vendor_invites.business_name` (older invites took 128).
-- Without a clip, a couple who typed a long name would make their supplier's claim FAIL on this CHECK. So both are
-- re-created here, byte for byte from their latest definitions (20271287347520 · 20271286262047), with ONE change:
-- the invite's name is read through `NULLIF(btrim(left(btrim(…), 50)), '')`. A name already on a shop row
-- (`v_staged.business_name`) is under the CHECK already and is not touched.
--
-- 🔑 The couple's own record (`event_manual_vendors.business_name`) stays free text — only SHOPS are 50.
-- Proven by apps/web/tests/db/a-shop-name-is-fifty-characters.db.test.ts.

BEGIN;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_business_name_max_50;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_business_name_max_50
  CHECK (char_length(business_name) <= 50) NOT VALID;
ALTER TABLE public.vendor_profiles VALIDATE CONSTRAINT vendor_profiles_business_name_max_50;

COMMENT ON CONSTRAINT vendor_profiles_business_name_max_50 ON public.vendor_profiles IS
  'A shop name is 50 characters at most (owner 2026-11-06). Mirrors SHOP_NAME_MAX in apps/web/lib/business-slug.ts.';

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

CREATE OR REPLACE FUNCTION public.claim_ready_the_invited_shop(p_user_id uuid, p_claim_token text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inv    public.vendor_invites%ROWTYPE;
  v_staged public.vendor_profiles%ROWTYPE;
  v_own    public.vendor_profiles%ROWTYPE;
  v_shop   uuid;
  v_now    public.vendor_profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_claim_token IS NULL OR length(p_claim_token) = 0 THEN
    RAISE EXCEPTION 'claim_ready_the_invited_shop: a user and a claim token are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inv FROM public.vendor_invites WHERE claim_token = p_claim_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_ready_the_invited_shop: no such link' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.source <> 'admin' THEN
    RAISE EXCEPTION 'claim_ready_the_invited_shop: not a Setnayan invite' USING ERRCODE = '22023';
  END IF;
  -- The same claimant again (a double tap, a refresh after the first call won): their shop, nothing re-applied.
  IF v_inv.status::text = 'claimed' AND v_inv.claimed_by_user_id = p_user_id
     AND v_inv.claimed_vendor_profile_id IS NOT NULL THEN
    RETURN v_inv.claimed_vendor_profile_id;
  END IF;
  IF v_inv.status::text <> 'pending' THEN
    RAISE EXCEPTION 'claim_ready_the_invited_shop: this link is %', v_inv.status USING ERRCODE = '55000';
  END IF;
  -- 🔒 The link's own end, checked HERE — not only by the page that called. A link past `expires_at` claims nothing.
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'claim_ready_the_invited_shop: this link has expired' USING ERRCODE = '55000';
  END IF;

  -- The shop the admin prepared — only while nobody owns it.
  IF v_inv.claimed_vendor_profile_id IS NOT NULL THEN
    SELECT * INTO v_staged FROM public.vendor_profiles
     WHERE vendor_profile_id = v_inv.claimed_vendor_profile_id AND user_id IS NULL
     FOR UPDATE;
  END IF;

  -- 🔒 THE CLAIMANT'S SHOP, PICKED EXPLICITLY — never "whichever row came first". The invite's prepared shop if it is
  -- already theirs, else their OLDEST shop. (`vendor_profiles.user_id` is UNIQUE today, so this is one row; the
  -- order is written down so the day a person can own two, this cannot silently pick the wrong one.)
  SELECT * INTO v_own FROM public.vendor_profiles
   WHERE user_id = p_user_id
   ORDER BY (vendor_profile_id = v_inv.claimed_vendor_profile_id) DESC NULLS LAST, created_at, vendor_profile_id
   LIMIT 1
   FOR UPDATE;

  IF v_own.vendor_profile_id IS NULL AND v_staged.vendor_profile_id IS NOT NULL THEN
    -- No shop yet: the prepared shop becomes theirs, whole.
    UPDATE public.vendor_profiles
       SET user_id = p_user_id, updated_at = NOW()
     WHERE vendor_profile_id = v_staged.vendor_profile_id AND user_id IS NULL;
    v_shop := v_staged.vendor_profile_id;

  ELSIF v_own.vendor_profile_id IS NULL THEN
    -- Nothing prepared (an old invite, or the row was removed): open one from the invite.
    INSERT INTO public.vendor_profiles (user_id, business_name, contact_email, services, is_published)
    VALUES (
      p_user_id,
      NULLIF(btrim(left(btrim(v_inv.business_name), 50)), ''),
      v_inv.email,
      CASE WHEN NULLIF(btrim(v_inv.service_category), '') IS NULL THEN ARRAY[]::text[]
           ELSE ARRAY[btrim(v_inv.service_category)] END,
      FALSE
    )
    RETURNING vendor_profile_id INTO v_shop;

  ELSIF v_staged.vendor_profile_id IS NOT NULL
        AND public.vendor_shop_is_untouched(v_own.vendor_profile_id, p_user_id) THEN
    -- 🔁 THE USUAL CASE: the vendor sign-up opened an EMPTY shop a moment ago. That shop is deleted (it holds nothing
    -- — `vendor_shop_is_untouched` proved it against every table that points at a shop; the only row that goes with
    -- it is the claimant's own admin seat, re-made below) and the PREPARED shop is handed over WHOLE — everything the
    -- admin set on it travels with it: name, service, contact, place, the gift tier, the founder flag, is_published,
    -- the photo allowance. Nothing is copied, so nothing can be forgotten.
    PERFORM set_config('app.vendor_empty_shop_handover', v_own.vendor_profile_id::text, true);
    DELETE FROM public.vendor_profiles WHERE vendor_profile_id = v_own.vendor_profile_id;
    PERFORM set_config('app.vendor_empty_shop_handover', '', true);
    UPDATE public.vendor_profiles
       SET user_id = p_user_id, updated_at = NOW()
     WHERE vendor_profile_id = v_staged.vendor_profile_id AND user_id IS NULL;
    v_shop := v_staged.vendor_profile_id;

  ELSE
    -- A REAL shop already (it holds something of the supplier's): it is kept, and the prepared shop is folded into
    -- it. WHAT IS COPIED from the prepared shop, and how:
    --   · business_name · services · contact_email · contact_phone · tagline · location_city · hq_address with its
    --     hq_latitude/hq_longitude — BLANKS ONLY: a value the supplier set is theirs;
    --   · is_founder    — TRUE if either shop is (never cleared);
    --   · is_published  — TRUE if either shop is (a published shop is never hidden by a claim);
    --   · portfolio_photo_allowance — the larger of the two (never lowered);
    --   · the GIFT TIER — tier_state · tier_expires_at · tier_source, only when the prepared shop holds a running
    --     admin comp AND this shop is Free/Verified with no credit and no scheduled change (the same rule as the
    --     invite's own offer below: a shop on a plan is never shortened, its credit never put at risk).
    -- Nothing else is copied. The prepared row is then deleted, still unowned — exactly as a revoke deletes it.
    v_shop := v_own.vendor_profile_id;
    UPDATE public.vendor_profiles vp
       SET business_name = COALESCE(NULLIF(btrim(vp.business_name), ''),
                                    NULLIF(btrim(v_staged.business_name), ''),
                                    NULLIF(btrim(left(btrim(v_inv.business_name), 50)), '')),
           services      = CASE WHEN COALESCE(cardinality(vp.services), 0) > 0 THEN vp.services
                                WHEN COALESCE(cardinality(v_staged.services), 0) > 0 THEN v_staged.services
                                WHEN NULLIF(btrim(v_inv.service_category), '') IS NOT NULL THEN ARRAY[btrim(v_inv.service_category)]
                                ELSE vp.services END,
           contact_email = COALESCE(vp.contact_email, v_staged.contact_email, v_inv.email),
           contact_phone = COALESCE(vp.contact_phone, v_staged.contact_phone),
           tagline       = COALESCE(vp.tagline, v_staged.tagline),
           location_city = COALESCE(vp.location_city, v_staged.location_city),
           hq_latitude   = CASE WHEN vp.hq_address IS NULL THEN v_staged.hq_latitude ELSE vp.hq_latitude END,
           hq_longitude  = CASE WHEN vp.hq_address IS NULL THEN v_staged.hq_longitude ELSE vp.hq_longitude END,
           hq_address    = COALESCE(vp.hq_address, v_staged.hq_address),
           is_founder    = vp.is_founder OR COALESCE(v_staged.is_founder, FALSE),
           is_published  = vp.is_published OR COALESCE(v_staged.is_published, FALSE),
           portfolio_photo_allowance = CASE
             WHEN v_staged.portfolio_photo_allowance IS NULL THEN vp.portfolio_photo_allowance
             ELSE GREATEST(COALESCE(vp.portfolio_photo_allowance, 0), v_staged.portfolio_photo_allowance) END,
           updated_at    = NOW()
     WHERE vp.vendor_profile_id = v_shop;

    IF v_staged.vendor_profile_id IS NOT NULL
       AND v_staged.tier_source = 'admin_comp'
       AND v_staged.tier_state::text IN ('solo', 'pro', 'enterprise')
       AND v_staged.tier_expires_at > NOW()
       AND v_own.tier_state::text IN ('free', 'verified')
       AND COALESCE(v_own.subscription_credit_php, 0) = 0
       AND v_own.pending_tier IS NULL THEN
      UPDATE public.vendor_profiles
         SET tier_state      = v_staged.tier_state,
             tier_expires_at = v_staged.tier_expires_at,
             tier_source     = 'admin_comp',
             updated_at      = NOW()
       WHERE vendor_profile_id = v_shop;
    END IF;

    IF v_staged.vendor_profile_id IS NOT NULL THEN
      UPDATE public.vendor_invites SET claimed_vendor_profile_id = v_shop WHERE invite_id = v_inv.invite_id;
      DELETE FROM public.vendor_profiles
       WHERE vendor_profile_id = v_staged.vendor_profile_id AND user_id IS NULL;
    END IF;
  END IF;

  INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
  VALUES (v_shop, p_user_id, 'admin')
  ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;

  -- ── THE OFFER ──────────────────────────────────────────────────────────────
  IF v_inv.offer_tier IS NOT NULL AND v_inv.offer_until > NOW() THEN
    SELECT * INTO v_now FROM public.vendor_profiles WHERE vendor_profile_id = v_shop FOR UPDATE;
    -- 🔒 FREE OR VERIFIED ONLY. A plan of any kind — even one past its day that the login-driven sweep has not
    -- reached yet — is never overwritten: its term and its credit are the shop's, and only its own lapse ends them.
    IF v_now.tier_state::text IN ('free', 'verified')
       AND COALESCE(v_now.subscription_credit_php, 0) = 0
       AND v_now.pending_tier IS NULL THEN
      UPDATE public.vendor_profiles
         SET tier_state      = v_inv.offer_tier::public.vendor_tier_state,
             tier_expires_at = v_inv.offer_until,
             tier_source     = 'admin_comp',
             updated_at      = NOW()
       WHERE vendor_profile_id = v_shop;
      INSERT INTO public.admin_audit_log (action, target_id, actor_user_id, metadata)
      VALUES (
        'vendor_tier_set',
        v_shop,
        v_inv.invited_by_user_id,
        jsonb_build_object(
          'public_id', (SELECT public_id FROM public.vendor_profiles WHERE vendor_profile_id = v_shop),
          'from_tier', v_now.tier_state::text,
          'to_tier', v_inv.offer_tier,
          'from_expires_at', v_now.tier_expires_at,
          'to_expires_at', v_inv.offer_until,
          'reason', 'Personal invite ' || v_inv.public_id,
          'invite_id', v_inv.invite_id
        )
      );
    END IF;
  END IF;

  IF v_inv.offer_photo_allowance IS NOT NULL THEN
    UPDATE public.vendor_profiles
       SET portfolio_photo_allowance = GREATEST(COALESCE(portfolio_photo_allowance, 0), v_inv.offer_photo_allowance),
           updated_at = NOW()
     WHERE vendor_profile_id = v_shop;
  END IF;

  -- 🔒 Spent, under the lock taken at the top: nobody else can claim this link now.
  UPDATE public.vendor_invites
     SET status = 'claimed',
         claimed_by_user_id = p_user_id,
         claimed_vendor_profile_id = v_shop,
         claimed_at = NOW()
   WHERE invite_id = v_inv.invite_id;

  RETURN v_shop;
END;
$$;

COMMENT ON FUNCTION public.claim_ready_the_invited_shop(uuid, text) IS
  'Finalize step 1 of a supplier claiming a Setnayan (admin) invite. Refuses a link that is not a pending admin invite '
  'or is past expires_at. Picks the claimant''s shop explicitly (the prepared one, else the oldest). The empty shop the '
  'sign-up opened is deleted and the prepared shop handed over whole; a real existing shop is kept and the prepared '
  'one folded in (blanks · founder · published · allowance · a running gift tier onto Free/Verified — listed in the '
  'body). Ensures the admin seat; applies the invite''s offer only to a Free/Verified shop with no credit and no '
  'scheduled change; marks the invite claimed under its row lock (the same claimant again gets their shop back). '
  'Service role only.';

REVOKE ALL ON FUNCTION public.claim_ready_the_invited_shop(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_the_invited_shop(uuid, text) TO service_role;

COMMIT;
