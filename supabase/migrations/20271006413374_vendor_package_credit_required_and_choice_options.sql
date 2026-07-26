-- ============================================================================
-- 20271006413374_vendor_package_credit_required_and_choice_options.sql
--
-- PACKAGE CREDIT MODEL — FOUNDATION (owner-locked 2026-07-26).
--
-- THE MODEL (owner's words, not a redesign)
-- -----------------------------------------
-- A vendor package carries a CREDIT POOL, shaped like a hotel F&B credit.
-- Dropping an inclusion returns that item's value to the pool; the package
-- PRICE stays fixed, so credit changes WHAT you get, not what you pay.
--
--   1. Credit is spendable ACROSS THE VENDOR'S WHOLE CATALOGUE, not only
--      package items.
--   2. A line can be a CHOICE: one inclusion, N alternatives, pick one
--      (a caterer offers 3 delicacies for one "main course" line).
--   3. Each choice carries its OWN extra cost (a price delta). The package
--      price assumes the DEFAULT option; a premium pick adds its difference.
--   4. A vendor can mark a line REQUIRED — must be picked, cannot be removed.
--      REQUIRED is a SEPARATE AXIS from CHOICE. Four combinations:
--        required + fixed   — the venue
--        required + choice  — must pick a main course, 1 of 3
--        optional + fixed   — chocolate fountain, drop it for credit
--        optional + choice  — dessert is optional; pick one if taken
--   5. Unspent credit: the VENDOR decides PER PACKAGE — 'expiring'
--      ("use it or lose it") or 'refundable' (comes off the price).
--   6. Overspend is ALLOWED — it is added to the package total and paid
--      through the EXISTING apply-then-pay rail. No new payment machinery.
--
-- THE INVARIANT THIS SCHEMA EXISTS TO SERVE
-- ------------------------------------------
-- A REQUIRED line's value must NEVER enter the available-credit pool. A
-- couple must never be shown credit they cannot actually free. `is_required`
-- is what lets the pure engine (apps/web/lib/package-credit.ts) exclude
-- those values instead of guessing from `is_default_included` — which is
-- NOT required-ness (it only means "ticked by default"; nothing stopped a
-- host removing such a line).
--
-- WHY A SEPARATE OPTIONS TABLE (vs a self-referencing group on items)
-- -------------------------------------------------------------------
-- Two shapes were on the table. A self-referencing `parent_item_id` on
-- vendor_package_items would make every alternative ITSELF a package item
-- row — and every shipped reader of that table (keptItems(), the
-- cascade-lock in app/dashboard/[eventId]/vendors/packages/actions.ts, the
-- booking detail page, /v/[slug]) does an unfiltered
-- `select … from vendor_package_items where package_id = …`. Those readers
-- would instantly see N extra "line items", price them, and cascade-create
-- N extra event_vendors rows — a live behaviour change the moment the
-- migration lands, before any flag is flipped. That is disqualifying.
--
-- A CHILD table is invisible to every existing SELECT (nobody joins it
-- yet), so the schema delta is inert until the credit engine is wired up.
-- It also matches the real shape: an option has no canonical_service, never
-- cascades to event_vendors, and never appears on a planning card.
--
-- OPTION IDENTITY IS STABLE. `option_id` is a UUID primary key; a stored
-- selection references THAT id, never a copied price. When the vendor edits
-- an option's price the delta re-resolves from the row, so a booking can
-- never silently drift onto a stale number. When the vendor DELETES an
-- option, the stored selection becomes unresolvable and the pure engine
-- fails CLOSED (`unknown_option`) rather than inventing a price.
--
-- COLUMNS ADDED
-- -------------
--   vendor_package_items.is_required           BOOLEAN NOT NULL DEFAULT FALSE
--   vendor_packages.unspent_credit_policy      TEXT NOT NULL DEFAULT 'expiring'
--   NEW TABLE vendor_package_item_options
--
-- BACKWARD COMPATIBILITY (this migration changes NO existing behaviour)
-- ---------------------------------------------------------------------
--   • is_required DEFAULT FALSE  → every existing row keeps today's
--     "anything can be unchecked" semantics.
--   • unspent_credit_policy DEFAULT 'expiring' → today's math exactly:
--     unspent consumable budget never comes off total_locked_centavos.
--   • The shipped seed's required-ness WORKAROUND (give the venue line
--     `replacement_value_centavos = 0` so removing it frees no credit)
--     keeps working untouched. Section 4 below additionally promotes those
--     zero-value anchor lines to `is_required = TRUE` — which is a strict
--     no-op for money (they already free 0 centavos) and simply makes the
--     intent explicit for the engine.
--   • No shipped query selects the new columns, so no row shape changes.
--
-- GREENFIELD: prod has 0 packages, 0 items, 0 bookings — no backfill risk.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DROP POLICY IF EXISTS + CREATE POLICY, per the repo migration convention.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_package_items.is_required — the axis that protects the invariant
-- ----------------------------------------------------------------------------

-- TRUE  = the couple must keep this line. It cannot be removed, and its
--         replacement_value_centavos NEVER enters the available-credit pool.
-- FALSE = optional (today's behaviour for every row).
--
-- Deliberately a SEPARATE column from is_default_included: "ticked by
-- default" and "cannot be unticked" are different claims, and conflating
-- them is exactly how a UI ends up promising credit that cannot be freed.
ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_package_items.is_required IS
  'TRUE = line cannot be removed and its replacement_value_centavos never enters the credit pool (owner-locked package credit model, 2026-07-26). Distinct from is_default_included, which only means "ticked by default".';

-- ----------------------------------------------------------------------------
-- 2. vendor_packages.unspent_credit_policy — the vendor decides, per package
-- ----------------------------------------------------------------------------

-- 'expiring'   = use it or lose it. Unspent credit is forfeited; the couple
--                pays total_price_centavos (+ any overspend). This is the
--                behaviour shipped today, hence the DEFAULT.
-- 'refundable' = unspent credit comes OFF the price:
--                total = total_price_centavos - unspent (+ overspend).
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS unspent_credit_policy TEXT NOT NULL DEFAULT 'expiring'
    CHECK (unspent_credit_policy IN ('expiring', 'refundable'));

COMMENT ON COLUMN public.vendor_packages.unspent_credit_policy IS
  'Per-package vendor decision for leftover credit: expiring (use it or lose it - today''s behaviour) or refundable (comes off the price).';

-- ----------------------------------------------------------------------------
-- 3. vendor_package_item_options — N alternatives for one line
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_package_item_options (
  option_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id               UUID NOT NULL
                        REFERENCES public.vendor_package_items(item_id) ON DELETE CASCADE,
  option_label          TEXT NOT NULL,
  option_description    TEXT,
  -- EXTRA cost of picking this alternative over the package's assumed
  -- default, in CENTAVOS. The package price already assumes the default,
  -- so the default's delta is pinned to 0 by the CHECK below.
  --
  -- >= 0 by construction: the owner model is "each choice carries its own
  -- EXTRA cost … a premium pick adds its difference". A negative delta
  -- would be a *downgrade credit* — a genuinely different product decision
  -- (it would let a REQUIRED line mint credit), so it is refused at the DB
  -- until an owner explicitly asks for it.
  price_delta_centavos  BIGINT NOT NULL DEFAULT 0
                        CHECK (price_delta_centavos >= 0),
  -- Exactly one default per item (partial unique index below). The default
  -- is what total_price_centavos already pays for.
  is_default            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Vendor can retire an alternative without deleting it (which would
  -- orphan stored selections). An unavailable option cannot be newly
  -- chosen; the engine fails closed on it.
  is_available          BOOLEAN NOT NULL DEFAULT TRUE,
  display_order         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The package price assumes the DEFAULT option, so the default costs
  -- nothing extra by definition. Without this, a vendor could set the
  -- default to +50,000 pesos and every untouched booking would silently
  -- carry a surcharge nobody chose.
  CONSTRAINT vendor_package_item_options_default_is_free
    CHECK (is_default = FALSE OR price_delta_centavos = 0)
);

-- At most ONE default per line. Partial unique index (not a table
-- constraint) because only the TRUE rows must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_package_item_options_one_default_idx
  ON public.vendor_package_item_options(item_id)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS vendor_package_item_options_item_idx
  ON public.vendor_package_item_options(item_id, display_order);

COMMENT ON TABLE public.vendor_package_item_options IS
  'Alternatives for a CHOICE package line (pick exactly one). A line is a CHOICE iff it has >= 1 row here. option_id is the stable identity a booking stores - never a copied price, so vendor edits re-resolve instead of drifting.';

ALTER TABLE public.vendor_package_item_options ENABLE ROW LEVEL SECURITY;

-- RLS mirrors vendor_package_items exactly: public read while the parent
-- package is active; vendor-owner (or admin) writes.
DROP POLICY IF EXISTS vendor_package_item_options_public_read
  ON public.vendor_package_item_options;
CREATE POLICY vendor_package_item_options_public_read
  ON public.vendor_package_item_options
  FOR SELECT
  USING (
    item_id IN (
      SELECT i.item_id
      FROM public.vendor_package_items i
      INNER JOIN public.vendor_packages vp ON vp.package_id = i.package_id
      WHERE vp.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS vendor_package_item_options_owner_write
  ON public.vendor_package_item_options;
CREATE POLICY vendor_package_item_options_owner_write
  ON public.vendor_package_item_options
  FOR ALL
  TO authenticated
  USING (
    item_id IN (
      SELECT i.item_id
      FROM public.vendor_package_items i
      INNER JOIN public.vendor_packages vp ON vp.package_id = i.package_id
      INNER JOIN public.vendor_profiles p
        ON vp.vendor_profile_id = p.vendor_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  )
  WITH CHECK (
    item_id IN (
      SELECT i.item_id
      FROM public.vendor_package_items i
      INNER JOIN public.vendor_packages vp ON vp.package_id = i.package_id
      INNER JOIN public.vendor_profiles p
        ON vp.vendor_profile_id = p.vendor_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

-- Reuse the updated_at trigger function already defined by
-- 20260604110000_vendor_packages.sql.
DROP TRIGGER IF EXISTS vendor_package_item_options_updated_at
  ON public.vendor_package_item_options;
CREATE TRIGGER vendor_package_item_options_updated_at
  BEFORE UPDATE ON public.vendor_package_item_options
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_packages_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Make the shipped "required-ness workaround" explicit (money no-op)
-- ----------------------------------------------------------------------------

-- The 20260604110000 seed faked required-ness by pricing the anchor venue
-- line at replacement_value_centavos = 0, so unchecking it freed no credit.
-- That workaround still works untouched. This UPDATE simply says out loud
-- what it meant, so the engine can REFUSE the removal instead of silently
-- returning 0.
--
-- Strictly value-preserving: only rows that already free 0 centavos are
-- touched, so no pool, total, or booking figure can move. Scoped to the
-- package's own anchor service so an unrelated free giveaway line is not
-- promoted by accident.
UPDATE public.vendor_package_items i
SET is_required = TRUE
FROM public.vendor_packages p
WHERE i.package_id = p.package_id
  AND i.is_required = FALSE
  AND i.replacement_value_centavos = 0
  AND i.is_default_included = TRUE
  AND i.canonical_service = p.primary_canonical_service;

COMMIT;
