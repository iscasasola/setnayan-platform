-- ════════════════════════════════════════════════════════════════════════════
-- M1 — package anchor role + cascade indexes
--
-- Canonical: Vendor_Package_Credit_BUILD_SPEC_2026-07-26.md § 0 + § 1 (M1).
-- Owner-locked model, 7-agent design + money/data-model adversarial review.
--
-- ── WHY THIS IS URGENT ──────────────────────────────────────────────────────
-- A package with MORE THAN ONE line cannot be locked today. `lockPackage`
-- cascades one `event_vendors` row per kept item, all carrying the same
-- `marketplace_vendor_id`, and since 2026-06-25 a partial unique index has
-- forbidden exactly that:
--
--   event_vendors_unique_marketplace_pick_per_event
--     ON (event_id, marketplace_vendor_id) WHERE ... archived_at IS NULL
--
-- The second row raises 23505, the whole bulk insert fails, lockPackage rolls
-- its booking back, and the couple sees an error. Reproduced end-to-end in
-- tests/db/first-user-journey.db.test.ts. Nobody noticed because prod holds 0
-- packages — the index was added for an unrelated race in the Save-Vendor flow
-- (20260625050739) and packages were collateral.
--
-- ── THE MODEL — "one anchor, N covered" ─────────────────────────────────────
--                     anchor row              covered rows
--   count             exactly 1 per booking   1 per kept item (minus anchor's)
--   package_role      'anchor'                'covered'
--   total_cost_php    the gross total         ALWAYS NULL
--   booking fee       opened once, here       never (guarded)
--   free-tier cap     counts 1                counts 0 (DISTINCT event_id)
--   budget            one priced line         occupies its key, prices nothing
--
-- Covered rows are exempted from the uniqueness rules because for them the
-- grain is deliberately per-line; the duplicate-pick race those rules exist to
-- stop cannot occur on a server-side cascade.
--
-- ⚠ TWO indexes must be rebuilt, not one. The spec's own review caught the
-- second: `event_vendors_hard_single_lock_uniq` keys on the GENERATED
-- `hard_single_group` derived from `category`, and the anchor's category equals
-- that of its own kept row — so it would 23505 on the second insert even after
-- Blocker 1 was fixed. ("BLOCKER 2 — MISSED IN THE DRAFT".)
--
-- Additive and idempotent: every ADD CONSTRAINT is preceded by DROP ... IF
-- EXISTS, because Postgres has no ADD CONSTRAINT IF NOT EXISTS and this repo's
-- migrations are known to be re-run.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) The role column ──────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS package_role TEXT;

COMMENT ON COLUMN public.event_vendors.package_role IS
  'NULL = an ordinary booking. anchor = the ONE row per package booking that '
  'carries the money and the booking fee. covered = one row per kept package '
  'item; carries NO money and is exempt from the marketplace-pick and '
  'hard-single uniqueness rules. Vendor_Package_Credit_BUILD_SPEC_2026-07-26 s0.';

ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_package_role_ck;
ALTER TABLE public.event_vendors ADD CONSTRAINT event_vendors_package_role_ck
  CHECK (package_role IS NULL OR package_role IN ('anchor','covered'));

-- A covered row must never carry money. Structural, so no code path can put a
-- peso on a row the fee engine is forbidden to see.
ALTER TABLE public.event_vendors DROP CONSTRAINT IF EXISTS event_vendors_covered_rows_carry_no_money;
ALTER TABLE public.event_vendors ADD CONSTRAINT event_vendors_covered_rows_carry_no_money
  CHECK (package_role IS DISTINCT FROM 'covered'
         OR (total_cost_php IS NULL AND deposit_paid_php IS NULL));

-- ── 2) Shape of a package booking ───────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_one_anchor_per_booking_uniq
  ON public.event_vendors (event_vendor_package_id)
  WHERE package_role = 'anchor' AND archived_at IS NULL;

-- One covered row per package item per booking → the safe delete key.
CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_one_covered_per_item_uniq
  ON public.event_vendors (event_vendor_package_id, package_item_id)
  WHERE package_role = 'covered' AND archived_at IS NULL;

-- ── 3) BLOCKER 1 — marketplace pick ─────────────────────────────────────────
DROP INDEX IF EXISTS public.event_vendors_unique_marketplace_pick_per_event;
CREATE UNIQUE INDEX event_vendors_unique_marketplace_pick_per_event
  ON public.event_vendors (event_id, marketplace_vendor_id)
  WHERE marketplace_vendor_id IS NOT NULL AND archived_at IS NULL
    AND package_role IS DISTINCT FROM 'covered';

-- ── 4) BLOCKER 2 — hard-single slot ─────────────────────────────────────────
DROP INDEX IF EXISTS public.event_vendors_hard_single_lock_uniq;
CREATE UNIQUE INDEX event_vendors_hard_single_lock_uniq
  ON public.event_vendors (event_id, hard_single_group)
  WHERE hard_single_group IS NOT NULL AND archived_at IS NULL
    AND package_role IS DISTINCT FROM 'covered'
    AND status IN ('contracted','deposit_paid','delivered','complete');

-- ── 5) Free-tier cap counts EVENTS, not rows ────────────────────────────────
-- A packaged booking is N rows in ONE event. COUNT(*) would read a single
-- 3-service package as three of the vendor's three free concurrent slots and
-- lock them out of the marketplace on their first booking.
CREATE OR REPLACE FUNCTION public.enforce_free_tier_booking_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_active  CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered']::public.vendor_status[];
  v_cap     CONSTANT INTEGER := 3;
  v_tier    TEXT;
  v_count   INTEGER;
BEGIN
  SELECT COALESCE(ps.free_tier_booking_cap_enabled, FALSE)
    INTO v_enabled
    FROM public.platform_settings ps
   WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A covered row is not a booking of its own; the anchor already counts.
  IF NEW.package_role = 'covered' THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = ANY (v_active)) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = ANY (v_active) THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text
    INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.marketplace_vendor_id;
  IF v_tier IS DISTINCT FROM 'free' AND v_tier IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;

  -- DISTINCT event_id: one event is one booking however many rows it spans.
  SELECT COUNT(DISTINCT ev.event_id)
    INTO v_count
    FROM public.event_vendors ev
   WHERE ev.marketplace_vendor_id = NEW.marketplace_vendor_id
     AND ev.event_id <> NEW.event_id
     AND ev.status = ANY (v_active);

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'free_tier_booking_cap: free-tier vendor already holds % concurrent active bookings (cap %) (marketplace_vendor_id=%)',
      v_count, v_cap, NEW.marketplace_vendor_id
      USING ERRCODE = 'check_violation',
            HINT = 'Free vendors hold 3 concurrent bookings. Finish an event to free a slot, or subscribe (Solo+) for unlimited.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_free_tier_booking_cap() IS
  'Free-tier 3-concurrent-booking cap (owner 2026-07-25). Counts DISTINCT '
  'event_id so a packaged booking (N rows, one event) is ONE slot, and skips '
  'covered rows entirely. Gated on platform_settings.free_tier_booking_cap_enabled '
  '(default FALSE = inert). Mirrors lib/vendor-free-tier-booking-cap.ts.';

-- ── 6) One live lock per (event, package) ───────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS event_vendor_packages_one_lock_per_pkg_uniq
  ON public.event_vendor_packages (event_id, package_id) WHERE status = 'locked';

-- ── 7) GUARD A — an anchor's price is DERIVED, never typed ──────────────────
-- Closes updateVendorCosts (vendors/actions.ts), which updates any event_vendors
-- row in the couple's event with a typed total and no package filter, backed by
-- the FOR ALL policy event_vendors_couple_write. A typed "1" would rewrite a
-- ₱70,000 pending fee base down to the ₱50 floor.
CREATE OR REPLACE FUNCTION public.guard_package_anchor_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Escape hatch for the server-side credit RPC only.
  IF COALESCE(current_setting('setnayan.package_credit_rpc', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  -- (a) an anchor's total is DERIVED, never typed.
  IF NEW.package_role = 'anchor'
     AND NEW.total_cost_php IS DISTINCT FROM OLD.total_cost_php THEN
    RAISE EXCEPTION 'package_anchor_price_is_derived: edit the package selections, not the total'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) ⚠ AND the ROLE itself is immutable. Without this, (a) is trivially
  --     evaded: `event_vendors` grants UPDATE to `authenticated` at table level
  --     (55 sibling columns are already anon=SIU authenticated=SIU), so a couple
  --     could demote their own anchor to 'covered' and NULL the total in ONE
  --     statement — (a) tests NEW.package_role, which is no longer 'anchor', so
  --     it would not fire and the fee base would silently vanish. A trigger is
  --     the only lever here: a column-level REVOKE cannot bite against a
  --     table-level grant.
  IF OLD.package_role IS DISTINCT FROM NEW.package_role THEN
    RAISE EXCEPTION 'package_role_is_immutable: release the package instead of re-roling its rows'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS event_vendors_guard_anchor_price ON public.event_vendors;
-- Fires on ANY update, not just `OF total_cost_php` — the role flip is the
-- evasion, and it does not touch total_cost_php in the same statement.
CREATE TRIGGER event_vendors_guard_anchor_price
  BEFORE UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_anchor_price();

-- ── 8) GUARD B — an anchor with a live fee charge cannot be DELETEd ─────────
-- booking_fee_charges.event_vendor_id is ON DELETE CASCADE, so a stray delete
-- hard-removes a PAID charge while booking_fee_ledger.fee_paid_total_centavos
-- keeps the money: a silent, audit-less desync.
CREATE OR REPLACE FUNCTION public.guard_package_anchor_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.package_role = 'anchor' AND EXISTS (
    SELECT 1 FROM public.booking_fee_charges c
     WHERE c.event_vendor_id = OLD.vendor_id
       AND c.status IN ('pending','paid','waived_import','waived_free5')) THEN
    RAISE EXCEPTION 'package_anchor_has_live_fee_charge: release the package instead of deleting it'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS event_vendors_guard_anchor_delete ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_anchor_delete
  BEFORE DELETE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_package_anchor_delete();

COMMIT;

-- ── Post-condition: both blockers are actually gone. ────────────────────────
DO $$
DECLARE v_def TEXT;
BEGIN
  SELECT indexdef INTO v_def FROM pg_indexes
   WHERE schemaname='public' AND indexname='event_vendors_unique_marketplace_pick_per_event';
  IF v_def IS NULL OR v_def NOT LIKE '%package_role%' THEN
    RAISE EXCEPTION 'BLOCKER 1 not cleared: marketplace-pick index does not exempt covered rows';
  END IF;

  SELECT indexdef INTO v_def FROM pg_indexes
   WHERE schemaname='public' AND indexname='event_vendors_hard_single_lock_uniq';
  IF v_def IS NULL OR v_def NOT LIKE '%package_role%' THEN
    RAISE EXCEPTION 'BLOCKER 2 not cleared: hard-single index does not exempt covered rows';
  END IF;
END $$;
