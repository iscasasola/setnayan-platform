-- ============================================================================
-- 20271236460588_event_manual_vendors_address.sql
--
-- A VENUE THE COUPLE TYPES IN MUST BE ABLE TO CARRY ITS ADDRESS.
--
-- Owner, 2026-09-20: "the ceremony and reception venues to lock needs an exact
-- address if added manually. and yes, both … needs to have an address since
-- they will be used for the event itself."
--
-- ── What was missing ───────────────────────────────────────────────────────
-- `event_manual_vendors` (20260604080000) captured exactly four fields —
-- business_name, contact_person, contact_number, optional photo. For a florist
-- that is the whole truth: you ring them and they come to you. For the two
-- categories that ARE a place it is not. The ceremony and reception venues are
-- where every guest is sent, what the map pin on the guest site points at, and
-- what the supplier brief prints — and a couple who books their venue off
-- platform had nowhere to put that address. Measured on prod 2026-09-20: the
-- most recent self-added supplier is `Seda Vertis North`, category `venue`,
-- with no address anywhere on the row.
--
-- ── Why NULLABLE in the database ───────────────────────────────────────────
-- Every existing row predates the field, and a NOT NULL would refuse them all.
-- The REQUIREMENT is a product rule about two categories, and `category` lives
-- on `event_vendors`, not here — one manual contact can be attached to several
-- categories, so this table genuinely cannot know whether an address is owed.
-- The rule therefore lives where it can see the category, in ONE pure module
-- both the form and the server action import (`lib/manual-venue-address.ts`),
-- with `manual-venue-address.test.ts` executing its truth table.
--
-- The CHECK below is the part the database CAN honestly enforce: if a value is
-- present it must not be whitespace, mirroring the three columns above it.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Idempotent: drop-then-add so a re-run cannot fail on the existing constraint.
ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT IF EXISTS event_manual_vendors_address_not_blank;

ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_address_not_blank
  CHECK (address IS NULL OR length(trim(address)) > 0);

COMMENT ON COLUMN public.event_manual_vendors.address IS
  'Exact street address of a supplier the couple added themselves. REQUIRED at '
  'the application layer for the two categories that are a place — event_vendors.category '
  'IN (''venue'', ''religious_venue'') — because those addresses are where guests are '
  'sent. Optional for every other category (a caterer''s commissary is worth keeping '
  'but is never demanded). The requirement cannot live here: category is on '
  'event_vendors and one manual contact may serve several. See '
  'apps/web/lib/manual-venue-address.ts.';

COMMIT;
