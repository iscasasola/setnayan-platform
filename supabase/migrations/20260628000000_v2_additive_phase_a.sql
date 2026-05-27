-- =============================================================================
-- 20260628000000_v2_additive_phase_a.sql
-- V2 ARCHITECTURAL PIVOT · Phase A schema · NON-DESTRUCTIVE APPEND.
-- =============================================================================
--
-- SAFETY POSTURE — V1 PILOT UNTOUCHED.
-- This migration is purely additive: it ONLY creates new tables, indexes,
-- triggers, and functions. It does NOT drop, alter, or otherwise touch any
-- V1 surface. Specifically preserved:
--
--   ✓ users.concierge_trial_used_at        (kept untouched)
--   ✓ users.concierge_abuse_strike_count   (kept untouched)
--   ✓ users.concierge_enforcement_*        (all 4 columns kept)
--   ✓ events.concierge_trial_used_at       (kept untouched)
--   ✓ events.concierge_trial_started_by_user_id (kept untouched)
--   ✓ concierge_abuse_flags table          (kept untouched)
--   ✓ users_concierge_enforcement_idx      (kept untouched)
--   ✓ service_catalog (V1 19+ SKUs)        (kept untouched)
--   ✓ setnayan_pay_methods                 (kept untouched)
--   ✓ launch_promo_until columns           (kept untouched)
--
-- V2 tables are created with `_v2` suffix where the V1 namespace already has
-- a similar table or where parallel write paths are required:
--
--   platform_retail_catalog_v2     (parallel to V1 service_catalog)
--   event_software_activations_v2  (parallel namespace for V2 telemetry)
--
-- V2-only tables (no V1 collision) keep their natural names:
--
--   vendor_wallets · platform_package_catalog · registered_crew_devices
--   token_rewards_log · couple_briefs · vendor_bid_submissions
--   manual_payment_logs (manual QR overlay audit · new this migration)
--
-- Source-of-truth blueprint: ~/Desktop/setnayan_blueprint/💎 Part 1.md +
-- ~/Desktop/SQL Guide.pdf.
-- Operationalization doc: V2_Cutover_Plan_2026-05-28.md (Phase A section).
-- Decision-log row: CLAUDE.md 2026-05-28 fifth row (non-destructive pivot
-- · supersedes the third + fourth 2026-05-28 row destructive plans).
--
-- THIS MIGRATION IS PROD-SAFE TO PUSH. Pilot 2026-06-01 unchanged.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PASS 1 — VENDOR WALLET (dual-balance · purchased + 45-day-expiring earned)
-- =============================================================================
-- V1 namespace has no vendor_wallets table · safe to claim the unsuffixed name.

CREATE TABLE IF NOT EXISTS public.vendor_wallets (
  vendor_id        UUID PRIMARY KEY,
  purchased_tokens INT NOT NULL DEFAULT 0 CHECK (purchased_tokens >= 0),
  earned_tokens    INT NOT NULL DEFAULT 0 CHECK (earned_tokens    >= 0),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.vendor_wallets IS
  'V2 dual-balance vendor token wallet · earned_tokens expire 45 days after the event date (lazy-eval on read).';


-- =============================================================================
-- PASS 2 — V2 RETAIL CATALOG (parallel to V1 service_catalog · _v2 suffix)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_retail_catalog_v2 (
  service_code            TEXT PRIMARY KEY,
  title                   TEXT NOT NULL,
  retail_price_php        NUMERIC(10, 2) NOT NULL,
  saas_overhead_cost_php  NUMERIC(10, 2) NOT NULL,
  is_token_able           BOOLEAN DEFAULT FALSE
);

-- 19 V2 SKUs (blueprint Part 1 + PAKANTA added 2026-05-28).
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able)
VALUES
  ('ANIMATED_MONOGRAM',   'Animated Monogram Maker',                    2499.00, 140.00, FALSE),
  ('PRO_WEBSITE',         'Pro Wedding Website Subdomain',              2999.00, 150.00, FALSE),
  ('CUSTOM_QR_GUEST',     'Custom QR per Guest Token',                  1499.00,   0.00, FALSE),
  ('TODAYS_FOCUS',        'Todays Focus Dashboard Engine',              1499.00,   0.00, FALSE),
  ('PINOY_MAP_ROUTE',     'Traditional Pinoy Map Route Engine',         1499.00,   0.00, FALSE),
  ('INDOOR_BLUEPRINT',    'Indoor Blueprint Venue Layout Engine',       1499.00,   0.00, FALSE),
  ('CALL_TIME_ESCALATOR', 'Call-Time Escalator Coordinator Assistant',  1999.00, 100.00, FALSE),
  ('PATIKTOK_COMPILER',   'Patiktok WebAssembly Highlight Compiler',    2499.00, 140.00, TRUE),
  ('PABATI',              'Pabati 5-Second Video Guestbook Pass',        999.00,   0.00, TRUE),
  ('HIGH_RES_ARCHIVE',    'High Res Archive Yearly Subscription',       2999.00, 150.00, FALSE),
  ('PAPIC_GUEST',         'Papic Guest AI Gallery',                     2999.00, 174.00, FALSE),
  ('PAPIC_GUEST_STORIES', 'Papic Guest AI Gallery with Stories',        3499.00, 174.00, FALSE),
  ('PAPIC_MEDIA_PACK',    'Papic Guest with Stories + Thank You Video', 9999.00, 574.00, FALSE),
  ('PAPIC_SEATS',         'Papic Professional 5 Seats Pass',            2999.00, 174.00, TRUE),
  ('PANOOD_SYSTEM',       'Panood Multi-Cam Live Broadcast Engine',     3499.00, 699.80, TRUE),
  ('SDE',                 'Same Day Edit Video Processing Pass',        5499.00, 300.00, TRUE),
  ('CAMERA_BRIDGE',       'DSLR Mirrorless Camera Bridge Sync',         1999.00, 100.00, TRUE),
  ('LIVE_WALL',           'Live Venue Photo Wall Projection Socket',    3499.00, 200.00, TRUE),
  ('PAKANTA',             'Pakanta Custom Wedding Song Service',        3499.00, 200.00, TRUE)
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able;

COMMENT ON TABLE public.platform_retail_catalog_v2 IS
  'V2 catalog (parallel to V1 service_catalog). 19 SKUs · sold at 100% full retail · zero discounts. is_token_able=TRUE for the 8 services that fire telemetry-driven token rewards.';


-- =============================================================================
-- PASS 3 — MASTER PACKAGE BUNDLES (V2-only · no V1 namespace collision)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_package_catalog (
  package_code     TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  retail_price_php NUMERIC(10, 2) NOT NULL
);

INSERT INTO public.platform_package_catalog
  (package_code, title, retail_price_php)
VALUES
  ('GUIDED_PACK', 'Setnayan Guided Planner Suite',          11999.00),
  ('MEDIA_PACK',  'Setnayan Comprehensive Media Pack Bundle', 16999.00)
ON CONFLICT (package_code) DO UPDATE SET
  title            = EXCLUDED.title,
  retail_price_php = EXCLUDED.retail_price_php;


-- =============================================================================
-- PASS 4 — EVENT SOFTWARE ACTIVATIONS V2 (parallel namespace · _v2 suffix)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_software_activations_v2 (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL,
  vendor_id        UUID NOT NULL,
  service_code     TEXT NOT NULL REFERENCES public.platform_retail_catalog_v2(service_code),
  is_reward_issued BOOLEAN DEFAULT FALSE,
  rewarded_at      TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, service_code)
);

CREATE INDEX IF NOT EXISTS event_software_activations_v2_vendor_event_idx
  ON public.event_software_activations_v2(vendor_id, event_id);


-- =============================================================================
-- PASS 5 — CREW DEVICE 5-CAP (V2-only · no V1 collision)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.registered_crew_devices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL,
  vendor_id          UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  registered_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS registered_crew_devices_event_idx
  ON public.registered_crew_devices(event_id);

CREATE OR REPLACE FUNCTION public.check_crew_device_seat_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_active_devices INT;
BEGIN
  SELECT COUNT(*) INTO v_active_devices
    FROM public.registered_crew_devices
   WHERE event_id = NEW.event_id;

  IF v_active_devices >= 5 THEN
    RAISE EXCEPTION 'CREW_SEAT_LIMIT_EXCEEDED: On-site registration blocked. Maximum 5 operational technical device seats are full.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_crew_device_caps ON public.registered_crew_devices;
CREATE TRIGGER enforce_crew_device_caps
  BEFORE INSERT ON public.registered_crew_devices
  FOR EACH ROW EXECUTE FUNCTION public.check_crew_device_seat_allocation();


-- =============================================================================
-- PASS 6 — TOKEN REWARDS AUDIT LEDGER (V2-only · no V1 collision)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.token_rewards_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL,
  event_id       UUID NOT NULL,
  service_code   TEXT NOT NULL,
  tokens_awarded INT NOT NULL,
  processed_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS token_rewards_log_vendor_processed_idx
  ON public.token_rewards_log(vendor_id, processed_at DESC);


-- =============================================================================
-- PASS 7 — TELEMETRY REWARD FUNCTION (14-token stacking ladder)
-- =============================================================================
-- References platform_retail_catalog_v2 + event_software_activations_v2.

CREATE OR REPLACE FUNCTION public.execute_manpower_telemetry_reward(
  p_vendor_id    UUID,
  p_event_id     UUID,
  p_service_code TEXT
) RETURNS VOID AS $$
DECLARE
  v_activation_id        UUID;
  v_is_already_rewarded  BOOLEAN;
  v_completed_count      INT;
  v_payout_tokens        INT := 0;
BEGIN
  SELECT id, is_reward_issued
    INTO v_activation_id, v_is_already_rewarded
    FROM public.event_software_activations_v2
   WHERE event_id = p_event_id
     AND vendor_id = p_vendor_id
     AND service_code = p_service_code
     FOR UPDATE;

  IF v_is_already_rewarded OR v_activation_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.event_software_activations_v2
     SET is_reward_issued = TRUE,
         rewarded_at = NOW()
   WHERE id = v_activation_id;

  SELECT COUNT(*)
    INTO v_completed_count
    FROM public.event_software_activations_v2
   WHERE event_id = p_event_id
     AND vendor_id = p_vendor_id
     AND is_reward_issued = TRUE;

  IF    v_completed_count = 1 THEN v_payout_tokens := 1;  -- cumulative 1
  ELSIF v_completed_count = 2 THEN v_payout_tokens := 2;  -- cumulative 3
  ELSIF v_completed_count = 3 THEN v_payout_tokens := 2;  -- cumulative 5
  ELSIF v_completed_count = 4 THEN v_payout_tokens := 2;  -- cumulative 7
  ELSIF v_completed_count = 5 THEN v_payout_tokens := 2;  -- cumulative 9
  ELSIF v_completed_count = 6 THEN v_payout_tokens := 2;  -- cumulative 11
  ELSIF v_completed_count = 7 THEN v_payout_tokens := 3;  -- cumulative 14 MAX
  END IF;
  -- v_completed_count >= 8 → payout stays 0 (cap holds).

  IF v_payout_tokens > 0 THEN
    UPDATE public.vendor_wallets
       SET earned_tokens = earned_tokens + v_payout_tokens,
           updated_at = NOW()
     WHERE vendor_id = p_vendor_id;

    INSERT INTO public.token_rewards_log
      (vendor_id, event_id, service_code, tokens_awarded)
    VALUES
      (p_vendor_id, p_event_id, p_service_code, v_payout_tokens);
  END IF;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- PASS 8 — VENDOR ASSET CONSUMPTION (earned-first FIFO burn)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.consume_vendor_assets(
  p_vendor_id     UUID,
  p_spend_amount  INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_earned_bal    INT;
  v_purchased_bal INT;
  v_remainder     INT := p_spend_amount;
BEGIN
  SELECT earned_tokens, purchased_tokens
    INTO v_earned_bal, v_purchased_bal
    FROM public.vendor_wallets
   WHERE vendor_id = p_vendor_id
     FOR UPDATE;

  IF (v_earned_bal + v_purchased_bal) < p_spend_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: Request denied.';
    RETURN FALSE;
  END IF;

  IF v_earned_bal > 0 THEN
    IF v_earned_bal >= v_remainder THEN
      UPDATE public.vendor_wallets
         SET earned_tokens = earned_tokens - v_remainder,
             updated_at = NOW()
       WHERE vendor_id = p_vendor_id;
      v_remainder := 0;
    ELSE
      v_remainder := v_remainder - v_earned_bal;
      UPDATE public.vendor_wallets
         SET earned_tokens = 0,
             updated_at = NOW()
       WHERE vendor_id = p_vendor_id;
    END IF;
  END IF;

  IF v_remainder > 0 THEN
    UPDATE public.vendor_wallets
       SET purchased_tokens = purchased_tokens - v_remainder,
           updated_at = NOW()
     WHERE vendor_id = p_vendor_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- PASS 9 — BID/RFP MARKETPLACE (V2-only · no V1 collision)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.couple_briefs (
  brief_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL,
  brief_title           TEXT NOT NULL CHECK (LENGTH(brief_title) BETWEEN 8 AND 200),
  brief_body            TEXT NOT NULL CHECK (LENGTH(brief_body) BETWEEN 30 AND 4000),
  category              TEXT NOT NULL,
  estimated_budget_range TEXT NOT NULL CHECK (estimated_budget_range IN
    ('under_20k', '20k_to_100k', '100k_to_250k', '250k_to_500k', '500k_to_1m', 'over_1m')),
  brief_valuation_tier  INT NOT NULL CHECK (brief_valuation_tier BETWEEN 1 AND 3),
  token_cost_per_submission INT NOT NULL CHECK (token_cost_per_submission BETWEEN 1 AND 8),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN
    ('open', 'closed', 'awarded', 'withdrawn')),
  awarded_vendor_id     UUID,
  expires_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS couple_briefs_event_idx ON public.couple_briefs(event_id);
CREATE INDEX IF NOT EXISTS couple_briefs_category_status_idx
  ON public.couple_briefs(category, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS couple_briefs_expires_idx
  ON public.couple_briefs(expires_at) WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.derive_brief_token_cost()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.estimated_budget_range
    WHEN 'under_20k'     THEN NEW.brief_valuation_tier := 1; NEW.token_cost_per_submission := 1;
    WHEN '20k_to_100k'   THEN NEW.brief_valuation_tier := 2; NEW.token_cost_per_submission := 3;
    WHEN '100k_to_250k'  THEN NEW.brief_valuation_tier := 3; NEW.token_cost_per_submission := 5;
    WHEN '250k_to_500k'  THEN NEW.brief_valuation_tier := 3; NEW.token_cost_per_submission := 6;
    WHEN '500k_to_1m'    THEN NEW.brief_valuation_tier := 3; NEW.token_cost_per_submission := 7;
    WHEN 'over_1m'       THEN NEW.brief_valuation_tier := 3; NEW.token_cost_per_submission := 8;
  END CASE;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS couple_briefs_derive_token_cost ON public.couple_briefs;
CREATE TRIGGER couple_briefs_derive_token_cost
  BEFORE INSERT OR UPDATE OF estimated_budget_range ON public.couple_briefs
  FOR EACH ROW EXECUTE FUNCTION public.derive_brief_token_cost();

CREATE TABLE IF NOT EXISTS public.vendor_bid_submissions (
  bid_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        UUID NOT NULL REFERENCES public.couple_briefs(brief_id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL,
  proposal_body   TEXT NOT NULL CHECK (LENGTH(proposal_body) BETWEEN 50 AND 4000),
  proposed_price  NUMERIC(10, 2) NOT NULL CHECK (proposed_price >= 0),
  tokens_burned   INT NOT NULL CHECK (tokens_burned BETWEEN 1 AND 8),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'shortlisted', 'awarded', 'declined', 'withdrawn')),
  submitted_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brief_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS vendor_bid_submissions_brief_idx
  ON public.vendor_bid_submissions(brief_id, status);
CREATE INDEX IF NOT EXISTS vendor_bid_submissions_vendor_idx
  ON public.vendor_bid_submissions(vendor_id, submitted_at DESC);


-- =============================================================================
-- PASS 10 — MANUAL PAYMENT LOGS (Branch A · QR overlay audit trail)
-- =============================================================================
-- Tracks pending manual payments while Maya API approval is in progress.
-- Each row = one customer initialization · admin reconciles via Branch A's
-- response payload (reference number + GCash/Maya QR screenshot upload).

CREATE TABLE IF NOT EXISTS public.manual_payment_logs (
  manual_payment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL,
  reference_number    TEXT NOT NULL UNIQUE,
  amount_php          NUMERIC(10, 2) NOT NULL CHECK (amount_php > 0),
  payment_status      TEXT NOT NULL DEFAULT 'PENDING_MANUAL_VERIFICATION' CHECK (payment_status IN
    ('PENDING_MANUAL_VERIFICATION', 'CONFIRMED', 'REJECTED', 'REFUNDED', 'EXPIRED')),
  items_ordered       JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_user_id    UUID,
  verified_at         TIMESTAMP WITH TIME ZONE,
  verified_by_admin_id UUID,
  rejection_reason    TEXT,
  expires_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS manual_payment_logs_event_idx ON public.manual_payment_logs(event_id);
CREATE INDEX IF NOT EXISTS manual_payment_logs_status_idx
  ON public.manual_payment_logs(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_payment_logs_reference_idx ON public.manual_payment_logs(reference_number);

COMMENT ON TABLE public.manual_payment_logs IS
  'V2 audit trail for manual QR overlay payments (Branch A of /api/v1/billing/initialize-maya). Each row tracks an instructed manual GCash/Maya transfer with a unique reference_number for admin reconciliation. Replaces Maya API path once NEXT_PUBLIC_MAYA_STATUS=APPROVED.';


-- =============================================================================
-- PASS 11 — ROW LEVEL SECURITY (per RLS_Policy_Pattern.md)
-- =============================================================================

ALTER TABLE public.vendor_wallets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_retail_catalog_v2      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_package_catalog        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_software_activations_v2   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_crew_devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_rewards_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_briefs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bid_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payment_logs             ENABLE ROW LEVEL SECURITY;

-- Public read on catalog tables (price information is non-secret).
DROP POLICY IF EXISTS platform_retail_catalog_v2_public_read ON public.platform_retail_catalog_v2;
CREATE POLICY platform_retail_catalog_v2_public_read
  ON public.platform_retail_catalog_v2 FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS platform_package_catalog_public_read ON public.platform_package_catalog;
CREATE POLICY platform_package_catalog_public_read
  ON public.platform_package_catalog FOR SELECT
  USING (TRUE);

-- All other tables are service-role-only until per-row policies land in
-- their consumer-phase PRs. Service role bypasses RLS · client-side
-- surfaces don't yet query these tables so there's no leak vector.


COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (run in Supabase Studio SQL editor):
-- =============================================================================
--
-- -- (1) Confirm V1 surfaces are UNTOUCHED:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='users'
--     AND column_name LIKE 'concierge_%' ORDER BY column_name;
-- -- Expected: 6 concierge_* columns intact.
--
-- SELECT EXISTS(SELECT 1 FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='concierge_abuse_flags') AS abuse_flags_intact;
-- -- Expected: TRUE
--
-- -- (2) Confirm V2 tables exist (9 rows):
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN (
--     'vendor_wallets', 'platform_retail_catalog_v2', 'platform_package_catalog',
--     'event_software_activations_v2', 'registered_crew_devices',
--     'token_rewards_log', 'couple_briefs', 'vendor_bid_submissions',
--     'manual_payment_logs'
--   ) ORDER BY table_name;
--
-- -- (3) Confirm PAKANTA SKU:
-- SELECT service_code, title, retail_price_php, is_token_able
--   FROM public.platform_retail_catalog_v2 WHERE service_code='PAKANTA';
-- -- Expected: PAKANTA · 3499.00 · TRUE
--
-- -- (4) Confirm RLS enabled on all 9 new tables:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND tablename IN (
--     'vendor_wallets', 'platform_retail_catalog_v2', 'platform_package_catalog',
--     'event_software_activations_v2', 'registered_crew_devices',
--     'token_rewards_log', 'couple_briefs', 'vendor_bid_submissions',
--     'manual_payment_logs'
--   ) ORDER BY tablename;
-- -- Expected: all rowsecurity=true
--
-- =============================================================================
