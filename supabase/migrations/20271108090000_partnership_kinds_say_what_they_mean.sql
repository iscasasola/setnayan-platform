-- Rename two vendor_partnerships kinds so they stop reading as paid advertising.
--
-- ── WHY A RENAME EARNS A MIGRATION ──────────────────────────────────────────
-- `sponsored_included` and `sponsored_discounted` do NOT mean anyone paid
-- Setnayan. The vendor sponsors their PARTNER'S SERVICE FOR THE COUPLE:
--
--     included_in_package   — the partner is in my package, free to the couple
--     discounted_together   — the partner discounts when booked alongside me
--
-- The word "sponsored" has now sent two independent readers to the same wrong
-- conclusion. A 2026-07-27 ranking-honesty audit recorded a finding that "paid
-- placement is reordering the public marketplace and the code calls it
-- organic"; and on 2026-08-05 it led to a pricing recommendation built on the
-- same misreading, argued to the owner twice before the vendor-facing form was
-- read. Both cost real time, and the next reader would have paid it again.
--
-- Documentation was tried first (lib/vendor-partnership-kinds.ts opens with the
-- correction). A comment does not travel with the value: the value is what
-- shows up in a query result, a log line and an audit.
--
-- ── WHY THIS IS SAFE TO RENAME RATHER THAN DUAL-WRITE ───────────────────────
-- `relationship_type` is a plain text column with a CHECK — not an enum, so no
-- type surgery. Production holds ZERO partnership rows (verified 2026-08-05),
-- so the UPDATE below is a no-op there. It is written anyway because this file
-- must also be correct on a branch, a replay, or any database where rows exist.
--
-- ORDER MATTERS: the CHECK must come off before the values move, or every row
-- update fails against the old allowlist. It goes back on afterwards, narrowed
-- to the new names — leaving the old ones legal would let a stale client keep
-- writing the word this migration exists to remove.

BEGIN;

ALTER TABLE public.vendor_partnerships
  DROP CONSTRAINT IF EXISTS vendor_partnerships_relationship_type_check;

UPDATE public.vendor_partnerships
   SET relationship_type = 'included_in_package'
 WHERE relationship_type = 'sponsored_included';

UPDATE public.vendor_partnerships
   SET relationship_type = 'discounted_together'
 WHERE relationship_type = 'sponsored_discounted';

ALTER TABLE public.vendor_partnerships
  ADD CONSTRAINT vendor_partnerships_relationship_type_check
  CHECK (
    relationship_type = ANY (
      ARRAY[
        'accredited'::text,
        'included_in_package'::text,
        'discounted_together'::text,
        'general'::text
      ]
    )
  );

COMMENT ON COLUMN public.vendor_partnerships.relationship_type IS
  'What one vendor claims about another, ranked by what the COUPLE gets: '
  'included_in_package (free to the couple) > discounted_together > accredited '
  '> general. NONE of these are paid placement — nobody pays Setnayan for a '
  'partnership. Renamed from sponsored_included/sponsored_discounted on '
  '2026-08-05 because "sponsored" read as advertising to two separate reviewers.';

COMMIT;
