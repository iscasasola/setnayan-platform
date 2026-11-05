-- ============================================================================
-- 20271307996183_supplier_plan_allowances_2026_11_04.sql
--
-- 📐 SUPPLIER PLAN ALLOWANCES + BRANCHES PER PLAN — owner 2026-11-04 (DECISION_LOG), verbatim:
--   "… waitlist 0,0,1,5 …"            (Free·Verified / Solo / Pro / Ultra)
--   "branches 0,0,3,10"              (included beyond the main shop; only Ultra buys more)
-- and, the same day, "ULTRA = ₱5,990 PER 4 WEEKS / ₱59,900 PER YEAR, WITH TRIMMED ALLOWANCES": Ultra waitlist 3
-- (was 5) and Ultra branches 6 (was 10). Custom runs as Ultra.
--
-- The SQL side of the two numbers the database ENFORCES. Every other allowance in the ruling (reach, categories,
-- service cards, seats, own web address) is enforced in the app's server actions and has no SQL twin — checked:
-- no migration mirrors serviceRadiusKm / parentCategories / servicesPerLeaf / agentAccounts.
--
-- 1 · `vendor_tier_limit` — copied from its LATEST definition
--     (20271285071117_every_plan_holds_five_couples_a_date.sql). The `whitelist_per_date` arm is VERBATIM. The
--     `waitlist_acceptances` arm moves to the owner's numbers: Free 0 · Verified 0 (was 1) · Solo 0 (was 1) ·
--     Pro 1 (was 3) · Enterprise/Custom 3 (was 5). A NEW key, `branches_included`: 0 · 0 · 0 · 3 · 6 · 6.
--     Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; held in step by
--     tests/db/vendor-tier-pipeline-caps.db.test.ts (waitlist) and
--     tests/db/vendor-plan-allowances.db.test.ts (branches), both of which DERIVE from the TypeScript side.
--
--     GRANDFATHERED (waitlist): couples a shop already accepted off a waitlist stay accepted — the app counts at
--     the moment of a NEW pick (`pickWaitlistCouple`). The settings trigger
--     (`enforce_vendor_waitlist_settings`, unchanged) keeps its 2026-08-29 rule: the zero-allowance arm turns the
--     waitlist SETTING off on a plan that has none; grandfathering protects a number, never a feature. It is still
--     inert until platform_settings.vendor_tier_pipeline_caps_enabled.
--
-- 2 · `vendor_branches.included_in_plan` — a branch the PLAN includes (no fee, no order, live once added). The app
--     (`deriveBranchStatus`) reads it as active. DEFAULT FALSE, so every existing branch keeps reading exactly as it
--     did (production held ZERO branch rows on 2026-08-29; nothing to backfill either way).
--
-- 3 · `enforce_included_branch_allowance` — BEFORE INSERT OR UPDATE on vendor_branches. `vendor_branches` admits the
--     shop's own owner/admin to INSERT/UPDATE under RLS, so without this a shop could write `included_in_plan = true`
--     straight from the API and take free branches past its plan. It refuses (check_violation,
--     'included_branch_allowance: …') when a row BECOMES a live included branch — inserted included, flipped to
--     included, or un-cancelled while included — and the shop already holds its plan's number of them.
--     GRANDFATHERED: rows already live are never touched, cancelled or refused; a shop over a lowered allowance keeps
--     every branch it has and only the NEXT one is refused. Serialised per shop with a row lock on its
--     vendor_profiles row, so two concurrent adds cannot both see "one left".
--
-- Never applied by hand: the pipeline (`supabase db push --include-all`) applies it. Idempotent.
-- ============================================================================

BEGIN;

-- ── 1 · the grid ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan (was 1)
        WHEN 'verified'   THEN 5   -- (was 2)
        WHEN 'solo'       THEN 5   -- (was 3)
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5   -- (was 10)
        WHEN 'custom'     THEN 5   -- (was 10) — the ₱2,500 "no limit" axis still lifts it
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0   -- owner 2026-11-04 "waitlist 0,0,1,5" (was 1)
        WHEN 'solo'       THEN 0   -- (was 1)
        WHEN 'pro'        THEN 1   -- (was 3)
        WHEN 'enterprise' THEN 3   -- Ultra trimmed 2026-11-04 (was 5)
        WHEN 'custom'     THEN 3   -- runs as Ultra
        ELSE 0
      END
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0   -- owner 2026-11-04 "branches 0,0,3,10"
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 0
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 6   -- Ultra trimmed 2026-11-04 ("branches 0,0,3,10" said 10)
        WHEN 'custom'     THEN 6   -- runs as Ultra
        ELSE 0
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;
COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier limits. Keys: whitelist_per_date (accepted-but-not-yet-locked customers a vendor may hold for ONE date — 5 on EVERY plan since 2026-10-23) · waitlist_acceptances (couples they may accept off the waitlist for one date — 0/0/0/1/3/3 since 2026-11-04, Ultra trimmed to 3) · branches_included (fee-free branches beyond the main shop — 0/0/0/3/6/6 since 2026-11-04, Ultra trimmed to 6). Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts and tests/db/vendor-plan-allowances.db.test.ts, which derive from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

-- ── 2 · the included branch ──────────────────────────────────────────────────
ALTER TABLE public.vendor_branches
  ADD COLUMN IF NOT EXISTS included_in_plan boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_branches.included_in_plan IS
  'TRUE = a branch the shop''s PLAN includes (owner 2026-11-04: Pro 3 · Ultra 6) — no fee, no '
  'order, live from the moment it is added and still live after a downgrade (a shop keeps what it has). FALSE = a '
  'PAID branch, live only while its latest vendor_additional_branch__{branch_id} order is paid and in window. '
  'Guarded by enforce_included_branch_allowance: a row may only BECOME a live included branch while the shop holds '
  'fewer than vendor_tier_limit(tier, ''branches_included'').';

-- ── 3 · the gate ─────────────────────────────────────────────────────────────
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

  v_cap := COALESCE(public.vendor_tier_limit(v_tier, 'branches_included'), 0);

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
  'when the shop already holds vendor_tier_limit(tier, ''branches_included'') of them. Owner 2026-11-04, '
  '"branches 0,0,3,10". Rows already live are never touched (grandfathered). Serialised per shop by a row lock on '
  'vendor_profiles.';

DROP TRIGGER IF EXISTS enforce_included_branch_allowance_trg ON public.vendor_branches;
CREATE TRIGGER enforce_included_branch_allowance_trg
  BEFORE INSERT OR UPDATE OF included_in_plan, cancelled_at, parent_vendor_profile_id
  ON public.vendor_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_included_branch_allowance();

COMMIT;
