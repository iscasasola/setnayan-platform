-- 🎞 EVERY FILM OF THEIR DAY, ATTACHED TO THE EVENT — the feature the ₱2,500 page
-- already promises.
--
-- WHY THIS EXISTS AND WHY IT IS URGENT. Migration `20271194920190` rewrote the
-- LIVE_STUDIO catalog description to the owner's 2026-09-02 ruling: "One unlock covers
-- the whole event — unlimited streams, **unlimited video-link uploads**, no day limit."
-- The first and third were true when written. The second was not: nothing anywhere let a
-- COUPLE attach a video link to their event. `video-links-editor.tsx` exists but is
-- vendor-dashboard only, for vendor microsites.
--
-- So the buy screen has been selling a feature that does not exist. This is that feature.
--
-- ── WHY A TABLE AND NOT A JSONB COLUMN ─────────────────────────────────────
-- "Unlimited" is the product promise. A jsonb array on `events` would work until the
-- couple with fourteen films, and it makes per-film ordering and removal a read-modify-
-- write race between two people editing the same event. Rows are the honest shape.
--
-- ── RLS: AUTHENTICATED ONLY, AND THAT IS DELIBERATELY ENOUGH ───────────────
-- The public story page reads through `createAdminClient()` (service role) —
-- `app/[slug]/_components/editorial/data.ts` builds its whole payload that way — so anon
-- needs NO policy here and gets none. Adding an anon SELECT "so the page works" would
-- widen the public surface for a read that already happens as service_role.
-- Host access uses `public.current_event_ids()`, the canonical helper (CLAUDE.md § RLS).
--
-- ⚠ NO PAYWALL ON THIS TABLE. Owner ruling 2026-09-02: attaching links is FREE and lives
-- with Story Maker, which is free. `LIVE_STUDIO` names it because one unlock covers
-- everything, not because it gates it. A gate here would be a second rule that can
-- disagree with the first, and the way it would disagree is a couple's own prenup film
-- vanishing from their story the day an entitlement lapses.

CREATE TABLE IF NOT EXISTS public.event_films (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- 'youtube' | 'vimeo' — the two providers lib/vendor-microsite.ts parses, owner-locked
  -- 2026-07-03. Google Drive and everything else are rejected by the parser, not here.
  provider     TEXT NOT NULL CHECK (provider IN ('youtube', 'vimeo')),
  -- The provider's own id, already validated by parseVideoRef before it reaches here.
  video_id     TEXT NOT NULL CHECK (length(video_id) BETWEEN 1 AND 64),
  -- Vimeo unlisted share hash (`vimeo.com/{id}/{hash}`). NULL for YouTube and for
  -- public Vimeo. Without it an unlisted Vimeo link cannot be played back.
  video_hash   TEXT CHECK (video_hash IS NULL OR length(video_hash) BETWEEN 1 AND 64),
  -- What the couple calls it: "Same-Day Edit", "Our prenup". Optional.
  label        TEXT CHECK (label IS NULL OR length(label) <= 120),
  sort_key     INTEGER NOT NULL DEFAULT 0,
  added_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One film once per event. A couple pasting the same link twice gets one row, not two
  -- identical cards they then have to tell apart to delete the right one.
  UNIQUE (event_id, provider, video_id)
);

CREATE INDEX IF NOT EXISTS event_films_event_idx
  ON public.event_films (event_id, sort_key, id);

ALTER TABLE public.event_films ENABLE ROW LEVEL SECURITY;

-- ⚠ `current_couple_event_ids()`, NOT `current_event_ids()`. The latter returns events
-- for ANY member_type, so a policy named `_host_` that used it would let an ordinary
-- GUEST attach films to the couple's story — the name would be lying about its own
-- scope. `tests/db/couple-host-policy-scope.db.test.ts` catches exactly this and caught
-- it here: the first version of this migration shipped `current_event_ids()`.
CREATE POLICY event_films_host_all ON public.event_films
  FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin())
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

COMMENT ON TABLE public.event_films IS
  'Films the couple attaches to their event — same-day edit, prenup, the videographer''s '
  'cut. Rendered on the story page beside the live replay. Free (Story Maker); LIVE_STUDIO '
  'names it only because one unlock covers everything. Read publicly via service role.';

-- 🔒 AND TAKE THE WHOLE TABLE OFF `anon`, AT BIRTH.
--
-- A new table in `public` inherits Supabase's blanket grants, so `event_films` arrived
-- with anon holding SELECT + INSERT + UPDATE on all seven columns — caught by
-- `tests/db/exposure-freeze.db.test.ts`, not by review.
--
-- ANON NEEDS NOTHING HERE. The public story page reads these rows through
-- `createAdminClient()` (service role) — `app/[slug]/_components/editorial/data.ts`
-- builds its whole payload that way — and the only writer is a host-gated server action.
-- There is no path, now or planned, on which an anonymous caller touches this table.
--
-- 🔑 AND THIS IS THE FIX THAT WAS NOT AVAILABLE ON `public.users` THIS MORNING
-- (`20271193294406`). There, anon's SELECT could not be revoked: twenty-plus RLS policies
-- read `users` in their USING clause, PostgreSQL evaluates those AS THE CALLING USER, and
-- pulling the grant would have made `creator_chapters.public_can_read_published_chapter`
-- RAISE instead of deny — breaking every public creator page. A brand-new table has no
-- such dependants, so the whole grant goes, and it goes in the same migration that
-- creates it rather than being left for someone to notice later.

REVOKE ALL ON public.event_films FROM anon;
