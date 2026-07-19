-- ============================================================================
-- 20270818771487_storytellers_chapter_featuring.sql
-- Storytellers hub (PR-D) — chapter featuring columns + read-path indexes.
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Storytellers_Editorial_Architecture_Council_Verdict_2026-07-16.md §5
--       + Creator_Economy_Simplest_Approach_Council_Verdict_2026-07-16.md §5
--       (owner-ratified 2026-07-16 — badge word "Storyteller", YouTube-derived
--       thumbnails, deny-by-default curation).
--
-- The model (deny-by-default): a creator PUBLISHING a chapter makes it public
-- only on their own /u/[slug] timeline — publish ≠ listed. An owner "Feature"
-- click in the /admin/studio Storytellers tab stamps `showcase_featured_at`,
-- and ONLY featured chapters ever render in the "From Our Storytellers" shelf
-- on /realstories. This mirrors the EXACT 2-column curation pattern of
-- migration 20261221000000 (events.showcase_featured_at / _feature_rank) —
-- pattern-copied, never shared: two independent gates, two write paths.
--
--   • showcase_featured_at   timestamptz NULL — NULL = not featured. Stamped
--                            by the owner's Feature click; cleared by
--                            Unfeature AND atomically by a report-hide
--                            resolution (admin/user-reports — the S0 seam).
--   • showcase_feature_rank  int NULL — lower sorts higher on the shelf;
--                            NULL sorts last.
--
-- Featuring never overrides the RLS/app gates: the public shelf loader still
-- requires status='published' AND the owner's public_profile_enabled — a
-- featured chapter whose owner hides their profile (or unpublishes) drops off
-- the shelf without the featured stamp mattering.
--
-- Indexes:
--   1. Partial featured index — the public shelf's ordered read (only featured
--      published rows participate). Mirror of events_showcase_featured_idx.
--   2. Global published index (published_at DESC) — the admin candidate list
--      reads ALL published chapters newest-first; today's only published index
--      (20270813337233 creator_chapters_published_idx) is user-scoped.
--
-- NO new tables. NO changes to `events`. NO changes to either consent gate.
--
-- RLS: creator_chapters already has owner-write (Pattern A), public-read
-- (Pattern D) and the admin override; admin writes in the app go through the
-- service-role client and are audited in admin_audit_log. No policy change.
--
-- Additive + idempotent. NOT auto-applied — owner applies with:
--   supabase db push --db-url "$SUPABASE_DB_URL"
-- ----------------------------------------------------------------------------

BEGIN;

ALTER TABLE public.creator_chapters
  ADD COLUMN IF NOT EXISTS showcase_featured_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS showcase_feature_rank INTEGER     NULL;

COMMENT ON COLUMN public.creator_chapters.showcase_featured_at IS
  'Storytellers featuring (PR-D 2026-07-16): when set, this chapter is pinned to the "From Our Storytellers" shelf on /realstories by the owner. NULL = published-but-not-listed (deny-by-default). Cleared on unfeature AND atomically by a report-hide resolution.';
COMMENT ON COLUMN public.creator_chapters.showcase_feature_rank IS
  'Storytellers featuring (PR-D 2026-07-16): manual sort weight on the /realstories Storytellers shelf; lower = higher, NULL sorts last.';

-- 1 · Partial index — only featured published rows participate in the ordered
--     public shelf read (mirror of events_showcase_featured_idx).
CREATE INDEX IF NOT EXISTS creator_chapters_showcase_featured_idx
  ON public.creator_chapters (showcase_feature_rank ASC NULLS LAST, showcase_featured_at DESC)
  WHERE status = 'published' AND showcase_featured_at IS NOT NULL;

-- 2 · Global published index — the admin Storytellers candidate list reads all
--     published chapters newest-first (the existing published index is
--     user-scoped and can't serve a cross-creator scan).
CREATE INDEX IF NOT EXISTS creator_chapters_published_global_idx
  ON public.creator_chapters (published_at DESC)
  WHERE status = 'published';

COMMIT;
