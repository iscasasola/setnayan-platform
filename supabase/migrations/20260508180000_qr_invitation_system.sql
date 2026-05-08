-- Tayo V1 — Iteration 0002: Guest QR Code System & Personal Invitation Site
-- Builds on 0001_creating_guest_list. Adds:
--   - scan_events table (every QR scan, regardless of surface)
--   - guests.profile_photo_*, first_rule_*, download_completed_at, scan_tracking_opt_out
--   - guest_rsvp_extras (registered-guest-only RSVP fields)
--   - events.photos_released_at (deferred-iteration trigger flag for photo cloud delivery)
-- All changes are additive; 0001 functionality is untouched.

-- ─────────────────────────────────────────────────────────────────────────────
-- scan_events — unified scan log across surfaces (browser, tayo_native, tayo_din, coordinator)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE scan_events (
  scan_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  guest_id          UUID         NOT NULL REFERENCES guests(guest_id) ON DELETE CASCADE,
  scanned_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  source            TEXT         NOT NULL CHECK (source IN ('browser', 'tayo_native', 'tayo_din', 'coordinator')),
  scanner_user_id   UUID         REFERENCES auth.users(id),
  context           JSONB,
  user_agent        TEXT,
  ip_anon           TEXT
);

CREATE INDEX idx_scan_events_guest ON scan_events(guest_id, scanned_at DESC);
CREATE INDEX idx_scan_events_event ON scan_events(event_id, source, scanned_at DESC);

ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

-- Couples can read all scan events for their own event
CREATE POLICY scan_events_couple_select ON scan_events FOR SELECT
  USING (is_couple_of(event_id));

-- Inserts go through server actions running as service_role (bypassing RLS).
-- We expose no client-side INSERT policy on purpose — guests aren't in auth.users
-- and we don't want to grant anon insert.

COMMENT ON TABLE scan_events IS 'Unified QR-scan log across browser / Tayo native / Tayo Din / Coordinator. Inserted server-side via service_role.';
COMMENT ON COLUMN scan_events.context IS 'Surface-specific metadata. e.g., {photo_id, segment} for tayo_native; {service_line_id} for tayo_din; {first_rule:true, photo_id} for arrival capture.';
COMMENT ON COLUMN scan_events.ip_anon IS 'First 3 octets only, per RA 10173 (PH Data Privacy Act).';

-- ─────────────────────────────────────────────────────────────────────────────
-- guests — additive columns for profile photo, first-rule, post-download, opt-out
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE guests ADD COLUMN profile_photo_url       TEXT;
ALTER TABLE guests ADD COLUMN profile_photo_set_at    TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN profile_photo_segment   TEXT
  CHECK (profile_photo_segment IS NULL OR profile_photo_segment IN ('arrival','ceremony','cocktails','reception','manual'));

-- First-rule of event-day scan: every guest gets a portrait photographed at first
-- event-day scan before any tagging proceeds. Native-app implementation lands in
-- Phase 2; columns exist now so the schema is compatible.
ALTER TABLE guests ADD COLUMN first_rule_completed_at      TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN first_rule_captured_by_user_id UUID REFERENCES auth.users(id);

-- Post-download conversion flow: tracks whether the public guest has already
-- pulled their tagged-photo zip. Suppresses the moment-of-truth screen on
-- subsequent visits unless they download again.
ALTER TABLE guests ADD COLUMN download_completed_at    TIMESTAMPTZ;

-- PH-DPA opt-out for scan-event tracking
ALTER TABLE guests ADD COLUMN scan_tracking_opt_out    BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN guests.profile_photo_url IS 'Auto-set from first paparazzi capture during ceremony/cocktails (Phase 2). NULL = empty-state placeholder on the personal site.';
COMMENT ON COLUMN guests.first_rule_completed_at IS 'Set when the event-day first-rule portrait is captured. Drives the "Awaiting arrival" -> "Arrived 2:48 PM" coverage label.';

-- ─────────────────────────────────────────────────────────────────────────────
-- guest_rsvp_extras — registered-guest-only RSVP fields
-- Locked decision 2026-05-08: the core RSVP form does not require a Tayo account
-- (going / maybe / declined, plus_one, meal, dietary, optional note). Registered
-- guests see additional fields below the core form.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE guest_rsvp_extras (
  guest_id                  UUID         PRIMARY KEY REFERENCES guests(guest_id) ON DELETE CASCADE,
  event_id                  UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  song_request              TEXT,
  dance_style               TEXT         CHECK (dance_style IS NULL OR dance_style IN ('slow', 'line_dancing', 'hip_hop', 'no_preference')),
  photo_challenges_opt_in   BOOLEAN      NOT NULL DEFAULT TRUE,
  freeform_note             TEXT,
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guest_rsvp_extras_event ON guest_rsvp_extras(event_id);

CREATE TRIGGER trg_guest_rsvp_extras_updated_at BEFORE UPDATE ON guest_rsvp_extras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE guest_rsvp_extras ENABLE ROW LEVEL SECURITY;

-- Couples can read/write extras for their event
CREATE POLICY guest_rsvp_extras_couple_all ON guest_rsvp_extras FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- events — photo-release flag (consumed by the deferred 0005 cloud-delivery iteration)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events ADD COLUMN photos_released_at TIMESTAMPTZ;
COMMENT ON COLUMN events.photos_released_at IS 'Trigger flag for the 0005 photo-cloud-delivery job. NULL = photos still in review window. Set when the couple flips "Release to Drive".';
