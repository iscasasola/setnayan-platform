-- ============================================================================
-- 20260908000000_vendor_token_burn_on_answer.sql
-- Connect the vendor token economy: burn-on-answer + anti-merge enforcement.
--
-- Owner-locked ruleset (2026-06-05, see DECISION_LOG / project_setnayan_vendor_token_model):
--   • A vendor "answers" an inquiry by ACCEPTING it (the accept-gate; a vendor
--     cannot even reply before accepting). That answer costs ONE idempotent
--     unlock per (vendor_profile_id, event_id), and that single unlock covers
--     ALL of the vendor's services for that event.
--   • The cost is banded by the WEDDING's region: 1 / 2 / 3 tokens = ₱100 /
--     ₱200 / ₱300 (flat ₱100/token). Lowest-wage regions = band 1, Metro
--     Manila = band 3. The band map is ADMIN-EDITABLE (wages drift).
--   • Burns at ANSWER, not at win (vendor carries conversion risk).
--   • 100 free founder tokens on verification already ship (cushion) — see
--     20260703500000_vendor_token_grants.sql; not touched here.
--
-- This migration adds:
--   1. vendor_event_unlocks       — the per-(vendor,event) idempotency record
--   2. token_burn_bands           — admin-editable region → band/token map (seeded)
--   3. unlock_vendor_event() RPC  — atomic, idempotent, ownership-checked burn
--   4. anti-merge immutability triggers on the four token tables (a vendor's
--      tokens/wallet/ledger can NEVER be reassigned to another vendor — the
--      owner's "their data can never be merged to another vendor" guarantee,
--      enforced at the DB level rather than relying on the absence of a merge
--      feature).
-- ============================================================================

-- ── 1 · Per-(vendor, event) unlock record (idempotency + audit) ─────────────
CREATE TABLE IF NOT EXISTS public.vendor_event_unlocks (
  unlock_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL
                     REFERENCES public.events(event_id) ON DELETE CASCADE,
  tokens_burned      INT  NOT NULL CHECK (tokens_burned >= 0),
  region_slug        TEXT,
  band               SMALLINT,
  unlocked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The contract: at most ONE unlock per (vendor, event), covering all services.
  UNIQUE (vendor_profile_id, event_id)
);

CREATE INDEX IF NOT EXISTS vendor_event_unlocks_vendor_idx
  ON public.vendor_event_unlocks(vendor_profile_id);

ALTER TABLE public.vendor_event_unlocks ENABLE ROW LEVEL SECURITY;

-- Vendors read their own unlocks (to render "you've already answered this" UI).
-- current_vendor_profile_ids() = 20260821000000_vendor_role_aware_rls.sql.
DROP POLICY IF EXISTS vendor_event_unlocks_vendor_read ON public.vendor_event_unlocks;
CREATE POLICY vendor_event_unlocks_vendor_read
  ON public.vendor_event_unlocks FOR SELECT
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Admins read all (governance / disputes).
DROP POLICY IF EXISTS vendor_event_unlocks_admin_read ON public.vendor_event_unlocks;
CREATE POLICY vendor_event_unlocks_admin_read
  ON public.vendor_event_unlocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid()
      AND (u.is_internal OR u.is_team_member OR u.account_type = 'admin')
  ));
-- No INSERT/UPDATE/DELETE policy: the unlock row is written only by the
-- SECURITY DEFINER RPC below (which bypasses RLS).

-- ── 2 · Admin-editable region → band/token map ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_burn_bands (
  region_slug   TEXT PRIMARY KEY,
  band          SMALLINT NOT NULL CHECK (band BETWEEN 1 AND 3),
  tokens        INT NOT NULL CHECK (tokens > 0),
  min_wage_php  INT,
  label         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.token_burn_bands ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated may READ the bands (so a vendor UI can show "answering
-- costs N tokens" before they accept). Only admins may WRITE.
DROP POLICY IF EXISTS token_burn_bands_read ON public.token_burn_bands;
CREATE POLICY token_burn_bands_read
  ON public.token_burn_bands FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS token_burn_bands_admin_write ON public.token_burn_bands;
CREATE POLICY token_burn_bands_admin_write
  ON public.token_burn_bands FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid()
      AND (u.is_internal OR u.is_team_member OR u.account_type = 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid()
      AND (u.is_internal OR u.is_team_member OR u.account_type = 'admin')
  ));

-- Seed the PROPOSED band map (₱100/token → tokens = band). region_slug values
-- match events.region slugs (20260719000000). ⚠ OWNER TO RATIFY the exact
-- band→region assignment + confirm slugs; admin-editable, so adjust in-app.
-- The '__default__' row is the fallback for a null/unknown region (conservative
-- floor = band 1) so a missing region never over-charges or blocks resolution.
INSERT INTO public.token_burn_bands (region_slug, band, tokens, min_wage_php, label) VALUES
  ('__default__',           1, 1, NULL, 'Default (unknown region · floor)'),
  -- Band 3 · ₱300 · highest minimum-wage regions
  ('ncr',                   3, 3, 695, 'NCR / Metro Manila'),
  ('calabarzon',            3, 3, 560, 'CALABARZON'),
  ('central_luzon',         3, 3, 560, 'Central Luzon'),
  -- Band 2 · ₱200 · mid minimum-wage regions
  ('cordillera',            2, 2, 480, 'CAR / Cordillera'),
  ('car',                   2, 2, 480, 'CAR / Cordillera'),
  ('ilocos',                2, 2, 490, 'Ilocos Region'),
  ('cagayan_valley',        2, 2, 480, 'Cagayan Valley'),
  ('mimaropa',              2, 2, 430, 'MIMAROPA'),
  ('western_visayas',       2, 2, 480, 'Western Visayas'),
  ('central_visayas',       2, 2, 500, 'Central Visayas'),
  ('northern_mindanao',     2, 2, 480, 'Northern Mindanao'),
  ('davao',                 2, 2, 480, 'Davao Region'),
  ('davao_region',          2, 2, 480, 'Davao Region'),
  -- Band 1 · ₱100 · lowest minimum-wage regions
  ('bicol',                 1, 1, 415, 'Bicol Region'),
  ('eastern_visayas',       1, 1, 405, 'Eastern Visayas'),
  ('zamboanga_peninsula',   1, 1, 390, 'Zamboanga Peninsula'),
  ('soccsksargen',          1, 1, 410, 'SOCCSKSARGEN'),
  ('caraga',                1, 1, 400, 'Caraga'),
  ('barmm',                 1, 1, 361, 'BARMM')
ON CONFLICT (region_slug) DO NOTHING;

-- ── 3 · The atomic, idempotent, ownership-checked burn RPC ──────────────────
-- Returns JSONB describing the outcome:
--   {charged:true,  already:false, tokens:N, region, band}  — first answer; burned N
--   {charged:false, already:true,  tokens:0, region, band}  — already unlocked; free
-- RAISES 'INSUFFICIENT_WALLET_BALANCES' (propagated from the burn) when the
-- vendor can't afford the unlock — the whole transaction (including the unlock
-- row) rolls back, so there is never a phantom unlock. The caller turns that
-- into a friendly "top up your tokens" message and does NOT accept the inquiry.
CREATE OR REPLACE FUNCTION public.unlock_vendor_event(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_region    TEXT;
  v_tokens    INT;
  v_band      SMALLINT;
  v_rowcount  INT;
BEGIN
  -- Ownership check — this function is SECURITY DEFINER and granted to
  -- `authenticated`, so without this any signed-in user could burn ANOTHER
  -- vendor's tokens. Mirror the exact ownership check acceptInquiry uses
  -- (vendor_profiles.user_id = auth.uid()).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  -- Resolve the wedding's region → band/tokens (fallback to __default__).
  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;

  SELECT band, tokens INTO v_band, v_tokens
    FROM public.token_burn_bands
   WHERE region_slug = COALESCE(NULLIF(v_region, ''), '__default__');

  IF v_tokens IS NULL THEN
    SELECT band, tokens INTO v_band, v_tokens
      FROM public.token_burn_bands WHERE region_slug = '__default__';
  END IF;

  IF v_tokens IS NULL THEN
    -- Ultimate safety net if the seed is ever wiped.
    v_tokens := 1; v_band := 1;
  END IF;

  -- Idempotency gate: one unlock per (vendor, event). If a row already exists
  -- this is a no-op insert → the vendor already answered this event → free.
  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;

  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object(
      'charged', false, 'already', true, 'tokens', 0,
      'region', v_region, 'band', v_band);
  END IF;

  -- Fresh unlock → burn the tokens. If the vendor can't afford it, this RAISES
  -- INSUFFICIENT_WALLET_BALANCES and the whole tx (incl. the insert above)
  -- rolls back — no phantom unlock, vendor can retry after topping up.
  PERFORM public.consume_vendor_assets_per_voucher(
    p_vendor_profile_id,
    v_tokens,
    'INQUIRY_UNLOCK',
    p_event_id,
    jsonb_build_object('region', v_region, 'band', v_band)
  );

  RETURN jsonb_build_object(
    'charged', true, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.unlock_vendor_event(UUID, UUID) IS
  'Burn-on-answer: idempotent 1 unlock per (vendor, event), banded by the wedding region (token_burn_bands), covering all of the vendor''s services for that event. Ownership-checked. RAISES INSUFFICIENT_WALLET_BALANCES (rolling back) when unaffordable. Owner-locked token economy 2026-06-05.';

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;

-- ── 4 · Anti-merge enforcement — token rows can never change vendor ─────────
-- The owner's strict rule: a vendor's data can never be merged into another
-- vendor. For the token economy specifically, enforce that the vendor_id on
-- every token table is IMMUTABLE — no UPDATE may reassign a wallet, voucher,
-- grant, or redemption to a different vendor. Today no merge feature exists;
-- this makes the invariant impossible to violate even if one is ever built.
CREATE OR REPLACE FUNCTION public.forbid_vendor_id_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_id IS DISTINCT FROM OLD.vendor_id THEN
    RAISE EXCEPTION
      'VENDOR_ID_IMMUTABLE: token rows cannot be reassigned to another vendor (anti-merge guarantee)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS forbid_reassign_vendor_wallets ON public.vendor_wallets;
CREATE TRIGGER forbid_reassign_vendor_wallets
  BEFORE UPDATE ON public.vendor_wallets
  FOR EACH ROW EXECUTE FUNCTION public.forbid_vendor_id_reassignment();

DROP TRIGGER IF EXISTS forbid_reassign_earned_token_vouchers ON public.earned_token_vouchers;
CREATE TRIGGER forbid_reassign_earned_token_vouchers
  BEFORE UPDATE ON public.earned_token_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.forbid_vendor_id_reassignment();

DROP TRIGGER IF EXISTS forbid_reassign_token_grants_log ON public.token_grants_log;
CREATE TRIGGER forbid_reassign_token_grants_log
  BEFORE UPDATE ON public.token_grants_log
  FOR EACH ROW EXECUTE FUNCTION public.forbid_vendor_id_reassignment();

DROP TRIGGER IF EXISTS forbid_reassign_token_redemptions_log ON public.token_redemptions_log;
CREATE TRIGGER forbid_reassign_token_redemptions_log
  BEFORE UPDATE ON public.token_redemptions_log
  FOR EACH ROW EXECUTE FUNCTION public.forbid_vendor_id_reassignment();
