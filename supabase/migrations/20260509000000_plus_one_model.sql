-- Tayo V1 — Iteration 0001 plus-one model upgrade (locked 2026-05-09)
--
-- Promotes plus-ones from a string column on the primary guest's row to a
-- first-class `guests` row with its own qr_token. Two new columns:
--
--   - plus_one_of_guest_id : when set, THIS row is itself a +1, invited under
--                             the referenced primary. NULL on primary rows.
--   - plus_one_mode        : 'full' = +1 gets full Tayo guest experience
--                             (Shutter, Selfie Camera, Challenges, reels);
--                             'limited' = +1 can be tagged + RSVP only;
--                             tagged photos auto-route into the primary
--                             inviter's gallery. NULL on primary rows.
--
-- The legacy `plus_one_allowed` boolean and `plus_one_name` text columns stay
-- as-is — `plus_one_allowed` remains the per-guest opt-in flag (now strictly
-- couple-driven, default FALSE), and `plus_one_name` remains a UI hint /
-- placeholder label on the primary's row before the canonical +1 is created.

ALTER TABLE guests
  ADD COLUMN plus_one_of_guest_id UUID REFERENCES guests(guest_id) ON DELETE SET NULL;

ALTER TABLE guests
  ADD COLUMN plus_one_mode TEXT
  CHECK (plus_one_mode IS NULL OR plus_one_mode IN ('full', 'limited'));

-- Constraint: a +1 row (plus_one_of_guest_id set) must have a plus_one_mode;
-- conversely, a primary row (no plus_one_of_guest_id) must not have a mode.
ALTER TABLE guests
  ADD CONSTRAINT guests_plus_one_mode_consistency
  CHECK (
    (plus_one_of_guest_id IS NULL AND plus_one_mode IS NULL)
    OR
    (plus_one_of_guest_id IS NOT NULL AND plus_one_mode IS NOT NULL)
  );

-- Index for the reverse lookup ("show me this primary's +1").
CREATE INDEX idx_guests_plus_one_of
  ON guests(plus_one_of_guest_id)
  WHERE plus_one_of_guest_id IS NOT NULL;

COMMENT ON COLUMN guests.plus_one_of_guest_id IS
  'When set, THIS row is itself a +1, invited under the referenced primary guest. NULL on primary rows. The primary keeps plus_one_allowed = TRUE (opt-in flag) and optionally plus_one_name (UI hint), but the canonical +1 is a separate guests row with its own qr_token, RSVP, meal preference, and (for full mode) full Tayo guest experience.';

COMMENT ON COLUMN guests.plus_one_mode IS
  '''full'' = +1 has the full Tayo guest experience (Shutter / Selfie Camera / Photo Challenges / reel builder). ''limited'' = +1 can be tagged in photos and RSVP only; tagged photos auto-route into the primary inviter''s gallery. NULL on primary rows.';
