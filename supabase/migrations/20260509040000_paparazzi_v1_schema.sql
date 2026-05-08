-- Tayo V1 — Iteration 0012: Paparazzi V1 schema (locked 2026-05-09)
--
-- Builds on 0001 (events, guests, wedding_tables) and 0002 (scan_events).
-- Spec: docs/0012_paparazzi/0012_paparazzi.md + 10_Tayo_Paparazzi_Feature_Specification.md.
--
-- Ships the data-layer foundation for V1 Paparazzi:
--   1. events  — additive paparazzi columns (tier, review window, public unlock, retention)
--   2. paparazzi_seats — claim-able seats (3 or 5 per event), one row per seat
--   3. captures — photos AND clips (type discriminator) uploaded by paparazzi
--   4. capture_tags — guest tagging fan-out, capped at 10 per capture
--   5. paparazzi_tag_intents — queued tag intents for offline replay (consumed on upload)
--   6. reel_templates + event_template_unlocks — template catalogue + per-event unlocks
--   7. personal_reels — guest-built personal reel renders
--   8. paparazzi_wallet_skus — service_key registrations later consumed by 0003 wallet
--
-- The native capture app (iOS/Android) is V1.5 per SPEC.md; this migration
-- exists so the webapp couple gallery, review window, and admin tooling can
-- be built now and the native app slots in cleanly when it lands.
--
-- All operations are idempotent (IF NOT EXISTS guards + DO blocks for constraints).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. events — additive Paparazzi columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS paparazzi_tier               INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gallery_review_window_days   INTEGER NOT NULL DEFAULT 7;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gallery_public_unlocked_at   TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hot_retention_days           INTEGER NOT NULL DEFAULT 90;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_monogram_unlocked     BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_paparazzi_tier_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_paparazzi_tier_check
      CHECK (paparazzi_tier IS NULL OR paparazzi_tier IN (3, 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_gallery_review_window_days_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_gallery_review_window_days_check
      CHECK (gallery_review_window_days BETWEEN 0 AND 14);
  END IF;
END $$;

COMMENT ON COLUMN events.paparazzi_tier IS
  'NULL until the couple buys 3 Paparazzi (₱1,500) or 5 Paparazzi (₱2,500). Determines how many paparazzi_seats rows exist for this event.';
COMMENT ON COLUMN events.gallery_review_window_days IS
  'Couple''s private review window between the event end and public-unlock to all guests. Default 7, configurable 0–14 per spec Part 3.1.';
COMMENT ON COLUMN events.gallery_public_unlocked_at IS
  'Timestamp the gallery flipped from couple-only to public. NULL = still in private review.';
COMMENT ON COLUMN events.hot_retention_days IS
  'How many days originals stay in R2 hot storage before tiering to cold archive. Default 90 per spec Part 4.5.';
COMMENT ON COLUMN events.custom_monogram_unlocked IS
  'Mirrors the 0011 Custom Monogram Pack flag. When TRUE, paparazzi exports/reels stamp the couple''s monogram instead of the Tayo logo. Owned by 0011 long-term; defaults FALSE here so 0012 can read it before 0011 lands.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. paparazzi_seats — one row per seat, claim-able via QR
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paparazzi_seats (
  seat_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  seat_index        INTEGER      NOT NULL,
  role_label        TEXT,
  claim_qr_token    TEXT         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  claimer_user_id   UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  claimer_label     TEXT,
  claimed_at        TIMESTAMPTZ,
  device_platform   TEXT         CHECK (device_platform IS NULL OR device_platform IN ('ios', 'android')),
  device_app_build  TEXT,
  last_seen_at      TIMESTAMPTZ,
  battery_pct_last  INTEGER      CHECK (battery_pct_last IS NULL OR battery_pct_last BETWEEN 0 AND 100),
  handed_off_to_seat_id UUID     REFERENCES paparazzi_seats(seat_id) ON DELETE SET NULL,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, seat_index)
);

CREATE INDEX IF NOT EXISTS idx_paparazzi_seats_event ON paparazzi_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_paparazzi_seats_claimer ON paparazzi_seats(claimer_user_id) WHERE claimer_user_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_paparazzi_seats_updated_at') THEN
    CREATE TRIGGER trg_paparazzi_seats_updated_at BEFORE UPDATE ON paparazzi_seats
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  paparazzi_seats IS 'Claim-able paparazzi seats. Created when a couple buys 3-Paparazzi or 5-Paparazzi via the wallet. The deep-link claim QR contains claim_qr_token; once claimed, the seat is bound to claimer_user_id for the event lifetime (or until handoff).';
COMMENT ON COLUMN paparazzi_seats.role_label IS 'Optional couple-set hint: "bride-side", "groom-side", "ninang", etc.';
COMMENT ON COLUMN paparazzi_seats.claim_qr_token IS 'Hex(16) token rendered into the seat-claim QR. Regenerated by admin if a paparazzo loses their phone before the event.';
COMMENT ON COLUMN paparazzi_seats.handed_off_to_seat_id IS 'Set when the original paparazzo battery-handed-off to a backup paparazzo at the event. Captures already uploaded stay attributed to this row; new captures land on the successor seat.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. captures — photos and clips uploaded by paparazzi (type-discriminated)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_type') THEN
    CREATE TYPE capture_type AS ENUM ('photo', 'clip');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_moderation_status') THEN
    CREATE TYPE capture_moderation_status AS ENUM ('pending', 'approved', 'flagged', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_orientation') THEN
    CREATE TYPE capture_orientation AS ENUM ('portrait', 'landscape');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS captures (
  capture_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  paparazzi_seat_id   UUID         NOT NULL REFERENCES paparazzi_seats(seat_id) ON DELETE RESTRICT,
  type                capture_type NOT NULL,
  duration_seconds    NUMERIC(4,2),
  flash_used          BOOLEAN      NOT NULL DEFAULT FALSE,
  orientation         capture_orientation NOT NULL DEFAULT 'portrait',
  client_capture_id   TEXT         NOT NULL,
  captured_at         TIMESTAMPTZ  NOT NULL,
  uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  r2_object_key       TEXT         NOT NULL,
  r2_thumbnail_key    TEXT,
  width_px            INTEGER,
  height_px           INTEGER,
  byte_size           BIGINT,
  moderation_status   capture_moderation_status NOT NULL DEFAULT 'pending',
  nsfw_score          NUMERIC(4,3),
  hidden_by_couple_at TIMESTAMPTZ,
  hidden_reason       TEXT,
  favorite_of_couple  BOOLEAN      NOT NULL DEFAULT FALSE,
  tags_count          INTEGER      NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT captures_clip_duration_check
    CHECK (
      (type = 'photo' AND duration_seconds IS NULL)
      OR
      (type = 'clip' AND duration_seconds IS NOT NULL AND duration_seconds = 5.00)
    ),
  CONSTRAINT captures_tags_count_cap_check CHECK (tags_count BETWEEN 0 AND 10),
  UNIQUE (paparazzi_seat_id, client_capture_id)
);

CREATE INDEX IF NOT EXISTS idx_captures_event_captured_at
  ON captures(event_id, captured_at DESC)
  WHERE hidden_by_couple_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_captures_event_type
  ON captures(event_id, type, captured_at DESC)
  WHERE hidden_by_couple_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_captures_event_untagged
  ON captures(event_id, captured_at DESC)
  WHERE tags_count = 0 AND hidden_by_couple_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_captures_event_moderation
  ON captures(event_id, moderation_status)
  WHERE moderation_status IN ('pending', 'flagged');
CREATE INDEX IF NOT EXISTS idx_captures_seat ON captures(paparazzi_seat_id, captured_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_captures_updated_at') THEN
    CREATE TRIGGER trg_captures_updated_at BEFORE UPDATE ON captures
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  captures IS 'Photos and 5-second clips uploaded by paparazzi. Sorted by captured_at (client-side timestamp) so out-of-order uploads from spotty venue WiFi still appear chronologically.';
COMMENT ON COLUMN captures.client_capture_id IS 'Client-side UUID written into the native app''s SQLite WAL at capture time. Idempotency key for upload retries — same (seat, client_capture_id) collapses to one row regardless of retry count.';
COMMENT ON COLUMN captures.captured_at IS 'Camera-clock timestamp from the device at the moment of capture. NEVER use uploaded_at for gallery sort — uploads can land hours late from offline queues.';
COMMENT ON COLUMN captures.duration_seconds IS 'Clips are exactly 5.00 seconds in V1; the CHECK constraint enforces it. Photos are NULL.';
COMMENT ON COLUMN captures.hidden_by_couple_at IS 'Set during the 7-day couple review window (or after public unlock). Hidden captures stay invisible to guests in the public gallery but remain accessible to the couple.';
COMMENT ON COLUMN captures.tags_count IS 'Denormalized counter, bumped by the capture_tags trigger. Capped at 10 (10-tag-per-photo rule).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. capture_tags — fan-out from QR or manual picker
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_tag_source') THEN
    CREATE TYPE capture_tag_source AS ENUM ('individual_qr', 'table_qr', 'manual_pick', 'auto_face_match');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS capture_tags (
  capture_id        UUID         NOT NULL REFERENCES captures(capture_id) ON DELETE CASCADE,
  guest_id          UUID         NOT NULL REFERENCES guests(guest_id) ON DELETE CASCADE,
  source            capture_tag_source NOT NULL,
  tagged_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  tagged_by_seat_id UUID         REFERENCES paparazzi_seats(seat_id) ON DELETE SET NULL,
  PRIMARY KEY (capture_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_capture_tags_guest ON capture_tags(guest_id, tagged_at DESC);

CREATE OR REPLACE FUNCTION bump_capture_tags_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE captures SET tags_count = tags_count + 1 WHERE capture_id = NEW.capture_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE captures SET tags_count = GREATEST(tags_count - 1, 0) WHERE capture_id = OLD.capture_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_capture_tags_count') THEN
    CREATE TRIGGER trg_capture_tags_count
      AFTER INSERT OR DELETE ON capture_tags
      FOR EACH ROW EXECUTE FUNCTION bump_capture_tags_count();
  END IF;
END $$;

COMMENT ON TABLE  capture_tags IS 'Guest fan-out for a capture. (capture_id, guest_id) is unique. The bump_capture_tags_count trigger keeps captures.tags_count in sync; cap of 10 is enforced by app code (the 10-tag truncation warning sheet) plus the captures.tags_count CHECK.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. paparazzi_tag_intents — queued offline tag intents (replayed at upload)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paparazzi_tag_intents (
  intent_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  paparazzi_seat_id   UUID         NOT NULL REFERENCES paparazzi_seats(seat_id) ON DELETE CASCADE,
  client_capture_id   TEXT         NOT NULL,
  guest_id            UUID         REFERENCES guests(guest_id) ON DELETE SET NULL,
  table_id            UUID         REFERENCES wedding_tables(table_id) ON DELETE SET NULL,
  source              capture_tag_source NOT NULL,
  intended_at         TIMESTAMPTZ  NOT NULL,
  applied_at          TIMESTAMPTZ,
  applied_capture_id  UUID         REFERENCES captures(capture_id) ON DELETE SET NULL,
  truncated           BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT paparazzi_tag_intents_target_check
    CHECK (
      (guest_id IS NOT NULL AND table_id IS NULL)
      OR
      (guest_id IS NULL AND table_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_paparazzi_tag_intents_unapplied
  ON paparazzi_tag_intents(paparazzi_seat_id, client_capture_id)
  WHERE applied_at IS NULL;

COMMENT ON TABLE  paparazzi_tag_intents IS 'Tag intents queued at capture time on the native app, sent in the upload payload. The server resolves table tags into per-guest fan-out (capped at 10), marks the intent applied_at, and sets truncated=true if the table-tag was clipped at the 10-cap.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. reel_templates + event_template_unlocks
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reel_feel_category') THEN
    CREATE TYPE reel_feel_category AS ENUM (
      'bridgerton_feel',
      'taylor_swift_feel',
      'mj_feel',
      'jazz',
      'sunday_morning',
      'hip_hop'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reel_templates (
  template_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT         NOT NULL UNIQUE,
  display_name       TEXT         NOT NULL,
  feel_category      reel_feel_category NOT NULL,
  manifest_json      JSONB        NOT NULL,
  preview_video_key  TEXT,
  paired_track_ids   UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],
  duration_min_s     INTEGER      NOT NULL DEFAULT 1,
  duration_max_s     INTEGER      NOT NULL DEFAULT 30,
  production_ready   BOOLEAN      NOT NULL DEFAULT FALSE,
  retired_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT reel_templates_duration_range_check
    CHECK (duration_min_s >= 1 AND duration_max_s <= 30 AND duration_min_s <= duration_max_s)
);

CREATE INDEX IF NOT EXISTS idx_reel_templates_live
  ON reel_templates(feel_category)
  WHERE production_ready = TRUE AND retired_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reel_templates_updated_at') THEN
    CREATE TRIGGER trg_reel_templates_updated_at BEFORE UPDATE ON reel_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  reel_templates IS 'Catalogue of Personal Reel templates. The 12-month rotation ritual (per 14_Tayo_Music_Catalogue_Cowork_Playbook) retires the bottom slice annually via retired_at; production_ready gates whether a template is currently selectable in the builder.';

CREATE TABLE IF NOT EXISTS event_template_unlocks (
  event_id          UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  template_id       UUID         NOT NULL REFERENCES reel_templates(template_id) ON DELETE RESTRICT,
  unlocked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  wallet_txn_id     UUID,
  PRIMARY KEY (event_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_event_template_unlocks_event ON event_template_unlocks(event_id);

COMMENT ON TABLE  event_template_unlocks IS 'Per-event ₱200 template purchases. wallet_txn_id is left as a soft FK because the wallet table lives in 0003 (token wallet); 0003 will add the FK once it exists.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. personal_reels — guest-built renders
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reel_render_status') THEN
    CREATE TYPE reel_render_status AS ENUM ('queued', 'rendering', 'ready', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS personal_reels (
  reel_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  guest_id             UUID         NOT NULL REFERENCES guests(guest_id) ON DELETE CASCADE,
  template_id          UUID         NOT NULL REFERENCES reel_templates(template_id) ON DELETE RESTRICT,
  selected_capture_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],
  couple_clip_ids      UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],
  duration_s           INTEGER      NOT NULL,
  music_track_id       UUID,
  monogram_applied     BOOLEAN      NOT NULL DEFAULT FALSE,
  status               reel_render_status NOT NULL DEFAULT 'queued',
  r2_output_key        TEXT,
  preview_thumb_key    TEXT,
  enqueued_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  rendering_started_at TIMESTAMPTZ,
  rendered_at          TIMESTAMPTZ,
  failure_reason       TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT personal_reels_duration_check CHECK (duration_s BETWEEN 1 AND 30),
  CONSTRAINT personal_reels_selection_size_check
    CHECK (cardinality(selected_capture_ids) BETWEEN 1 AND 5 AND cardinality(couple_clip_ids) BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_personal_reels_event ON personal_reels(event_id, rendered_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_reels_guest ON personal_reels(guest_id, rendered_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_reels_queue ON personal_reels(status, enqueued_at) WHERE status IN ('queued', 'rendering');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_personal_reels_updated_at') THEN
    CREATE TRIGGER trg_personal_reels_updated_at BEFORE UPDATE ON personal_reels
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  personal_reels IS 'Personal Reel renders created by guests. status walks queued → rendering → ready (or failed). monogram_applied snapshots the events.custom_monogram_unlocked flag at enqueue time so already-rendered reels don''t change branding mid-flight if the couple buys the pack later.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. paparazzi_wallet_skus — service-key registrations consumed by 0003
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paparazzi_wallet_skus (
  service_key          TEXT         PRIMARY KEY,
  display_name_en      TEXT         NOT NULL,
  php_price_centavos   BIGINT       NOT NULL,
  token_display        BIGINT       NOT NULL,
  ref_type             TEXT         NOT NULL,
  one_time_per_event   BOOLEAN      NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO paparazzi_wallet_skus (service_key, display_name_en, php_price_centavos, token_display, ref_type, one_time_per_event)
VALUES
  ('paparazzi_3_seat',  '3 Paparazzi',         150000, 45000, 'event_id',               TRUE),
  ('paparazzi_5_seat',  '5 Paparazzi',         250000, 75000, 'event_id',               TRUE),
  ('paparazzi_template','Personal Reel template', 20000,  6000, '(event_id, template_id)', FALSE)
ON CONFLICT (service_key) DO UPDATE SET
  display_name_en    = EXCLUDED.display_name_en,
  php_price_centavos = EXCLUDED.php_price_centavos,
  token_display      = EXCLUDED.token_display,
  ref_type           = EXCLUDED.ref_type,
  one_time_per_event = EXCLUDED.one_time_per_event;

COMMENT ON TABLE  paparazzi_wallet_skus IS 'Pre-registration of the three Paparazzi service_keys consumed by 0003 token wallet. 0003 will read this table and import the rows into its master service catalogue. Prices are clean × 30 token math per the 2026-05-08 alignment.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE paparazzi_seats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures               ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE paparazzi_tag_intents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_template_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE paparazzi_wallet_skus  ENABLE ROW LEVEL SECURITY;

-- paparazzi_seats — couples manage their own; the seat-claimer can read their own row.
DROP POLICY IF EXISTS paparazzi_seats_couple_all ON paparazzi_seats;
CREATE POLICY paparazzi_seats_couple_all ON paparazzi_seats FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

DROP POLICY IF EXISTS paparazzi_seats_claimer_select ON paparazzi_seats;
CREATE POLICY paparazzi_seats_claimer_select ON paparazzi_seats FOR SELECT
  USING (claimer_user_id = auth.uid());

-- captures — couples manage their own; capture inserts come from server (service_role).
DROP POLICY IF EXISTS captures_couple_all ON captures;
CREATE POLICY captures_couple_all ON captures FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- capture_tags — derived through captures; couples can read/write tags for their own event.
DROP POLICY IF EXISTS capture_tags_couple_all ON capture_tags;
CREATE POLICY capture_tags_couple_all ON capture_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM captures c WHERE c.capture_id = capture_tags.capture_id AND is_couple_of(c.event_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM captures c WHERE c.capture_id = capture_tags.capture_id AND is_couple_of(c.event_id))
  );

-- paparazzi_tag_intents — couple read-only (for support / debugging); writes go through service_role.
DROP POLICY IF EXISTS paparazzi_tag_intents_couple_select ON paparazzi_tag_intents;
CREATE POLICY paparazzi_tag_intents_couple_select ON paparazzi_tag_intents FOR SELECT
  USING (is_couple_of(event_id));

-- reel_templates — readable by any authenticated user (couples and guests browse the catalogue).
DROP POLICY IF EXISTS reel_templates_authenticated_select ON reel_templates;
CREATE POLICY reel_templates_authenticated_select ON reel_templates FOR SELECT
  TO authenticated
  USING (production_ready = TRUE AND retired_at IS NULL);

-- event_template_unlocks — couples see their own.
DROP POLICY IF EXISTS event_template_unlocks_couple_all ON event_template_unlocks;
CREATE POLICY event_template_unlocks_couple_all ON event_template_unlocks FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- personal_reels — couples see all their event's reels; the originating guest is auth'd via guest session, server-mediated.
DROP POLICY IF EXISTS personal_reels_couple_select ON personal_reels;
CREATE POLICY personal_reels_couple_select ON personal_reels FOR SELECT
  USING (is_couple_of(event_id));

-- paparazzi_wallet_skus — readable by any authenticated user (checkout reads price/token display).
DROP POLICY IF EXISTS paparazzi_wallet_skus_authenticated_select ON paparazzi_wallet_skus;
CREATE POLICY paparazzi_wallet_skus_authenticated_select ON paparazzi_wallet_skus FOR SELECT
  TO authenticated
  USING (TRUE);
