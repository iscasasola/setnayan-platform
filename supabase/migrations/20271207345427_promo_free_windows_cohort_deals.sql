-- Promo free windows · COHORT DEALS for vendors (owner ask 2026-09-05).
--
-- The owner asked for two vendor cohort shapes, verbatim: *"for all vendors"*
-- and *"for any vendor who registers and submits documents on X-X"*. And one
-- ruling on top: **"all vendors" means all VERIFIED vendors**
-- (vendor_profiles.verification_state = 'verified' — never tier_state, whose
-- own legacy 'verified' value is a trap, not the column).
--
-- Three additive changes to public.promo_free_windows (20270908268882):
--
--   1. audience_type gains 'new_verified_vendors'. A vendor qualifies when BOTH
--      their sign-up (vendor_profiles.created_at) AND their doc approval
--      (vendor_profiles.last_verified_at, written by admin/verify approval)
--      fall inside [starts_at, ends_at). Evaluated statelessly at gate time in
--      lib/promo-free-windows.ts — no per-vendor row, no job, no trigger, the
--      same pattern the date windows already use.
--
--      ⚠ THE COLUMN CHECK RE-LISTS ITS VOCABULARY. It was declared inline, so
--      Postgres named it promo_free_windows_audience_type_check; it is dropped
--      and re-created here with the new value. The failure mode of forgetting
--      this fires only at ALTER validation against real rows — the PGlite
--      replay (tests/db) is what catches it.
--
--   2. The tier rule is EXTENDED, never bypassed: a cohort window MUST name a
--      promoted tier exactly like an all_vendors window does, because the
--      vendor "free" path is a tier PROMOTION (vendor_billing_catalog has
--      CHECK (price_php > 0), so a vendor SKU can never be zeroed).
--
--   3. deal_length_days — how long EACH qualifying vendor keeps the deal,
--      counted from the moment they qualified. NULL keeps the existing
--      meaning: the deal ends when the window ends (ends_at). The window says
--      WHO gets in; this column says HOW LONG each of them keeps it. A vendor
--      who qualifies on the last day of a 28-day deal keeps it 28 days past
--      ends_at — that is the point of the separate control.
--
-- Everything stays behind env PROMO_FREE_WINDOWS_ENABLED (default OFF); the
-- readers short-circuit before any DB read while it is off.

BEGIN;

ALTER TABLE public.promo_free_windows
  ADD COLUMN IF NOT EXISTS deal_length_days INTEGER;

ALTER TABLE public.promo_free_windows
  DROP CONSTRAINT IF EXISTS promo_free_windows_deal_length_positive;
ALTER TABLE public.promo_free_windows
  ADD CONSTRAINT promo_free_windows_deal_length_positive
  CHECK (deal_length_days IS NULL OR deal_length_days > 0);

COMMENT ON COLUMN public.promo_free_windows.deal_length_days IS
  'How long each qualifying vendor keeps the deal, in days from the moment they qualified. NULL = until the window''s ends_at. The window controls who gets in; this controls how long each of them keeps it. Owner ask 2026-09-05.';

-- 1. Widen the audience vocabulary. Inline column CHECK → auto-named
--    <table>_<column>_check. Drop by that name, and also by definition in case
--    a hand-applied environment named it differently.
ALTER TABLE public.promo_free_windows
  DROP CONSTRAINT IF EXISTS promo_free_windows_audience_type_check;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.promo_free_windows'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%audience_type%'
      AND pg_get_constraintdef(oid) LIKE '%all_couples%'
      AND pg_get_constraintdef(oid) NOT LIKE '%promoted_vendor_tier%'
  LOOP
    EXECUTE format('ALTER TABLE public.promo_free_windows DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.promo_free_windows
  ADD CONSTRAINT promo_free_windows_audience_type_check
  CHECK (audience_type IN ('all_couples','all_vendors','new_verified_vendors','segment'));

-- 2. Extend the tier rule: every VENDOR audience names a promoted tier; a
--    non-vendor audience never does.
ALTER TABLE public.promo_free_windows
  DROP CONSTRAINT IF EXISTS promo_free_windows_vendor_tier;
ALTER TABLE public.promo_free_windows
  ADD CONSTRAINT promo_free_windows_vendor_tier CHECK (
    (audience_type IN ('all_vendors','new_verified_vendors')) = (promoted_vendor_tier IS NOT NULL)
  );

COMMENT ON COLUMN public.promo_free_windows.audience_type IS
  'all_couples · all_vendors (every VERIFIED vendor — verification_state = ''verified'') · new_verified_vendors (sign-up AND doc approval both inside the window) · segment (schema-forward, unbuilt). Vendor audiences require promoted_vendor_tier.';

COMMIT;
