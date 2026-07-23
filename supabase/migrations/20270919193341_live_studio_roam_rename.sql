-- live_studio_roam_rename — rename the Live Studio ROAM foundation off the legacy
-- `panood_*` namespace onto `live_studio_roam_*`. The product is "Live Studio",
-- with two variants: Live Studio CAST + Live Studio ROAM (owner 2026-07-23).
--
-- The panood_roam_* tables (migration 20270918111955) are EMPTY + flag-dark
-- (NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED off, nothing reads them), so a clean
-- DROP + CREATE is safe and yields pristine, panood-free object names (indexes,
-- policies, constraints included) — cleaner than a partial ALTER…RENAME.
--
-- SCOPE: this renames ROAM only. The legacy Live Studio CAST tables
-- (panood_broadcasts, panood_camera_operators, panood_screens, …) KEEP their
-- internal names — renaming a live, selling product's schema + SKU key is a
-- separate, larger effort, deliberately out of scope here.
--
-- KEEP IDEMPOTENT: DROP … IF EXISTS · CREATE … IF NOT EXISTS · ADD COLUMN IF NOT
-- EXISTS · DROP POLICY IF EXISTS ; CREATE POLICY.

-- ============================================================================
-- 0. Drop the legacy-named foundation (empty + flag-dark). CASCADE clears the
--    internal FKs (streams → zones / channel_pool). The events column goes too.
-- ============================================================================
DROP TABLE IF EXISTS public.panood_roam_streams CASCADE;
DROP TABLE IF EXISTS public.panood_roam_zones CASCADE;
DROP TABLE IF EXISTS public.panood_roam_channel_pool CASCADE;
ALTER TABLE public.events DROP COLUMN IF EXISTS panood_roam_manifest;

-- ============================================================================
-- 1. live_studio_roam_zones — the "places" a guest can visit (control-plane).
--    Couple-managed; control-room RLS (couple + coordinator + admin, NOT guests).
--    Public picker reads the mirrored events.live_studio_roam_manifest, not this.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_roam_zones (
  id                 bigserial PRIMARY KEY,
  event_id           uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  zone_index         int NOT NULL,          -- dense 1..N per event; picker order
  label              text NOT NULL,         -- "Ceremony", "Reception Floor", "Photo Booth"
  venue_label        text,                  -- optional multi-venue grouping
  camera_operator_id bigint REFERENCES public.panood_camera_operators(id) ON DELETE SET NULL,
                                            -- which camera "seat" (legacy Cast table) feeds this zone
  is_featured        boolean NOT NULL DEFAULT false,
  sort_order         int NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned','live','offline','disabled')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, zone_index)
);

ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS event_id           uuid;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS zone_index         int;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS label              text;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS venue_label        text;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS camera_operator_id bigint;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS is_featured        boolean NOT NULL DEFAULT false;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS sort_order         int NOT NULL DEFAULT 0;
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'planned';
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_roam_zones ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS live_studio_roam_zones_event_idx ON public.live_studio_roam_zones (event_id);

ALTER TABLE public.live_studio_roam_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_studio_roam_zones_couple_full ON public.live_studio_roam_zones;
CREATE POLICY live_studio_roam_zones_couple_full ON public.live_studio_roam_zones
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_roam_zones.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = live_studio_roam_zones.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

COMMENT ON TABLE public.live_studio_roam_zones IS
  'Live Studio ROAM: the "places" a guest can visit (one per camera/zone/venue). Control-room RLS (couple + coordinator, NOT guests); public picker reads the mirrored events.live_studio_roam_manifest. lib/live-studio-roam.ts.';

-- ============================================================================
-- 2. live_studio_roam_channel_pool — Setnayan-owned YouTube channel inventory.
--    One channel checked out per event, recycled. Admin-only RLS.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_roam_channel_pool (
  id                   bigserial PRIMARY KEY,
  youtube_channel_id   text NOT NULL,
  label                text,
  status               text NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available','checked_out','maintenance','retired')),
  checked_out_event_id uuid REFERENCES public.events(event_id) ON DELETE SET NULL,
  checked_out_at       timestamptz,
  verified             boolean NOT NULL DEFAULT false,
  concurrent_cap       int NOT NULL DEFAULT 4,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (youtube_channel_id)
);

ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS youtube_channel_id   text;
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS label                text;
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS status               text NOT NULL DEFAULT 'available';
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS checked_out_event_id uuid;
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS checked_out_at       timestamptz;
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS verified             boolean NOT NULL DEFAULT false;
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS concurrent_cap       int NOT NULL DEFAULT 4;
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS created_at           timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_roam_channel_pool ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS live_studio_roam_channel_pool_one_per_event
  ON public.live_studio_roam_channel_pool (checked_out_event_id)
  WHERE status = 'checked_out' AND checked_out_event_id IS NOT NULL;

ALTER TABLE public.live_studio_roam_channel_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_studio_roam_channel_pool_admin_full ON public.live_studio_roam_channel_pool;
CREATE POLICY live_studio_roam_channel_pool_admin_full ON public.live_studio_roam_channel_pool
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.live_studio_roam_channel_pool IS
  'Live Studio ROAM: Setnayan-owned YouTube channel pool (one channel checked out per event, recycled). Admin-only RLS. Scales concurrent weddings + isolates copyright-strike blast radius. lib/live-studio-roam-provision.ts.';

-- ============================================================================
-- 3. live_studio_roam_streams — per-zone YouTube broadcasts (N per event — the
--    isolation from CAST's single-active panood_broadcasts). Holds the SECRET
--    stream_key → service-role only (RLS on, NO policy).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_roam_streams (
  id              bigserial PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  zone_id         bigint REFERENCES public.live_studio_roam_zones(id) ON DELETE SET NULL,
  channel_pool_id bigint REFERENCES public.live_studio_roam_channel_pool(id) ON DELETE SET NULL,
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

ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS event_id        uuid;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS zone_id         bigint;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS channel_pool_id bigint;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS broadcast_id    text;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS stream_id       text;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS stream_key      text;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS ingestion_url   text;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'ready';
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS went_live_at    timestamptz;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS ended_at        timestamptz;
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_roam_streams ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS live_studio_roam_streams_event_idx ON public.live_studio_roam_streams (event_id);
CREATE INDEX IF NOT EXISTS live_studio_roam_streams_zone_idx  ON public.live_studio_roam_streams (zone_id);

CREATE UNIQUE INDEX IF NOT EXISTS live_studio_roam_streams_one_active_per_zone
  ON public.live_studio_roam_streams (zone_id)
  WHERE status NOT IN ('complete','errored') AND zone_id IS NOT NULL;

ALTER TABLE public.live_studio_roam_streams ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: carries the secret stream_key (service-role only), same
-- posture as panood_broadcasts. The public picker only ever sees mirrored videoIds.

COMMENT ON TABLE public.live_studio_roam_streams IS
  'Live Studio ROAM: per-zone YouTube broadcast lifecycle (N per event — the isolation from CAST''s single-active panood_broadcasts). Service-role only (secret stream_key). lib/live-studio-roam-provision.ts.';

-- ============================================================================
-- 4. events.live_studio_roam_manifest — the PUBLIC picker manifest (mirror).
-- ============================================================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS live_studio_roam_manifest jsonb;

COMMENT ON COLUMN public.events.live_studio_roam_manifest IS
  'Live Studio ROAM public picker manifest (jsonb array of {zoneIndex,label,venueLabel,videoId,featured,status}). Mirror of the non-secret zone/stream fields; never a stream_key. Consumed by the event-page ROAM picker. lib/live-studio-roam.ts.';
