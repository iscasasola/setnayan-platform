-- Tayo V1 — Iteration 0000: App shell, multi-event account model (locked 2026-05-09)
--
-- Spec: docs/0000_app_shell_and_navigation/0000_app_shell_and_navigation.md
--
-- Adds:
--   1. events.is_primary, events.archived (with partial unique index)
--   2. users — Tayo identity table mirroring auth.users(id)
--   3. event_join_tokens — per-event QR for the /join/[event_id]?token=…  flow
--   4. event_members — account ↔ event link with member_type discriminator
--   5. Triggers:
--      - auto-create event_join_tokens + couple-side event_members on event INSERT
--      - auto-mirror auth.users → public.users (insert + update + delete)
--      - enforce "only one is_primary per couple_user_id_1" by demoting siblings
--
-- All operations are idempotent so the migration can re-run safely.
-- Existing RLS via is_couple_of() (0001) keeps working; event_members is
-- additive and used by the multi-event picker query, not (yet) by RLS.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. events — additive columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived   BOOLEAN NOT NULL DEFAULT FALSE;

-- One primary event per creator (couple_user_id_1). Partial unique index so
-- non-primary rows don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS events_one_primary_per_creator
  ON events (couple_user_id_1) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived) WHERE archived = TRUE;

COMMENT ON COLUMN events.is_primary IS
  'TRUE on the event the couple wants auto-jumped to on sign-in. Enforced unique per couple_user_id_1 via the partial index. Initial backfill picks the oldest event per creator.';
COMMENT ON COLUMN events.archived IS
  'TRUE when the couple has archived the event. Excluded from the auto-jump query and folded under "Archived" in the picker.';

-- Backfill is_primary = TRUE for each creator's oldest event, if they have
-- exactly zero primary events today. Idempotent: skips creators that
-- already have a primary set.
WITH ranked AS (
  SELECT event_id,
         couple_user_id_1,
         ROW_NUMBER() OVER (PARTITION BY couple_user_id_1 ORDER BY created_at ASC) AS rn,
         BOOL_OR(is_primary) OVER (PARTITION BY couple_user_id_1)                  AS any_primary
  FROM events
)
UPDATE events e
SET is_primary = TRUE
FROM ranked r
WHERE e.event_id = r.event_id
  AND r.rn = 1
  AND r.any_primary = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. users — Tayo identity, mirrored from auth.users(id)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  phone              TEXT,
  display_name       TEXT,
  profile_photo_url  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

COMMENT ON TABLE users IS 'Tayo identity, one row per auth.users. Mirrored via the trg_auth_users_to_public trigger so app code never needs to read auth.users directly.';

-- Backfill from auth.users for any existing rows. Idempotent.
INSERT INTO users (user_id, email, last_login_at)
SELECT id, email, last_sign_in_at
FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET
  email         = EXCLUDED.email,
  last_login_at = EXCLUDED.last_login_at;

-- Mirror trigger: keep public.users in sync with auth.users on insert/update.
CREATE OR REPLACE FUNCTION mirror_auth_user_to_public()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.users (user_id, email, last_login_at)
    VALUES (NEW.id, NEW.email, NEW.last_sign_in_at)
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      last_login_at = EXCLUDED.last_login_at;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.users
    SET email = NEW.email,
        last_login_at = NEW.last_sign_in_at
    WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_to_public_ins') THEN
    CREATE TRIGGER trg_auth_users_to_public_ins
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION mirror_auth_user_to_public();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_to_public_upd') THEN
    CREATE TRIGGER trg_auth_users_to_public_upd
      AFTER UPDATE OF email, last_sign_in_at ON auth.users
      FOR EACH ROW EXECUTE FUNCTION mirror_auth_user_to_public();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. event_join_tokens — per-event QR for /join/[event_id]?token=…
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_join_tokens (
  event_id    UUID         PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
  token       TEXT         NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  rotated_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

COMMENT ON TABLE event_join_tokens IS 'One token per event, rotatable from event settings. URL: /join/[event_id]?token=[token].';

-- Backfill one row per existing event.
INSERT INTO event_join_tokens (event_id, token)
SELECT event_id, encode(gen_random_bytes(16), 'hex')
FROM events
ON CONFLICT (event_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. event_members — account ↔ event link
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_members (
  member_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID         NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id      UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  member_type  TEXT         NOT NULL CHECK (member_type IN ('couple', 'guest', 'vendor')),
  role         TEXT,
  guest_id     UUID         REFERENCES guests(guest_id) ON DELETE SET NULL,
  joined_via   TEXT         CHECK (joined_via IS NULL OR joined_via IN ('qr_scan', 'invited', 'created_event')),
  joined_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id, member_type)
);

CREATE INDEX IF NOT EXISTS idx_event_members_user_active
  ON event_members(user_id, member_type)
  INCLUDE (event_id);
CREATE INDEX IF NOT EXISTS idx_event_members_event ON event_members(event_id, member_type);

COMMENT ON TABLE event_members IS 'How a Tayo account becomes a member of a specific event. Separate from guests (couple''s master list) — a Tayo account becomes an event member only when they sign in and link via the QR or are explicitly invited.';

-- Backfill couple memberships from the legacy events.couple_user_id_{1,2} columns.
INSERT INTO event_members (event_id, user_id, member_type, joined_via)
SELECT e.event_id, e.couple_user_id_1, 'couple', 'created_event'
FROM events e
WHERE e.couple_user_id_1 IS NOT NULL
ON CONFLICT (event_id, user_id, member_type) DO NOTHING;

INSERT INTO event_members (event_id, user_id, member_type, joined_via)
SELECT e.event_id, e.couple_user_id_2, 'couple', 'invited'
FROM events e
WHERE e.couple_user_id_2 IS NOT NULL
ON CONFLICT (event_id, user_id, member_type) DO NOTHING;

ALTER TABLE event_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_join_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;

-- users: row-owner can read+update their own profile; mirrors are server-side.
DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- event_members: a user can read their own memberships; couples of an event
-- can read all members of that event.
DROP POLICY IF EXISTS event_members_self_select ON event_members;
CREATE POLICY event_members_self_select ON event_members FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS event_members_couple_select ON event_members;
CREATE POLICY event_members_couple_select ON event_members FOR SELECT
  USING (is_couple_of(event_id));

-- event_join_tokens: couples of the event can read+update; everything else
-- (the public /join/ page) goes through the service_role-backed admin client.
DROP POLICY IF EXISTS event_join_tokens_couple_all ON event_join_tokens;
CREATE POLICY event_join_tokens_couple_all ON event_join_tokens FOR ALL
  USING (is_couple_of(event_id))
  WITH CHECK (is_couple_of(event_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. On-INSERT trigger: auto-provision token + couple memberships
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION provision_event_shell()
RETURNS TRIGGER AS $$
BEGIN
  -- Token row (one per event).
  INSERT INTO event_join_tokens (event_id, token)
  VALUES (NEW.event_id, encode(gen_random_bytes(16), 'hex'))
  ON CONFLICT (event_id) DO NOTHING;

  -- Couple-1 always exists (NOT NULL on the column).
  INSERT INTO event_members (event_id, user_id, member_type, joined_via)
  VALUES (NEW.event_id, NEW.couple_user_id_1, 'couple', 'created_event')
  ON CONFLICT (event_id, user_id, member_type) DO NOTHING;

  -- Couple-2 may be NULL.
  IF NEW.couple_user_id_2 IS NOT NULL THEN
    INSERT INTO event_members (event_id, user_id, member_type, joined_via)
    VALUES (NEW.event_id, NEW.couple_user_id_2, 'couple', 'invited')
    ON CONFLICT (event_id, user_id, member_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_provision_event_shell') THEN
    CREATE TRIGGER trg_provision_event_shell
      AFTER INSERT ON events
      FOR EACH ROW EXECUTE FUNCTION provision_event_shell();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. is_primary invariant — flipping a row to TRUE demotes its siblings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_one_primary_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary AND (TG_OP = 'INSERT' OR OLD.is_primary IS DISTINCT FROM TRUE) THEN
    UPDATE events
       SET is_primary = FALSE
     WHERE couple_user_id_1 = NEW.couple_user_id_1
       AND event_id <> NEW.event_id
       AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_one_primary_event') THEN
    CREATE TRIGGER trg_enforce_one_primary_event
      BEFORE INSERT OR UPDATE OF is_primary ON events
      FOR EACH ROW
      WHEN (NEW.is_primary = TRUE)
      EXECUTE FUNCTION enforce_one_primary_event();
  END IF;
END $$;
