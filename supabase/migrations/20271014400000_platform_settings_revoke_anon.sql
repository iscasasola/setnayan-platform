-- =====================================================================
-- Close the anonymous read on public.platform_settings.
--
-- WHY: policy `platform_settings_read_all` (20260513230000:41) is
-- `FOR SELECT TO anon, authenticated USING (true)` -- no condition at all --
-- and `anon` additionally holds table-level SELECT, INSERT, UPDATE, DELETE,
-- TRUNCATE, REFERENCES, TRIGGER. Anyone holding the publishable anon key,
-- which is in the page source by design, could
-- `GET /rest/v1/platform_settings?select=*` and receive the single settings
-- row in full.
--
-- Unlike the sibling finding on vendor_profiles (PR #3821, which was
-- fix-before-first-verification with an empty table), THIS ROW IS POPULATED
-- IN PRODUCTION TODAY. Verified against prod 2026-07-27 before writing:
-- 64 columns, 1 row, and `business_tin`, `business_address`,
-- `business_email`, `bdo_account_name`, `bdo_account_number`, `bdo_qr_url`,
-- `gcash_account_name`, `gcash_number`, `gcash_qr_url`,
-- `resend_from_address` and `vendor_validate_email` all hold real values.
-- `SET LOCAL ROLE anon; SELECT business_tin ...` succeeded against prod.
-- This is a live disclosure, not a latent one.
--
-- WHAT WAS EXPOSED, in three classes:
--   * Tax + corporate identity: business_tin (Setnayan's real BIR TIN),
--     business_address, business_email, resend_from_address. The bir_payor_*
--     and bir_authorized_rep_* columns are anon-readable too but currently
--     hold NULL -- they become a disclosure of a NAMED INDIVIDUAL's TIN the
--     moment the owner fills in the BIR block on /admin/settings.
--   * Internal business configuration: firstlook_boost_weight (the admin
--     search-ranking dial), setnayan_pay_fee_pct, referral_reward_php,
--     radar_min_n_floor, repost_watch_hamming_threshold, firstlook_sla_hours,
--     maya_checkout_endpoint, tiktok_client_key, the *_oauth_client_id /
--     *_oauth_redirect_uri values, vendor_validate_email/phone, the
--     *_sweep_last_run_at + admin_digest_last_sent_at cron timestamps, and
--     EVERY *_enabled feature flag -- which together disclose the unreleased
--     roadmap (radar_enabled, spotlight_homepage_enabled,
--     referral_program_enabled, free_tier_booking_cap_enabled,
--     vendor_addon_tiered_pricing_enabled, setnayan_ai_*_enabled ...).
--   * Deliberately customer-facing payment instructions: business_name,
--     bdo_*, gcash_*, default_vat_rate_pct. See the note below -- these are
--     NOT dropped from the product, they are moved behind a login.
--
-- THE ROOT CAUSE IS THE ORIGINAL COMMENT. 20260513230000:39 reads: "Everyone
-- can read -- these are display values (business name, TIN, merchant payment
-- info), not secrets." A TIN was never a display value, and the table has
-- since grown from 13 columns to 64: the policy stayed `USING (true)` while
-- 50 columns of internal configuration were added underneath it. A
-- `USING (true)` policy on a settings table is an open-ended promise that
-- every future column is public.
--
-- MECHANISM: full revoke, NO re-grant. anon needs exactly ZERO columns.
-- Verified by mapping every read path (see PR body): every logged-out-
-- reachable surface that needs a value from this table -- the brand icons
-- (lib/brand-settings.ts:65), the loader chrome (lib/loader-settings.ts:39),
-- the onboarding music (lib/platform-settings.ts:fetchOnboardingBgMusicUrl),
-- the favicon route, the homepage spotlight flag -- already reads through
-- `createAdminClient()` (service_role), which bypasses grants entirely.
-- Every session-client read sits behind an auth gate. No application code
-- changes are required, and none were made.
--
-- Nothing can break invisibly here: confirmed against prod that NO view or
-- materialized view in `public` references platform_settings (so there is no
-- security_invoker view whose anon reads would start 42501-ing), and NO RLS
-- policy on ANY other table subqueries platform_settings (so no other
-- table's anon SELECT depends on this grant). Both were the traps that
-- forced PR #3821 to re-grant 21 columns; neither applies here, which is why
-- this migration can take everything back.
--
-- THE PAYMENT-INSTRUCTION FIELDS -- a deliberate product decision, not an
-- oversight. bdo_*/gcash_*/business_name/default_vat_rate_pct exist to be
-- shown to customers under the apply-then-pay model. They are NOT being
-- hidden from customers: `authenticated` keeps full SELECT, and every
-- surface that renders them (the inline checkout drawer, /dashboard/*/orders,
-- /receipts/*) is already behind a login -- /receipts/[receiptId]/page.tsx:24
-- redirects a logged-out visitor to /login BEFORE the read. So the customer
-- journey is untouched, while a stranger who never signed up can no longer
-- bulk-pull Setnayan's bank account number alongside its TIN. Publishing
-- payment rails to authenticated buyers is the product; publishing them to
-- anonymous scrapers is not.
--
-- SCOPE -- `authenticated` KEEPS SELECT ON ALL 64 COLUMNS. This is
-- deliberate and it leaves a documented hole (see PR body): any logged-in
-- user can still read business_tin and the internal dials. It is NOT folded
-- in here because `fetchPlatformSettings` (lib/platform-settings.ts:94)
-- returns a hardcoded FALLBACK on ANY error -- so a column-level grant that
-- missed even one of the 25 columns in its SELECT list would not throw, it
-- would SILENTLY blank out the BDO/GCash payment details at checkout and
-- reset default_vat_rate_pct to 0. That is a money defect that CI cannot
-- see. Narrowing `authenticated` requires making that helper fail loudly
-- first, and gets its own PR.
--
-- WRITES: anon's and authenticated's write grants are revoked even though
-- RLS refuses the writes today (the SELECT policy is the table's only
-- policy, so INSERT/UPDATE/DELETE have no permissive policy to pass).
-- TRUNCATE is the reason this is not merely tidy: RLS is NEVER consulted for
-- TRUNCATE, so "there are no write policies" was never sufficient reasoning
-- for leaving it granted. Not reachable through PostgREST today (no TRUNCATE
-- verb, anon/authenticated are NOLOGIN); the realistic path is a future
-- SECURITY INVOKER RPC. Cost to remove is zero. All writes to this table go
-- through `createAdminClient()` in /admin surfaces -- verified across every
-- .update()/.insert() call site -- and service_role is untouched below.
--
-- IDEMPOTENT: DROP POLICY IF EXISTS + REVOKE/GRANT are safe to re-apply.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Take `anon` out of the read policy.
--
--    Strictly, revoking the grant in step 2 is already sufficient --
--    Postgres checks privileges BEFORE it evaluates RLS. This is
--    defence in depth against the realistic regression: someone later
--    runs `GRANT SELECT ... TO anon` (or a migration re-applies
--    Supabase's default privileges) and a policy still naming `anon`
--    would silently re-open the whole table. Leaving the role in the
--    policy also documents an intent that is no longer true.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS platform_settings_read_all ON public.platform_settings;

CREATE POLICY platform_settings_read_authenticated
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------
-- 2. Revoke everything from the anonymous role. No re-grant follows:
--    anon requires no column of this table.
--
--    Always name the roles -- a bare `FROM PUBLIC` leaves Supabase's
--    role-specific grants in place (supabase/security/README.md:126-133).
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_settings FROM anon;

-- ---------------------------------------------------------------------
-- 3. `authenticated` keeps SELECT (the checkout/receipt path) and loses
--    every write bit, TRUNCATE included.
-- ---------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.platform_settings FROM authenticated;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

-- =====================================================================
-- POST-CONDITIONS
--
-- A migration that silently no-ops is the failure mode being guarded
-- against: `schema_migrations` can report a migration APPLIED while its
-- DDL never landed (two confirmed cases in this repo's history). Each
-- block below RAISES rather than trusting the ledger.
-- =====================================================================

-- --- P0. ANTI-VACUITY: the canary columns must actually exist. --------
-- Without this, P1 passes trivially against a drifted schema.
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY[
    'business_tin','business_address','business_email','resend_from_address',
    'bir_authorized_rep_tin','firstlook_boost_weight','setnayan_pay_fee_pct',
    'bdo_account_number','gcash_number','default_vat_rate_pct'
  ]) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='platform_settings' AND column_name=c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'platform_settings post-condition P0 FAILED: canary columns absent (%). The privilege assertions below would pass vacuously.',
      missing;
  END IF;
END $$;

-- --- P1. NO column of the table is anon-selectable. -------------------
-- Asserted over EVERY column rather than a hand-written sensitive list,
-- so a column added later cannot quietly land anon-readable. Uses
-- has_column_privilege, which returns the EFFECTIVE privilege and so also
-- catches a leftover table-level grant.
DO $$
DECLARE leaked text; n int;
BEGIN
  SELECT count(*), string_agg(column_name, ', ' ORDER BY column_name)
    INTO n, leaked
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='platform_settings'
    AND has_column_privilege('anon','public.platform_settings',column_name,'SELECT');
  IF n > 0 THEN
    RAISE EXCEPTION
      'platform_settings post-condition P1 FAILED: % column(s) still anon-SELECTable: %', n, leaked;
  END IF;
END $$;

-- --- P2. anon holds NO table privilege of any kind. -------------------
-- Checked with has_table_privilege rather than information_schema:
-- role_table_grants only exposes grants whose grantee is a currently
-- enabled role, and would otherwise pass vacuously when applied by a
-- non-member role.
DO $$
DECLARE p text; held text := '';
BEGIN
  FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('anon','public.platform_settings',p) THEN
      held := held || p || ' ';
    END IF;
  END LOOP;
  IF held <> '' THEN
    RAISE EXCEPTION
      'platform_settings post-condition P2 FAILED: anon still holds: %', held;
  END IF;
END $$;

-- --- P3. No RLS policy on the table admits `anon` any more. -----------
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(polname, ', ') INTO bad
  FROM pg_policy
  WHERE polrelid = 'public.platform_settings'::regclass
    AND 'anon' = ANY (SELECT rolname FROM pg_roles WHERE oid = ANY(polroles));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'platform_settings post-condition P3 FAILED: policy/policies still naming anon: %', bad;
  END IF;
END $$;

-- --- P4. The checkout/receipt path still resolves. --------------------
-- Every column in the SELECT list of fetchPlatformSettings()
-- (lib/platform-settings.ts:53) plus fetchVendorValidateContacts()
-- (:126). If any of these stopped being readable by `authenticated`, the
-- helper would NOT throw -- it returns FALLBACK -- so checkout would
-- silently lose its BDO/GCash details. This asserts loudly instead.
DO $$
DECLARE c text; denied text := '';
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'id','business_name','business_tin','business_address','business_email',
    'bdo_account_name','bdo_account_number','bdo_qr_url',
    'gcash_account_name','gcash_number','gcash_qr_url',
    'default_vat_rate_pct','onboarding_bg_music_r2_key','onboarding_bg_music_enabled',
    'admin_digest_enabled','brand_icon_master_url','brand_favicon_ico_url',
    'brand_apple_touch_url','brand_icon_png_512_url','brand_icon_svg_url',
    'brand_icon_version','repost_watch_hamming_threshold','spotlight_homepage_enabled',
    'referral_program_enabled','updated_at',
    'vendor_validate_email','vendor_validate_phone'
  ] LOOP
    IF NOT has_column_privilege('authenticated','public.platform_settings',c,'SELECT') THEN
      denied := denied || c || ' ';
    END IF;
  END LOOP;
  IF denied <> '' THEN
    RAISE EXCEPTION
      'platform_settings post-condition P4 FAILED: authenticated lost SELECT on: % -- checkout would silently fall back to blank payment details.', denied;
  END IF;
END $$;

-- --- P5. authenticated holds SELECT and NO write bit; service_role -----
--         keeps full access. The tripwire against someone "simplifying"
--         this migration by adding authenticated to the REVOKE in step 2,
--         or by dropping the service_role grants along with anon's.
DO $$
DECLARE p text; held text := '';
BEGIN
  IF NOT has_table_privilege('authenticated','public.platform_settings','SELECT') THEN
    RAISE EXCEPTION 'platform_settings post-condition P5 FAILED: authenticated lost SELECT -- checkout, orders and receipts all read this table on the session client.';
  END IF;
  FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('authenticated','public.platform_settings',p) THEN
      held := held || p || ' ';
    END IF;
  END LOOP;
  IF held <> '' THEN
    RAISE EXCEPTION 'platform_settings post-condition P5 FAILED: authenticated still holds write privilege(s): %', held;
  END IF;
  IF NOT has_table_privilege('service_role','public.platform_settings','SELECT')
     OR NOT has_table_privilege('service_role','public.platform_settings','UPDATE') THEN
    RAISE EXCEPTION 'platform_settings post-condition P5 FAILED: service_role lost access -- every /admin write and every public brand/loader read goes through it.';
  END IF;
END $$;

COMMIT;
