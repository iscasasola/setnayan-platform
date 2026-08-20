-- ============================================================================
-- Self-profile FOOD — meal preference + dietary needs (owner 2026-08-21).
--
-- Owner: *"if they create an account to sync, these information will be saved
-- on their account automatically."*
--
-- A guest already answers these on every invitation they accept — meal choice
-- and "halal · nut allergy · …" — and today the answer dies with that one
-- event. Someone invited to four weddings types their allergy four times, and
-- gets it wrong once. These two columns are where the answer LIVES, so the
-- reply card can offer it back and a person tells us once.
--
-- Sits alongside the religion + civil_status carve-out (20270732591262) and
-- the self gender one (20270804097729), and copies their shape exactly:
-- optional, reference-only, never required, never shared, idempotent.
--
-- ⚠ DIETARY NEEDS ARE HEALTH DATA under RA 10173 — "nut allergy", "coeliac",
-- and religious restrictions are sensitive personal information, which is
-- precisely why `religion` next door carries its own consent timestamp. So the
-- free-text field gets one too: stamped when a value is first stored, cleared
-- when the person empties it. Meal preference is an ordinary preference from a
-- fixed list and carries no stamp.
--
-- 🔑 REUSES public.meal_preference — the SAME enum guests.meal_preference
-- already uses. A parallel list would drift the moment one side gained a
-- value, and the whole point is that one field can fill the other.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS meal_preference                public.meal_preference,
  ADD COLUMN IF NOT EXISTS dietary_restrictions           TEXT,
  ADD COLUMN IF NOT EXISTS dietary_restrictions_consent_at TIMESTAMPTZ;

DO $$
BEGIN
  -- Bound the free text. The guest-side column is unbounded, but this one is
  -- carried across every future event, so a runaway paste would follow the
  -- person around rather than sitting on one guest row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_dietary_restrictions_len_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_dietary_restrictions_len_check
      CHECK (dietary_restrictions IS NULL OR char_length(dietary_restrictions) <= 300);
  END IF;
END $$;

COMMENT ON COLUMN public.users.meal_preference IS
  'Optional self meal preference, reused as the default when this person RSVPs to any event. Same enum as guests.meal_preference so the two can fill each other. Reference-only; never shared beyond an event this person has joined.';
COMMENT ON COLUMN public.users.dietary_restrictions IS
  'Optional self dietary needs (free text, <=300 chars) — reused as the default when this person RSVPs. HEALTH DATA under RA 10173: consent timestamp in dietary_restrictions_consent_at, stamped on first value and cleared when emptied, exactly like religion_consent_at.';
COMMENT ON COLUMN public.users.dietary_restrictions_consent_at IS
  'RA 10173 per-field consent for the sensitive dietary_restrictions value. NULL = no value stored / consent withdrawn.';

COMMIT;
