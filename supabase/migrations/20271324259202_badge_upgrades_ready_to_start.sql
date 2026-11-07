-- badge_upgrades_ready_to_start
-- ============================================================================
-- BADGE UPGRADES — four weeks of a catalogue add-on for the supplier's OWN shop,
-- ready until the supplier taps Start (owner approved the table 2026-11-06,
-- DECISION_LOG "BADGE REWARDS — THE APPROVED TABLE (6 NOV)").
--
--   Verified                           → Papic Challenges
--   First booking through Setnayan     → 3D Booth (below Solo: Papic Challenges
--                                        instead — the booth logo only shows on
--                                        Solo and up)
--   5 reviews                          → AI Chatbot
--   Top Pick / Most Booked of a month  → one of the three, the supplier's choice
--                                        (on top of the Event Plus that award
--                                        already puts in the gift stock)
--
-- WHAT THIS FILE DOES (extends shop_badge_rewards' pattern; touches no gift stock):
--   1. `shop_badge_upgrades` — ONE row per upgrade earned, UNIQUE (shop,
--      reward_key) so each badge step gives its upgrade exactly once. A row is
--      READY (started_at NULL) until Start; a ready row never expires.
--   2. `shop_badge_upgrade_grant` — the one door an upgrade takes in.
--      Idempotent (ON CONFLICT DO NOTHING on the key). service_role only.
--   3. `shop_badge_upgrade_start` — the one door out of "ready". Under a row
--      lock it re-checks the choice against the row and the shop's plan (the 3D
--      Booth needs Solo+ — `vendor_tier_rank`; below it the booth becomes Papic
--      Challenges), then extends the SAME entitlement column a paid purchase
--      extends — papic_challenge_expires_at · booth_addon_expires_at ·
--      ai_addon_expires_at — stacking from the LATER of now and the current
--      expiry, exactly as nextPhotoChallengeExpiry / nextVendor3dBoothExpiry /
--      nextVendorAiAddonExpiry do. The period arrives from the app, which reads
--      the add-on's own period constant (the paid activation's); bounded here.
--      A started row can never start again. service_role only — the server
--      action proves the shop is the signed-in supplier's before calling.
--
-- No trial column is touched (booth_addon_trial_used_at / ai_addon_trial_used_at
-- stay the paid free-first-cycle's business), and no price or product is typed.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · the upgrades a shop earned ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_badge_upgrades (
  upgrade_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id   UUID NOT NULL
                        REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The badge and its step or period — the exactly-once key ('upgrade:verified',
  -- 'upgrade:reviews:5', 'upgrade:award:top_pick:2026-11-01').
  reward_key          TEXT NOT NULL
                        CONSTRAINT shop_badge_upgrades_reward_key_shape
                        CHECK (reward_key LIKE 'upgrade:%' AND length(reward_key) <= 120),
  badge               TEXT NOT NULL
                        CONSTRAINT shop_badge_upgrades_badge_allowed
                        CHECK (badge IN ('verified', 'first_booking', 'reviews', 'award')),
  -- What Start may begin (more than one = the supplier picks).
  choices             TEXT[] NOT NULL
                        CONSTRAINT shop_badge_upgrades_choices_allowed
                        CHECK (cardinality(choices) BETWEEN 1 AND 3
                               AND choices <@ ARRAY['photo_challenge', '3d_booth', 'ai_chatbot']::TEXT[]),
  note                TEXT,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Start: what began, when, for how long, and the add-on's new expiry.
  started_choice      TEXT
                        CONSTRAINT shop_badge_upgrades_started_choice_allowed
                        CHECK (started_choice IS NULL OR started_choice IN ('photo_challenge', '3d_booth', 'ai_chatbot')),
  started_at          TIMESTAMPTZ,
  started_period_days INTEGER
                        CONSTRAINT shop_badge_upgrades_period_range
                        CHECK (started_period_days IS NULL OR started_period_days BETWEEN 1 AND 366),
  ends_at             TIMESTAMPTZ,
  CONSTRAINT shop_badge_upgrades_started_together CHECK (
    (started_at IS NULL AND started_choice IS NULL AND started_period_days IS NULL AND ends_at IS NULL)
    OR (started_at IS NOT NULL AND started_choice IS NOT NULL AND started_period_days IS NOT NULL AND ends_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_badge_upgrades_once
  ON public.shop_badge_upgrades (vendor_profile_id, reward_key);

CREATE INDEX IF NOT EXISTS shop_badge_upgrades_ready_idx
  ON public.shop_badge_upgrades (vendor_profile_id, granted_at)
  WHERE started_at IS NULL;

COMMENT ON TABLE public.shop_badge_upgrades IS
  'Four weeks of a catalogue add-on a badge gave the supplier''s OWN shop (owner 2026-11-06, DECISION_LOG "BADGE '
  'REWARDS — THE APPROVED TABLE (6 NOV)"): Verified → Papic Challenges · first booking → 3D Booth (below Solo: Papic '
  'Challenges) · 5 reviews → AI Chatbot · Top Pick / Most Booked of a month → the supplier''s choice. UNIQUE '
  '(vendor_profile_id, reward_key): each badge step gives its upgrade once. READY until Start (never expires unused); '
  'shop_badge_upgrade_start extends the add-on''s own entitlement column. Written only by shop_badge_upgrade_grant and '
  'shop_badge_upgrade_start. No gift stock, no price.';

ALTER TABLE public.shop_badge_upgrades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_badge_upgrades_vendor_read ON public.shop_badge_upgrades;
CREATE POLICY shop_badge_upgrades_vendor_read
  ON public.shop_badge_upgrades
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.shop_badge_upgrades FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_badge_upgrades FROM authenticated;

-- ── 2 · the one door an upgrade takes in ────────────────────────────────────
-- Returns {status:'granted', upgrade_id} · {status:'already'} · {status:'bad_input'}.
CREATE OR REPLACE FUNCTION public.shop_badge_upgrade_grant(
  p_vendor_profile_id UUID,
  p_reward_key        TEXT,
  p_badge             TEXT,
  p_choices           TEXT[],
  p_note              TEXT DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_reward_key IS NULL OR p_reward_key NOT LIKE 'upgrade:%'
     OR p_badge IS NULL OR p_badge NOT IN ('verified', 'first_booking', 'reviews', 'award')
     OR p_choices IS NULL OR cardinality(p_choices) NOT BETWEEN 1 AND 3
     OR NOT (p_choices <@ ARRAY['photo_challenge', '3d_booth', 'ai_chatbot']::TEXT[]) THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;

  INSERT INTO public.shop_badge_upgrades (vendor_profile_id, reward_key, badge, choices, note)
  VALUES (p_vendor_profile_id, btrim(p_reward_key), p_badge, p_choices, p_note)
  ON CONFLICT (vendor_profile_id, reward_key) DO NOTHING
  RETURNING upgrade_id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;
  RETURN jsonb_build_object('status', 'granted', 'upgrade_id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_badge_upgrade_grant(UUID, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_badge_upgrade_grant(UUID, TEXT, TEXT, TEXT[], TEXT) TO service_role;

COMMENT ON FUNCTION public.shop_badge_upgrade_grant(UUID, TEXT, TEXT, TEXT[], TEXT) IS
  'The ONE door a badge upgrade takes in (owner 2026-11-06). Exactly once per (shop, reward_key) by ON CONFLICT DO '
  'NOTHING. Called by grantOwedBadgeUpgrades (lib/badge-upgrades.server.ts) beside the gift-stock grant sweep.';

-- ── 3 · Start — the one door out of "ready" ─────────────────────────────────
-- Returns {status:'started', choice, ends_at} · {status:'already', choice, ends_at}
--       · {status:'not_found'} · {status:'bad_choice'} · {status:'bad_input'}.
CREATE OR REPLACE FUNCTION public.shop_badge_upgrade_start(
  p_upgrade_id        UUID,
  p_vendor_profile_id UUID,
  p_choice            TEXT,
  p_period_days       INTEGER
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row     public.shop_badge_upgrades%ROWTYPE;
  v_tier    public.vendor_tier_state;
  v_allowed TEXT[];
  v_ends    TIMESTAMPTZ;
BEGIN
  IF p_upgrade_id IS NULL OR p_vendor_profile_id IS NULL OR p_choice IS NULL
     OR p_period_days IS NULL OR p_period_days NOT BETWEEN 1 AND 366 THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;

  SELECT * INTO v_row
    FROM public.shop_badge_upgrades
   WHERE upgrade_id = p_upgrade_id
     AND vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_row.started_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already', 'choice', v_row.started_choice, 'ends_at', v_row.ends_at);
  END IF;

  -- The shop's plan decides whether the 3D Booth is startable (the booth logo
  -- shows on Solo and up); below it the booth becomes Papic Challenges —
  -- startableChoices() in lib/badge-upgrades.ts, the same rule.
  SELECT vp.tier_state INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF public.vendor_tier_rank(v_tier) >= public.vendor_tier_rank('solo'::public.vendor_tier_state) THEN
    v_allowed := v_row.choices;
  ELSE
    v_allowed := array_replace(v_row.choices, '3d_booth', 'photo_challenge');
  END IF;
  IF NOT (p_choice = ANY (v_allowed)) THEN
    RETURN jsonb_build_object('status', 'bad_choice');
  END IF;

  -- Extend the add-on's OWN entitlement, stacking on time already paid for.
  IF p_choice = 'photo_challenge' THEN
    UPDATE public.vendor_profiles
       SET papic_challenge_expires_at =
             GREATEST(COALESCE(papic_challenge_expires_at, NOW()), NOW()) + make_interval(days => p_period_days)
     WHERE vendor_profile_id = p_vendor_profile_id
    RETURNING papic_challenge_expires_at INTO v_ends;
  ELSIF p_choice = '3d_booth' THEN
    UPDATE public.vendor_profiles
       SET booth_addon_expires_at =
             GREATEST(COALESCE(booth_addon_expires_at, NOW()), NOW()) + make_interval(days => p_period_days)
     WHERE vendor_profile_id = p_vendor_profile_id
    RETURNING booth_addon_expires_at INTO v_ends;
  ELSE
    UPDATE public.vendor_profiles
       SET ai_addon_expires_at =
             GREATEST(COALESCE(ai_addon_expires_at, NOW()), NOW()) + make_interval(days => p_period_days)
     WHERE vendor_profile_id = p_vendor_profile_id
    RETURNING ai_addon_expires_at INTO v_ends;
  END IF;

  UPDATE public.shop_badge_upgrades
     SET started_choice      = p_choice,
         started_at          = NOW(),
         started_period_days = p_period_days,
         ends_at             = v_ends
   WHERE upgrade_id = p_upgrade_id;

  RETURN jsonb_build_object('status', 'started', 'choice', p_choice, 'ends_at', v_ends);
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_badge_upgrade_start(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_badge_upgrade_start(UUID, UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.shop_badge_upgrade_start(UUID, UUID, TEXT, INTEGER) IS
  'Start a ready badge upgrade (owner 2026-11-06): under a row lock, re-checks the choice against the row and the '
  'shop''s plan (3D Booth needs Solo+, else it becomes Papic Challenges), extends the add-on''s own entitlement column '
  'from the later of now and its current expiry by p_period_days (the add-on''s period constant, read by the app), and '
  'stamps the row. A started row never starts again. service_role only — startBadgeUpgrade proves the shop first.';

COMMIT;
