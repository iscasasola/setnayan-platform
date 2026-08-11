-- ═══════════════════════════════════════════════════════════════════════════
-- ONE BILL, MANY ITEMS — the onboarding services basket (owner 2026-08-11)
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner: *"it will total and create a custom QR, okay?"* … *"it will also
-- integrate the approval of both at the same time once verified."*
--
-- The onboarding services step can now sell three things at once — a Papic Pool
-- rung, N dedicated Papic One cameras, and Setnayan AI. Before this they became
-- THREE separate orders, which meant three amounts, three reference codes and
-- three QR codes for a couple who has not yet seen their dashboard. Worse, the
-- QR carries the AMOUNT ONLY — GCash rejects a reference inside the code, tested
-- on real wallets 2026-07-31 — so a couple scanning one QR for the total would
-- send ONE transfer that reconciles against NONE of the three bills cleanly.
--
-- So the basket is ONE order, and this table records what that order covers.
--
-- ── WHY ONE ORDER RATHER THAN A GROUP OF ORDERS ───────────────────────────
-- The alternative was to keep three orders and add a "bill group" the payment
-- side understands. Rejected deliberately: reconciliation is the most delicate,
-- most human, most money-critical path we have — the shortfall guard, the
-- duplicate detector and the paste-the-bank-alert matcher all reason about ONE
-- order with ONE amount and ONE reference. Making the basket a single order
-- leaves every one of those BYTE-IDENTICAL and moves the new complexity into
-- activation, which is mechanical and already fans out for bundles.
--
-- ── WHY NOT `bundle_components` ───────────────────────────────────────────
-- That table is (bundle_sku_code, component_service_code): STATIC membership,
-- no quantity. A basket's contents vary per couple — which of nine Pool rungs,
-- how many cameras, planner or no planner. Registering every possible child
-- against one bundle code would hand Setnayan AI to every couple who bought
-- only shots, because ownership is resolved from the bundle's composition and
-- not from what they actually paid for. Per-ORDER is the only honest shape.

CREATE TABLE IF NOT EXISTS public.onboarding_order_items (
  item_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  -- The CHILD service_key. Activation dispatches on exactly this, so it must be
  -- a key EXACT_HOOKS knows; `onboarding-basket-fans-out.db.test.ts` fails if a
  -- basket can be built from a key that owns no hook.
  service_code TEXT NOT NULL,
  -- How many of it. Only Papic One uses > 1 today (N dedicated cameras on one
  -- bill); the Pool rung and Setnayan AI are always 1.
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- The unit price AT PURCHASE, in pesos. Snapshotted for the same reason
  -- papic_one_orders snapshots its points: an admin repricing tomorrow must not
  -- silently restate what a couple agreed to today. NOT a billing source — the
  -- order's own requested_total_php is what is owed.
  unit_price_php NUMERIC(12,2) NOT NULL CHECK (unit_price_php >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per (order, service). A basket cannot list the same product twice:
  -- two Pool rungs would be a choice the picker cannot express, and two camera
  -- lines would double-count the quantity.
  UNIQUE (order_id, service_code)
);

CREATE INDEX IF NOT EXISTS onboarding_order_items_order_idx
  ON public.onboarding_order_items (order_id);
-- Ownership asks the reverse question — "which orders granted this SKU?" — so
-- it needs the service_code leading, not the order.
CREATE INDEX IF NOT EXISTS onboarding_order_items_service_idx
  ON public.onboarding_order_items (service_code);

-- 🔒 RLS at CREATE TABLE time, and the grants revoked explicitly: a new table in
-- `public` ships OPEN to anon+authenticated on this project unless it is taken
-- away. This table is written only by the commit path (service_role) and read
-- only by activation + ownership (service_role), so no session role needs it at
-- all. No policy is added on purpose — RLS enabled with zero policies denies
-- every session role, which is exactly the intent.
ALTER TABLE public.onboarding_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_order_items TO service_role;

COMMENT ON TABLE public.onboarding_order_items IS
  'What ONE onboarding services order covers. The basket is a single order so '
  'the couple gets one total, one QR, one reference and one approval; this is '
  'the list activation fans out over, reversal reads, and ownership consults.';
COMMENT ON COLUMN public.onboarding_order_items.service_code IS
  'The CHILD service_key. Must be one EXACT_HOOKS can dispatch, or the item is '
  'paid for and never provisioned.';
