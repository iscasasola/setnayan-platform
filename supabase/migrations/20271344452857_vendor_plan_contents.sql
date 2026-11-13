-- vendor_plan_contents
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🧮 PLAN CONTENTS ARE EDITABLE — owner 2026-11-13, verbatim "Yes, add both" (DECISION_LOG
-- "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN CONTENTS"): what each supplier plan INCLUDES becomes
-- admin-editable, "typed + 24 h like a price change, the code values as the seed". Drawn on the
-- approved prototype (specs repo prototypes/admin_pub/catalogue.html, the Plan contents view:
-- plan-pick · cfm-cap) and its builder panel #builder-2026-11-13.
--
-- WHAT EXISTED: every cap was code — TIER_CAPS in apps/web/lib/vendor-tier-caps.ts and its SQL twin
-- vendor_tier_limit() (IMMUTABLE, hard-coded, latest body 20271316466285).
--
-- THE DELTA:
--   1 · vendor_plan_contents (plan, key, value) — one row per plan × editable allowance. value NULL =
--       no limit. SEEDED FROM TIER_CAPS: every number below was printed from TIER_CAPS by a script, not
--       typed, and tests/db/vendor-plan-contents.db.test.ts asserts the seed equals TIER_CAPS key by key.
--       Only the SEVEN allowances whose readers follow the table are seeded (lib/vendor-plan-contents.ts
--       EDITABLE_PLAN_KEYS) — a row nothing reads would be an edit that changes nothing.
--   2 · vendor_plan_content_changes — the change history, one row per changed value, written by a
--       trigger so no edit path can skip it.
--   3 · vendor_tier_limit() reads the table first and falls back to its hard-coded arms (the code
--       values) when a row is missing. IMMUTABLE → STABLE, because it now reads a table. No index,
--       generated column or CHECK uses it (checked across every migration), so the volatility change
--       is safe. The fallback CASE is VERBATIM from 20271316466285.
--
-- 🔒 Edits arrive ONLY through the two-admin approval (admin_approval_requests action
-- approve_plan_contents_change, executed by the service role) — the same gate as a price change.
-- 🔒 RLS at CREATE TABLE: the plan table is public reading (the Plans page prints it; vendor_tier_limit
-- runs as the INVOKER inside triggers fired by a supplier's own session), writes are service-role only.
-- The history is admin-read.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

-- ── 0 · the approval action type ────────────────────────────────────────────
-- Re-listed from its LATEST definition (20271309260178) + one value.
ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'approve_fraud_wipe_ban',
    'approve_journal_spotlight',
    -- 2026-09-22 · money actions.
    'approve_comp_grant',
    'approve_large_refund',
    'approve_payment_account_change',
    -- 2026-09-23 · § 9.1: what a customer is charged.
    'approve_retail_price_change',
    -- 2026-11-05 · § 9.1: "Add to team" makes someone an admin.
    'grant_team_member',
    -- 2026-11-13 · what a supplier plan includes ("like a price change").
    'approve_plan_contents_change'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin. Privilege actions '
  '(grant_internal_account, grant_team_pool [retired 2026-11-05, kept so old '
  'rows stay readable], promote_to_admin, grant_team_member [9.1: '
  'is_team_member is an admin role], approve_vendor_partnership, '
  'approve_fraud_wipe_ban, approve_journal_spotlight), money actions '
  '(approve_comp_grant, approve_large_refund, approve_payment_account_change, '
  'approve_retail_price_change) and plan contents (approve_plan_contents_change, '
  '2026-11-13). Re-list from pg_get_constraintdef on PRODUCTION when adding a '
  'value — the migration history is not the list.';

-- ── 1 · the plan table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_plan_contents (
  plan          TEXT        NOT NULL CHECK (plan IN ('free', 'verified', 'solo', 'pro', 'enterprise')),
  key           TEXT        NOT NULL CHECK (key IN (
                              'whitelist_per_date', 'waitlist_acceptances', 'branches_included',
                              'bookings_per_date_per_service', 'services_per_leaf',
                              'parent_categories', 'agent_accounts')),
  value         INTEGER     CHECK (value IS NULL OR value >= 0),
  changed_by    UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  confirmed_by  UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  approval_id   UUID,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, key)
);
ALTER TABLE public.vendor_plan_contents ENABLE ROW LEVEL SECURITY;

-- The four allowances vendor_tier_limit() serves are never "no limit": its callers COALESCE a NULL
-- to 0 (branches) or read it as a missing cap. Refuse it here, not only in the form.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_plan_contents_sql_keys_finite_ck') THEN
    ALTER TABLE public.vendor_plan_contents
      ADD CONSTRAINT vendor_plan_contents_sql_keys_finite_ck CHECK (
        value IS NOT NULL
        OR key NOT IN ('whitelist_per_date', 'waitlist_acceptances', 'branches_included', 'bookings_per_date_per_service')
      );
  END IF;
END $$;

COMMENT ON TABLE public.vendor_plan_contents IS
  'Owner 2026-11-13 ("Yes, add both"): what each supplier plan includes, admin-editable through the two-admin approval (approve_plan_contents_change). Seeded from TIER_CAPS (apps/web/lib/vendor-tier-caps.ts), which stays as the fallback when a row is missing. value NULL = no limit. Read by vendor_tier_limit() and by the app''s live plan reader (lib/vendor-plan-contents.server.ts).';

DROP POLICY IF EXISTS vendor_plan_contents_public_read ON public.vendor_plan_contents;
CREATE POLICY vendor_plan_contents_public_read ON public.vendor_plan_contents
  FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON public.vendor_plan_contents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_plan_contents TO anon, authenticated;
GRANT ALL ON public.vendor_plan_contents TO service_role;

-- Seed — printed from TIER_CAPS (Infinity → NULL); held equal by vendor-plan-contents.db.test.ts.
INSERT INTO public.vendor_plan_contents (plan, key, value) VALUES
  ('free', 'whitelist_per_date', 5),
  ('free', 'waitlist_acceptances', 0),
  ('free', 'branches_included', 0),
  ('free', 'bookings_per_date_per_service', 1),
  ('free', 'services_per_leaf', 1),
  ('free', 'parent_categories', 1),
  ('free', 'agent_accounts', 0),
  ('verified', 'whitelist_per_date', 5),
  ('verified', 'waitlist_acceptances', 0),
  ('verified', 'branches_included', 0),
  ('verified', 'bookings_per_date_per_service', 1),
  ('verified', 'services_per_leaf', 1),
  ('verified', 'parent_categories', 1),
  ('verified', 'agent_accounts', 0),
  ('solo', 'whitelist_per_date', 5),
  ('solo', 'waitlist_acceptances', 0),
  ('solo', 'branches_included', 0),
  ('solo', 'bookings_per_date_per_service', 1),
  ('solo', 'services_per_leaf', 3),
  ('solo', 'parent_categories', 2),
  ('solo', 'agent_accounts', 1),
  ('pro', 'whitelist_per_date', 5),
  ('pro', 'waitlist_acceptances', 1),
  ('pro', 'branches_included', 3),
  ('pro', 'bookings_per_date_per_service', 3),
  ('pro', 'services_per_leaf', 10),
  ('pro', 'parent_categories', 8),
  ('pro', 'agent_accounts', 5),
  ('enterprise', 'whitelist_per_date', 5),
  ('enterprise', 'waitlist_acceptances', 3),
  ('enterprise', 'branches_included', 6),
  ('enterprise', 'bookings_per_date_per_service', 5),
  ('enterprise', 'services_per_leaf', 25),
  ('enterprise', 'parent_categories', 15),
  ('enterprise', 'agent_accounts', 10)
ON CONFLICT (plan, key) DO NOTHING;

-- ── 2 · the history ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_plan_content_changes (
  change_id     BIGSERIAL   PRIMARY KEY,
  plan          TEXT        NOT NULL,
  key           TEXT        NOT NULL,
  old_value     INTEGER,
  new_value     INTEGER,
  changed_by    UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  confirmed_by  UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  approval_id   UUID,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_plan_content_changes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vendor_plan_content_changes_plan_idx
  ON public.vendor_plan_content_changes (plan, changed_at DESC);

COMMENT ON TABLE public.vendor_plan_content_changes IS
  'One row per changed plan allowance (old → new, who asked, who confirmed). Written ONLY by the trigger on vendor_plan_contents, so no edit path can skip it. NULL value = no limit. Admin-read.';

DROP POLICY IF EXISTS vendor_plan_content_changes_admin_read ON public.vendor_plan_content_changes;
CREATE POLICY vendor_plan_content_changes_admin_read ON public.vendor_plan_content_changes
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE ALL ON public.vendor_plan_content_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_plan_content_changes TO authenticated;
GRANT ALL ON public.vendor_plan_content_changes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.vendor_plan_content_changes_change_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.record_vendor_plan_content_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.vendor_plan_content_changes
      (plan, key, old_value, new_value, changed_by, confirmed_by, approval_id, changed_at)
    VALUES
      (NEW.plan, NEW.key, OLD.value, NEW.value, NEW.changed_by, NEW.confirmed_by, NEW.approval_id, now());
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_vendor_plan_content_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_plan_contents_history_trg ON public.vendor_plan_contents;
CREATE TRIGGER vendor_plan_contents_history_trg
  AFTER UPDATE ON public.vendor_plan_contents
  FOR EACH ROW
  EXECUTE FUNCTION public.record_vendor_plan_content_change();

-- ── 3 · vendor_tier_limit reads the table (fallback VERBATIM from 20271316466285) ──
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    -- The admin-edited number (owner 2026-11-13). An unknown tier reads as Free, like the arms below.
    (SELECT c.value
       FROM public.vendor_plan_contents c
      WHERE c.plan = CASE WHEN COALESCE(p_tier, 'free') IN ('free', 'verified', 'solo', 'pro', 'enterprise')
                          THEN COALESCE(p_tier, 'free') ELSE 'free' END
        AND c.key = p_key),
    -- The code values — the fallback when no row exists.
    CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan (was 1)
        WHEN 'verified'   THEN 5   -- (was 2)
        WHEN 'solo'       THEN 5   -- (was 3)
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5   -- (was 10)
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0   -- owner 2026-11-04 "waitlist 0,0,1,5" (was 1)
        WHEN 'solo'       THEN 0   -- (was 1)
        WHEN 'pro'        THEN 1   -- (was 3)
        WHEN 'enterprise' THEN 3   -- Ultra trimmed 2026-11-04 (was 5)
        ELSE 0
      END
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0   -- owner 2026-11-04 "branches 0,0,3,10"
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 0
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 6   -- Ultra trimmed 2026-11-04 ("branches 0,0,3,10" said 10)
        ELSE 0
      END
    WHEN 'bookings_per_date_per_service' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 1    -- owner click 2026-11-06 "FREE AND VERIFIED": "1 each, like Solo"
        WHEN 'verified'   THEN 1    -- same ruling
        WHEN 'solo'       THEN 1    -- owner 2026-11-06: "Solo has 1 per date/service"
        WHEN 'pro'        THEN 3    -- "pro has 3 per date/service"
        WHEN 'enterprise' THEN 5    -- "ultra has 5 per date/service"
        ELSE 1                      -- unknown tier reads as Free (asVendorTier)
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
    END
  );
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · bookings_per_date_per_service (the table also holds services_per_leaf · parent_categories · agent_accounts, which the app reads). STABLE since 2026-11-13 (was IMMUTABLE — it reads a table now). An unknown TIER reads as Free; an unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';
