-- ═══════════════════════════════════════════════════════════════════════════
-- A BUNDLE CARRIES ITS CARDS AND A GIFT — the bundle maker's two missing facts.
--
-- Owner, 7 Nov 2026 (DECISION_LOG "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS
-- FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES"): the bundle maker
-- (`package-editor.tsx`) is built from SERVICE CARDS first, as locked lines,
-- and gets the card's GIFT row — "bundle: NEW (no gift in the shipped bundle)".
-- And on the makers: "where are the gifts?". The ruling's own note: "gift
-- columns are migrations and ship alone."
--
-- RULE 0 — a flag beats new schema. Checked first, and neither fact has a home:
--   • `vendor_packages` carries no gift of any kind (origin/main 522574564f).
--     The card's yes/no lives on `vendor_services.includes_setnayan_gift`
--     (20271216515644) — a card column, not a package one.
--   • `vendor_packages.vendor_service_id` (20271159436100) names the ONE card a
--     package was minted FOR by the card maker's ★ Customization step. A bundle
--     holds SEVERAL cards, so that single column cannot say which lines are
--     cards; and `vendor_package_items` has no link to a card at all. Without
--     one, a saved bundle cannot reopen with its card lines locked — they would
--     come back as ordinary typed lines.
--
-- So, three columns and one guard. Nothing is computed, billed or granted here.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ WHAT THIS DOES NOT DO — said here so nobody reads a column as a promise kept
--
-- The Setnayan gift on a CARD reaches the couple through
-- `setnayan_gift_offered_on(event_vendor_id)` (20271222508050 and its later
-- re-definitions), which reads `event_vendors.service_id → vendor_services`.
-- A bundle lock cascades SEVERAL `event_vendors` rows, so "is the gift once per
-- bundle or once per cascaded row" is a MONEY RULING nobody has made. This
-- migration does NOT touch that function. A shop gift pack on a bundle likewise
-- has no delivery door yet (shop packs reach a couple only through quote lines,
-- `supplier_gifts_stock_quote_lines_and_delivery`). Both are surfaced to the
-- owner in the PR, not decided here.
--
-- ───────────────────────────────────────────────────────────────────────────
-- RLS AND GRANTS — checked, not assumed.
-- `vendor_packages` and `vendor_package_items` have RLS enabled at CREATE TABLE
-- (20260604110000) with row-scoped policies (public read of active packages,
-- owner write). New columns inherit them; no policy is added or changed. Neither
-- table carries a per-column GRANT allowlist (no `GRANT SELECT (` on either in
-- any migration), so the columns are readable the moment they exist.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) The bundle's gift: the SAME two choices the card's Gift row offers ───
--
-- `includes_setnayan_gift` — named exactly as the card's column on purpose, so
-- one reader can ask one question of either. DEFAULT FALSE and never inferred:
-- on a card this boolean is a money event for the supplier (20271216515644).
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS includes_setnayan_gift BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_packages.includes_setnayan_gift IS
  'The bundle''s Gift row set to "Setnayan gift" — the same yes/no as vendor_services.includes_setnayan_gift. '
  'Stored only: added 2026-11-07 by the bundle maker. Whether a bundle lock bills and grants it (once per bundle, '
  'or once per cascaded event_vendors row) is an owner money ruling not yet made; setnayan_gift_offered_on() does '
  'not read this column.';

-- `gift_pack_code` — one of the shop's OWN gift packs (lib/shop-gifts.ts): a
-- `platform_retail_catalog_v2.service_code` that can be gifted. The CHECK is
-- the same three kinds `shopGiftKindOf` accepts — a Papic pack
-- (PAPIC_GUEST / PAPIC_GUEST_<rung>), Event Plus (EVENT_PLUS) or Event Pro
-- (COUPLE_WEBSITE_PRO) — so a free-text product can never be stored here.
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS gift_pack_code TEXT;

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_gift_pack_code_ck;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_gift_pack_code_ck
  CHECK (
    gift_pack_code IS NULL
    OR gift_pack_code ~ '^PAPIC_GUEST(_[A-Z0-9]+)?$'
    OR gift_pack_code IN ('EVENT_PLUS', 'COUPLE_WEBSITE_PRO')
  );

-- ONE gift per bundle — the Gift row is one dropdown: No gift · Setnayan gift ·
-- a shop pack. Two at once is a shape the maker can never draw.
ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_one_gift_ck;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_one_gift_ck
  CHECK (NOT (includes_setnayan_gift AND gift_pack_code IS NOT NULL));

COMMENT ON COLUMN public.vendor_packages.gift_pack_code IS
  'The bundle''s Gift row set to one of the shop''s own gift packs (lib/shop-gifts.ts: a PAPIC_GUEST* pack, '
  'EVENT_PLUS or COUPLE_WEBSITE_PRO), or NULL. Mutually exclusive with includes_setnayan_gift. Stored only: added '
  '2026-11-07 by the bundle maker; no delivery door reads it yet (shop packs reach a couple through quote lines).';

-- ── 2) Which lines are service CARDS ────────────────────────────────────────
--
-- NULLABLE and ON DELETE SET NULL, like vendor_packages.vendor_service_id: a
-- typed extra inclusion belongs to no card, and deleting a card must never
-- delete a line a couple may have locked — the line keeps its words and its
-- canonical_service, it only stops being shown as that card.
ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_package_items.vendor_service_id IS
  'The service CARD this bundle line is (the bundle maker''s locked card lines, 2026-11-07), or NULL for a typed '
  'extra inclusion. ON DELETE SET NULL: deleting a card keeps the line. 🔒 trg_vendor_package_item_service_same_owner '
  'refuses a card of another shop — an FK is not a permission.';

CREATE INDEX IF NOT EXISTS vendor_package_items_vendor_service_id_idx
  ON public.vendor_package_items (vendor_service_id)
  WHERE vendor_service_id IS NOT NULL;

-- ── 3) The ownership guard — the line is yours, the card must be too ───────
--
-- Mirrors vendor_package_service_same_owner() (20271159436100): SECURITY
-- DEFINER so it can see a card the caller's RLS would hide (a guard that cannot
-- see what it checks passes by accident); INSERT and UPDATE both, because
-- savePackage replaces items by delete-then-insert.
CREATE OR REPLACE FUNCTION public.vendor_package_item_service_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_service_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.vendor_packages vp
      JOIN public.vendor_services vs
        ON vs.vendor_profile_id = vp.vendor_profile_id
     WHERE vp.package_id = NEW.package_id
       AND vs.vendor_service_id = NEW.vendor_service_id
  ) THEN
    RAISE EXCEPTION
      'vendor_package_items.vendor_service_id must name a service card owned by the package''s own shop'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_package_item_service_same_owner()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_package_item_service_same_owner() IS
  'Refuses a vendor_package_items.vendor_service_id that names another shop''s service card. vendor_package_items '
  'is writable by the package''s owner through PostgREST, so without this a bundle could list a competitor''s card '
  'as one of its locked lines. NULL is always allowed (a typed extra inclusion).';

DROP TRIGGER IF EXISTS trg_vendor_package_item_service_same_owner ON public.vendor_package_items;
CREATE TRIGGER trg_vendor_package_item_service_same_owner
  BEFORE INSERT OR UPDATE OF vendor_service_id, package_id
  ON public.vendor_package_items
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_package_item_service_same_owner();
