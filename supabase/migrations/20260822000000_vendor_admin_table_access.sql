-- =============================================================================
-- 20260822000000_vendor_admin_table_access.sql
--
-- Iteration 0022 — Vendor agents · fast-follow: "main account holders see
-- everything." Repo: setnayan-platform.
--
-- WHY: Phase 2b (#972) made the CORE vendor surfaces role-aware — owner+admin
-- see everything, agents see only their assigned services + customers — by
-- redefining current_vendor_profile_ids() to "direct owner UNION owner/admin
-- team members" and repointing vendor_services / chat_threads / chat_messages /
-- vendor_profiles onto it. But a tail of the vendor's OWN tables still gates
-- vendor access on a DIRECT `vendor_profiles WHERE user_id = auth.uid()` check
-- (owner-only) or on is_admin()/account_type='admin' (which is the PLATFORM
-- admin, not the vendor's own team-admin). So a vendor-team ADMIN — a co-owner
-- the vendor explicitly elevated above 'agent' — could manage services + chat
-- but NOT see the business's packages, contracts, calendar, payouts, ad
-- subscriptions, tax filings, token vouchers, etc. That breaks the owner's
-- promise that "the main account holders of the vendor page can see everything."
--
-- WHAT: one ADDITIVE owner+admin policy per gap table, keyed on
-- current_vendor_profile_ids() (= direct owner UNION owner/admin team members).
-- The existing owner-only policies are LEFT UNTOUCHED — Postgres OR's permissive
-- policies, so this only GRANTS (never revokes): the owner is already inside
-- current_vendor_profile_ids(), so they are provably un-regressed; vendor-team
-- admins gain parity; agents/viewers/strangers match no clause and stay locked
-- out. This is the vendor's OWN data shared with the vendor's OWN chosen admin —
-- no cross-tenant exposure. Mirrors the per-table grant the owner already has:
-- FOR ALL where the owner had ALL; FOR SELECT where the owner had read-only.
--
-- Idempotent (DROP POLICY IF EXISTS → CREATE). No schema/DDL changes; RLS-only.
--
-- DELIBERATELY OUT OF SCOPE (flagged for the owner, not changed here):
--   • vendor_active_ads · vendor_active_tools · vendor_market_stats ·
--     vendor_self_comp_caps — RLS enabled but ZERO policies (service-role only;
--     even the owner can't read them via the authed client). That's a separate
--     pre-existing condition, not a team-admin gap — fixing it could expose data
--     and needs its own review.
-- =============================================================================

-- ---- FOR ALL (owner currently has full read/write) --------------------------

DROP POLICY IF EXISTS vendor_packages_team_admin ON public.vendor_packages;
CREATE POLICY vendor_packages_team_admin ON public.vendor_packages
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_contracts_team_admin ON public.vendor_contracts;
CREATE POLICY vendor_contracts_team_admin ON public.vendor_contracts
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_calendar_blocks_team_admin ON public.vendor_calendar_blocks;
CREATE POLICY vendor_calendar_blocks_team_admin ON public.vendor_calendar_blocks
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_service_attributes_team_admin ON public.vendor_service_attributes;
CREATE POLICY vendor_service_attributes_team_admin ON public.vendor_service_attributes
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_payment_methods_team_admin ON public.vendor_payment_methods;
CREATE POLICY vendor_payment_methods_team_admin ON public.vendor_payment_methods
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- ---- FOR SELECT (owner currently has read-only) -----------------------------

DROP POLICY IF EXISTS vendor_payouts_team_admin ON public.vendor_payouts;
CREATE POLICY vendor_payouts_team_admin ON public.vendor_payouts
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_ad_subscriptions_team_admin ON public.vendor_ad_subscriptions;
CREATE POLICY vendor_ad_subscriptions_team_admin ON public.vendor_ad_subscriptions
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_2307_filings_team_admin ON public.vendor_2307_filings;
CREATE POLICY vendor_2307_filings_team_admin ON public.vendor_2307_filings
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS manpower_gigs_team_admin ON public.manpower_gigs;
CREATE POLICY manpower_gigs_team_admin ON public.manpower_gigs
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS supplier_vendor_skus_team_admin ON public.supplier_vendor_skus;
CREATE POLICY supplier_vendor_skus_team_admin ON public.supplier_vendor_skus
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_disputes_team_admin ON public.vendor_disputes;
CREATE POLICY vendor_disputes_team_admin ON public.vendor_disputes
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- earned_token_vouchers is keyed on vendor_id (→ vendor_profiles.vendor_profile_id)
DROP POLICY IF EXISTS earned_token_vouchers_team_admin ON public.earned_token_vouchers;
CREATE POLICY earned_token_vouchers_team_admin ON public.earned_token_vouchers
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT public.current_vendor_profile_ids()));
