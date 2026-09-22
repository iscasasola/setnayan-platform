-- a_couple_can_report_a_shop — CTRL-B3 build 9.
--
-- ── THE GAP, measured 2026-09-22 ───────────────────────────────────────────
-- `ReportPageButton` accepts `event | user_profile | chapter`, `PublicPageActions`
-- is mounted on `app/[slug]` and `/u/*` only — never under `app/v/` — and this
-- CHECK allowed no vendor value. So a couple who meets a misrepresenting shop
-- had **no route to report it at all**, on the one surface where strangers meet
-- strangers and money changes hands.
--
-- ⚠ THE LIST BELOW IS THE LIVE CONSTRAINT, READ FROM PRODUCTION, PLUS ONE.
-- Re-listing a CHECK from an older migration silently drops every value added
-- since — and the failure only appears at ALTER TABLE time against real rows,
-- which in this repo means the PGlite replay rather than a person. Measured
-- 2026-09-22 with `pg_get_constraintdef`:
--
--   photo · comment · user · ai_output · event · user_profile · chapter
--
-- `vendor` is the eighth. Nothing else moves.

ALTER TABLE public.user_reports
  DROP CONSTRAINT IF EXISTS user_reports_target_type_check;
ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_target_type_check
    CHECK (target_type = ANY (ARRAY[
      'photo'::text,
      'comment'::text,
      'user'::text,
      'ai_output'::text,
      'event'::text,
      'user_profile'::text,
      'chapter'::text,
      -- CTRL-B3 build 9. The reported id is `vendor_profiles.vendor_profile_id`.
      'vendor'::text
    ]));

COMMENT ON CONSTRAINT user_reports_target_type_check ON public.user_reports IS
  'The reportable surfaces. Extended 2026-09-22 with ''vendor'' so a couple can '
  'report a shop — until then the marketplace was the only public surface with '
  'no report route. ⚠ Re-list this from the LIVE constraint, never from an older '
  'migration: a retyped list drops whatever was added since, and the failure '
  'surfaces only against real rows.';
