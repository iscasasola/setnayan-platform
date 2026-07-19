-- Second Google Drive per event — the 'drive_overflow' provider (owner 2026-07-11)
-- (Pricing.md § 2.1 "up to 2 Google Drives per event" + DECISION_LOG 2026-07-11)
--
-- When the couple's primary Drive fills mid-event, they connect a SECOND Drive
-- (their own other account) so full-res always has somewhere to land. Rather than
-- touch the UNIQUE(event_id, provider) key + every existing provider='drive'
-- reader, the 2nd Drive is an ADDITIVE new provider value: slot 1 = 'drive'
-- (unchanged, every existing reader works verbatim), slot 2 = 'drive_overflow'
-- (a new row, invisible to those readers). UNIQUE(event_id, provider) then already
-- allows exactly one of each → 2 Drives per event, zero blast radius.
--
-- SAFETY INVARIANT (owner-locked): both Drives are the couple's OWN real Google
-- accounts, each OAuth-consented, narrow `drive.file` scope. Setnayan never
-- creates accounts. This migration only widens the allowed provider set.
--
-- Idempotent: re-uses the constraint name so DROP-IF-EXISTS + ADD re-runs cleanly.
-- Existing rows all hold values already in the allowed set, so the CHECK validates.

-- Drop whatever the provider CHECK is named (robust to the auto-generated name),
-- then add the widened one. Name-agnostic so we don't depend on Postgres's
-- inline-constraint naming, and idempotent (re-run drops the just-added one).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.oauth_grants'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.oauth_grants DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.oauth_grants ADD CONSTRAINT oauth_grants_provider_check
  CHECK (provider IN ('youtube', 'drive', 'tiktok', 'drive_photo_delivery', 'drive_overflow'));

DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.oauth_state'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.oauth_state DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.oauth_state ADD CONSTRAINT oauth_state_provider_check
  CHECK (provider IN ('youtube', 'drive', 'tiktok', 'drive_photo_delivery', 'drive_overflow'));

COMMENT ON CONSTRAINT oauth_grants_provider_check ON public.oauth_grants IS
  'Allowed OAuth providers. drive_overflow = the couple''s 2nd Drive for an event (overflow when the primary fills) — their own account, drive.file scope; Setnayan never creates accounts (owner 2026-07-11).';
