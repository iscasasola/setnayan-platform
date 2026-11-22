-- supplier_final_ladder_2026_11_22
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🪜 THE FINAL SUPPLIER LADDER — owner 2026-11-22 ("FINAL LADDER" + "STARTER BUSINESS"; sizes re-cut by "SUPPLIER SIZES RE-CUT" +
-- "PLUS CUT TO 128 GB"), specs
-- SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md § ★ B. The plans ARE storage sizes:
--
--   plan (code)          storage   live cards   people beyond owner   branches beyond main shop   categories
--   Free     (free)       256 MB    1            0                     0                           1
--   Verified (verified)   2 GB      3            0                     0                           1
--   Plus     (solo)       128 GB    15           2                     0                           no limit
--   Pro      (pro)        500 GB    no limit     no limit              no limit                    no limit
--   Ultra    (enterprise) 1 TB      no limit     no limit              no limit                    no limit
--
-- Pro and Ultra: storage is the only ceiling; every branch belongs to the same registered business. Every tool on every
-- paid size (the photo challenge and the branded 3D booth open from Plus). No add-ons.
--
-- This is the DATA half of `TIER_CAPS` (apps/web/lib/vendor-tier-caps.ts), which moves in the same PR:
--   1 · the admin-editable `vendor_plan_contents` rows (NULL = no limit, as the app reads them);
--   2 · `vendor_tier_limit()`: 'storage_mb' (whole MB) 256 · 2,000 · 128,000 · 500,000 · 1,000,000 REPLACES 'storage_gb'
--       (Free 256 MB: owner 23 Nov "free unverified is 256 MB"; whole GB cannot say it. Verified 2 GB: "verified is 2Gb only") (Free and Verified had none), branches no limit on
--       Pro and Ultra — and a stored NULL for `branches_included` now MEANS no limit instead of falling back;
--   3 · `enforce_included_branch_allowance`: a NULL allowance is no limit (it used to COALESCE NULL to 0);
--   4 · `vendor_pro_tools_included`: Plus joins Pro and Ultra (owner: every tool on every paid size);
--   5 · the plan rows' max_categories / max_sub_seats in the catalogue (NULL = no limit, the column's own meaning).
--   6 · `offer_creator_reach_hold`: creator offers open on every paid size (owner 22 Nov "SAME FEATURES IN EVERY SIZE").
--   7 · `enforce_supplier_storage_allowance`: reads 'storage_mb' and names the size in its own words ("256 MB", "2 GB", "1 TB").
--
-- 🔑 NO PRICE IS WRITTEN, NO ROW IS RETIRED. Prices and the monthly-only catalogue are the next PR.
-- GRANDFATHERED: lowering a number takes nothing away (only Plus's people 1 → 2 and cards 10 → 15 move, both up).
-- RLS unchanged · no new table · no write to any shop's data.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ── 1 · the plan contents ──────────────────────────────────────────────────
-- `branches_included` may now be "no limit" (NULL): the gate below reads NULL as no limit. The other database-served
-- keys stay finite (their callers still COALESCE a NULL to 0). Same constraint name, so the guard tests still find it.
ALTER TABLE public.vendor_plan_contents
  DROP CONSTRAINT IF EXISTS vendor_plan_contents_sql_keys_finite_ck;
ALTER TABLE public.vendor_plan_contents
  ADD CONSTRAINT vendor_plan_contents_sql_keys_finite_ck CHECK (
    value IS NOT NULL
    OR key NOT IN ('whitelist_per_date', 'waitlist_acceptances', 'bookings_per_date_per_service')
  );

INSERT INTO public.vendor_plan_contents (plan, key, value) VALUES
  ('free', 'service_cards_total', 1),
  ('verified', 'service_cards_total', 3),
  ('solo', 'service_cards_total', 15),
  ('pro', 'service_cards_total', NULL),
  ('enterprise', 'service_cards_total', NULL),
  ('free', 'parent_categories', 1),
  ('verified', 'parent_categories', 1),
  ('solo', 'parent_categories', NULL),
  ('pro', 'parent_categories', NULL),
  ('enterprise', 'parent_categories', NULL),
  ('free', 'agent_accounts', 0),
  ('verified', 'agent_accounts', 0),
  ('solo', 'agent_accounts', 2),
  ('pro', 'agent_accounts', NULL),
  ('enterprise', 'agent_accounts', NULL),
  ('free', 'branches_included', 0),
  ('verified', 'branches_included', 0),
  ('solo', 'branches_included', 0),
  ('pro', 'branches_included', NULL),
  ('enterprise', 'branches_included', NULL)
ON CONFLICT (plan, key) DO UPDATE
   SET value = EXCLUDED.value
 WHERE vendor_plan_contents.value IS DISTINCT FROM EXCLUDED.value;

-- ── 2 · the database's own reader ──────────────────────────────────────────
-- The body of 20271350427190 with the 2026-11-22 numbers. ONE rule change: for `branches_included` a stored row is
-- the answer even when it is NULL (no limit) — before, COALESCE let a NULL row fall through to the code value, so
-- "no limit" could never be set. The other keys keep COALESCE (their callers read NULL as 0, and the admin screen
-- never offers "no limit" for them).
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH t AS (
    SELECT CASE WHEN COALESCE(p_tier, 'free') IN ('free', 'verified', 'solo', 'pro', 'enterprise')
                THEN COALESCE(p_tier, 'free') ELSE 'free' END AS plan
  ),
  stored AS (
    SELECT c.value
      FROM public.vendor_plan_contents c, t
     WHERE c.plan = t.plan
       AND c.key = p_key
  ),
  code AS (
    SELECT CASE p_key
      WHEN 'whitelist_per_date' THEN
        CASE t.plan
          WHEN 'free'       THEN 5              -- owner 2026-10-23: the same on every plan
          WHEN 'verified'   THEN 5
          WHEN 'solo'       THEN 5
          WHEN 'pro'        THEN 5
          WHEN 'enterprise' THEN 5
          ELSE 5                                -- unknown tier reads as free (asVendorTier)
        END
      WHEN 'waitlist_acceptances' THEN 10       -- owner 2026-11-18 (ruling 32): no plan limit — the column's own ceiling
      WHEN 'branches_included' THEN
        CASE t.plan
          WHEN 'pro'        THEN NULL           -- owner 2026-11-22: no limit (one registered business)
          WHEN 'enterprise' THEN NULL
          ELSE 0                                -- Free · Verified · Plus (and an unknown tier, read as Free)
        END
      WHEN 'storage_mb' THEN                    -- whole MB (decimal, as the supplier reads it); replaces 'storage_gb'
        CASE t.plan
          WHEN 'free'       THEN 256            -- owner 2026-11-23 "free unverified is 256 MB"
          WHEN 'verified'   THEN 2000           -- owner 2026-11-22 "verified is 2Gb only"
          WHEN 'solo'       THEN 128000         -- owner 2026-11-22 "FINAL LADDER": the plans are storage sizes
          WHEN 'pro'        THEN 500000
          WHEN 'enterprise' THEN 1000000        -- 1 TB
        END
      ELSE NULL                                 -- unknown key: NULL, never a silent 0
    END AS value
    FROM t
  )
  SELECT CASE
    WHEN p_key = 'branches_included' AND EXISTS (SELECT 1 FROM stored) THEN (SELECT value FROM stored)
    ELSE COALESCE((SELECT value FROM stored), (SELECT value FROM code))
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · storage_mb (the table also holds service_cards_total · parent_categories · agent_accounts, which the app reads). branches_included: NULL = no limit (Pro and Ultra since 2026-11-22), and a stored NULL row is honoured. storage_mb (whole MB, replaces storage_gb): 256 · 2000 · 128000 · 500000 · 1000000 (owner 2026-11-22 "FINAL LADDER", re-cut by "PLUS CUT TO 128 GB", "verified is 2Gb only" and 23 Nov "free unverified is 256 MB"). An unknown TIER reads as Free; an unknown KEY returns NULL on purpose. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';

-- ── 3 · the branch gate: NULL = no limit ───────────────────────────────────
-- The body of 20271307996183 with ONE change: a NULL allowance lets the branch through (was COALESCE(…, 0)).
CREATE OR REPLACE FUNCTION public.enforce_included_branch_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier   text;
  v_cap    int;
  v_in_use int;
BEGIN
  -- Only a row that BECOMES a live included branch is counted. Everything else (a paid branch, a rename, a cancel,
  -- a row that was already a live included branch) passes untouched — that is the grandfathering.
  IF NOT (NEW.included_in_plan AND NEW.cancelled_at IS NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.included_in_plan AND OLD.cancelled_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialise per shop: two concurrent adds must not both see "one left".
  SELECT vp.tier_state::text
    INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.parent_vendor_profile_id
   FOR UPDATE;

  v_cap := public.vendor_tier_limit(v_tier, 'branches_included');
  -- Owner 2026-11-22: Pro and Ultra have no branch limit — NULL is no limit, never 0.
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO v_in_use
    FROM public.vendor_branches b
   WHERE b.parent_vendor_profile_id = NEW.parent_vendor_profile_id
     AND b.included_in_plan
     AND b.cancelled_at IS NULL
     AND b.branch_id IS DISTINCT FROM NEW.branch_id;

  IF v_in_use >= v_cap THEN
    RAISE EXCEPTION 'included_branch_allowance: this plan includes % branches and % are in use', v_cap, v_in_use
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_included_branch_allowance() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_included_branch_allowance() IS
  'Refuses a vendor_branches row that BECOMES a live included branch (included_in_plan AND cancelled_at IS NULL) '
  'when the shop already holds vendor_tier_limit(tier, ''branches_included'') of them; a NULL allowance is no limit '
  '(Pro and Ultra, owner 2026-11-22). Rows already live are never touched (grandfathered). Serialised per shop by a '
  'row lock on vendor_profiles.';

-- ── 4 · the photo challenge and the 3D booth: every paid plan ──────────────
-- The body of 20271356215288 with ONE change: Plus (solo) joins Pro and Ultra in the first arm. The grandfather arms
-- are unchanged (a Plus shop no longer needs them, but a shop that drops to Verified keeps what it was given).
CREATE OR REPLACE FUNCTION public.vendor_pro_tools_included(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT
      -- Every paid plan includes them (owner 2026-11-22: every tool on every paid size; was Pro and Ultra).
      (vp.tier_state::TEXT IN ('solo', 'pro', 'enterprise')
         AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
      -- Grandfathered: the Plus term that was running when 20271356215288 shipped …
      OR (g.pro_tools_plus_until IS NOT NULL AND g.pro_tools_plus_until <> 'infinity'::TIMESTAMPTZ
          AND g.pro_tools_plus_until > NOW())
      OR (g.pro_tools_plus_until = 'infinity'::TIMESTAMPTZ
          AND vp.tier_state::TEXT = 'solo' AND vp.tier_expires_at IS NULL)
      -- … and a Specialized tools window or trial already held (the unlock's own verified floor, unchanged).
      OR (
        vp.verification_state::TEXT = 'verified'
        AND vp.tier_state::TEXT IN ('verified', 'solo', 'pro', 'enterprise')
        AND (
          (g.pro_tools_unlock_until IS NOT NULL AND g.pro_tools_unlock_until > NOW())
          OR (p_event_id IS NOT NULL
              AND g.trial_event_id = p_event_id
              AND g.pro_tools_trial_until IS NOT NULL
              AND g.pro_tools_trial_until > NOW())
        )
      )
    FROM public.vendor_profiles vp
    LEFT JOIN public.vendor_specialized_tools_access g
      ON g.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  ), FALSE);
$$;

COMMENT ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) IS
  'May this shop use the photo challenge and brand its 3D booth at this event? TRUE for a live Plus, Pro or Ultra plan (owner 2026-11-22: every tool on every paid size; was Pro and up from 20 Nov), or a shop grandfathered by the frozen vendor_specialized_tools_access.pro_tools_* columns. Called by vendor_papic_challenge_entitled and event_branded_booth_vendor_ids. Mirror: proToolsIncludedFrom (apps/web/lib/specialized-tools-access.ts). service_role only.';

REVOKE ALL ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_pro_tools_included(UUID, UUID) TO service_role;

-- ── 5 · the plan rows in the catalogue carry the same two caps ─────────────
-- (held by deep-search-one-price-and-plan-caps.db.test.ts; NULL = no limit, the columns' own CHECKs allow it)
UPDATE public.vendor_billing_catalog
   SET max_categories = v.cats, max_sub_seats = v.seats, updated_at = NOW()
  FROM (VALUES
          ('solo_vendor_monthly', NULL::int, 2),     ('solo_vendor_annual', NULL::int, 2),
          ('pro_vendor_monthly', NULL::int, NULL::int),        ('pro_vendor_annual', NULL::int, NULL::int),
          ('enterprise_vendor_monthly', NULL::int, NULL::int), ('enterprise_vendor_annual', NULL::int, NULL::int)
       ) AS v(sku_code, cats, seats)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND (vendor_billing_catalog.max_categories IS DISTINCT FROM v.cats
        OR vendor_billing_catalog.max_sub_seats IS DISTINCT FROM v.seats);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · Creator offers open on every paid size (owner 2026-11-22 "SAME FEATURES IN EVERY SIZE"; was Pro and up).
--     The function is the latest definition (20271121043599_creator_offers_free_no_token) with Plus added to the
--     tier gate and nothing else changed — same signature, so its grants and comment carry over.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.offer_creator_reach_hold(
  p_vendor_profile_id uuid,
  p_creator_user_id uuid,
  p_creator_rate_terms text,
  p_audience_rate_terms text DEFAULT NULL::text,
  p_reach_tokens integer DEFAULT 1,
  p_expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor      UUID := auth.uid();
  v_founder    UUID;
  v_is_founder BOOLEAN;
  v_tier       TEXT;
  v_offer_id   UUID;
  v_terms      TEXT := NULLIF(btrim(COALESCE(p_creator_rate_terms, '')), '');
BEGIN
  -- Answering-member gate (identical shape to unlock_vendor_event_hold).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = p_vendor_profile_id
      AND tm.user_id = v_actor
      AND tm.role IN ('owner', 'admin', 'agent')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member of this vendor';
  END IF;

  IF v_terms IS NULL THEN
    RAISE EXCEPTION 'MISSING_TERMS: a creator-rate discount is required';
  END IF;

  SELECT user_id, tier_state INTO v_founder, v_tier
    FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_profile_id;
  v_is_founder := (v_actor = v_founder);

  -- EVERY PAID SIZE (owner 2026-11-22, DECISION_LOG "SUPPLIER PLANS MIRROR ICLOUD+: SAME FEATURES IN EVERY
  -- SIZE"; was Pro and up, 2026-07-16). The send is free, but it is still a paid-size capability. The error code
  -- keeps its name: the app maps it.
  IF v_tier IS NULL OR v_tier NOT IN ('solo', 'pro', 'enterprise', 'custom') THEN
    RAISE EXCEPTION 'TIER_BELOW_PRO_NO_REACH: creator offers are a Pro-and-up feature';
  END IF;

  -- Self-offer guard: a vendor founder can't offer to their own creator profile.
  IF p_creator_user_id = v_founder THEN
    RAISE EXCEPTION 'SELF_OFFER: you cannot send a discount offer to yourself';
  END IF;

  -- Eligibility: the target is a creator (>=1 PUBLISHED chapter) on a PUBLIC
  -- profile. Derived, user-native definition (no is_creator flag).
  IF NOT EXISTS (
    SELECT 1
      FROM public.creator_chapters c
      JOIN public.users u ON u.user_id = c.user_id
     WHERE c.user_id = p_creator_user_id
       AND c.status = 'published'
       AND u.public_profile_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'NOT_A_CREATOR: target has no published chapter on a public profile';
  END IF;

  -- Creator solicitation opt-out (RA-10173 must-plan). The browse hides
  -- opted-out creators; this is the server-side floor beneath it.
  IF EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.user_id = p_creator_user_id
       AND u.creator_accepts_offers = FALSE
  ) THEN
    RAISE EXCEPTION 'CREATOR_OFFERS_OFF: this creator is not accepting vendor offers';
  END IF;

  -- One outstanding offer at a time (also enforced by the partial unique index).
  -- ⚠ THIS IS NOW THE ONLY THING RATIONING SENDS. The token cost used to be the
  -- economic brake; with the send free, this guard and the Pro-and-up gate are
  -- what stop a vendor blanketing every creator. Do not relax either.
  IF EXISTS (
    SELECT 1 FROM public.vendor_creator_offers
     WHERE vendor_id = p_vendor_profile_id
       AND creator_user_id = p_creator_user_id
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'OFFER_PENDING: you already have an outstanding offer to this creator';
  END IF;

  -- Open the offer. reach_tokens_held = 0 and escrowed_at stays NULL: nothing
  -- was charged, so the sweep must not refund and respond must not settle.
  INSERT INTO public.vendor_creator_offers
    (vendor_id, creator_user_id, creator_rate_terms, audience_rate_terms,
     status, reach_tokens_held, holder_user_id, is_founder_draw, expires_at)
  VALUES
    (p_vendor_profile_id, p_creator_user_id, v_terms,
     NULLIF(btrim(COALESCE(p_audience_rate_terms, '')), ''),
     'pending', 0, v_actor, v_is_founder, p_expires_at)
  RETURNING vendor_creator_offers.offer_id INTO v_offer_id;

  RETURN jsonb_build_object(
    'ok', true, 'escrowed', false, 'offer_id', v_offer_id,
    'tokens_charged', 0, 'creator_user_id', p_creator_user_id);
END;
$function$;


-- ── 7 · the storage backstop reads whole MB ('storage_mb') ─────────────────
-- Body from 20271342883073 VERBATIM except: the key ('storage_gb' → 'storage_mb'), the byte sum (MB × 1,000,000) and the
-- refusal's size words. Free is 256 MB (owner 2026-11-23), which a whole-GB number cannot hold.
CREATE OR REPLACE FUNCTION public.enforce_supplier_storage_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier   text;
  v_mb     int;
  v_words  text;
  v_size   bigint;
  v_used   bigint;
BEGIN
  IF NEW.media_id IS NULL THEN
    RETURN NEW;                                   -- a link, a portfolio pointer or a chat document: no stored bytes
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.media_id IS NOT DISTINCT FROM OLD.media_id THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_mb := public.vendor_tier_limit(v_tier, 'storage_mb');
  IF v_mb IS NULL THEN
    RETURN NEW;                                   -- no allowance known: never refuse on a guess
  END IF;

  -- One shop's filings in a row, so two uploads racing for the last megabytes cannot both get in.
  PERFORM pg_advisory_xact_lock(hashtext('supplier_storage:' || NEW.vendor_profile_id::text));

  -- These bytes are already counted (another file of this shop points at the same copy): a link adds nothing.
  IF EXISTS (
    SELECT 1 FROM public.event_supplier_files f
     WHERE f.media_id = NEW.media_id
       AND f.vendor_profile_id = NEW.vendor_profile_id
       AND (TG_OP = 'INSERT' OR f.file_id <> NEW.file_id)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(m.size_bytes, 0) INTO v_size
    FROM public.supplier_media m
   WHERE m.media_id = NEW.media_id AND m.vendor_profile_id = NEW.vendor_profile_id;
  v_used := public.vendor_storage_used_bytes(NEW.vendor_profile_id);

  IF v_used + COALESCE(v_size, 0) > v_mb::bigint * 1000000 THEN
    -- The size as the supplier reads it (lib/downgrade-limits.ts storageWords): "256 MB" · "2 GB" · "1 TB".
    v_words := CASE
      WHEN v_mb >= 1000000 AND v_mb % 1000000 = 0 THEN (v_mb / 1000000)::text || ' TB'
      WHEN v_mb >= 1000 AND v_mb % 1000 = 0 THEN (v_mb / 1000)::text || ' GB'
      ELSE v_mb::text || ' MB'
    END;
    RAISE EXCEPTION 'storage_allowance: this file does not fit the % your plan holds', v_words
      USING ERRCODE = 'P0001',
            HINT = 'Remove files from an event to make room, or move to a plan that holds more.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_supplier_storage_allowance() FROM PUBLIC, anon, authenticated;

COMMIT;
