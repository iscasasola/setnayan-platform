-- ============================================================================
-- 20260513050000_iteration_0002_invitation.sql
-- Iteration 0002 — QR Invitation System (web-side foundation).
--
-- Adds:
--   - events.slug (3–32 chars, unique, lowercase/hyphen)
--   - events.palette_finalized_at (gates QR auto-derive — placeholder for 0010)
--   - guests.profile_photo_url + profile_photo_set_at + profile_photo_segment
--     (auto-set logic ships with native Papic; column NULL = empty state)
--   - guests.plus_one_name_confirmed_at (+1 TBA onboarding marker)
--   - guests.scan_tracking_opt_out (RA 10173 per-guest opt-out)
--   - guests.download_completed_at (post-download conversion screen trigger)
--   - scan_events table (one row per QR scan across all surfaces)
--   - slug_change_log (90-day SEO redirect window for slug rotations)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. events.slug + slug_change_log
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS palette_finalized_at TIMESTAMPTZ;

-- The unique index needs to be case-insensitive. Use a lower() expression
-- index because Postgres CHECK constraints can't reference functions; the
-- format check fires at row-write time.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_slug_format;

ALTER TABLE public.events
  ADD CONSTRAINT events_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{3,32}$');

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_lower_idx
  ON public.events (LOWER(slug)) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.slug_change_log (
  id              BIGSERIAL PRIMARY KEY,
  change_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('event', 'vendor')),
  entity_id       UUID NOT NULL,
  old_slug        TEXT NOT NULL,
  new_slug        TEXT NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by      UUID REFERENCES auth.users(id),
  redirect_until  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

-- Can't use NOW() in a partial-index predicate (not IMMUTABLE). Application
-- queries this table by old_slug + filter redirect_until > NOW() at runtime.
CREATE INDEX IF NOT EXISTS idx_slug_change_old
  ON public.slug_change_log (LOWER(old_slug));

ALTER TABLE public.slug_change_log ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. guests — new columns for invitation system
-- ----------------------------------------------------------------------------

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_photo_segment TEXT
    CHECK (profile_photo_segment IS NULL OR profile_photo_segment IN ('pre_event', 'ceremony', 'cocktails', 'reception', 'after_party', 'manual')),
  ADD COLUMN IF NOT EXISTS plus_one_name_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scan_tracking_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS download_completed_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 3. scan_events — one row per QR scan, regardless of surface
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.scan_source AS ENUM (
    'browser',
    'setnayan_native',
    'setnayan_din',
    'coordinator'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.scan_events (
  id              BIGSERIAL PRIMARY KEY,
  scan_id         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          public.scan_source NOT NULL,
  scanner_user_id UUID REFERENCES auth.users(id),   -- who did the scan; NULL for browser
  context         JSONB,
  user_agent      TEXT,
  ip_anon         TEXT  -- first 3 octets only per RA 10173
);

CREATE INDEX IF NOT EXISTS idx_scan_events_guest
  ON public.scan_events(guest_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_event
  ON public.scan_events(event_id, source, scanned_at DESC);

ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. RLS — couple sees all their events' scan_events; guests see only their own
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS couple_reads_scan_events ON public.scan_events;
CREATE POLICY couple_reads_scan_events ON public.scan_events
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS guest_reads_own_scans ON public.scan_events;
CREATE POLICY guest_reads_own_scans ON public.scan_events
  FOR SELECT TO authenticated
  USING (
    guest_id IN (SELECT public.current_user_guest_ids())
    OR public.is_admin()
  );

-- Scan events are written via the service role (server actions / edge functions)
-- since unauthenticated browser scans don't have a JWT. No INSERT policy for
-- authenticated; admin client handles all writes.

DROP POLICY IF EXISTS admin_writes_scan_events ON public.scan_events;
CREATE POLICY admin_writes_scan_events ON public.scan_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- slug_change_log is admin-only on read; service role writes it on slug change.
DROP POLICY IF EXISTS admin_reads_slug_log ON public.slug_change_log;
CREATE POLICY admin_reads_slug_log ON public.slug_change_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;
