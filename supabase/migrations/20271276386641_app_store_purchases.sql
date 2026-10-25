-- ═══════════════════════════════════════════════════════════════════════════
-- 🍎 APP STORE PURCHASES — one row per Apple purchase attempt (In-App Purchase)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Owner, 2026-10-18 (DECISION_LOG "IN-APP PURCHASE — THE FIVE DECISIONS"):
-- Papic credits, Event Hub Pro and Live Watch are sold inside the iPhone app
-- through Apple, each as a CONSUMABLE applied to the CURRENT event.
--
-- WHY A ROW BEFORE APPLE'S SHEET OPENS (the "intent"). Apple's signed
-- transaction says WHAT was bought and by which Apple ID — never for which of
-- our events. StoreKit 2 lets the app attach one UUID to a purchase
-- (`appAccountToken`), and Apple signs it into the transaction. So the app asks
-- our server for a row FIRST (who · which event · which product, checked
-- against event membership), and that row's key IS the token. When Apple's
-- signed transaction arrives — from the app, or from App Store Server
-- Notifications with no session at all — the token names the event.
--
-- IDEMPOTENCY: `transaction_id` is UNIQUE. The same Apple transaction verified
-- twice (the app and the notification racing, a retry, Restore) finds the same
-- row and the same order: one purchase is one order, always.
--
-- MONEY: the order itself is an ordinary `orders` row (platform 'ios') with an
-- ordinary `payments` row (channel 'app_store', reference = Apple's transaction
-- id), switched on by the same activation path the web's admin approval uses.
-- This table never grants anything on its own.
--
-- 🔒 service_role only: RLS on with no policy, every grant to anon /
-- authenticated revoked. The server code in apps/web/lib/iap/ is the only
-- caller; nothing here is reachable from a browser.

CREATE TABLE IF NOT EXISTS public.app_store_purchases (
  -- The StoreKit appAccountToken. Minted here, handed to the app, signed by Apple.
  app_account_token        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  event_id                 UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  product_id               TEXT NOT NULL CHECK (length(product_id) BETWEEN 1 AND 200),
  service_key              TEXT NOT NULL CHECK (length(service_key) BETWEEN 1 AND 200),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Filled once Apple's signed transaction is verified.
  transaction_id           TEXT,
  original_transaction_id  TEXT,
  environment              TEXT CHECK (environment IS NULL OR environment IN ('Production', 'Sandbox')),
  -- Apple's price in milli-units of `currency` (JWSTransactionDecodedPayload.price).
  price_milliunits         BIGINT CHECK (price_milliunits IS NULL OR price_milliunits >= 0),
  currency                 TEXT CHECK (currency IS NULL OR length(currency) = 3),
  purchased_at             TIMESTAMPTZ,
  verified_at              TIMESTAMPTZ,
  order_id                 UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,

  -- Apple refunded or revoked it (App Store Server Notifications v2 · REFUND).
  revoked_at               TIMESTAMPTZ,
  revocation_reason        INTEGER,
  last_notification_type   TEXT CHECK (last_notification_type IS NULL OR length(last_notification_type) <= 64),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_store_purchases IS
  'One row per Apple In-App Purchase attempt. The primary key is the StoreKit appAccountToken minted BEFORE Apple''s sheet opens, so Apple''s signed transaction names the event. transaction_id UNIQUE = one Apple transaction is one order. The order + payment live in orders/payments (platform ios, channel app_store). service_role only (20271276386641).';

CREATE UNIQUE INDEX IF NOT EXISTS app_store_purchases_transaction_id_uniq
  ON public.app_store_purchases (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_store_purchases_order_id_uniq
  ON public.app_store_purchases (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_store_purchases_user_idx
  ON public.app_store_purchases (user_id, created_at DESC);

-- RLS AT CREATE TABLE — and no policy: service_role only.
ALTER TABLE public.app_store_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_store_purchases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_store_purchases TO service_role;
