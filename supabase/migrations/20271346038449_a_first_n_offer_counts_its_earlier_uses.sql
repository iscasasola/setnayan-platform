-- a_first_n_offer_counts_its_earlier_uses
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🧾 OWN-01 (W1 re-walk, live 5cbf166 · 14 Nov 2026, money): A "FIRST N COUPLES" OFFER COUNTS ITS EARLIER USES.
--
-- Liwanag's December "first 1 couple" ₱5,000 offer landed on a SECOND couple's quote (S89J-VBT0P4MJPD), an hour after
-- the first (S89J-3YAPVHGQYH). Two halves, both measured:
--   · `vendor_offers.first_n_taken` had NO WRITER — its own column comment says "nothing writes it yet" — so every cap
--     (`offerStatus` in lib/offers.ts, the card's best-discount pick, `apply_dropped_offer`) compared against 0 forever;
--   · a quote started from a service card carries the card's best offer as a typed "Discount" line that named no offer
--     at all, so even a counter had nothing to count.
-- The app now stamps that line `from_offer_id` (an offer's own named line already carries `offer_id`). This migration:
--   1 · USES: an offer's uses are the OTHER couples (events) whose live quote (sent · viewed · accepted) from this shop
--       carries it on a line, as `offer_id` or `from_offer_id` — counted, never typed;
--   2 · REFUSES, BEFORE the row is written, a quote that is newly sent with, or newly gains, a "first N" offer that other
--       couples have already used up (`OFFER_TAKEN`). A quote already carrying it is never refused on a later change —
--       a couple's accepted quote must not become unacceptable because of somebody else's;
--   3 · KEEPS `first_n_taken` TRUE after every change, so every existing reader closes the offer at its cap with no
--       reader edited.
-- ⚠ Quotes sent before this carry no `from_offer_id` and are not counted (both on record are on the owner's test shop).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The offer ids one quote's lines carry (an offer's own line, or a discount filled in from an offer). */
CREATE OR REPLACE FUNCTION public.quote_offer_ids(p_line_items JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.id), '{}')
    FROM (
      SELECT NULLIF(e ->> 'offer_id', '') AS id FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) e
       WHERE jsonb_typeof(COALESCE(p_line_items, '[]'::jsonb)) = 'array'
      UNION ALL
      SELECT NULLIF(e ->> 'from_offer_id', '') FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) e
       WHERE jsonb_typeof(COALESCE(p_line_items, '[]'::jsonb)) = 'array'
    ) x
   WHERE x.id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.quote_offer_ids(JSONB) FROM PUBLIC, anon, authenticated;

/** How many couples (events) have this shop's offer on a live quote — optionally leaving one event out. */
CREATE OR REPLACE FUNCTION public.offer_uses(p_vendor_profile_id UUID, p_offer_public_id TEXT, p_except_event UUID DEFAULT NULL)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(DISTINCT p.event_id)::INT
    FROM public.vendor_proposals p
   WHERE p.vendor_profile_id = p_vendor_profile_id
     AND p.status IN ('sent', 'viewed', 'accepted')
     AND (p_except_event IS NULL OR p.event_id <> p_except_event)
     AND p_offer_public_id = ANY (public.quote_offer_ids(p.line_items));
$$;
REVOKE ALL ON FUNCTION public.offer_uses(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_vendor_proposals_first_n_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_ids TEXT[];
  v_old_ids TEXT[] := '{}';
  v_id      TEXT;
  v_offer   RECORD;
  v_newly_live BOOLEAN;
BEGIN
  IF NEW.status NOT IN ('sent', 'viewed', 'accepted') THEN
    RETURN NEW;
  END IF;
  v_new_ids := public.quote_offer_ids(NEW.line_items);
  IF cardinality(v_new_ids) = 0 THEN
    RETURN NEW;
  END IF;
  v_newly_live := TG_OP = 'INSERT' OR OLD.status NOT IN ('sent', 'viewed', 'accepted');
  IF TG_OP = 'UPDATE' AND NOT v_newly_live THEN
    v_old_ids := public.quote_offer_ids(OLD.line_items);
  END IF;
  FOREACH v_id IN ARRAY v_new_ids LOOP
    -- Only an offer this quote did not already carry while live is judged; one it carried stays, whatever happens.
    CONTINUE WHEN NOT v_newly_live AND v_id = ANY (v_old_ids);
    SELECT o.name, o.who, o.first_n_cap INTO v_offer
      FROM public.vendor_offers o
     WHERE o.public_id = v_id AND o.vendor_profile_id = NEW.vendor_profile_id;
    CONTINUE WHEN NOT FOUND OR v_offer.who IS DISTINCT FROM 'first_n' OR v_offer.first_n_cap IS NULL;
    IF public.offer_uses(NEW.vendor_profile_id, v_id, NEW.event_id) >= v_offer.first_n_cap THEN
      RAISE EXCEPTION 'vendor_proposals: OFFER_TAKEN — "%" was for the first % couple(s), and they have it', v_offer.name, v_offer.first_n_cap
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_vendor_proposals_first_n_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_proposals_first_n_cap ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_first_n_cap
  BEFORE INSERT OR UPDATE OF status, line_items ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_proposals_first_n_cap();

/** After any change, every offer this row carries (before or after) reads its true count. */
CREATE OR REPLACE FUNCTION public.tg_vendor_proposals_offer_taken()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids TEXT[] := '{}';
  v_shop UUID;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    v_ids := v_ids || public.quote_offer_ids(NEW.line_items);
    v_shop := NEW.vendor_profile_id;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    v_ids := v_ids || public.quote_offer_ids(OLD.line_items);
    v_shop := COALESCE(v_shop, OLD.vendor_profile_id);
  END IF;
  IF cardinality(v_ids) > 0 THEN
    UPDATE public.vendor_offers o
       SET first_n_taken = public.offer_uses(o.vendor_profile_id, o.public_id, NULL)
     WHERE o.vendor_profile_id = v_shop
       AND o.public_id = ANY (v_ids)
       AND o.first_n_taken IS DISTINCT FROM public.offer_uses(o.vendor_profile_id, o.public_id, NULL);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_vendor_proposals_offer_taken() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_proposals_offer_taken ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_offer_taken
  AFTER INSERT OR UPDATE OF status, line_items OR DELETE ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_proposals_offer_taken();

-- The count as it stands today (an offer's own `offer_id` lines already on record are real uses).
UPDATE public.vendor_offers o
   SET first_n_taken = public.offer_uses(o.vendor_profile_id, o.public_id, NULL)
 WHERE o.first_n_taken IS DISTINCT FROM public.offer_uses(o.vendor_profile_id, o.public_id, NULL);

COMMENT ON COLUMN public.vendor_offers.first_n_taken IS
  'How many couples have this offer on a live quote (sent · viewed · accepted) from this shop — counted, never typed: kept by the vendor_proposals_offer_taken trigger from the lines that carry it (offer_id, or from_offer_id on a discount filled in from an offer). A "first N" offer cannot newly go on a quote once N other couples have it (vendor_proposals_first_n_cap, OFFER_TAKEN). Migration 20271346038449.';
