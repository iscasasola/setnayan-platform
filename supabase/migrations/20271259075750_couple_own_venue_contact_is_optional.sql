-- ============================================================================
-- 20271259075750_couple_own_venue_contact_is_optional.sql
--
-- A COUPLE'S OWN VENUE MAY BE SAVED WITH ONLY A NAME AND A PIN.
--
-- Owner, 2026-10-01 (wedding onboarding, "Add it yourself — name · pin · photo
-- — locked at once"): *"make the contact OPTIONAL for a couple's own venue —
-- the card asks name, pin, photo only; … Your Team shows 'Add contact' later."*
--
-- `event_manual_vendors.contact_person` and `.contact_number` were NOT NULL
-- (+ a non-blank CHECK) since 20260604080000, which made it impossible to save a
-- venue the couple had only just named. They are the couple's OWN notes about a
-- supplier they added by hand — never read by the guest side, never an
-- identity — so the table can hold "not given yet" honestly instead of a typed
-- placeholder (a fake phone number would be worse than none).
--
-- ── WHAT STAYS REQUIRED ───────────────────────────────────────────────────
-- The "Add manually" sheet and `createManualVendor` still ask for both for every
-- other supplier: this migration relaxes the TABLE, not the form. A value that
-- IS given must still be non-blank (the CHECK now reads `IS NULL OR non-blank`),
-- so an empty string can never masquerade as a contact.
--
-- ── RLS ───────────────────────────────────────────────────────────────────
-- Unchanged. `event_manual_vendors_host_all` (20260604080000) governs every
-- column; relaxing NOT NULL widens no one's access.
--
-- Idempotent: DROP NOT NULL is a no-op when already nullable, and the CHECKs are
-- dropped IF EXISTS before being re-added.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_manual_vendors ALTER COLUMN contact_person DROP NOT NULL;
ALTER TABLE public.event_manual_vendors ALTER COLUMN contact_number DROP NOT NULL;

ALTER TABLE public.event_manual_vendors DROP CONSTRAINT IF EXISTS event_manual_vendors_contact_person_check;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_contact_person_check
  CHECK (contact_person IS NULL OR length(trim(contact_person)) > 0);

ALTER TABLE public.event_manual_vendors DROP CONSTRAINT IF EXISTS event_manual_vendors_contact_number_check;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_contact_number_check
  CHECK (contact_number IS NULL OR length(trim(contact_number)) > 0);

COMMENT ON COLUMN public.event_manual_vendors.contact_person IS
  'Who the couple speaks to. NULL = not given yet (a couple''s own venue added from onboarding with only a name and a pin); when present it is non-blank.';
COMMENT ON COLUMN public.event_manual_vendors.contact_number IS
  'The number the couple rings. NULL = not given yet (see contact_person); when present it is non-blank.';

COMMIT;
