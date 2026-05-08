-- Tayo V1 — Initial guest-list schema (work order 0001)
-- Tables: events (minimal), wedding_tables, households, guests
-- All RLS-protected. Couples access only their own events.
-- Role taxonomy matches Filipino-Catholic wedding structural roles.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE wedding_side       AS ENUM ('bride', 'groom', 'both');
CREATE TYPE group_category     AS ENUM ('family', 'friends', 'work', 'school', 'officiant', 'other');
CREATE TYPE rsvp_status        AS ENUM ('pending', 'attending', 'declined', 'maybe');
CREATE TYPE meal_preference    AS ENUM ('beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids', 'no_preference');
CREATE TYPE ceremony_type      AS ENUM ('catholic', 'civil', 'other');
CREATE TYPE event_status       AS ENUM ('planning', 'ceremony_done', 'archived');
CREATE TYPE event_tier         AS ENUM ('essentials', 'premium', 'pro_event');

CREATE TYPE wedding_role AS ENUM (
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger function (shared)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- events (minimal — fuller schema in SPEC.md §4.1, expanded as features land)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE events (
  event_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT         NOT NULL,
  couple_user_id_1      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_user_id_2      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  bride_first_name      TEXT         NOT NULL,
  bride_last_name       TEXT         NOT NULL,
  groom_first_name      TEXT         NOT NULL,
  groom_last_name       TEXT         NOT NULL,
  event_date            DATE         NOT NULL,
  ceremony_type         ceremony_type NOT NULL DEFAULT 'catholic',
  ceremony_venue        TEXT,
  reception_venue       TEXT,
  guest_count_estimate  INTEGER,
  status                event_status NOT NULL DEFAULT 'planning',
  tier                  event_tier   NOT NULL DEFAULT 'essentials',
  monogram_svg          TEXT,
  rsvp_deadline         DATE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX events_slug_lower_idx ON events (LOWER(slug));
CREATE INDEX idx_events_couple_1 ON events(couple_user_id_1);
CREATE INDEX idx_events_couple_2 ON events(couple_user_id_2);

CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- wedding_tables (PG reserves "tables"; minimal — full seating chart later)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE wedding_tables (
  table_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  table_name   TEXT        NOT NULL,
  capacity     INTEGER     NOT NULL DEFAULT 8,
  position_x   INTEGER,
  position_y   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wedding_tables_event ON wedding_tables(event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- households
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE households (
  household_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  address       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_households_event ON households(event_id);

CREATE TRIGGER trg_households_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- guests (full per work order 0001 §Data model)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE guests (
  guest_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  household_id          UUID        REFERENCES households(household_id) ON DELETE SET NULL,
  pair_with_guest_id    UUID        REFERENCES guests(guest_id) ON DELETE SET NULL,
  first_name            TEXT        NOT NULL,
  last_name             TEXT        NOT NULL,
  display_name          TEXT,
  side                  wedding_side    NOT NULL,
  group_category        group_category  NOT NULL,
  role                  wedding_role    NOT NULL DEFAULT 'guest',
  plus_one_allowed      BOOLEAN     NOT NULL DEFAULT FALSE,
  plus_one_name         TEXT,
  email                 TEXT,
  mobile                TEXT,
  address               JSONB,
  meal_preference       meal_preference,
  dietary_restrictions  TEXT,
  photo_consent         BOOLEAN     NOT NULL DEFAULT TRUE,
  table_assignment_id   UUID        REFERENCES wedding_tables(table_id) ON DELETE SET NULL,
  invited_to_blocks     TEXT[]      NOT NULL DEFAULT ARRAY['ceremony', 'reception']::TEXT[],
  custom_tags           TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  rsvp_status           rsvp_status NOT NULL DEFAULT 'pending',
  rsvp_responded_at     TIMESTAMPTZ,
  invitation_sent_at    TIMESTAMPTZ,
  notes                 TEXT,
  qr_token              TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_guests_event ON guests(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_guests_event_rsvp ON guests(event_id, rsvp_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_guests_household ON guests(household_id);

CREATE TRIGGER trg_guests_updated_at BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — couple-of-event access pattern.
-- Helper function avoids RLS recursion on the events table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_couple_of(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE event_id = p_event_id
      AND (auth.uid() = couple_user_id_1 OR auth.uid() = couple_user_id_2)
  );
$$;

ALTER TABLE events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_tables   ENABLE ROW LEVEL SECURITY;
ALTER TABLE households       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests           ENABLE ROW LEVEL SECURITY;

-- events
CREATE POLICY events_couple_select ON events FOR SELECT
  USING (auth.uid() = couple_user_id_1 OR auth.uid() = couple_user_id_2);
CREATE POLICY events_couple_insert ON events FOR INSERT
  WITH CHECK (auth.uid() = couple_user_id_1);
CREATE POLICY events_couple_update ON events FOR UPDATE
  USING (auth.uid() = couple_user_id_1 OR auth.uid() = couple_user_id_2)
  WITH CHECK (auth.uid() = couple_user_id_1 OR auth.uid() = couple_user_id_2);
CREATE POLICY events_couple_delete ON events FOR DELETE
  USING (auth.uid() = couple_user_id_1);

-- households (full CRUD for couples of the event)
CREATE POLICY households_couple_all ON households FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- wedding_tables (full CRUD for couples of the event)
CREATE POLICY wedding_tables_couple_all ON wedding_tables FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- guests (full CRUD for couples of the event)
CREATE POLICY guests_couple_all ON guests FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments (documentation)
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE  guests IS 'Couple-managed guest list. RLS: only the couple of the event can see/write. Soft-deleted via deleted_at.';
COMMENT ON COLUMN guests.qr_token IS 'Per-guest QR token used by Tayo Paparazzi (spec 10) for tag-on-scan. Format: hex(16 bytes).';
COMMENT ON COLUMN guests.invited_to_blocks IS 'Schedule blocks the guest is invited to. Default: ceremony + reception. Other valid: cocktails, after_party, rehearsal_dinner.';
COMMENT ON COLUMN guests.photo_consent IS 'PH Data Privacy Act compliance. FALSE means face-blur in the gallery (Paparazzi spec).';
COMMENT ON COLUMN guests.pair_with_guest_id IS 'Symmetric pair (e.g., Tito Boy & Tita Cora as one principal-sponsor entry). Two guests share one display row.';
