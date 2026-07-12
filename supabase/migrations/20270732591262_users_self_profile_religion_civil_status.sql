-- ============================================================================
-- 20270732591262_users_self_profile_religion_civil_status.sql
--
-- Optional self-profile personalization fields (date-anchor model · Phase 1).
-- Owner 2026-07-12: religion + civil status are REFERENCE-ONLY, never required,
-- opt-in. Both are SENSITIVE personal information (RA 10173 §3(l): religious
-- affiliation; marital status) — so each carries its own durable proof-of-
-- consent timestamp (`*_consent_at`), stamped when a value is first stored and
-- cleared on withdrawal, mirroring the existing `marketing_consent_at` pattern.
--
-- (birth_date already exists on users — added by the Social Sharing Program
-- migration 20261203000000 — so it is NOT re-added here.)
--
-- RLS: users already has its Pattern-A policies (self read/write + admin); new
-- columns inherit them. Idempotent (ADD COLUMN IF NOT EXISTS + guarded CHECK).
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS religion                TEXT,
  ADD COLUMN IF NOT EXISTS religion_consent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS civil_status            TEXT,
  ADD COLUMN IF NOT EXISTS civil_status_consent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_religion_check') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_religion_check CHECK (
        religion IS NULL OR religion IN ('catholic', 'muslim', 'inc', 'christian', 'other')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_civil_status_check') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_civil_status_check CHECK (
        civil_status IS NULL OR civil_status IN (
          'single', 'in_a_relationship', 'engaged', 'married', 'widowed', 'separated'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.users.religion IS
  'OPTIONAL, REFERENCE-ONLY, sensitive PI (RA 10173 §3(l)). The person''s faith — tailors wedding ceremony pre-select + faith rite suggestions. Never required, never used to verify/gate/share. Consent proof in religion_consent_at.';
COMMENT ON COLUMN public.users.civil_status IS
  'OPTIONAL, REFERENCE-ONLY, sensitive PI (RA 10173 §3(l) marital status). Tailors Wedding relevance + the union-anchor stage. Never required. Consent proof in civil_status_consent_at.';
COMMENT ON COLUMN public.users.religion_consent_at IS
  'Durable proof-of-consent: stamped when religion is first set, cleared on withdrawal (mirrors marketing_consent_at).';
COMMENT ON COLUMN public.users.civil_status_consent_at IS
  'Durable proof-of-consent: stamped when civil_status is first set, cleared on withdrawal.';

COMMIT;
