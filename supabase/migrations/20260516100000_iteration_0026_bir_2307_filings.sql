-- ============================================================================
-- 20260516100000_iteration_0026_bir_2307_filings.sql
-- Iteration 0026 — BIR Form 2307 quarterly auto-fill system.
--
-- Per-vendor, per-quarter Certificate of Creditable Tax Withheld at Source
-- (BIR Form 2307, January 2018 ENCS) generation. One row per
-- (vendor_profile_id, tax_year, tax_quarter) — regeneration UPDATEs in place
-- so the BIR audit trail is unbroken.
--
-- What this migration owns:
--   1. ALTER TABLE vendor_profiles ADD tin_number / tin_type /
--      registered_business_name / registered_address / registered_zip /
--      bir_service_category — the BIR-relevant identity columns the 2307
--      generator reads from the vendor side. (The official spec § 5.2
--      names these on a `vendors` table; we land them on the actual
--      `vendor_profiles` table that ships in this repo.)
--   2. ALTER TABLE platform_settings ADD bir_payor_name /
--      bir_payor_address / bir_payor_zip / bir_authorized_rep_name /
--      bir_authorized_rep_tin / bir_authorized_rep_title — the Setnayan-
--      side Part II identity columns. (`business_tin` already exists.)
--   3. CREATE TABLE vendor_2307_filings — the one-row-per-quarter filing
--      record (PDF storage + monthly breakdown + totals + audit log).
--   4. RLS — vendor reads own; admin reads all.
--   5. pg_cron + pg_net extensions enabled.
--   6. Quarterly cron schedule (`quarterly_2307_generation`) pinging
--      /api/admin/cron/generate-2307 on the 1st of Jan/Apr/Jul/Oct at
--      02:00 PHT (18:00 UTC the prior day).
--
-- Idempotent. No drops on production data. The pg_cron schedule is
-- conditionally unscheduled-then-rescheduled so reruns pick up changes.
--
-- Source of truth: spec corpus 0026_bir_tax_compliance.md (681 lines) +
-- 0034_payments_and_cart.md § 6.7 (post-#68 Setnayan Pay reprice).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles — BIR identity columns.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tin_type TEXT
    CHECK (tin_type IS NULL OR tin_type IN ('individual', 'corporation'));
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registered_business_name TEXT;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registered_address TEXT;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS registered_zip TEXT;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS bir_service_category TEXT
    CHECK (bir_service_category IS NULL OR bir_service_category IN
      ('professional', 'talent', 'service_supplier'));
    -- 'professional' = lawyers / CPAs / engineers / medical (WI151 / WI150)
    -- 'talent'       = musicians / photographers if classed as talent
    --                  (WI080 / WI081)
    -- 'service_supplier' = default for most wedding vendors — caterers /
    --                  florists / coordinators (WI158 / WC158 at 2% under
    --                  Setnayan's Top Withholding Agent designation).
    -- NULL = unset → mapper defaults to 'service_supplier'.

-- ----------------------------------------------------------------------------
-- 2. platform_settings — BIR Part II (payor / Setnayan) identity columns.
-- ----------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bir_payor_name TEXT;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bir_payor_address TEXT;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bir_payor_zip TEXT;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bir_authorized_rep_name TEXT;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bir_authorized_rep_tin TEXT;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bir_authorized_rep_title TEXT;

-- ----------------------------------------------------------------------------
-- 3. vendor_2307_filings — one row per (vendor, year, quarter).
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.vendor_2307_status AS ENUM (
    'queued',
    'generated',
    'downloaded',
    'filed_manually',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vendor_2307_filings (
  filing_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              TEXT UNIQUE NOT NULL
                         DEFAULT public.generate_public_id('B'),
    -- 'B' prefix = BIR document. Per the spec brief; collides with the
    -- existing vendor_profiles 'B' prefix but the value lives in a
    -- different domain (a 2307 filing public_id never appears in a
    -- vendor-profile context) and Crockford base 32 collisions across
    -- two unrelated tables are operationally fine for V1.

  vendor_profile_id      UUID NOT NULL
                         REFERENCES public.vendor_profiles(vendor_profile_id)
                         ON DELETE CASCADE,

  tax_year               INTEGER NOT NULL CHECK (tax_year BETWEEN 2024 AND 2100),
  tax_quarter            INTEGER NOT NULL CHECK (tax_quarter BETWEEN 1 AND 4),
  period_from            DATE NOT NULL,
  period_to              DATE NOT NULL,

  status                 public.vendor_2307_status NOT NULL DEFAULT 'queued',

  -- ---- PDF storage ----
  pdf_storage_bucket     TEXT,
    -- Either 'setnayan-bir-2307' (R2) or 'supabase://bir-2307' (Supabase
    -- Storage fallback). NULL while status='queued'.
  pdf_storage_key        TEXT,
  pdf_public_url         TEXT,

  -- ---- Lifecycle timestamps ----
  generated_at           TIMESTAMPTZ,
  downloaded_by_vendor_at TIMESTAMPTZ,
  filed_at               TIMESTAMPTZ,
    -- Vendor-marked "I've filed this with BIR for my own income tax credit".

  -- ---- Provenance ----
  generated_by_admin_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    -- NULL when the cron generated it; populated when an admin hit the
    -- manual regenerate button.
  regenerated_count      INTEGER NOT NULL DEFAULT 0,

  -- ---- Data captured at generation time ----
  monthly_breakdown      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Array of:
    --   { month_index: 1|2|3,
    --     atc_code: 'WI158',
    --     gross_centavos: 12500000,
    --     ewt_centavos: 62500 }
    -- Up to 3 rows per ATC code (one per month). Multiple ATC codes
    -- → multiple groups in this array (the mapper can in principle
    -- produce different codes per service if the vendor wears
    -- multiple BIR hats; V1 mapper defaults all rows to a single
    -- code per vendor).
  totals                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { gross_centavos: 37500000,
    --   ewt_centavos:   187500,
    --   atc_rows:
    --     [ { atc_code: 'WI158', rate_bps: 200,
    --         gross_centavos: 37500000,
    --         ewt_centavos: 187500 } ] }
  audit_log              JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Append-only list of { at: timestamp, actor: 'cron'|admin_user_id,
    -- action: 'generated'|'regenerated'|'downloaded'|'marked_filed',
    -- note: text }.

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One filing per vendor per quarter — regenerations UPDATE this row.
  UNIQUE (vendor_profile_id, tax_year, tax_quarter)
);

CREATE INDEX IF NOT EXISTS vendor_2307_filings_vendor_idx
  ON public.vendor_2307_filings(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_2307_filings_year_quarter_idx
  ON public.vendor_2307_filings(tax_year, tax_quarter);
CREATE INDEX IF NOT EXISTS vendor_2307_filings_status_idx
  ON public.vendor_2307_filings(status);
CREATE INDEX IF NOT EXISTS vendor_2307_filings_generated_at_idx
  ON public.vendor_2307_filings(generated_at DESC);

-- ----------------------------------------------------------------------------
-- 4. RLS — vendor reads own; admin reads all. No vendor writes.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_2307_filings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_2307_filings_self_read
  ON public.vendor_2307_filings;
CREATE POLICY vendor_2307_filings_self_read
  ON public.vendor_2307_filings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_2307_filings.vendor_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Vendor mark-as-filed flow — toggles status + filed_at via service-role
-- only. UPDATE / DELETE intentionally not policied for users; the vendor
-- UI POSTs to a server action that runs with the admin client.

-- ----------------------------------------------------------------------------
-- 5. pg_cron + pg_net extensions for quarterly auto-trigger.
--
-- pg_cron lives in the `cron` schema; pg_net in `net`. Both ship with
-- Supabase Postgres and are off by default — enabling them is owner-side
-- (Supabase Dashboard → Database → Extensions). Wrapping the schedule
-- statements in a DO block so the migration doesn't blow up on local /
-- bare-Postgres setups where the extensions aren't installed.
-- ----------------------------------------------------------------------------

DO $cron$
BEGIN
  -- Owner action: enable both extensions via the Supabase Dashboard.
  -- These CREATE EXTENSION statements are safe to ship — they're a no-op
  -- if the extension is already present, and Supabase auto-enables them
  -- when the owner toggles the extension on. Local-Postgres installs
  -- without the extensions available will hit the EXCEPTION branch and
  -- silently skip the scheduling.

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension unavailable; skipping schedule.';
    RETURN;
  END;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension unavailable; skipping schedule.';
    RETURN;
  END;

  -- Drop any previously-scheduled job with the same name so reruns are
  -- idempotent. cron.unschedule returns BOOLEAN; we swallow the result.
  PERFORM cron.unschedule('quarterly_2307_generation')
    FROM cron.job
    WHERE jobname = 'quarterly_2307_generation';

  -- Schedule: 18:00 UTC on the 1st of Jan/Apr/Jul/Oct = 02:00 PH time
  -- (PH is UTC+8) on the same calendar day in PH. pg_cron uses UTC.
  PERFORM cron.schedule(
    'quarterly_2307_generation',
    '0 18 1 1,4,7,10 *',
    $sql$
      SELECT net.http_post(
        url := COALESCE(
          current_setting('app.app_url', true),
          'https://www.setnayan.com'
        ) || '/api/admin/cron/generate-2307',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', COALESCE(current_setting('app.cron_secret', true), '')
        ),
        body := jsonb_build_object('triggered_by', 'pg_cron')
      );
    $sql$
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Catch-all for environments where extensions are present but
    -- scheduling fails (e.g. permission issues on a hosted shard).
    RAISE NOTICE 'Skipping quarterly_2307_generation schedule: %', SQLERRM;
END
$cron$;

COMMIT;
