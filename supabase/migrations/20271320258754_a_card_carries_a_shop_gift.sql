-- ═══════════════════════════════════════════════════════════════════════════
-- A CARD CARRIES A SHOP GIFT — the third answer of the card's Gift dropdown.
--
-- Owner, 7 Nov 2026 (DECISION_LOG "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS
-- FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES"): "Gift row on both — card: the
-- shipped Setnayan-gift switch becomes one Gift dropdown that also offers the
-- shop's own gifts (lib/shop-gifts.ts, today only on quotes — NEW on cards)".
-- And on the makers: "on service card and bundles where are the gifts?". The
-- ruling's own note: "gift columns are migrations and ship alone."
--
-- RULE 0 — a flag beats new schema. Checked first:
--   • `vendor_services.includes_setnayan_gift` (20271216515644) is a BOOLEAN —
--     it can say "Setnayan gift" or "no gift", never WHICH of the shop's packs.
--     It stays the home of the Setnayan gift, unchanged.
--   • The shop's own packs live on QUOTES only (`supplier_gifts_stock_quote_
--     lines_and_delivery` → quote lines); no column on `vendor_services` names a
--     pack. So the pack needs one column.
--
-- The SAME shape as the bundle maker's column (`vendor_packages.gift_pack_code`,
-- migration `a_bundle_carries_its_cards_and_a_gift`, branch
-- claude/bundle-maker-fix-nov7): the same name, the same CHECK, the same
-- one-gift rule — so one Gift picker reads and writes either table.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ WHAT THIS DOES NOT DO — said here so nobody reads a column as a promise kept
--
-- Nothing is billed, held or delivered from this column. A shop pack reaches a
-- couple only through a QUOTE line (the supplier's "＋ Add a gift"), which takes
-- it out of the shop's stock when the first payment clears. The card offers it;
-- the quote gives it. Carrying the card's pack onto the quote automatically is
-- a follow-up (it touches the quote composer that open PR #7298 is editing).
--
-- RLS AND GRANTS — checked, not assumed. `vendor_services` has RLS enabled at
-- CREATE TABLE with row-ownership policies; the new column inherits them and
-- no policy changes. No per-column GRANT allowlist exists on the table (the
-- publish-gate migration 20271176775619 says `authenticated` holds UPDATE on
-- every column), so the column is readable and writable by the card's owner
-- the moment it exists — the CHECKs below are the fence on WHAT it may hold.
-- `save_vendor_service` is NOT re-defined: the maker writes this column in its
-- own owner-scoped UPDATE around the RPC.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS gift_pack_code TEXT;

-- The same three kinds `shopGiftKindOf` (lib/shop-gifts.ts) accepts: a Papic
-- pack (PAPIC_GUEST / PAPIC_GUEST_<rung>), Event Plus (EVENT_PLUS) or Event Pro
-- (COUPLE_WEBSITE_PRO). A free-text product can never be stored here.
ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_gift_pack_code_ck;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_gift_pack_code_ck
  CHECK (
    gift_pack_code IS NULL
    OR gift_pack_code ~ '^PAPIC_GUEST(_[A-Z0-9]+)?$'
    OR gift_pack_code IN ('EVENT_PLUS', 'COUPLE_WEBSITE_PRO')
  );

-- ONE gift per card — the Gift row is one dropdown: No gift · Setnayan gift ·
-- a shop pack. Every existing row has gift_pack_code NULL, so this cannot fail
-- on apply.
ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_one_gift_ck;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_one_gift_ck
  CHECK (NOT (COALESCE(includes_setnayan_gift, FALSE) AND gift_pack_code IS NOT NULL));

COMMENT ON COLUMN public.vendor_services.gift_pack_code IS
  'The card''s Gift row set to one of the shop''s own gift packs (lib/shop-gifts.ts: a PAPIC_GUEST* pack, '
  'EVENT_PLUS or COUPLE_WEBSITE_PRO), or NULL. Mutually exclusive with includes_setnayan_gift. Added 2026-11-07 '
  'by the card maker. Offered on the card only — a pack is given through a quote line, which moves the stock.';
