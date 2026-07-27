-- ============================================================================
-- A FOLLOW-UP LINE CAN NEVER BE "INCLUDED BY DEFAULT" — AND NEVER REQUIRED.
--
-- ── THE MONEY, FIRST ────────────────────────────────────────────────────────
-- A follow-up (`parent_option_id IS NOT NULL`, migration 20271012816361) is a
-- line the couple is only ever SHOWN once one specific option is picked on
-- another line: "choose lechon" reveals "which style?". It is CONDITIONAL by
-- definition — that is the whole meaning of the column.
--
-- `is_default_included = TRUE` says the opposite: this line is inside
-- `total_price_centavos`, the couple is charged for it, and on lock it becomes
-- a booked `event_vendors` row. Written on a follow-up, those two claims put
-- the couple on the hook for a line whose triggering option they never picked:
--
--   • CHARGED — it sits inside the package total the couple pays, and the
--     platform booking fee is a percentage OF that total, so the fee inflates
--     with it;
--   • DELIVERED — `keptItems` (apps/web/lib/vendor-packages.ts) cascades every
--     included line into an `event_vendors` row at lock, so the couple ends up
--     with a booked service nobody chose;
--   • UNREFUNDABLE by removal — the couple cannot untick what the configurator
--     never showed them.
--
-- `is_required = TRUE` is the same overcharge through a second door: required
-- means "cannot be dropped, and its value never enters the credit pool". A
-- follow-up nobody triggered, that also cannot be dropped, is the worst shape
-- of all. It is named here explicitly rather than left to
-- `vendor_package_items_required_implies_included` (20271006413374) to imply,
-- so that this constraint states the whole rule about follow-ups on its own —
-- relaxing the OTHER constraint later must not silently re-open this door.
--
-- ── WHY A CONSTRAINT AND NOT A FILTER IN THE PRICING CODE ───────────────────
-- Several readers price or cascade these rows — `keptItems`,
-- `computeCustomization`, `chosenOptionsSurchargeCentavos`, the credit engine
-- in lib/package-credit.ts, the couple-side lock modal. A filter added to each
-- protects only the readers that know follow-ups exist; the NEXT reader written
-- would not know, and would re-open the hazard silently.
--
-- With `is_default_included = FALSE` FORCED, every one of those readers is
-- already correct with no change at all, because each of them already excludes
-- not-included lines: `keptItems` returns false, `computeCustomization` counts
-- nothing, the cascade skips it, the credit engine leaves it out of the pool.
-- The truth lives in the schema; the readers inherit it.
--
-- ⚠ IF YOU ARE HERE TO RELAX THIS CONSTRAINT: you are re-opening an overcharge.
-- Making a follow-up default-included does not "include it by default" — it
-- charges every couple for a line most of them will never be shown. If a vendor
-- wants a line every couple gets, that line is not a follow-up: give it
-- `parent_option_id = NULL`.
--
-- ── PRICING A PICKED FOLLOW-UP ──────────────────────────────────────────────
-- This does NOT make follow-ups free forever. A follow-up that the couple DOES
-- reach is priced by its own options' `price_delta_centavos`, exactly like any
-- other choice line — that arrives with the couple-side renderer. This
-- constraint only removes the ability to charge for one that was never reached.
--
-- ── EXISTING ROWS ───────────────────────────────────────────────────────────
-- Zero rows to migrate: prod holds 0 `vendor_packages`, 0
-- `vendor_package_items` and 0 `vendor_package_item_options` (checked
-- 2026-07-27), because the authoring surface is still flag-dark. The constraint
-- is therefore added VALIDATED (no `NOT VALID`) — it must fail loudly on any
-- row that does not fit rather than sit un-enforced over bad data. The
-- pre-flight block below states the count in the error if that ever changes.
--
-- IDEMPOTENT: pre-flight SELECT + DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT.
-- ============================================================================

BEGIN;

-- ── Pre-flight: refuse to run over data the rule would break. ───────────────
-- `ADD CONSTRAINT` would raise 23514 on its own, but with a message that names
-- only the constraint. This says how many rows and which shape, so whoever hits
-- it can fix the data instead of guessing.
DO $$
DECLARE
  v_bad INT;
BEGIN
  SELECT count(*) INTO v_bad
    FROM public.vendor_package_items
   WHERE parent_option_id IS NOT NULL
     AND (is_default_included = TRUE OR is_required = TRUE);

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'vendor_package_items: % follow-up row(s) are default-included or required. Each one charges a couple for a line they were never shown. Set is_default_included = FALSE and is_required = FALSE on them, or clear parent_option_id to make them real top-level lines, then re-run.',
      v_bad;
  END IF;
END $$;

ALTER TABLE public.vendor_package_items
  DROP CONSTRAINT IF EXISTS vendor_package_items_followup_not_default_included_ck;

ALTER TABLE public.vendor_package_items
  ADD CONSTRAINT vendor_package_items_followup_not_default_included_ck
  CHECK (
    parent_option_id IS NULL
    OR (is_default_included = FALSE AND is_required = FALSE)
  );

COMMENT ON CONSTRAINT vendor_package_items_followup_not_default_included_ck
  ON public.vendor_package_items IS
  'MONEY GUARD, not bookkeeping. A follow-up line (parent_option_id IS NOT NULL) is shown only once a specific option is picked on another line, so it can never be inside the package price: is_default_included = TRUE would charge every couple for a line most of them are never shown, inflate the booking fee that is a percentage of that total, and cascade an event_vendors row at lock (keptItems) for a service nobody chose - with no way to untick what was never displayed. is_required = TRUE is the same overcharge by a second door (cannot be dropped, value never released to the credit pool), named here so this constraint states the whole rule about follow-ups without depending on vendor_package_items_required_implies_included. RELAXING THIS RE-OPENS AN OVERCHARGE. A line every couple should get is not a follow-up - give it parent_option_id = NULL. Mirrored in TS by validatePackageDraft (lib/package-authoring.ts) so a vendor reads a sentence instead of a 23514, and belt-and-braced in keptItems (lib/vendor-packages.ts).';

COMMIT;

-- ── Post-condition: the constraint exists AND is VALIDATED. ─────────────────
-- `schema_migrations` records APPLIED for a migration whose objects never
-- landed (see tests/db/schema-drift.db.test.ts), and a constraint that exists
-- but is NOT VALID enforces nothing over the rows already there. Assert the
-- OBJECT, and assert `convalidated`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.vendor_package_items'::regclass
       AND conname = 'vendor_package_items_followup_not_default_included_ck'
       AND contype = 'c'
       AND convalidated
  ) THEN
    RAISE EXCEPTION
      'vendor_package_items_followup_not_default_included_ck is missing or NOT VALID - the follow-up overcharge guard is not enforced';
  END IF;
END $$;
