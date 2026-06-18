-- 20270103050000_alaala_clips.sql
--
-- WHY: Lane A of the Alaala pipeline — the couple's own video clips that play
-- inside the Alaala orb on their editorial page and on the marketing
-- /our-story showcase. Clips are either uploaded directly by the couple
-- (source = 'couple_upload') or sourced from guest-consented Papic captures
-- (source = 'papic'). The dual-consent gate (consent_to_public +
-- couple_approved_for_showcase) guards public visibility per the Alaala orb
-- consent rule (memory: project_setnayan_alaala_orb_video_consent).
--
-- NOT AUTO-APPLIED: owner runs `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.alaala_clips (
  id                         BIGSERIAL PRIMARY KEY,
  event_id                   UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  source                     TEXT        NOT NULL CHECK (source IN ('couple_upload', 'papic')),
  r2_object_key              TEXT        NOT NULL,
  duration_ms                INTEGER     NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 5500),
  sort_order                 INTEGER     NOT NULL DEFAULT 0,
  -- couple_upload: both flags default TRUE (couple has implicit consent over their own uploads)
  -- papic:        flags land FALSE, set by the couple once they review guest captures
  consent_to_public          BOOLEAN     NOT NULL DEFAULT FALSE,
  couple_approved_for_showcase BOOLEAN   NOT NULL DEFAULT FALSE,
  uploaded_by_user_id        UUID        REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.alaala_clips IS
  'Video clips that play inside the Alaala orb. Couple uploads (source=couple_upload) '
  'have both consent flags pre-set to TRUE. Papic clips (source=papic) require the '
  'couple to explicitly approve before they are shown publicly. See memory: '
  'project_setnayan_alaala_orb_video_consent.';

-- Fast lookup: clips for an event, ordered for the orb rotation
CREATE INDEX IF NOT EXISTS idx_alaala_clips_event
  ON public.alaala_clips (event_id, sort_order, id);

-- Fast lookup: public-safe clips for the editorial page
CREATE INDEX IF NOT EXISTS idx_alaala_clips_public
  ON public.alaala_clips (event_id, consent_to_public, couple_approved_for_showcase);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.alaala_clips ENABLE ROW LEVEL SECURITY;

-- Couple can read all their own event's clips (dashboard management view)
DROP POLICY IF EXISTS couple_read_own_clips ON public.alaala_clips;
CREATE POLICY couple_read_own_clips ON public.alaala_clips
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Couple can insert (via upload API which uses the admin client — this policy
-- covers the dashboard management flow using the user-scoped client)
DROP POLICY IF EXISTS couple_insert_own_clips ON public.alaala_clips;
CREATE POLICY couple_insert_own_clips ON public.alaala_clips
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

-- Couple can update their own clips (approve/reorder/delete)
DROP POLICY IF EXISTS couple_update_own_clips ON public.alaala_clips;
CREATE POLICY couple_update_own_clips ON public.alaala_clips
  FOR UPDATE TO authenticated
  USING  (event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

-- Couple can delete their own clips
DROP POLICY IF EXISTS couple_delete_own_clips ON public.alaala_clips;
CREATE POLICY couple_delete_own_clips ON public.alaala_clips
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Admins have full read access
DROP POLICY IF EXISTS admin_read_all_clips ON public.alaala_clips;
CREATE POLICY admin_read_all_clips ON public.alaala_clips
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Public SELECT (anonymous) — only fully-consented clips
DROP POLICY IF EXISTS public_read_consented_clips ON public.alaala_clips;
CREATE POLICY public_read_consented_clips ON public.alaala_clips
  FOR SELECT
  USING (consent_to_public = TRUE AND couple_approved_for_showcase = TRUE);

COMMIT;
