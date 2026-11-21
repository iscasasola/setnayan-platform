-- ═══════════════════════════════════════════════════════════════════════════
-- 💳 MAYA CHECKOUT — the pay page when it is on; BDO QR is the safety route
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Owner, 2026-11-21 (Setnayan-specs DECISION_LOG "MAYA CHECKOUT — BUILD IT",
-- then "MAYA IS THE MAIN WAY TO PAY" and "BDO QR IS NOT AN OPTION — ONLY THE
-- SAFETY ROUTE WHEN MAYA IS OFF"): with the switch on, the pay page is Maya
-- (QR Ph, Apple Pay / Google Pay, card, ShopeePay); the BDO QR appears only
-- when Maya is off, has no keys, or will not open.
--
-- TWO THINGS LAND HERE.
--
-- 1 · `platform_settings.maya_checkout_enabled` — the admin switch "Payers see
--     Maya" at the top of the Maya card on /admin/integrations (its one home,
--     DECISION_LOG v2 drawing row), in the shape of the `*_enabled` switches
--     (migration 20271028100000). DEFAULT FALSE: applying this changes
--     nothing a payer sees. It replaces the build-time NEXT_PUBLIC_MAYA_STATUS
--     gate — the switch AND present keys is the gate (lib/maya-checkout.ts).
--
-- 2 · `public.maya_checkouts` — one row per Maya checkout we create, so a
--     returning payer and Maya's webhook both find the order the checkout was
--     for, and so ONE Maya payment can only ever be one Setnayan payment
--     (`maya_payment_id` UNIQUE). The shape follows `app_store_purchases`
--     (20271276386641): the money itself is an ordinary `payments` row
--     (channel 'maya', reference = Maya's payment id) approved through the
--     same `approvePaymentCore` path as a manual approval. This table never
--     grants anything on its own.
--
-- 🔑 NOTHING IN THIS TABLE IS TRUSTED BECAUSE A WEBHOOK SAID IT. A row moves
--    to 'approved' only after Maya's own API, called server-side with our
--    SECRET key, confirms PAYMENT_SUCCESS for the exact reference and amount.
--
-- `payments.channel` is TEXT with no CHECK (iteration 0034), so 'maya' needs
-- no constraint change.
--
-- 🔒 maya_checkouts is service_role only: RLS on with no policy, every grant to
--    anon / authenticated revoked (RLS pattern "server-only ledger", the same as
--    app_store_purchases). Nothing here is reachable from a browser.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ALTERs platform_settings, which every page reads: wait at most 5 s for its lock rather than queue every reader.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS maya_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS maya_busy_noticed_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.maya_checkout_enabled IS
  'Admin switch "Payers see Maya" (owner 2026-11-21), set on the Maya card at /admin/integrations. TRUE + both Maya keys = Maya is the pay page (QR Ph, wallet, card, ShopeePay) and the BDO QR is only the safety route; FALSE or a missing key = every payer sees only the BDO QR (lib/maya-checkout.ts). Replaces the build-time NEXT_PUBLIC_MAYA_STATUS gate.';

COMMENT ON COLUMN public.platform_settings.maya_busy_noticed_at IS
  'When the admins were last told Maya would not open (payers sent to the BDO QR). One notice per outage window: lib/maya-busy.server.ts claims it with a conditional UPDATE.';

-- Defensive re-assert (table-level; the new column inherits these).
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.maya_checkouts (
  -- Maya's checkoutId (a UUID string), returned by POST /checkout/v1/checkouts.
  checkout_id              TEXT PRIMARY KEY CHECK (length(checkout_id) BETWEEN 1 AND 64),
  order_id                 UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- What we sent Maya as requestReferenceNumber: the order's reference_code.
  request_reference_number TEXT NOT NULL CHECK (length(request_reference_number) BETWEEN 1 AND 36),
  -- The order total we asked Maya to collect. The payer pays this EXACTLY.
  amount_php               NUMERIC(12,2) NOT NULL CHECK (amount_php > 0),
  environment              TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  status                   TEXT NOT NULL DEFAULT 'created'
                             CHECK (status IN ('created', 'approved', 'queued', 'failed', 'cancelled', 'expired')),
  -- Filled once Maya's API has been asked about this checkout.
  maya_payment_id          TEXT CHECK (maya_payment_id IS NULL OR length(maya_payment_id) BETWEEN 1 AND 64),
  payment_id               UUID REFERENCES public.payments(payment_id) ON DELETE SET NULL,
  -- How Maya says it was paid (its fundSource), for the payer's receipt row.
  paid_with                TEXT CHECK (paid_with IS NULL OR length(paid_with) <= 80),
  -- Why a verified payment went to the admin queue instead of approving.
  outcome_reason           TEXT CHECK (outcome_reason IS NULL OR length(outcome_reason) <= 500),
  verified_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.maya_checkouts IS
  'One row per Maya Checkout session (owner 2026-11-21). maya_payment_id UNIQUE = one Maya payment is one Setnayan payment. The money is an ordinary payments row (channel maya, reference = Maya payment id) approved through approvePaymentCore only after Maya''s API confirms it. service_role only (20271356998019).';

CREATE UNIQUE INDEX IF NOT EXISTS maya_checkouts_maya_payment_id_uniq
  ON public.maya_checkouts (maya_payment_id)
  WHERE maya_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS maya_checkouts_order_idx
  ON public.maya_checkouts (order_id, created_at DESC);

-- RLS AT CREATE TABLE — and no policy: service_role only.
ALTER TABLE public.maya_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.maya_checkouts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.maya_checkouts TO service_role;

COMMIT;
