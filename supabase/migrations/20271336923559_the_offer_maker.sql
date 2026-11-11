-- the_offer_maker
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- 🏷 THE OFFER MAKER — Shop › Offers (Build 6 · Lane D; owner 9 Nov 2026 "Offer maker",
-- "We want to mix them all", 10 Nov "service cards can receive multiple offer templates. but only
-- the best offer will show", 11 Nov "our offer maker already solves this" [the off-season offer]).
-- Approved prototype: Setnayan-specs prototypes/shop_discounts_bundle_card_open_2026-11-09/
-- discount-maker.html (artifact 1fdSN1HRkYWm1nfbpYRteh).
--
-- WHY A NEW TABLE AND NOT MORE COLUMNS ON vendor_service_discounts (Rule 0, measured):
--   · every vendor_service_discounts row belongs to ONE card (vendor_service_id NOT NULL), and
--   · save_vendor_service() REPLACES ALL of a card's discount rows on every card save
--     (DELETE … WHERE vendor_service_id = p_service_id, then re-insert what the form sent).
--   An offer is ONE row for the SHOP — one name · one Who · one How long · one switch — that reaches
--   "All cards" or the cards picked. Stored per card it would be N rows that a card save deletes.
--   The per-card rows keep working exactly as today (the Card Maker lane retires them); couples see the
--   single best of BOTH, decided in ONE function (`pickBestDiscount`, lib/vendor-service-public.ts),
--   which reads these offers projected onto the cards they reach (lib/offers.ts → offerCandidatesFor).
--
-- THE FIVE QUESTIONS → THE COLUMNS
--   1 Name                → name
--   2 Which cards?        → reaches_all, or rows in vendor_offer_cards (one per card picked)
--   3 What do they get?   → pct_off (off the card price, FIRST) · php_off (off what is left) ·
--                           first_payment + first_payment_unit (a lower first payment: the price stays) ·
--                           gift_mode + gifts (own add-ons · Setnayan gifts · a typed gift)
--   4 Who gets it?        → who: everyone · early_bird (min_lead_months) · first_n (first_n_cap) ·
--                           season (season_from–season_to = the EVENT's date — the off-season offer) ·
--                           returning
--   5 How long?           → until_date: the last day a couple can BOOK with it; NULL = until switched off
--   The list's switch     → is_on
--
-- NO NUMBER HERE GOVERNS MONEY. Nothing below types a rate, a fee or a limit: the gift limit is the
-- admin's live gift_limit_pct of the live booking fee (lib/shop-gifts.ts), read at the moment of use.
--
-- RLS (canonical, copied from vendor_service_discounts / vendor_service_addons — no invented pattern), every policy
-- TO authenticated (a policy with no TO clause is PUBLIC, i.e. anon too — and anon holds no grant on these tables):
--   public read  — authenticated, the shop is published and the offer is switched on;
--   vendor all   — the shop's own members (current_vendor_profile_ids);
--   admin all    — console admins.
-- ============================================================================

-- ============================================================================
-- 1 · vendor_offers — one row per offer, for the whole shop
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_offers (
  id                  BIGSERIAL PRIMARY KEY,
  public_id           TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('D'),
  vendor_profile_id   UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- 1 · Name, as couples read it.
  name                TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- 2 · Which cards? TRUE = every card of the shop, now and later; FALSE = vendor_offer_cards.
  reaches_all         BOOLEAN NOT NULL DEFAULT TRUE,
  -- 3 · What do they get? Any mix. % comes off the card price first, then the ₱ off what is left.
  pct_off             NUMERIC CHECK (pct_off IS NULL OR (pct_off > 0 AND pct_off < 100)),
  php_off             NUMERIC CHECK (php_off IS NULL OR php_off > 0),
  first_payment       NUMERIC CHECK (first_payment IS NULL OR first_payment > 0),
  first_payment_unit  TEXT NOT NULL DEFAULT 'php' CHECK (first_payment_unit IN ('php', 'pct')),
  gift_mode           TEXT NOT NULL DEFAULT 'same' CHECK (gift_mode IN ('same', 'per')),
  -- [{ kind:'addon', addon_id, card? } | { kind:'sn', code, card? } | { kind:'typed', label, worth_php?, card? }]
  -- `card` (a vendor_service_id) is set only when gift_mode = 'per'. Validated by the one writer
  -- (app/vendor-dashboard/offers/actions.ts → parseOfferGifts).
  gifts               JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(gifts) = 'array'),
  -- 4 · Who gets it?
  who                 TEXT NOT NULL DEFAULT 'everyone'
                      CHECK (who IN ('everyone', 'early_bird', 'first_n', 'season', 'returning')),
  min_lead_months     INT CHECK (min_lead_months IS NULL OR min_lead_months BETWEEN 1 AND 600),
  first_n_cap         INT CHECK (first_n_cap IS NULL OR first_n_cap >= 1),
  first_n_taken       INT NOT NULL DEFAULT 0 CHECK (first_n_taken >= 0),
  season_from         DATE,
  season_to           DATE,
  -- 5 · How long does it run? The last day a couple can book with it. NULL = until switched off.
  until_date          DATE,
  -- The list's switch.
  is_on               BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A % first payment is a share of the price, never 100% or more.
  CONSTRAINT vendor_offers_first_payment_pct CHECK (first_payment_unit = 'php' OR first_payment IS NULL OR first_payment < 100),
  -- Each Who carries its own answer, and only that one.
  CONSTRAINT vendor_offers_early_bird_months CHECK ((who = 'early_bird') = (min_lead_months IS NOT NULL)),
  CONSTRAINT vendor_offers_first_n_cap CHECK ((who = 'first_n') = (first_n_cap IS NOT NULL)),
  CONSTRAINT vendor_offers_season_window CHECK (
    (who = 'season') = (season_from IS NOT NULL AND season_to IS NOT NULL)
    AND (season_from IS NULL OR season_to IS NULL OR season_from <= season_to)
  )
);

CREATE INDEX IF NOT EXISTS vendor_offers_vendor_idx
  ON public.vendor_offers (vendor_profile_id, sort_order);

ALTER TABLE public.vendor_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_offers_public_read ON public.vendor_offers;
CREATE POLICY vendor_offers_public_read
  ON public.vendor_offers FOR SELECT
  TO authenticated
  USING (
    is_on = TRUE
    AND vendor_profile_id IN (SELECT vendor_profile_id FROM public.vendor_profiles WHERE is_published = TRUE)
  );

DROP POLICY IF EXISTS vendor_offers_vendor_all ON public.vendor_offers;
CREATE POLICY vendor_offers_vendor_all ON public.vendor_offers
  FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_offers_admin_all ON public.vendor_offers;
CREATE POLICY vendor_offers_admin_all ON public.vendor_offers
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_console_admin()))
  WITH CHECK ((SELECT public.is_console_admin()));

-- Never an anonymous surface: the public read is TO authenticated, and the couples' pages read offers with the service
-- role (lib/offers.server.ts). This closes the default table grant to anon too.
REVOKE ALL ON public.vendor_offers FROM anon;
REVOKE ALL ON SEQUENCE public.vendor_offers_id_seq FROM anon;

COMMENT ON TABLE public.vendor_offers IS
  'Shop › Offers (the Offer Maker, Build 6 Lane D, owner 2026-11-09/10/11). One row per offer for the whole shop: name · which cards (reaches_all or vendor_offer_cards) · what they get (pct_off then php_off · a lower first_payment · gifts) · who (everyone · early_bird · first_n · season = the EVENT date window, the off-season offer · returning) · until_date (last day to book; NULL = until switched off) · is_on. Couples see only the single best price result on a card — never stacked — decided in pickBestDiscount (lib/vendor-service-public.ts), which reads these offers projected onto each card beside the per-card vendor_service_discounts rows. Display only: the quote is where a price is agreed, and a sent quote or a booking keeps what it got.';
COMMENT ON COLUMN public.vendor_offers.first_n_taken IS
  'How many couples have taken a "first N" offer. Starts at 0 and nothing writes it yet: the booking path that records which offer a couple booked with is not built (named in the Offer Maker PR). Until then a first-N offer reads "N of N left".';
COMMENT ON COLUMN public.vendor_offers.season_from IS
  'Who gets it → "Event date in a season": the first day of the EVENT window (not when couples book — that is until_date). The Offer Maker pre-suggests it from the shop''s slow months (lib/vendor-lean-months.ts).';

-- ============================================================================
-- 2 · vendor_offer_cards — "The cards I pick": one row per card an offer reaches
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_offer_cards (
  vendor_offer_id    BIGINT NOT NULL REFERENCES public.vendor_offers(id) ON DELETE CASCADE,
  vendor_service_id  UUID NOT NULL
                     REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  -- Denormalized owner (mirrors vendor_service_addons) so RLS scopes without a join.
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_offer_id, vendor_service_id)
);

CREATE INDEX IF NOT EXISTS vendor_offer_cards_service_idx
  ON public.vendor_offer_cards (vendor_service_id);
CREATE INDEX IF NOT EXISTS vendor_offer_cards_vendor_idx
  ON public.vendor_offer_cards (vendor_profile_id);

ALTER TABLE public.vendor_offer_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_offer_cards_public_read ON public.vendor_offer_cards;
CREATE POLICY vendor_offer_cards_public_read
  ON public.vendor_offer_cards FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT vendor_profile_id FROM public.vendor_profiles WHERE is_published = TRUE)
    AND vendor_service_id IN (SELECT vendor_service_id FROM public.vendor_services WHERE is_active = TRUE)
  );

DROP POLICY IF EXISTS vendor_offer_cards_vendor_all ON public.vendor_offer_cards;
CREATE POLICY vendor_offer_cards_vendor_all ON public.vendor_offer_cards
  FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_offer_cards_admin_all ON public.vendor_offer_cards;
CREATE POLICY vendor_offer_cards_admin_all ON public.vendor_offer_cards
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_console_admin()))
  WITH CHECK ((SELECT public.is_console_admin()));

REVOKE ALL ON public.vendor_offer_cards FROM anon;

-- 🔒 An offer only ever reaches ITS OWN shop's cards. RLS checks the row's vendor_profile_id; this
-- checks that the offer and the card belong to that same shop (a shop can never put its offer on
-- another shop's card, however the row is written).
CREATE OR REPLACE FUNCTION public.vendor_offer_cards_same_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_offers o
     WHERE o.id = NEW.vendor_offer_id AND o.vendor_profile_id = NEW.vendor_profile_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.vendor_services s
     WHERE s.vendor_service_id = NEW.vendor_service_id AND s.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'An offer can only reach its own shop''s cards'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_offer_cards_same_shop ON public.vendor_offer_cards;
CREATE TRIGGER vendor_offer_cards_same_shop
  BEFORE INSERT OR UPDATE ON public.vendor_offer_cards
  FOR EACH ROW EXECUTE FUNCTION public.vendor_offer_cards_same_shop();

COMMENT ON TABLE public.vendor_offer_cards IS
  'The cards a vendor_offers row reaches when it is "The cards I pick" (reaches_all = FALSE). Same-shop enforced by trigger vendor_offer_cards_same_shop. Offer Maker, Build 6 Lane D.';
