-- samahan_stories_24h
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- Samahan Stories — the Setlog rhythm inside a samahan (owner 2026-08-24:
-- "samahan to have the same setlog concept … share stories every hour and we
-- will only keep these videos for 24 hours").
--
-- Shape of the promise, enforced HERE and not in app code:
--   · one story per member per community per clock hour (UNIQUE index on a
--     DB-stamped hour bucket — an app-side "last post" check would race);
--   · a story is INVISIBLE past 24 hours by RLS (expires_at > now() in the
--     read policy), so the 24-hour promise holds the instant the clock
--     passes, independent of when the storage sweep runs;
--   · screening happens BEFORE the row exists (the route classifies the
--     poster frame synchronously and refuses flagged posts), so there is no
--     'unscreened' state to leak — screened_at records that it happened.
--
-- Writes go through the service-role route only (member check + NSFW screen
-- + R2 upload live there). No INSERT/DELETE policy for authenticated — the
-- files must never outlive the row NOR the row outlive the files, and only
-- the server can delete both in the right order.

BEGIN;

CREATE TABLE IF NOT EXISTS public.samahan_stories (
  id             BIGSERIAL PRIMARY KEY,
  story_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  community_id   UUID NOT NULL REFERENCES public.communities(community_id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- r2://media/... refs. The clip is the browser-transcoded web copy (the
  -- member's phone does the compressing, same as Papic) — we never hold a raw
  -- phone export for a story.
  r2_object_key  TEXT NOT NULL,
  poster_r2_key  TEXT NOT NULL,
  clip_bytes     INTEGER NOT NULL DEFAULT 0 CHECK (clip_bytes >= 0),
  -- 10-second platform clip cap (owner 2026-07-22) — stories inherit it.
  duration_ms    INTEGER NOT NULL CHECK (duration_ms BETWEEN 1 AND 10000),
  -- Screening is a gate at the door: the route classifies the poster frame
  -- BEFORE inserting and refuses flagged posts, so every row that exists has
  -- been screened. This column records when.
  screened_at    TIMESTAMPTZ NOT NULL,
  -- DB-stamped hour bucket for the one-per-hour rule. date_trunc is STABLE
  -- (not IMMUTABLE) so it cannot sit in an index expression — stamping it
  -- into a column at insert time gives the UNIQUE index something immutable.
  hour_bucket    TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW()),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

COMMENT ON TABLE public.samahan_stories IS
  'Ephemeral samahan story clips (Setlog concept, owner 2026-08-24). One per member per community per clock hour; INVISIBLE past expires_at by RLS; R2 objects deleted by the samahan-story-sweep (file first, then row). Rows are pre-screened — the posting route refuses NSFW-flagged posters before any row exists.';
COMMENT ON COLUMN public.samahan_stories.expires_at IS
  '24 hours from posting. The read policy hides the row past this instant; the sweep deletes the R2 objects and then the row.';
COMMENT ON COLUMN public.samahan_stories.hour_bucket IS
  'date_trunc(''hour'', NOW()) stamped at insert — the one-story-per-hour rule is the UNIQUE index on (community_id, user_id, hour_bucket).';

CREATE INDEX IF NOT EXISTS samahan_stories_community_fresh_idx
  ON public.samahan_stories (community_id, expires_at);
CREATE INDEX IF NOT EXISTS samahan_stories_expired_idx
  ON public.samahan_stories (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS samahan_stories_one_per_hour_idx
  ON public.samahan_stories (community_id, user_id, hour_bucket);

ALTER TABLE public.samahan_stories ENABLE ROW LEVEL SECURITY;

-- Default-ACL hygiene (new tables arrive OPEN in this database): close
-- everything, then grant exactly the read the policy scopes.
REVOKE ALL ON public.samahan_stories FROM anon, authenticated;
GRANT SELECT ON public.samahan_stories TO authenticated;

-- Members of the community read its LIVE stories. expires_at sits in the
-- policy so the 24-hour promise is kept by the database, not by a sweep
-- having run. Admin override matches the communities pattern.
DROP POLICY IF EXISTS samahan_story_member_read ON public.samahan_stories;
CREATE POLICY samahan_story_member_read ON public.samahan_stories
  FOR SELECT TO authenticated
  USING (
    (community_id IN (SELECT public.current_community_ids())
      AND expires_at > NOW())
    OR public.is_admin()
  );

-- No INSERT / UPDATE / DELETE policies for authenticated, on purpose:
-- posting and pulling a story both move R2 objects, and only the
-- service-role route can keep files and rows in step.

COMMIT;
