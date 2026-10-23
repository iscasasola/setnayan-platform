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
--         · a shop already → see the next two lines;
--         · the claimant's shop is PICKED, never "the first row": the prepared
--           one if already theirs, else their oldest;
--         · when that shop is the EMPTY one the sign-up just opened (proved by
--           `vendor_shop_is_untouched` against every table that references a
--           shop), it is deleted and the PREPARED shop is handed over whole —
--           gift tier, founder flag, is_published and all; a REAL shop is kept
--           and the prepared one folded in (the function lists what is copied);
--         · a link past its `expires_at` is refused here, not only by the page;
--         · the admin seat is ensured;
--         · THE OFFER is applied — the same three columns `setVendorTier`
--           writes (tier_state · tier_expires_at · tier_source = 'admin_comp')
--           so `/admin/gifts` lists it — ONLY to a Free or Verified shop that
--           carries no credit and no scheduled plan change, and only while the
--           gift date is still ahead. 🔒 A shop on any plan (paid or given,
--           running or past its day) is left exactly as it is: writing the
--           gift's day over a paid term would SHORTEN it, and the gift's own
--           lapse would ZERO a carried credit (owner 2026-08-28: the credit
--           goes with the plan). The photo allowance is raised to the invite's,
--           never lowered; and one `admin_audit_log` row ('vendor_tier_set',
--           actor = the admin who made the invite, reason "Personal invite
--           <public_id>") — the same log line the Plan page writes;
--         · 🔒 THE INVITE IS MARKED CLAIMED HERE, under the row lock taken at
--           the top — so a shared link is spent exactly once. A second
--           claimant waits on the lock, then finds it claimed and is refused;
--           the SAME user retrying (a double tap, a refresh) gets their shop
--           back and nothing is applied twice.
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

-- A plan gift runs a year at most from the day it is offered (owner review 2026-10-23: "cap offer_until, max 1 year
-- ahead"; the form says the same — PERSONAL_INVITE_MAX_DAYS in lib/personal-invite-offer.ts). The extra day is the
-- end-of-day instant: the form's last allowed DAY is stored as that Manila day's last second.
ALTER TABLE public.vendor_invites DROP CONSTRAINT IF EXISTS vendor_invites_offer_until_within_a_year;
ALTER TABLE public.vendor_invites ADD CONSTRAINT vendor_invites_offer_until_within_a_year
  CHECK (offer_until IS NULL OR offer_until <= created_at + interval '1 year' + interval '1 day');

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

-- Is this shop the EMPTY one `handle_new_vendor_user` opened at sign-up — safe to delete so the admin-prepared shop
-- can be handed over instead? Proven, never guessed: ~100 tables cascade from `vendor_profiles`, so "empty" means
--   · the row itself carries nothing a person or the platform put there (no name, service, contact, place, photo,
--     plan, credit, scheduled change, founder flag or allowance; never published), AND
--   · NO row in ANY table that references `vendor_profiles` points at it — read from the catalogue, so a table added
--     later is covered without anyone remembering this function — except the claimant's own admin seat.
-- Any doubt answers FALSE (a read it cannot make, a multi-column key): the claim then keeps that shop and fills its
-- blanks instead, which can never lose anything.
CREATE OR REPLACE FUNCTION public.vendor_shop_is_untouched(p_shop uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_p   public.vendor_profiles%ROWTYPE;
  v_fk  record;
  v_hit boolean;
BEGIN
  SELECT * INTO v_p FROM public.vendor_profiles WHERE vendor_profile_id = p_shop;
  IF NOT FOUND OR v_p.user_id IS DISTINCT FROM p_user_id THEN
    RETURN FALSE;
  END IF;
  IF NULLIF(btrim(v_p.business_name), '') IS NOT NULL
     OR COALESCE(cardinality(v_p.services), 0) > 0
     OR v_p.is_published
     OR v_p.is_founder
     OR v_p.tier_state::text <> 'free'
     OR v_p.tier_expires_at IS NOT NULL
     OR COALESCE(v_p.subscription_credit_php, 0) <> 0
     OR v_p.pending_tier IS NOT NULL
     OR v_p.portfolio_photo_allowance IS NOT NULL
     OR COALESCE(cardinality(v_p.portfolio_r2_keys), 0) > 0
     OR v_p.contact_phone IS NOT NULL
     OR v_p.tagline IS NOT NULL
     OR v_p.location_city IS NOT NULL
     OR v_p.hq_address IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  FOR v_fk IN
    SELECT c.conrelid::regclass AS tbl, c.conkey, a.attname AS col
      FROM pg_constraint c
      LEFT JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.vendor_profiles'::regclass
  LOOP
    IF array_length(v_fk.conkey, 1) <> 1 OR v_fk.col IS NULL THEN
      RETURN FALSE;
    END IF;
    IF v_fk.tbl = 'public.vendor_team_members'::regclass THEN
      SELECT EXISTS (SELECT 1 FROM public.vendor_team_members
                      WHERE vendor_profile_id = p_shop AND user_id IS DISTINCT FROM p_user_id) INTO v_hit;
    ELSE
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_fk.tbl, v_fk.col) INTO v_hit USING p_shop;
    END IF;
    IF v_hit THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.vendor_shop_is_untouched(uuid, uuid) IS
  'TRUE only for the empty shop the vendor sign-up opened: nothing on the row, and no row in any table that references '
  'vendor_profiles points at it (read from pg_constraint) except the claimant''s own admin seat. Any doubt is FALSE. '
  'Used by claim_ready_the_invited_shop to decide whether that shop may be deleted. Service role only.';

REVOKE ALL ON FUNCTION public.vendor_shop_is_untouched(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_shop_is_untouched(uuid, uuid) TO service_role;

-- The last-admin guard gains ONE named exception for the hand-over below. It is re-declared from its latest body
-- (20271126915299) with only the `v_handover` lines added. Why not reuse the erasure flag: that one means "remove
-- this person", and one flag doing two jobs is how a rule's exception spreads. Why not exempt every cascade: this
-- guard is also what keeps an owner from deleting their own shop over the REST API today.
CREATE OR REPLACE FUNCTION public.vendor_team_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor        UUID := auth.uid();
  v_approved     BOOLEAN := COALESCE(current_setting('app.vendor_admin_change_approved', true), '') = 'true';
  -- Set ONLY by public.erase_vendor_seats below, which is the RA 10173 erasure
  -- path. Deliberately a separate flag from v_approved: that one means "the
  -- team voted to remove another admin" and must NOT also mean "it is fine to
  -- leave this shop with no admin at all". One flag doing both jobs would let a
  -- team vote empty a shop by accident.
  v_erasing      BOOLEAN := COALESCE(current_setting('app.vendor_seat_erasure', true), '') = 'true';
  -- Set ONLY by public.claim_ready_the_invited_shop (20271286262047), transaction-local, to the id of the ONE empty
  -- sign-up shop it is deleting so the admin-prepared shop can be handed over. Honoured only for that shop's seats
  -- and only once that shop row is already gone — a shop being deleted cannot be "left without an admin". A third
  -- named flag, not v_erasing: erasure means "remove this person", this means "remove this empty shop".
  v_handover     TEXT := NULLIF(current_setting('app.vendor_empty_shop_handover', true), '');
  v_other_admins INT;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    IF v_other_admins < 1 AND NOT v_erasing
       AND NOT (v_handover IS NOT NULL AND v_handover = OLD.vendor_profile_id::text
                AND NOT EXISTS (SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = OLD.vendor_profile_id)) THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    -- Removing ANOTHER admin needs the approved flag; self-removal is allowed.
    -- Erasure is self-removal by definition (the seat belongs to the subject),
    -- so this arm is left exactly as it was.
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: removing another admin needs a team vote';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    -- NOT exempted. Erasure DELETES a seat; it never demotes one. A demotion
    -- that empties a shop is still the mistake this guard was written to stop.
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: demoting another admin needs a team vote';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

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
      NULLIF(btrim(v_inv.business_name), ''),
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

