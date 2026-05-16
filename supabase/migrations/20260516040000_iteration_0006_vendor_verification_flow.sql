-- ============================================================================
-- 20260516040000_iteration_0006_vendor_verification_flow.sql
-- Iteration 0006 + 0023 — Vendor Verification flow (locked 2026-05-16).
--
-- Builds on top of the V1 SKU framework lock (20260516010000_…vendor_verifications)
-- and the public-visibility state machine (20260515000000_vendor_public_visibility):
--
--   • Adds a NEW vendor-side state column `verification_state` to vendor_profiles
--     distinct from `public_visibility`. `public_visibility` governs how the
--     marketplace surfaces the profile; `verification_state` governs the
--     identity/trust workflow itself (and gates Setnayan Pay, Pro Weekly,
--     Boosted Ads, Sponsored Boost, immediate payout, etc.).
--
--     States (per 0006 § Vendor Verification flow + task brief 2026-05-16):
--       • unverified      — default · vendor hasn't started the workflow
--       • pending_review  — vendor submitted 12-doc checklist · SLA clock running
--       • verified        — admin approved · perks unlocked
--       • demoted         — vendor was verified but auto-demoted (3+ disputes/30d)
--       • rejected        — admin rejected · vendor must address blockers before re-applying
--
--   • Adds `vendor_verification_applications` — application/intake rows. One
--     row per submission; tracks the 12-document checklist + SLA + decision +
--     reviewer + reason. Distinct from the existing `vendor_verifications`
--     table (the broader workflow record); applications represent each
--     submitted intake, so a single vendor over their lifecycle accumulates
--     multiple rows (initial → annual_renewal → optional post_demotion).
--
--   • Adds `vendor_tier_history` — state-transition audit table. One row per
--     `verification_state` change with from_state, to_state, admin actor, and
--     reason. Distinct from admin_audit_log (which records the broader admin
--     action stream); this table is the tier-specific timeline.
--
--   • Adds 2 SKU rows aliasing the task-spec'd codes
--     (`verification_annual_renewal` ₱1,500 + `verification_reverification` ₱2,500)
--     in addition to the canonical `vendor_verification_*` codes seeded by
--     the 2026-05-16 SKU lock migration. Two names exist so call sites that
--     follow the task brief literally and call sites that follow the SKU lock
--     migration both resolve.
--
-- Idempotent — CREATE TABLE IF NOT EXISTS, DO $$ … IF NOT EXISTS for the ENUM,
-- ON CONFLICT DO UPDATE for the SKU inserts. No drops.
--
-- Owner-side action required after merge:
--   • supabase db push --db-url "$SUPABASE_DB_URL"
--   • Provision the Cloudflare R2 bucket `setnayan-vendor-verification`
--     (90-day rolling raw + 7-year audit retention per BIR § 235).
--   • Sign up for Persona / Veriff / Onfido + AMLC (env vars already in
--     .env.example since the 2026-05-16 SKU lock; webhooks stubbed in this PR).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ENUM type — vendor_verification_state
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vendor_verification_state'
  ) THEN
    CREATE TYPE public.vendor_verification_state AS ENUM (
      'unverified',
      'pending_review',
      'verified',
      'demoted',
      'rejected'
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. Column on vendor_profiles
--
-- Default 'unverified' so newly-registered vendors land in the no-workflow-yet
-- state. Backfill: any vendor whose `public_visibility = 'verified'` from PR #56
-- is assumed to have been hand-approved by the owner; we lift them to the
-- 'verified' verification_state too so the spec's "verified perks unlocked"
-- behavior matches reality on deploy. Other rows stay 'unverified'.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS verification_state public.vendor_verification_state
    NOT NULL DEFAULT 'unverified';

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS next_renewal_due_at TIMESTAMPTZ;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS demotion_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS last_demoted_at TIMESTAMPTZ;

-- Backfill — preserve hand-approved listings from PR #56.
UPDATE public.vendor_profiles
   SET verification_state = 'verified',
       last_verified_at   = COALESCE(last_verified_at, NOW()),
       next_renewal_due_at = COALESCE(next_renewal_due_at, NOW() + INTERVAL '1 year')
 WHERE public_visibility = 'verified'
   AND verification_state = 'unverified';

CREATE INDEX IF NOT EXISTS vendor_profiles_verification_state_idx
  ON public.vendor_profiles(verification_state);

CREATE INDEX IF NOT EXISTS vendor_profiles_next_renewal_due_idx
  ON public.vendor_profiles(next_renewal_due_at)
  WHERE next_renewal_due_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. vendor_verification_applications — application/intake rows
--
-- One row per submitted application. SLA countdown reads `submitted_at`
-- (a UI badge turns red after 3 business days). Decision columns are filled
-- once the admin reviews; reviewer + reason are first-class fields so the
-- queue and the audit trail both stay readable without joining elsewhere.
--
-- doc_uploads JSONB — flat object keyed by the 12 doc-checklist slugs.
-- Example shape:
--   {
--     "dti_certificate":      { "r2_key": "vendor-verification/<v>/dti.pdf", "uploaded_at": "…" },
--     "bir_2303":             { "r2_key": "…", "uploaded_at": "…" },
--     "mayors_permit":        { "r2_key": "…", "uploaded_at": "…" },
--     "government_id":        { "r2_key": "…", "uploaded_at": "…", "persona_inquiry_id": "inq_…" },
--     "bank_account_proof":   { "r2_key": "…", "uploaded_at": "…" },
--     "portfolio_samples":    [ { "r2_key": "…" }, … ],
--     "client_references":    [ { "name": "…", "phone": "…" }, … ],
--     "live_selfie":          { "r2_key": "…", "uploaded_at": "…" },
--     "google_meet":          { "scheduled_at": "…", "meet_url": "…" },
--     "phone_email_otp":      { "phone_verified": true, "email_verified": true },
--     "social_media":         { "url": "…" },
--     "amlc_screening":       { "result": "clear", "screened_at": "…" }
--   }
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_verification_applications (
  application_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             TEXT UNIQUE NOT NULL
                        DEFAULT public.generate_public_id('A'),
    -- 'A' prefix = application. Distinct from Q (vendor_verifications) so
    -- admins can tell at a glance whether they're looking at a per-intake
    -- application row or the broader verification workflow record.
  vendor_profile_id     UUID NOT NULL
                        REFERENCES public.vendor_profiles(vendor_profile_id)
                        ON DELETE CASCADE,
  application_type      TEXT NOT NULL DEFAULT 'initial'
                        CHECK (application_type IN
                          ('initial', 'annual_renewal', 'post_demotion')),
  fee_php_centavos      INTEGER NOT NULL DEFAULT 0
                        CHECK (fee_php_centavos >= 0),
    -- 0 / 150000 / 250000 — matches service_catalog SKUs:
    --   initial         → vendor_verification_initial (FREE)
    --   annual_renewal  → verification_annual_renewal (₱1,500)
    --   post_demotion   → verification_reverification (₱2,500)
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN
                          ('draft',           -- vendor is filling out the form
                           'pending_review',  -- submitted; admin owns it
                           'in_review',       -- admin is actively checking
                           'approved',
                           'rejected',
                           'withdrawn')),

  -- ---- Document tracking ----
  doc_uploads           JSONB NOT NULL DEFAULT '{}'::jsonb,
  docs_complete         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Set TRUE when all 12 required slots have a non-null entry. Lets the
    -- queue cheaply filter "ready-to-review" without scanning JSONB.

  -- ---- SLA tracking ----
  submitted_at          TIMESTAMPTZ,
    -- NULL while status='draft'. Set on transition draft → pending_review.
    -- SLA clock anchors to this column; 3 business days = orange, 5 BD = red.
  sla_due_at            TIMESTAMPTZ,
    -- Calendar timestamp for the 5-BD SLA. Computed by the server-action at
    -- submit-time so the queue UI doesn't have to recompute per request.

  -- ---- Decision ----
  admin_user_id         UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    -- Reviewer who took the decision. NULL while pending/in_review.
  decision              TEXT
                        CHECK (decision IN ('approved', 'rejected', NULL)),
  decision_reason       TEXT,
    -- Required when decision='rejected'. Surfaces to the vendor in their
    -- application status page so they know what to fix.
  decided_at            TIMESTAMPTZ,

  -- ---- Notes ----
  notes                 TEXT,
    -- Free-form admin notes (not surfaced to vendor).

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_verification_applications_vendor_idx
  ON public.vendor_verification_applications(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_verification_applications_status_idx
  ON public.vendor_verification_applications(status);
CREATE INDEX IF NOT EXISTS vendor_verification_applications_submitted_at_idx
  ON public.vendor_verification_applications(submitted_at)
  WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_verification_applications_sla_due_idx
  ON public.vendor_verification_applications(sla_due_at)
  WHERE sla_due_at IS NOT NULL;

ALTER TABLE public.vendor_verification_applications ENABLE ROW LEVEL SECURITY;

-- Vendors see/write their own application rows. Admin (service-role) has
-- full access via createAdminClient.
DROP POLICY IF EXISTS vendor_verification_applications_owner_read
  ON public.vendor_verification_applications;
CREATE POLICY vendor_verification_applications_owner_read
  ON public.vendor_verification_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_verification_applications.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS vendor_verification_applications_owner_insert
  ON public.vendor_verification_applications;
CREATE POLICY vendor_verification_applications_owner_insert
  ON public.vendor_verification_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_verification_applications.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_verification_applications_owner_update_draft
  ON public.vendor_verification_applications;
CREATE POLICY vendor_verification_applications_owner_update_draft
  ON public.vendor_verification_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_verification_applications.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    AND status = 'draft'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_verification_applications.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    -- Vendor can only flip status from draft → pending_review (submit).
    -- All other transitions are admin-only via service-role.
    AND status IN ('draft', 'pending_review')
  );

-- ----------------------------------------------------------------------------
-- 4. vendor_tier_history — state-transition audit
--
-- One row per `verification_state` change. Used by the queue and by support
-- to understand how a vendor moved through the workflow. Keeps the tier
-- timeline cleanly separable from the broader admin_audit_log stream.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_tier_history (
  tier_history_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id   UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id)
                      ON DELETE CASCADE,
  from_state          public.vendor_verification_state,
    -- NULL when the row records the initial state at vendor creation.
  to_state            public.vendor_verification_state NOT NULL,
  application_id      UUID REFERENCES public.vendor_verification_applications(application_id)
                      ON DELETE SET NULL,
    -- Set when the transition was driven by an application decision.
  admin_user_id       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    -- Reviewer / admin who took the action. NULL for system-driven transitions
    -- (e.g. auto-demote cron).
  reason              TEXT,
  metadata            JSONB,
    -- Free-form payload: dispute counts, cron-batch ID, etc.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_tier_history_vendor_idx
  ON public.vendor_tier_history(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_tier_history_created_at_idx
  ON public.vendor_tier_history(created_at DESC);

ALTER TABLE public.vendor_tier_history ENABLE ROW LEVEL SECURITY;

-- Vendors see their own timeline; admins see everything; nobody writes
-- directly (server-role only via admin actions).
DROP POLICY IF EXISTS vendor_tier_history_owner_read
  ON public.vendor_tier_history;
CREATE POLICY vendor_tier_history_owner_read
  ON public.vendor_tier_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_tier_history.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 5. SKU aliases — surface the task-brief naming alongside the canonical
-- vendor_verification_* codes already seeded by 20260516000000_v1_sku_lock_…
--
-- Two SKU codes per fee tier ensure call sites that follow either naming
-- convention resolve. Both rows describe the same ₱-amount; updating one's
-- price requires the other to be updated in lockstep (a future migration can
-- normalize by retiring the alias).
-- ----------------------------------------------------------------------------

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('verification_annual_renewal',
   'Vendor Annual Re-verification (alias)',
   'Annual re-verification fee (₱1,500/year). Alias of ' ||
   'vendor_verification_annual_renewal; lives so call sites that use the ' ||
   'task-brief naming resolve. Same price, same behavior.',
   'vendor_verification', 150000, 'year',
   FALSE, TRUE, FALSE, 'vendor', TRUE,
   '2026-05-16 vendor verification flow'),
  ('verification_reverification',
   'Vendor Re-verification after demotion (alias)',
   'Post-demotion re-verification fee (₱2,500). Alias of ' ||
   'vendor_verification_redemption; lives so call sites that use the ' ||
   'task-brief naming resolve. Same price, same behavior.',
   'vendor_verification', 250000, 'verification',
   FALSE, FALSE, FALSE, 'vendor', TRUE,
   '2026-05-16 vendor verification flow')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  subscription = EXCLUDED.subscription,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;
