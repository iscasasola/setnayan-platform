-- shop_papic_wallet_ledger_and_the_shop_pack
-- ============================================================================
-- THE SHOP WALLET — one Papic-credit balance per SHOP (owner, 2026-10-23).
--
-- Owner, 23 Oct, on the prototype `shop_wallet_portfolio_credits_2026-10-23`:
-- **option A, ONE SHOP WALLET.** Packs go into one shop balance, spendable on
-- the shop's portfolio or on any event the shop is booked on. The 50-credit
-- event gift and the booking-fee credits STAY WITH THEIR EVENT (they live in
-- `vendor_papic_portfolio_credit_grants`, which this migration does not touch).
--
-- TWO parts:
--   1. `shop_papic_wallet_entries` — append-only, SIGNED. A pack lands as a
--      positive row; a spend (portfolio photo past the free 50, or an event
--      shot after that event's own credits ran out) leaves as a negative row;
--      a refunded pack is taken back as a negative `reversal` row. The balance
--      is the SUM, and nothing else holds it — one ledger, one home.
--        · a pack lands once per order: partial UNIQUE (order_id, kind);
--        · a spend lands once per thing it paid for: partial UNIQUE
--          (vendor_profile_id, spend_ref) — a retried Save or a re-sent
--          shutter cannot charge twice;
--        · the SIGN is tied to the kind by a named CHECK, so a "spend" can
--          never mint and a "pack" can never drain.
--      `shop_papic_wallet_spend` is the ONLY door a spend takes: it locks the
--      shop, re-reads the balance under the lock and refuses what the balance
--      cannot cover — so two devices spending the last credit at once cannot
--      both win. Service-role only; the route/action that calls it runs the
--      gates SQL cannot (who you are, which shop, what the file is).
--   2. The pack becomes a SHOP purchase. `vendor_papic_portfolio_pack` was
--      sold "per event" (offering_type 'vendor_addon_per_event') and its
--      credits landed in ONE event. It now lands in the shop wallet, needs no
--      event, and says so in its title. 'vendor_addon_metered' is the existing
--      shop-scoped, non-recurring offering type (the Deep Search add-on uses
--      it); no CHECK is widened. The price is NOT touched — /admin/pricing owns
--      it; read the table, never this file.
--
-- ⚠ A refunded pack can take the balance BELOW ZERO (credits already spent).
-- That is the correct outcome for a reversed order, not a fault: the spend
-- function refuses every spend until a new pack lands.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / IF EXISTS everywhere.
-- ============================================================================

BEGIN;

-- ── 1 · the ledger ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_papic_wallet_entries (
  entry_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "kept while the shop exists": the wallet goes with the shop.
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- CHECKs are NAMED: the Ugat schema-claims guard asserts them by name.
  delta             INTEGER NOT NULL
                      CONSTRAINT shop_papic_wallet_entries_delta_nonzero
                      CHECK (delta <> 0),
  -- No DEFAULT on purpose: a default is a write nobody made.
  kind              TEXT NOT NULL
                      CONSTRAINT shop_papic_wallet_entries_kind_allowed
                      CHECK (kind IN ('pack_order', 'admin', 'comp',
                                      'portfolio_spend', 'event_spend', 'reversal')),
  -- What paid in pays in; what spends spends. A spend can never mint.
  CONSTRAINT shop_papic_wallet_entries_sign_matches_kind CHECK (
    (kind IN ('pack_order', 'admin', 'comp') AND delta > 0)
    OR (kind IN ('portfolio_spend', 'event_spend', 'reversal') AND delta < 0)
  ),
  order_id          UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  -- The thing a spend paid for ('portfolio:<save id>', 'capture:<id>',
  -- 'import:<id>'); NULL on money-in rows.
  spend_ref         TEXT
                      CONSTRAINT shop_papic_wallet_entries_spend_ref_shape
                      CHECK (spend_ref IS NULL OR length(btrim(spend_ref)) > 0),
  -- The event an event spend was for (the sheet groups by it). Nullable: the
  -- portfolio is the shop's, no event is involved.
  event_id          UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  -- What a portfolio spend bought, so the sheet can say "72 photos" and not
  -- guess it from the credits (a clip is 8).
  photos            INTEGER
                      CONSTRAINT shop_papic_wallet_entries_photos_nonneg
                      CHECK (photos IS NULL OR photos >= 0),
  clips             INTEGER
                      CONSTRAINT shop_papic_wallet_entries_clips_nonneg
                      CHECK (clips IS NULL OR clips >= 0),
  note              TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_papic_wallet_entries_shop_idx
  ON public.shop_papic_wallet_entries (vendor_profile_id, created_at DESC);

-- One money-in (or reversal) row per (order, kind): a re-approved pack cannot
-- land twice, and a re-run refund cannot take it back twice.
CREATE UNIQUE INDEX IF NOT EXISTS shop_papic_wallet_entries_order_kind_unique
  ON public.shop_papic_wallet_entries (order_id, kind)
  WHERE order_id IS NOT NULL;

-- One spend per thing it paid for, per shop: the no-double-spend key.
CREATE UNIQUE INDEX IF NOT EXISTS shop_papic_wallet_entries_spend_ref_unique
  ON public.shop_papic_wallet_entries (vendor_profile_id, spend_ref)
  WHERE spend_ref IS NOT NULL;

COMMENT ON TABLE public.shop_papic_wallet_entries IS
  'The SHOP wallet (owner 2026-10-23, option A): one signed, append-only Papic '
  'credit ledger per shop. Packs in (written on admin payment approval by '
  'lib/sku-activation.ts), portfolio spends past the free 50 and event spends '
  'after that event''s own credits ran out go out, a refunded pack is taken back '
  'as a reversal. Balance = SUM(delta). Spends go ONLY through '
  'shop_papic_wallet_spend (locks the shop, refuses what the balance cannot '
  'cover, one spend per spend_ref). The per-event ledger '
  '(vendor_papic_portfolio_credit_grants) is a different pot by design.';

ALTER TABLE public.shop_papic_wallet_entries ENABLE ROW LEVEL SECURITY;

-- The shop reads its own wallet; admin reads all. NO write policy — a shop
-- writing its own balance is the one thing this table must make impossible.
DROP POLICY IF EXISTS shop_papic_wallet_entries_vendor_read
  ON public.shop_papic_wallet_entries;
CREATE POLICY shop_papic_wallet_entries_vendor_read
  ON public.shop_papic_wallet_entries
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

-- RLS is row-level and cannot hide a capability; take the capability away.
-- (tests/db/anon-table-grants-closed.db.test.ts)
REVOKE ALL ON TABLE public.shop_papic_wallet_entries FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_papic_wallet_entries FROM authenticated;

-- ── 1b · the only door a spend takes ─────────────────────────────────────────
-- Returns jsonb:
--   {status:'ok',           balance:<after>, entry_id}
--   {status:'duplicate',    balance:<now>,   entry_id}   — this spend_ref already paid
--   {status:'insufficient', balance:<now>}               — nothing written
--   {status:'invalid'}                                   — bad arguments, nothing written
-- The lock is per SHOP (advisory, transaction-scoped), so the balance read
-- and the insert are one step for every other spender of the same wallet.
CREATE OR REPLACE FUNCTION public.shop_papic_wallet_spend(
  p_vendor_profile_id UUID,
  p_credits           INTEGER,
  p_kind              TEXT,
  p_spend_ref         TEXT,
  p_event_id          UUID    DEFAULT NULL,
  p_photos            INTEGER DEFAULT NULL,
  p_clips             INTEGER DEFAULT NULL,
  p_note              TEXT    DEFAULT NULL,
  p_actor             UUID    DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_balance INTEGER;
  v_entry   UUID;
BEGIN
  IF p_vendor_profile_id IS NULL
     OR p_credits IS NULL OR p_credits <= 0
     OR p_kind IS NULL OR p_kind NOT IN ('portfolio_spend', 'event_spend')
     OR p_spend_ref IS NULL OR length(btrim(p_spend_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_papic_wallet:' || p_vendor_profile_id::text, 0));

  SELECT COALESCE(SUM(e.delta), 0)::INTEGER INTO v_balance
    FROM public.shop_papic_wallet_entries e
   WHERE e.vendor_profile_id = p_vendor_profile_id;

  SELECT e.entry_id INTO v_entry
    FROM public.shop_papic_wallet_entries e
   WHERE e.vendor_profile_id = p_vendor_profile_id
     AND e.spend_ref = p_spend_ref;
  IF v_entry IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'duplicate', 'balance', v_balance, 'entry_id', v_entry);
  END IF;

  IF v_balance < p_credits THEN
    RETURN jsonb_build_object('status', 'insufficient', 'balance', v_balance);
  END IF;

  INSERT INTO public.shop_papic_wallet_entries
    (vendor_profile_id, delta, kind, spend_ref, event_id, photos, clips, note, created_by)
  VALUES
    (p_vendor_profile_id, -p_credits, p_kind, p_spend_ref, p_event_id, p_photos, p_clips, p_note, p_actor)
  RETURNING entry_id INTO v_entry;

  RETURN jsonb_build_object('status', 'ok', 'balance', v_balance - p_credits, 'entry_id', v_entry);
END;
$function$;

COMMENT ON FUNCTION public.shop_papic_wallet_spend(UUID, INTEGER, TEXT, TEXT, UUID, INTEGER, INTEGER, TEXT, UUID) IS
  'The only door a shop-wallet spend takes. Locks the shop, re-reads the balance '
  'under the lock, refuses what it cannot cover, and writes one row per '
  'spend_ref (a repeat answers duplicate and charges nothing). Service-role only.';

REVOKE ALL ON FUNCTION public.shop_papic_wallet_spend(UUID, INTEGER, TEXT, TEXT, UUID, INTEGER, INTEGER, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_papic_wallet_spend(UUID, INTEGER, TEXT, TEXT, UUID, INTEGER, INTEGER, TEXT, UUID)
  TO service_role;

-- ── 1c · the balance, as one number ──────────────────────────────────────────
-- SECURITY INVOKER: RLS decides what the caller can sum. The app only ever
-- asks about the shop it has already resolved as the caller's own, and a
-- failed read is surfaced as "couldn't read", never as 0 (lib/shop-wallet.ts).
CREATE OR REPLACE FUNCTION public.shop_papic_wallet_balance(p_vendor_profile_id UUID)
 RETURNS INTEGER
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(e.delta), 0)::INTEGER
    FROM public.shop_papic_wallet_entries e
   WHERE e.vendor_profile_id = p_vendor_profile_id;
$function$;

REVOKE ALL ON FUNCTION public.shop_papic_wallet_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_papic_wallet_balance(UUID) TO authenticated, service_role;

-- ── 2 · the pack is a SHOP purchase ──────────────────────────────────────────
-- Title quotes the credits the activation hook grants
-- (VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS = 100); the db test reads the live
-- constant against this row. price_php is NOT in the SET list: admin-managed.
UPDATE public.vendor_billing_catalog
   SET title         = 'Papic credit pack — 100 credits for your shop',
       offering_type = 'vendor_addon_metered',
       updated_at    = NOW()
 WHERE sku_code = 'vendor_papic_portfolio_pack';

COMMIT;
