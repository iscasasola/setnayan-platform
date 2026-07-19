-- events partner birth data
-- ============================================================================
-- PR-G — opt-in, consent-gated, FLAG-GATED (default OFF) per-partner birth
-- DATE + TIME-OF-BIRTH capture for the Chinese-wedding BaZi (Four Pillars)
-- date-check, with RA 10173 export + deletion compliance. SHIPS DARK.
--
-- WHY these columns exist (purpose limitation, RA 10173):
--   BaZi date-checks need each partner's birth date and HOUR of birth. We store
--   them for exactly two reasons: (a) so the couple can hand them to a real
--   date specialist (the `date_fengshui_consultant` vendor leaf) and (b) to
--   derive a harmless zodiac/element label. The app NEVER computes a
--   compatibility/clash verdict (Chinese_Wedding_Traditions_Reference_2026-06-28
--   §2.3, locked). Birth TIME is sensitive personal data — it must NEVER render
--   on any public/guest surface (landing page, editorial, save-the-date); only
--   the couple-dashboard details surface reads it back.
--
-- CONSENT: bazi_birthdata_consent_at is stamped server-side at write time ONLY
--   when the couple ticks an explicit consent box AND the feature flag
--   NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED is on AND the event is a Chinese wedding.
--   A non-NULL value is the fresh-consent receipt for the captured fields.
--
-- RLS: NO new policy. These are plain columns on public.events, already covered
--   by the existing events policies — couple/host read via current_event_ids()
--   and write via couple_can_update_event (defined in the base schema). Column
--   grants follow the table; adding columns needs no policy change.
--
-- DARK SHIP: the migration only widens the schema. No code path writes or reads
--   these columns until the owner flips NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED on
--   (after DPO sign-off on the purpose notice + retention). Idempotent.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS partner_a_birth_date date,
  ADD COLUMN IF NOT EXISTS partner_a_birth_time time,
  ADD COLUMN IF NOT EXISTS partner_b_birth_date date,
  ADD COLUMN IF NOT EXISTS partner_b_birth_time time,
  ADD COLUMN IF NOT EXISTS bazi_birthdata_consent_at timestamptz;

COMMENT ON COLUMN public.events.partner_a_birth_date IS
  'RA 10173 purpose-limited sensitive data. Partner A birth date — captured opt-in (consent-gated, flag-gated) ONLY to hand to a date specialist for a BaZi/Four-Pillars reading. The app never computes a clash verdict. Excluded from every public/guest select.';
COMMENT ON COLUMN public.events.partner_a_birth_time IS
  'RA 10173 purpose-limited SENSITIVE data (hour of birth — the BaZi hour pillar). Opt-in, consent-gated, flag-gated. MUST NEVER render on any public/guest surface; couple-dashboard details surface only. Handed to a date specialist; the app never computes a clash verdict.';
COMMENT ON COLUMN public.events.partner_b_birth_date IS
  'RA 10173 purpose-limited sensitive data. Partner B birth date — captured opt-in (consent-gated, flag-gated) ONLY to hand to a date specialist for a BaZi/Four-Pillars reading. The app never computes a clash verdict. Excluded from every public/guest select.';
COMMENT ON COLUMN public.events.partner_b_birth_time IS
  'RA 10173 purpose-limited SENSITIVE data (hour of birth — the BaZi hour pillar). Opt-in, consent-gated, flag-gated. MUST NEVER render on any public/guest surface; couple-dashboard details surface only. Handed to a date specialist; the app never computes a clash verdict.';
COMMENT ON COLUMN public.events.bazi_birthdata_consent_at IS
  'RA 10173 fresh-consent receipt. Timestamp (server now()) of the couple''s explicit opt-in for capturing partner birth date/time for the BaZi date-check. NULL = no consent on file; non-NULL = consent recorded at this instant. Purged together with the birth fields on account hard-delete (right to erasure).';
