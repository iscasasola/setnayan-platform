-- =============================================================================
-- Reconcile FOUR columns that shipped code already reads and writes but that
-- do not exist in the production database.
-- =============================================================================
--
-- Found 2026-07-26 by the .from().select() phantom-column sweep. These four are
-- the subset of that sweep where the right answer is NOT "rename the read":
-- the feature is real, the write path targets the column too, and the column is
-- simply absent from prod. Removing the reads would have deleted working UI.
--
-- TWO DIFFERENT ROOT CAUSES, both worth naming:
--
--  (A) `CREATE TABLE IF NOT EXISTS` silently no-op'd against a table that
--      already existed in a different shape. The migration is recorded as
--      applied in supabase_migrations.schema_migrations, `supabase db push`
--      reported success, and the declared column never landed. Nothing in CI
--      or at deploy time compares the declared schema to the real one, so the
--      divergence is invisible until a query 42703s in production — where it
--      is ALSO invisible, because `?? []` renders a failed read as "no rows".
--        · concierge_abuse_flags.admin_notes
--            declared 20260518000000_v1_concierge_pay_flat_and_charm.sql:83
--        · manpower_gigs.posted_by_user_id
--            declared 20260704020000_v2_phase_f_manpower_gigs.sql:52
--
--  (B) The feature shipped with no migration at all — code reads and writes
--      columns that were never declared anywhere.
--        · events.kwento_flash_auto_wall
--        · events.last_kwento_notify_at
--
-- Every statement is ADD COLUMN IF NOT EXISTS: re-running is a no-op, and if a
-- column turns out to exist in some other environment this migration leaves it
-- alone. events has 2 rows and manpower_gigs / concierge_abuse_flags have 0, so
-- there is no rewrite and no lock of consequence. On PG11+ ADD COLUMN with a
-- constant DEFAULT is metadata-only regardless.
--
-- ⚠ AFTER MERGING: verify this actually applied. Repo history says migrations
-- auto-apply UNRELIABLY on bursty merges, and cause (A) above is what a
-- silently-skipped migration looks like six months later. Check with:
--    select 1 from information_schema.columns
--     where table_schema='public' and table_name='events'
--       and column_name='kwento_flash_auto_wall';
-- =============================================================================

-- (A1) concierge_abuse_flags.admin_notes -------------------------------------
-- The 0023 § 3.11.3 review workflow REQUIRES notes: adminClearConciergeAbuse
-- rejects under 10 chars, adminConfirmConciergeAbuse under 20, and both then
-- UPDATE this column. Those updates throw on `error` — so the moment a real
-- flag existed, clearing or confirming it would have 500'd the admin console.
-- 0 rows today, which is the only reason nobody has hit it.
ALTER TABLE public.concierge_abuse_flags
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMENT ON COLUMN public.concierge_abuse_flags.admin_notes IS
  'Reviewing admin''s written rationale for the clear / confirm decision. '
  'Mandatory at the app layer (>=10 chars to clear, >=20 to confirm abuse) '
  'per iteration 0023 section 3.11.3.';

-- (A2) manpower_gigs.posted_by_user_id ----------------------------------------
-- postManpowerGig() INSERTs posted_by_user_id = auth.uid(), and both the host
-- surface and the vendor surface name it in their SELECT lists. With the column
-- missing, the insert 42703s and both reads 42703s: posting a gig was
-- impossible and every gig list was permanently empty. Hence 0 rows in prod.
--
-- Added NULLABLE first even though 20260704020000 declares it NOT NULL: the
-- SET NOT NULL is applied separately below and only when it is provably safe,
-- so this migration can never fail on a non-empty table in some other
-- environment.
ALTER TABLE public.manpower_gigs
  ADD COLUMN IF NOT EXISTS posted_by_user_id UUID REFERENCES public.users(user_id);

COMMENT ON COLUMN public.manpower_gigs.posted_by_user_id IS
  'The host who posted this gig. Declared NOT NULL by 20260704020000 but never '
  'created there: that migration''s CREATE TABLE IF NOT EXISTS no-op''d against '
  'a pre-existing table. Reconciled 2026-07-26.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.manpower_gigs WHERE posted_by_user_id IS NULL
  ) THEN
    ALTER TABLE public.manpower_gigs ALTER COLUMN posted_by_user_id SET NOT NULL;
  ELSE
    RAISE NOTICE
      'manpower_gigs.posted_by_user_id left NULLABLE: % pre-existing NULL row(s). '
      'Backfill then run ALTER TABLE public.manpower_gigs '
      'ALTER COLUMN posted_by_user_id SET NOT NULL;',
      (SELECT count(*) FROM public.manpower_gigs WHERE posted_by_user_id IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_manpower_posted_by
  ON public.manpower_gigs (posted_by_user_id);

-- (B) events.kwento_flash_auto_wall + events.last_kwento_notify_at ------------
-- The coordinator's "auto-wall clean Flash kwentos" switch on
-- /dashboard/[eventId]/live writes kwento_flash_auto_wall; the kwento intake
-- route reads it as a kill switch and uses last_kwento_notify_at to debounce
-- flagged-story notifications to the couple.
--
-- Both were absent, so: the toggle's UPDATE silently failed, the kill switch
-- read null and auto-walling proceeded regardless of the coordinator's choice,
-- and the debounce read null every time so flagged-story notifications had no
-- rate limit at all. DEFAULT TRUE matches the app-side `?? true`, so existing
-- events keep the behaviour they already have.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS kwento_flash_auto_wall BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.events.kwento_flash_auto_wall IS
  'Coordinator kill switch. TRUE (default): a clean Flash kwento is posted to '
  'the wall automatically after a 5s grace window. FALSE: Flash behaves like '
  'Story and goes to the couple review queue instead.';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS last_kwento_notify_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.last_kwento_notify_at IS
  'Debounce stamp for flagged-Story "review this" notifications to the couple. '
  'Written before the send so concurrent requests cannot both notify.';
