-- panood_broadcasts — live-broadcast lifecycle state for the "upgraded" Panood
-- (iteration 0011). One row per broadcast Setnayan creates on the couple's OWN
-- YouTube channel (via the `youtube` scope): liveBroadcasts.insert +
-- liveStreams.insert + bind, then transition testing→live→complete.
--
-- Holds the SECRET stream_key (the OBS "Stream Key"), so the table is
-- SERVICE-ROLE ONLY: RLS is enabled with NO policy, and every read/write goes
-- through createAdminClient() in lib/panood-broadcast.ts (same posture as
-- oauth_grants refresh tokens). The public watch URL is mirrored into the
-- existing events.panood_watch_url column, which the event-page embed already
-- consumes — this table never feeds the client directly.

CREATE TABLE IF NOT EXISTS public.panood_broadcasts (
  id                  bigserial PRIMARY KEY,
  event_id            uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  broadcast_id        text NOT NULL,   -- YouTube liveBroadcast id == the public videoId
  stream_id           text NOT NULL,   -- YouTube liveStream id
  stream_key          text NOT NULL,   -- SECRET: the OBS "Stream Key" (cdn.ingestionInfo.streamName)
  ingestion_url       text NOT NULL,   -- RTMP server URL the encoder pushes to
  status              text NOT NULL DEFAULT 'ready'
                        CHECK (status IN ('ready','testing','live','complete','errored')),
  scheduled_start_at  timestamptz,
  went_live_at        timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS enabled at CREATE TABLE time (canonical rule). No policy is defined on
-- purpose: the table carries the secret stream_key, so anon/authed clients must
-- never read it. lib/panood-broadcast.ts reads + writes it via the admin
-- (service-role) client only; the couple sees their stream key through the
-- server-rendered setup page, never a direct client query.
ALTER TABLE public.panood_broadcasts ENABLE ROW LEVEL SECURITY;

-- Idempotency guard: at most one ACTIVE broadcast per event, so a
-- double-clicked "Create broadcast" can't spin up (and double-spend YouTube
-- quota on) two broadcasts. A completed or errored broadcast does not block a
-- fresh one.
CREATE UNIQUE INDEX IF NOT EXISTS panood_broadcasts_one_active_per_event
  ON public.panood_broadcasts (event_id)
  WHERE status NOT IN ('complete', 'errored');

CREATE INDEX IF NOT EXISTS panood_broadcasts_event_idx
  ON public.panood_broadcasts (event_id);

COMMENT ON TABLE public.panood_broadcasts IS
  'Upgraded Panood: YouTube live-broadcast lifecycle on the couple''s own channel. Service-role only (holds secret stream_key); watch URL mirrors to events.panood_watch_url. lib/panood-broadcast.ts.';
