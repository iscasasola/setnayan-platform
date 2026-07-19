-- ============================================================================
-- 20270813337233_creator_adventure_chapter_foundation_cp1.sql
-- Creator "Adventure Chapter" — foundation (CP-1).
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Adventure_Chapter_Build_Plan_2026-07-16.md  (phase CP-1)
--       + Creator_Program_Council_Verdict_2026-07-15.md
--
-- The locked model (do NOT re-litigate — see the build plan):
--   A "Chapter" = (1) the creator's finished edit EMBEDDED from their own
--   platform (Setnayan NEVER hosts the full video), (2) a short owned-music
--   teaser Setnayan hosts [teaser render DEFERRED to a later PR — teaser_r2_key
--   stays null here], and (3) the raw substrate (Papic gallery / itinerary /
--   vendor refs) = the moat. Creators are FREE — `is_creator` is an ACCESS
--   flag, not a SKU.
--
-- This migration owns:
--   1. users.is_creator            — admin-granted access flag (self-apply flow
--                                     is a follow-up). Default FALSE.
--   2. creator_chapters            — the Chapter rows. Public id prefix S89C-
--                                     (C = Chapter). RLS enabled at CREATE.
--
-- DEPENDS ON `users.public_profile_enabled` (BOOLEAN NOT NULL DEFAULT FALSE),
-- added by 20270812020691_users_public_profile_enabled.sql (Social-Share #7b).
-- That column — not this migration — owns the account's public/hidden gate;
-- the chapter public-read policy below JOINS to it. Default FALSE = dormant /
-- opt-in: a creator's published chapters are publicly readable only once they
-- turn their public profile on.
--
-- RLS (canonical patterns ONLY — 02_Specifications/RLS_Policy_Pattern.md):
--   • Owner-write  → Pattern A (per-user private data): user_id = auth.uid().
--   • Public-read  → Pattern D (public-read): FOR SELECT TO anon, authenticated,
--                     gated on status='published' AND the owner being a creator
--                     with a public profile (subquery to users, per the plan).
--   • Setnayan admin override (Pattern A/D convention).
--
-- Note on the public-read subquery to `users`: under `users`' own RLS
-- (Pattern A — only the row owner or an admin can read a users row), the
-- EXISTS(...) subquery errs CLOSED for anon / non-owner callers hitting
-- PostgREST directly — i.e. it never LEAKS a draft or a hidden profile. The
-- actual public render path (CP-3, DEFERRED) reads via the service-role admin
-- client and filters in app code, exactly like app/u/[userSlug]/page.tsx does
-- today. The policy is therefore correct-and-conservative defense-in-depth.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. users flags
-- ----------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_creator BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.is_creator IS
  'Creator-program access flag (Adventure Chapter). Admin-granted for now; creators are FREE. Gates the /dashboard/creator surface and chapter public-read.';

-- ----------------------------------------------------------------------------
-- 2. creator_chapters
--    A chapter may wrap a real Setnayan event (event_id) or stand alone (NULL).
--    embed_url is stored ALREADY NORMALIZED to a privacy-enhanced/no-cookie URL
--    by the app layer (lib/creator-chapters.ts); embed_provider is constrained
--    to the allowlist so a stray value can never reach a rendered iframe.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creator_chapters (
  id             BIGSERIAL PRIMARY KEY,
  chapter_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id      TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('C'),

  -- Owner (the creator). Matches Pattern A's user_id = auth.uid() shape.
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optional real Setnayan event this chapter wraps. NULL = standalone chapter.
  event_id       UUID REFERENCES public.events(event_id) ON DELETE SET NULL,

  title          TEXT NOT NULL,
  kind           TEXT NOT NULL
                   CHECK (kind IN ('wedding', 'travel', 'food', 'lifestyle')),

  -- The embedded finished edit (hosted on the creator's own platform).
  embed_url      TEXT,
  embed_provider TEXT
                   CHECK (embed_provider IS NULL
                          OR embed_provider IN ('youtube', 'instagram', 'tiktok')),

  -- Short owned-music teaser Setnayan hosts. Render is DEFERRED — stays NULL.
  teaser_r2_key  TEXT,

  -- Raw substrate refs (papic gallery id / itinerary / vendor ids). Stored now,
  -- surfaced publicly in CP-3/CP-4. Shape is app-owned; keep it a bag of refs.
  substrate      JSONB NOT NULL DEFAULT '{}'::jsonb,

  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published')),
  published_at   TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_chapters_user_id_idx
  ON public.creator_chapters(user_id);
CREATE INDEX IF NOT EXISTS creator_chapters_event_id_idx
  ON public.creator_chapters(event_id)
  WHERE event_id IS NOT NULL;
-- Public timeline read path (CP-3): a creator's published chapters, newest first.
CREATE INDEX IF NOT EXISTS creator_chapters_published_idx
  ON public.creator_chapters(user_id, published_at DESC)
  WHERE status = 'published';

ALTER TABLE public.creator_chapters ENABLE ROW LEVEL SECURITY;

-- Pattern A — owner reads/writes their own chapters (incl. drafts).
DROP POLICY IF EXISTS creator_owns_chapter ON public.creator_chapters;
CREATE POLICY creator_owns_chapter ON public.creator_chapters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pattern D — public reads a PUBLISHED chapter only when its owner is a creator
-- with a public profile. Errs closed for anon/non-owner under users' RLS
-- (never leaks a draft or a hidden profile); CP-3 renders via the admin client.
DROP POLICY IF EXISTS public_can_read_published_chapter ON public.creator_chapters;
CREATE POLICY public_can_read_published_chapter ON public.creator_chapters
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = creator_chapters.user_id
        AND u.is_creator = TRUE
        AND u.public_profile_enabled = TRUE
    )
  );

-- Setnayan admin override (read + write any row) for support/moderation.
DROP POLICY IF EXISTS admin_full_access_creator_chapters ON public.creator_chapters;
CREATE POLICY admin_full_access_creator_chapters ON public.creator_chapters
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
