-- vendor_papic_portfolio_credits_ledger_and_pack_sku
-- ============================================================================
-- VENDOR-PORTFOLIO PAPIC — the ledger and the price (owner rulings 2026-09-05).
--
-- Owner, verbatim: "vendors get 5% of the amount they paid for on booking fee.
-- so if they paid 1000 pesos for the booking fee, they get 50 papic credits for
-- that event. if they import a user and get to sync with them for free. they pay
-- 500 pesos for 25 papic credits. since they did not pay for booking fee, they
-- only pay for the photo importation fee for their portfolio."
--   · cap: "minimum of 1000" → confirmed as the MAXIMUM per event.
--   · when: "when we approve the payment" → written by lib/sku-activation.ts on
--     admin approval; never at submission, never self-reported.
--   · "replace it." → this SUPERSEDES the 2026-08-26 ₱5/point allowance
--     (retired in code in the same PR). Recorded in DECISION_LOG as a reversal.
--   · "base it all from the supplier's shots per event not from what the host
--     gives them." → ONE meter per (vendor, event), the supplier's own. It is a
--     DIFFERENT ledger from the couple's pool (papic_event_point_grants): a
--     supplier grant here never reaches papic_event_pool_status, and a db test
--     proves it (tests/db/vendor-papic-credits-are-the-suppliers.db.test.ts).
--
-- TWO parts:
--   1. vendor_papic_portfolio_credit_grants — append-only, always positive, one
--      row per approved order / admin grant. Same shape as
--      event_render_credit_grants (migration slug
--      moodboard_render_credits_ledger_and_the_one_pack_sku): partial UNIQUE on
--      (order_id, source) makes fulfilment idempotent; `source` has NO DEFAULT
--      because every writer must name where the credits came from. The spend
--      side is NOT a new table: the supplier's captures (vendor_papic_captures,
--      1 point per photo, 8 per clip) are already the meter the capture route
--      charges, and a second counter would be a second source of truth for one
--      balance.
--   2. The flat pack SKU in vendor_billing_catalog — ₱500 → 25 credits, per
--      event. price_php is admin-managed at /admin/pricing and deliberately NOT
--      overwritten on conflict. Read the table for the price, never this file.
--
-- ⚠ vendor_papic_capture_grants (the per-(vendor,event) TIER row, UNIQUE on the
-- pair) is NOT this ledger and is untouched: it holds one allowance row, not a
-- history of grants, so a second pack for the same event has nowhere to land
-- there. That is why a table was born rather than a `source` value added.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS / IF EXISTS everywhere.
-- ============================================================================

BEGIN;

-- ── 1 · the grant ledger ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_papic_portfolio_credit_grants (
  grant_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- CHECKs are NAMED: the Ugat schema-claims guard asserts them by name.
  credits           INTEGER NOT NULL
                      CONSTRAINT vendor_papic_portfolio_credit_grants_credits_positive
                      CHECK (credits > 0),
  -- No DEFAULT on purpose: a default is a write nobody made. Every writer says
  -- which of the owner's two doors the credits came through.
  source            TEXT NOT NULL
                      CONSTRAINT vendor_papic_portfolio_credit_grants_source_allowed
                      CHECK (source IN ('booking_fee', 'pack_order', 'admin', 'comp', 'migration')),
  order_id          UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_papic_portfolio_credit_grants_ve_idx
  ON public.vendor_papic_portfolio_credit_grants (vendor_profile_id, event_id, created_at DESC);

-- One grant per (paid order, source): a re-approved order cannot double-grant,
-- and a booking-fee order that also carried something else could not collide
-- with it. Partial: admin/comp grants carry no order_id and may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_papic_portfolio_credit_grants_order_source_unique
  ON public.vendor_papic_portfolio_credit_grants (order_id, source)
  WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.vendor_papic_portfolio_credit_grants IS
  'Append-only grant side of a SUPPLIER''s Papic credits for ONE event (owner '
  '2026-09-05: 5% of the booking fee paid, cap 1,000, no floor; or the ₱500/25 '
  'pack). Written only on admin payment approval (lib/sku-activation.ts). Spend '
  'side = vendor_papic_captures points, the same meter the capture route '
  'charges. A different ledger from the couple''s pool (papic_event_point_grants) '
  'by design. Partial UNIQUE on (order_id, source) makes fulfilment idempotent.';

ALTER TABLE public.vendor_papic_portfolio_credit_grants ENABLE ROW LEVEL SECURITY;

-- The supplier reads their own ledger (a balance nobody can read is the
-- invisible-state failure); admin reads all. There is deliberately NO write
-- policy — a supplier granting itself credits is the one thing this table must
-- make impossible. Writes are service-role only.
DROP POLICY IF EXISTS vendor_papic_portfolio_credit_grants_vendor_read
  ON public.vendor_papic_portfolio_credit_grants;
CREATE POLICY vendor_papic_portfolio_credit_grants_vendor_read
  ON public.vendor_papic_portfolio_credit_grants
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  );

-- Supabase grants ALL on every new public table to anon + authenticated and
-- publishes it as REST. RLS is row-level and cannot hide a capability; take the
-- capability away. (tests/db/anon-table-grants-closed.db.test.ts)
REVOKE ALL ON TABLE public.vendor_papic_portfolio_credit_grants FROM anon;
-- TRIGGER is in this list on purpose: the default grant includes it, and a
-- session role that can attach a trigger to a credit ledger can rewrite it.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_papic_portfolio_credit_grants FROM authenticated;

-- ── 2 · the pack SKU · ₱500 → 25 credits, per event ───────────────────────────
-- 'vendor_addon_per_event' already exists in the offering_type CHECK (added by
-- migration slug vendor_photo_challenge_sku). display_order 86 follows the 3D
-- Booth (85). The credit COUNT (25) is not a catalog column — the shape CHECK
-- forbids token_grant_count outside 'token_pack', and tokens are retired — so it
-- lives beside the rate in lib/vendor-papic-credits.ts, cited to the owner.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_papic_portfolio_pack',
   'Photo importation fee — 25 Papic credits for your portfolio (per event)',
   500.00, 'vendor_addon_per_event', NULL, NULL, NULL, 86)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

COMMIT;
