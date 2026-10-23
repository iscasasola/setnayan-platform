-- the_personal_invite_carries_its_offer
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS ·
-- DROP/ADD CONSTRAINT · CREATE OR REPLACE FUNCTION · DROP/CREATE TRIGGER ·
-- REVOKE/GRANT. No new table, no new policy.
--
-- ── WHY (owner 2026-10-23, prototype supplier_personal_invite_2026-10-23.html) ──
-- *"their personal invite will have special features … The only difference is
-- we can offer what plan they get for free and until when, how many portfolio
-- photos they can upload (normal is 50. we can make it 100)."* → *"making it
-- 100 is optional"* → ruling: the 100 is KEPT by the supplier after the offer
-- ends (DECISION_LOG 2026-10-23).
--
-- The admin's invite already exists (`createAdminVendorInvite`: a staged
-- `vendor_profiles` row + a `vendor_invites` row, source 'admin'). This adds
-- only what the offer needs:
--
--   1 · THREE NULLABLE COLUMNS ON THE INVITE — `offer_tier` · `offer_until` ·
--       `offer_photo_allowance`. Nothing is granted at invite time: an
--       unclaimed invite grants nothing, and a revoked one leaves no comp.
--
--   2 · ONE PER-SHOP ALLOWANCE — `vendor_profiles.portfolio_photo_allowance`.
--       The cap a shop's page holds is max(PORTFOLIO_FREE_BASE, allowance)
--       (`portfolioPhotoCap`, lib/vendor-tier-caps.ts). It is NOT tied to the
--       plan, so it outlives the gift by construction — no lapse logic exists
--       to forget. Never writable by the shop itself (guard trigger below).
--
--   3 · THE CLAIM, IN ONE CALL — `claim_ready_the_invited_shop(user, token)`.
--
--       🔑 THE ADMIN INVITE NEVER REACHED ITS STAGED SHOP. `/signup?as=vendor`
--       makes the account a vendor, and `handle_new_vendor_user` opens an EMPTY
--       shop the same instant (the very defect `claim_ready_the_shop` fixed for
--       the couple's link, 20271280303462). The finalize page then found "the
--       user's shop" — that empty one — and took its "already has a shop"
--       branch: the staged row the admin filled (name · category · email) was
--       left orphaned with user_id NULL, and the supplier arrived nameless.
--       This function is the admin-source twin of `claim_ready_the_shop`:
--         · no shop yet → the staged row is handed over (user_id := claimant);
--         · a shop already → its BLANKS are filled from the staged row (a name
--           or a service the supplier set is theirs), and the staged row — still
--           unclaimed, user_id NULL — is deleted, exactly as a revoke deletes it;
--         · the admin seat is ensured;
--         · THE OFFER is applied — the same three columns `setVendorTier`
--           writes (tier_state · tier_expires_at · tier_source = 'admin_comp')
--           so `/admin/gifts` lists it, only when it raises the shop (a shop
--           already on an equal or better running plan keeps it) and only while
--           the gift date is still ahead; the photo allowance is raised to the
--           invite's, never lowered; and one `admin_audit_log` row
--           ('vendor_tier_set', actor = the admin who made the invite, reason
--           "Personal invite <public_id>") — the same log line the Plan page
--           writes.
--       Service role only: the finalize page calls it after proving the session.
--
-- Proven by tests/db/the-personal-invite-carries-its-offer.db.test.ts.

-- ═══ 1 · the invite's offer ═════════════════════════════════════════════════
ALTER TABLE public.vendor_invites
  ADD COLUMN IF NOT EXISTS offer_tier            text,
  ADD COLUMN IF NOT EXISTS offer_until           timestamptz,
  ADD COLUMN IF NOT EXISTS offer_photo_allowance integer;

ALTER TABLE public.vendor_invites DROP CONSTRAINT IF EXISTS vendor_invites_offer_tier_is_a_paid_plan;
ALTER TABLE public.vendor_invites ADD CONSTRAINT vendor_invites_offer_tier_is_a_paid_plan
  CHECK (offer_tier IS NULL OR offer_tier IN ('solo', 'pro', 'enterprise'));

-- A plan gift always says until when (the owner's "for free and until when").
ALTER TABLE public.vendor_invites DROP CONSTRAINT IF EXISTS vendor_invites_offer_tier_has_an_end;
ALTER TABLE public.vendor_invites ADD CONSTRAINT vendor_invites_offer_tier_has_an_end
  CHECK ((offer_tier IS NULL) = (offer_until IS NULL));

ALTER TABLE public.vendor_invites DROP CONSTRAINT IF EXISTS vendor_invites_offer_photo_allowance_positive;
ALTER TABLE public.vendor_invites ADD CONSTRAINT vendor_invites_offer_photo_allowance_positive
  CHECK (offer_photo_allowance IS NULL OR offer_photo_allowance BETWEEN 1 AND 1000);

-- Only Setnayan's own invite carries an offer — a couple's link never does.
ALTER TABLE public.vendor_invites DROP CONSTRAINT IF EXISTS vendor_invites_offer_is_setnayans;
ALTER TABLE public.vendor_invites ADD CONSTRAINT vendor_invites_offer_is_setnayans
  CHECK (source = 'admin' OR (offer_tier IS NULL AND offer_until IS NULL AND offer_photo_allowance IS NULL));

COMMENT ON COLUMN public.vendor_invites.offer_tier IS
  'Personal invite (admin source): the plan given free on claim — solo · pro · enterprise (shown as Ultra). NULL = no plan gift.';
COMMENT ON COLUMN public.vendor_invites.offer_until IS
  'Personal invite: the gifted plan''s end — written to vendor_profiles.tier_expires_at on claim. Set exactly when offer_tier is.';
COMMENT ON COLUMN public.vendor_invites.offer_photo_allowance IS
  'Personal invite: portfolio photos the shop holds free (owner 2026-10-23: 100, optional). Written to vendor_profiles.portfolio_photo_allowance on claim and KEPT after the plan gift ends.';

-- ═══ 2 · the shop's photo allowance ═════════════════════════════════════════
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS portfolio_photo_allowance integer;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_portfolio_photo_allowance_positive;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_portfolio_photo_allowance_positive
  CHECK (portfolio_photo_allowance IS NULL OR portfolio_photo_allowance BETWEEN 1 AND 1000);

COMMENT ON COLUMN public.vendor_profiles.portfolio_photo_allowance IS
  'Portfolio photos this shop holds free when above the every-plan base (PORTFOLIO_FREE_BASE = 50). Given by a personal invite; kept after the plan gift ends (owner 2026-10-23). NULL = the base. Admin / service role only.';

-- The shop reads its own allowance (the photo cap is enforced on its session);
-- a stranger does not. `authenticated` holds column-scoped SELECT on this
-- table (20271217955839), so a new column is unreadable until named here.
GRANT SELECT (portfolio_photo_allowance) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (portfolio_photo_allowance) ON public.vendor_profiles FROM anon;

-- The shop's own definer view projects every column as of its CREATE — rebuilt so it carries the new one
-- (`lint-vendor-profiles-column-grants`; block copied from 20271217955839, unchanged).
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;

  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;

REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';

-- Never written by the shop: `authenticated` holds table-level UPDATE/INSERT,
-- which column REVOKEs cannot narrow — so a trigger refuses it, the same rule
-- `guard_vendor_profiles_entitlement` applies to the tier columns (and a no-op
-- outside the browser roles, so the admin console and this claim still write).
CREATE OR REPLACE FUNCTION public.guard_vendor_portfolio_photo_allowance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.portfolio_photo_allowance IS NOT NULL THEN
        RAISE EXCEPTION 'vendor_profiles.portfolio_photo_allowance is not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.portfolio_photo_allowance IS DISTINCT FROM OLD.portfolio_photo_allowance THEN
      RAISE EXCEPTION 'vendor_profiles.portfolio_photo_allowance is not writable by the vendor (self-grant blocked)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_vendor_portfolio_photo_allowance ON public.vendor_profiles;
CREATE TRIGGER guard_vendor_portfolio_photo_allowance
  BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_portfolio_photo_allowance();

-- ═══ 3 · the claim ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.claim_ready_the_invited_shop(p_user_id uuid, p_claim_token text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inv      public.vendor_invites%ROWTYPE;
  v_staged   public.vendor_profiles%ROWTYPE;
  v_shop     uuid;
  v_tier     text;
  v_expires  timestamptz;
  v_rank_now integer;
  v_rank_new integer;
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
  IF v_inv.status::text <> 'pending' THEN
    RAISE EXCEPTION 'claim_ready_the_invited_shop: this link is %', v_inv.status USING ERRCODE = '55000';
  END IF;

  -- The staged row the admin filled — only while nobody owns it.
  IF v_inv.claimed_vendor_profile_id IS NOT NULL THEN
    SELECT * INTO v_staged FROM public.vendor_profiles
     WHERE vendor_profile_id = v_inv.claimed_vendor_profile_id AND user_id IS NULL
     FOR UPDATE;
  END IF;

  SELECT vendor_profile_id INTO v_shop FROM public.vendor_profiles WHERE user_id = p_user_id;

  IF v_shop IS NULL AND v_staged.vendor_profile_id IS NOT NULL THEN
    -- No shop yet: the staged row becomes theirs.
    UPDATE public.vendor_profiles
       SET user_id = p_user_id, updated_at = NOW()
     WHERE vendor_profile_id = v_staged.vendor_profile_id AND user_id IS NULL;
    v_shop := v_staged.vendor_profile_id;
  ELSIF v_shop IS NULL THEN
    -- Nothing staged (an old invite, or the row was removed): open one from the invite.
    INSERT INTO public.vendor_profiles (user_id, business_name, contact_email, services, is_published)
    VALUES (
      p_user_id,
      NULLIF(btrim(v_inv.business_name), ''),
      v_inv.email,
      CASE WHEN NULLIF(btrim(v_inv.service_category), '') IS NULL THEN ARRAY[]::text[]
           ELSE ARRAY[btrim(v_inv.service_category)] END,
      FALSE
    )
    RETURNING vendor_profile_id INTO v_shop;
  ELSE
    -- A shop already (the sign-up trigger opened an empty one): fill ITS blanks
    -- from what the admin staged, or from the invite when nothing was staged.
    UPDATE public.vendor_profiles vp
       SET business_name = COALESCE(NULLIF(btrim(vp.business_name), ''),
                                    NULLIF(btrim(v_staged.business_name), ''),
                                    NULLIF(btrim(v_inv.business_name), '')),
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
           updated_at    = NOW()
     WHERE vp.vendor_profile_id = v_shop;

    -- The staged row is spent. Still unowned, so this is the revoke's own delete.
    IF v_staged.vendor_profile_id IS NOT NULL AND v_staged.vendor_profile_id <> v_shop THEN
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
    SELECT tier_state::text, tier_expires_at INTO v_tier, v_expires
      FROM public.vendor_profiles WHERE vendor_profile_id = v_shop;
    -- A plan that has run out counts as Free (the sweep may not have run yet).
    v_rank_now := CASE WHEN v_expires IS NOT NULL AND v_expires <= NOW() THEN 0 ELSE
      CASE v_tier WHEN 'solo' THEN 2 WHEN 'pro' THEN 3 WHEN 'enterprise' THEN 4 WHEN 'custom' THEN 5 ELSE 0 END
    END;
    v_rank_new := CASE v_inv.offer_tier WHEN 'solo' THEN 2 WHEN 'pro' THEN 3 WHEN 'enterprise' THEN 4 ELSE 0 END;
    IF v_rank_new > v_rank_now THEN
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
          'from_tier', v_tier,
          'to_tier', v_inv.offer_tier,
          'from_expires_at', v_expires,
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

  RETURN v_shop;
END;
$$;

COMMENT ON FUNCTION public.claim_ready_the_invited_shop(uuid, text) IS
  'Finalize step 1 of a supplier claiming a Setnayan (admin) invite: hand over the staged shop, or fill the '
  'user''s own shop''s blanks from it and drop the staged row; ensure the admin seat; apply the personal '
  'invite''s offer (plan + until, as an admin comp, only when it raises the shop; the photo allowance, kept). '
  'Refuses a link that is not a pending admin invite. Service role only.';

REVOKE ALL ON FUNCTION public.claim_ready_the_invited_shop(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_the_invited_shop(uuid, text) TO service_role;

