-- ============================================================================
-- Real Stories featuring — admin curate/pin/order for /realstories
-- PR D of the Real Stories featuring program · 2026-06-14
-- ============================================================================
-- Lets a Setnayan HQ admin FEATURE (pin) and ORDER which published, consent-
-- gated wedding editorials surface on the public /realstories index, plus
-- choose the hero "Featured" slot. Kept deliberately LIGHT — two nullable
-- columns on `events`, no new table:
--
--   • showcase_featured_at    timestamptz NULL — NULL = not featured. Set when
--                             an admin pins a wedding to /realstories.
--   • showcase_feature_rank   int NULL — lower sorts higher on the page; NULL
--                             sorts last. The top-ranked featured wedding fills
--                             the hero slot.
--
-- A wedding only becomes featurable once it ALREADY qualifies as a published
-- showcase (event_type='wedding', public slug, past the T+30d grace window,
-- AND a couple member opted in via users.public_summary_consent_at) — featuring
-- is curation ON TOP of the existing RA 10173 consent gate, never a bypass of
-- it. The curated SAMPLE ("Maria & Juan") is an in-code constant and is NOT in
-- this table, so it can never be admin-featured — it stays clearly labelled
-- "Sample showcase".
--
-- RLS: `events` already enables RLS at CREATE TABLE time, and the existing
-- `couple_can_update_event` policy includes `OR public.is_admin()` in its
-- USING clause — so admins can already UPDATE these new columns. Admin writes
-- in the app go through the service-role client (bypasses RLS) and are audited
-- in admin_audit_log. The public /realstories read path uses the admin client
-- too (anonymous page reading behind-RLS rows), exactly as loadPublishedShowcases
-- already does. No new policy needed; no policy is widened.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS · CREATE INDEX IF NOT EXISTS).
-- NOT auto-applied — owner applies with:
--   supabase db push --db-url "$SUPABASE_DB_URL"
-- ----------------------------------------------------------------------------

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS showcase_featured_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS showcase_feature_rank INTEGER     NULL;

COMMENT ON COLUMN public.events.showcase_featured_at IS
  'Real Stories featuring (PR D 2026-06-14): when set, this wedding is pinned to /realstories by an admin. NULL = not featured. Only meaningful once the event already qualifies as a consent-gated published showcase.';
COMMENT ON COLUMN public.events.showcase_feature_rank IS
  'Real Stories featuring (PR D 2026-06-14): manual sort weight on /realstories; lower = higher on the page, NULL sorts last. The lowest-rank featured wedding fills the hero slot.';

-- Partial index — only featured rows participate in the ordered public read.
CREATE INDEX IF NOT EXISTS events_showcase_featured_idx
  ON public.events (showcase_feature_rank ASC NULLS LAST, showcase_featured_at DESC)
  WHERE showcase_featured_at IS NOT NULL;

COMMIT;
