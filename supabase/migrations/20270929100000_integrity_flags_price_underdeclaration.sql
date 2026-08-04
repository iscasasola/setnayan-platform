-- ============================================================================
-- 20270929100000_integrity_flags_price_underdeclaration.sql
--
-- PRICE-UNDER-DECLARATION PLAUSIBILITY SCANNER — the admin-queue plumbing (dark).
--
-- Adds a THIRD-plus integrity_flags kind, `price_underdeclaration`, whose subject
-- is a single couple-confirmed LOCK (an `event_vendors` row) whose declared
-- `total_cost_php` scored as implausibly low on the deterministic scorer in
-- apps/web/lib/plausibility-scoring.ts (three tiers: inclusion cost-floor,
-- category×location median, and the vendor's own verified median). NO LLM.
--
-- SECOND LAYER, NOT AN ENFORCEMENT: couple-confirmation stays the load-bearing
-- anchor on the price. A row landing in this queue NEVER auto-penalizes the
-- vendor, never adjusts the price, never touches the lock. The only state
-- changes are an admin's explicit dismiss / confirm at /admin/integrity-watch
-- (human triage only) — exactly like the review-fraud / ghost-listing /
-- inquiry-concentration kinds already in this table.
--
-- COMPETITION-LAW posture: the cross-vendor "category median" tier is an
-- INTERNAL corroborating signal only. Nothing here is ever rendered to a couple
-- or a vendor, and the scorer caps that tier so it can never flag a vendor on
-- its own for being cheaper than peers (see the lib). This migration stores only
-- the flag; the guard lives in the deterministic scorer + the admin-only UI.
--
-- RA 10173: the `detail` JSONB carries only the lock's OWN figures + this
-- vendor's OWN aggregates (lock price, per-tier reference figures + severities).
-- NO couple identity, NO peer per-row prices, NO event id beyond the subject FK.
--
-- WHAT CHANGES (all inert until the scanner flag is flipped + a scan is run):
--   1. Widen integrity_flags.kind CHECK to allow 'price_underdeclaration'.
--   2. Add nullable `subject_event_vendor_id` (FK → event_vendors) so the flag
--      points at the specific LOCK, not just the vendor. NULL for every existing
--      row and every other kind → no data changes.
--   3. Widen the kind_shape CHECK: a price_underdeclaration flag carries a lock
--      reference + no review; all prior kinds must NOT carry a lock reference.
--   4. Partial unique index for dedup — at most one flag per lock.
--
-- DARK: a nullable column + wider CHECKs create ZERO rows and change no existing
-- behaviour. The feature stays invisible until NEXT_PUBLIC_PLAUSIBILITY_SCANNER_
-- ENABLED='true' AND an admin runs the rescan.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================

BEGIN;

-- 1. Allow the new kind (a WATCH row — no auto-enforcement).
ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_kind_check;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_kind_check
  CHECK (kind IN (
    'review_fraud',
    'ghost_listing',
    'inquiry_concentration',
    'price_underdeclaration'
  ));

-- 2. The specific locked booking this flag concerns (price_underdeclaration
--    only). Nullable + defaults NULL for all existing rows/kinds. ON DELETE
--    CASCADE so a removed lock takes its flag with it.
ALTER TABLE public.integrity_flags
  ADD COLUMN IF NOT EXISTS subject_event_vendor_id UUID
    REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE;

-- 3. Widen the shape CHECK. price_underdeclaration carries a lock reference and
--    NO review; every prior kind must NOT carry a lock reference (keeps the
--    columns mutually exclusive by kind).
ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_kind_shape;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_kind_shape CHECK (
    (kind = 'review_fraud'           AND subject_review_id IS NOT NULL AND subject_event_vendor_id IS NULL) OR
    (kind = 'ghost_listing'          AND subject_review_id IS NULL     AND subject_event_vendor_id IS NULL) OR
    (kind = 'inquiry_concentration'  AND subject_review_id IS NULL     AND subject_event_vendor_id IS NULL) OR
    (kind = 'price_underdeclaration' AND subject_review_id IS NULL     AND subject_event_vendor_id IS NOT NULL)
  );

-- 4. Dedup: at most ONE flag per lock (partial unique index; allows NULL on
--    every other kind's rows). A rescan refreshes an OPEN flag's score in place
--    and never stacks duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS integrity_flags_price_lock_uniq
  ON public.integrity_flags(subject_event_vendor_id)
  WHERE kind = 'price_underdeclaration';

COMMENT ON COLUMN public.integrity_flags.subject_event_vendor_id IS
  'Price-under-declaration scanner: the specific couple-confirmed LOCK '
  '(event_vendors.vendor_id) whose declared total_cost_php scored implausibly '
  'low on lib/plausibility-scoring.ts. NULL for every other kind. Detect-and-'
  'review only — the flag never touches the lock or penalizes the vendor.';

COMMIT;
