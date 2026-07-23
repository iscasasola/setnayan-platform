-- panood_roam_foundation — schema for Live Studio ROAM (the "guests pick which
-- camera / wander the venue" product, 2026-07-23 owner design session).
--
-- ROAM is DELIBERATELY ISOLATED from CAST (the existing directed single-feed
-- product). CAST relies on panood_broadcasts' "one active broadcast per event"
-- unique index — ROAM needs N concurrent broadcasts per event, so it gets its
-- OWN tables here rather than loosening that live, selling constraint. Nothing
-- in this migration touches panood_broadcasts / panood_camera_operators.
--
-- Channel model (owner-locked 2026-07-23 "we will integrate our own youtube
-- channel"): ROAM streams run on a SETNAYAN-OWNED channel POOL, one channel per
-- event, recycled after (recordings pulled + handed to the couple). See
-- Live_Studio_Cast_and_Roam_2026-07-23.md.
--
-- Everything here is flag-dark: no prod path reads these tables until
-- NEXT_PUBLIC_PANOOD_ROAM_ENABLED=true (lib/panood-roam.ts). The "roam" code
-- namespace is prefixed panood_ to stay clear of the 3D-avatar "roam"
-- (tap-to-walk) feature, which is unrelated.
--
-- KEEP THIS MIGRATION IDEMPOTENT (mirrors panood_broadcasts conventions):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ===========================================================================
-- 1. panood_roam_zones — the "places" a guest can visit (control-plane).
--    Couple-managed; one row per zone/camera the couple exposes for the event.
--    Mirrors panood_camera_operators RLS (couple + coordinator + admin, NOT
--    guests). The PUBLIC picker never reads this table — its non-secret fields
--    are mirrored into events.panood_roam_manifest (below), exactly as the CAST
--    watch URL mirrors into events.panood_watch_url.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.panood_roam_zones (
  id                 bigserial PRIMARY KEY,
  event_id           uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  zone_index         int NOT NULL,          -- dense 1..N per event; picker order derives from this
  label              text NOT NULL,         -- "Ceremony", "Reception Floor", "Photo Booth"
  venue_label        text,                  -- optional multi-venue grouping: "Church", "Reception Hall"
  camera_operator_id bigint REFERENCES public.panood_camera_operators(id) ON DELETE SET NULL,
                                            -- which camera "seat" feeds this zone (nullable until bound)
  is_featured        boolean NOT NULL DEFAULT false,
                                            -- the default "director's cut" zone the picker lands on
  sort_order         int NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned','live','offline','disabled')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, zone_index)
);

ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS event_id           uuid;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS zone_index         int;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS label              text;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS venue_label        text;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS camera_operator_id bigint;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS is_featured        boolean NOT NULL DEFAULT false;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS sort_order         int NOT NULL DEFAULT 0;
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'planned';
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.panood_roam_zones ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS panood_roam_zones_event_idx ON public.panood_roam_zones (event_id);

ALTER TABLE public.panood_roam_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panood_roam_zones_couple_full ON public.panood_roam_zones;
CREATE POLICY panood_roam_zones_couple_full ON public.panood_roam_zones
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_roam_zones.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = panood_roam_zones.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.panood_roam_zones IS
  'Live Studio ROAM: the "places" a guest can visit (one per camera/zone/venue). Control-room RLS (couple + coordinator, NOT guests); public picker reads the mirrored events.panood_roam_manifest, never this table. lib/panood-roam.ts.';

-- ===========================================================================
-- 2. panood_roam_channel_pool — Setnayan-owned YouTube channel inventory (ops).
--    One row per Setnayan channel available to host ROAM streams. A channel is
--    checked out for an event's window, then returned. Admin-managed; couples
--    never see it. Channel ids are not secret (per-camera stream keys live in
--    panood_roam_streams, service-role only) — so is_admin() RLS, not no-policy.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.panood_roam_channel_pool (
  id                   bigserial PRIMARY KEY,
  youtube_channel_id   text NOT NULL,
  label                text,                     -- admin nickname, e.g. "Pool #1"
  status               text NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available','checked_out','maintenance','retired')),
  checked_out_event_id uuid REFERENCES public.events(event_id) ON DELETE SET NULL,
  checked_out_at       timestamptz,
  verified             boolean NOT NULL DEFAULT false,  -- G1: live-enabled + verified + good standing
  concurrent_cap       int NOT NULL DEFAULT 4,          -- soft per-channel concurrency cap for this pool channel
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (youtube_channel_id)
);

ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS youtube_channel_id   text;
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS label                text;
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS status               text NOT NULL DEFAULT 'available';
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS checked_out_event_id uuid;
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS checked_out_at       timestamptz;
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS verified             boolean NOT NULL DEFAULT false;
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS concurrent_cap       int NOT NULL DEFAULT 4;
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS created_at           timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.panood_roam_channel_pool ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

-- One channel checked out per event at a time (a completed/returned channel frees up).
CREATE UNIQUE INDEX IF NOT EXISTS panood_roam_channel_pool_one_per_event
  ON public.panood_roam_channel_pool (checked_out_event_id)
  WHERE status = 'checked_out' AND checked_out_event_id IS NOT NULL;

ALTER TABLE public.panood_roam_channel_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panood_roam_channel_pool_admin_full ON public.panood_roam_channel_pool;
CREATE POLICY panood_roam_channel_pool_admin_full ON public.panood_roam_channel_pool
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.panood_roam_channel_pool IS
  'Live Studio ROAM: Setnayan-owned YouTube channel pool (one channel checked out per event, recycled). Admin-only RLS. Scales concurrent weddings + isolates copyright-strike blast radius. lib/panood-roam.ts.';

-- ===========================================================================
-- 3. panood_roam_streams — the per-zone YouTube broadcasts (N per event).
--    The isolation that lets ROAM run many concurrent streams without touching
--    CAST's single-active panood_broadcasts index. Holds the SECRET stream_key,
--    so SERVICE-ROLE ONLY: RLS enabled, NO policy (same posture as
--    panood_broadcasts / oauth_grants). Public videoIds reach the picker only via
--    the mirrored events.panood_roam_manifest.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.panood_roam_streams (
  id              bigserial PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  zone_id         bigint REFERENCES public.panood_roam_zones(id) ON DELETE SET NULL,
  channel_pool_id bigint REFERENCES public.panood_roam_channel_pool(id) ON DELETE SET NULL,
  broadcast_id    text NOT NULL,   -- YouTube liveBroadcast id == the public videoId
  stream_id       text NOT NULL,   -- YouTube liveStream id
  stream_key      text NOT NULL,   -- SECRET: the per-camera RTMP stream key
  ingestion_url   text NOT NULL,   -- RTMP server URL the kit phone pushes to
  status          text NOT NULL DEFAULT 'ready'
                    CHECK (status IN ('ready','testing','live','complete','errored')),
  went_live_at    timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS event_id        uuid;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS zone_id         bigint;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS channel_pool_id bigint;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS broadcast_id    text;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS stream_id       text;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS stream_key      text;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS ingestion_url   text;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'ready';
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS went_live_at    timestamptz;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS ended_at        timestamptz;
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.panood_roam_streams ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS panood_roam_streams_event_idx ON public.panood_roam_streams (event_id);
CREATE INDEX IF NOT EXISTS panood_roam_streams_zone_idx  ON public.panood_roam_streams (zone_id);

-- At most one ACTIVE stream per zone (a double-clicked provision can't double-spend
-- YouTube quota). N zones per event → N streams per event: NO event-level
-- single-active index — that is the whole point of the ROAM isolation.
CREATE UNIQUE INDEX IF NOT EXISTS panood_roam_streams_one_active_per_zone
  ON public.panood_roam_streams (zone_id)
  WHERE status NOT IN ('complete','errored') AND zone_id IS NOT NULL;

ALTER TABLE public.panood_roam_streams ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: carries the secret stream_key. All reads/writes go
-- through the service-role admin client (lib/panood-roam.ts, later PR), same as
-- panood_broadcasts. The public picker only ever sees mirrored videoIds.

COMMENT ON TABLE public.panood_roam_streams IS
  'Live Studio ROAM: per-zone YouTube broadcast lifecycle (N per event — the isolation from CAST''s single-active panood_broadcasts). Service-role only (secret stream_key). lib/panood-roam.ts.';

-- ===========================================================================
-- 4. events.panood_roam_manifest — the PUBLIC picker manifest (mirror).
--    A jsonb array of non-secret zone entries [{zoneIndex,label,venueLabel,
--    videoId,featured,status}, …] the public event page renders into the ROAM
--    camera picker. Mirrored by the service role from zones + streams, exactly
--    as events.panood_watch_url mirrors the CAST watch URL. NEVER holds a
--    stream_key. Null → no ROAM picker (falls back to the CAST single embed).
-- ===========================================================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS panood_roam_manifest jsonb;

COMMENT ON COLUMN public.events.panood_roam_manifest IS
  'Live Studio ROAM public picker manifest (jsonb array of {zoneIndex,label,venueLabel,videoId,featured,status}). Mirror of the non-secret zone/stream fields; never a stream_key. Consumed by the event-page ROAM picker. lib/panood-roam.ts.';
