-- claim_merges_onto_an_existing_shop_row
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE + REVOKE/GRANT).
-- ============================================================================
-- A SHOP THE COUPLE SAVED FROM FIND *AND* TYPED IN BY HAND CAN STILL CLAIM
-- THE COUPLE'S LINK — THE RECORD MERGES ONTO THE EXISTING ROW.
--
-- Owner, 2026-10-12 ("fix the problems", via the controller): the claim must not
-- fail on the one-marketplace-row-per-shop-per-event rule
-- (`event_vendors_unique_marketplace_pick_per_event`, live rows only); merge
-- onto the existing row and keep the earliest sourced fact.
--
-- Until now `applyClaimAutoLink` set `marketplace_vendor_id` on the couple's
-- hand-typed record; when the same shop was already on the event as a live
-- marketplace row (a save from Find), that UPDATE raised 23505 and the supplier
-- met "Couldn't finish connecting." on the claim they had just signed up for.
--
-- `claim_link_record_to_shop(record, shop)` does the link in ONE transaction:
--   · no other live row of the shop on this event → the record itself is linked
--     (the shipped behaviour, with the same null-or-same-shop guard);
--   · otherwise the record MERGES ONTO that existing row (the survivor):
--       – the survivor takes the record's `manual_vendor_id` (the couple's own
--         contact card) and, only where it has none, the record's agreed price,
--         inclusions and "also covers";
--       – every row that pointed at the record (its claim link, its payments,
--         plan, line items, meetings …) is re-pointed to the survivor — each
--         table in its own sub-block, so one that refuses (a unique clash, a
--         guard) stays on the record instead of failing the claim;
--       – the record is ARCHIVED, never deleted: it is history, and the
--         survivor's own `created_at` + `source` (the save from Find) is the
--         earliest sourced fact, which `booking_fee_attribution_for` reads.
--   ⚖ The record's STATUS does not move onto the survivor: a booking the couple
--     marked by hand does not hold the supplier's date before the supplier
--     agrees (owner 2026-10-10, "it reads asking") — the survivor keeps its own.
-- Service role only (the claim runs on the admin client).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_link_record_to_shop(
  p_record_vendor_id UUID,
  p_vendor_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec      RECORD;
  v_survivor RECORD;
  v_fk       RECORD;
BEGIN
  SELECT vendor_id, event_id, manual_vendor_id, marketplace_vendor_id,
         total_cost_php, host_inclusions, covers_plan_groups
    INTO v_rec
    FROM public.event_vendors
   WHERE vendor_id = p_record_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_link_record_to_shop: record % not found', p_record_vendor_id;
  END IF;
  -- The re-point guard of the shipped claim: a record already bonded to a
  -- DIFFERENT shop is never taken over.
  IF v_rec.marketplace_vendor_id IS NOT NULL AND v_rec.marketplace_vendor_id <> p_vendor_profile_id THEN
    RAISE EXCEPTION 'claim_link_record_to_shop: record is already linked to another shop';
  END IF;

  SELECT vendor_id, manual_vendor_id, total_cost_php, host_inclusions, covers_plan_groups
    INTO v_survivor
    FROM public.event_vendors
   WHERE event_id = v_rec.event_id
     AND marketplace_vendor_id = p_vendor_profile_id
     AND vendor_id <> p_record_vendor_id
     AND archived_at IS NULL
     AND package_role IS DISTINCT FROM 'covered'
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.event_vendors
       SET marketplace_vendor_id = p_vendor_profile_id
     WHERE vendor_id = p_record_vendor_id;
    RETURN p_record_vendor_id;
  END IF;

  -- ── MERGE onto the survivor ──────────────────────────────────────────────
  UPDATE public.event_vendors s
     SET manual_vendor_id   = COALESCE(s.manual_vendor_id, v_rec.manual_vendor_id),
         total_cost_php     = COALESCE(s.total_cost_php, v_rec.total_cost_php),
         host_inclusions    = CASE
                                WHEN cardinality(s.host_inclusions) = 0 THEN v_rec.host_inclusions
                                ELSE s.host_inclusions
                              END,
         covers_plan_groups = CASE
                                WHEN cardinality(s.covers_plan_groups) = 0
                                THEN v_rec.covers_plan_groups
                                ELSE s.covers_plan_groups
                              END
   WHERE s.vendor_id = v_survivor.vendor_id;

  -- Every single-column foreign key that points at event_vendors(vendor_id):
  -- what hung off the record now hangs off the survivor. One table at a time,
  -- so a refusal leaves that table's rows on the (archived) record.
  FOR v_fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.event_vendors'::regclass
       AND c.conrelid <> 'public.event_vendors'::regclass
       AND cardinality(c.conkey) = 1
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
        USING v_survivor.vendor_id, p_record_vendor_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'claim_link_record_to_shop: % stayed on the record (%)', v_fk.tbl, SQLERRM;
    END;
  END LOOP;

  UPDATE public.event_vendors
     SET archived_at = COALESCE(archived_at, now())
   WHERE vendor_id = p_record_vendor_id;

  RETURN v_survivor.vendor_id;
END;
$$;

COMMENT ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) IS
  'Links a couple''s hand-typed record to the shop that claimed its link. If the shop already has a live row on the event '
  '(a save from Find), the record MERGES onto that row (its contact card, price/inclusions/covers where the row has none, '
  'and every row pointing at it) and is archived — the survivor keeps the earliest sourced fact. Status never moves (a '
  'hand "booked" does not hold the supplier''s date). Returns the vendor_id that now carries the booking. Service role only.';

REVOKE ALL ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_link_record_to_shop(UUID, UUID) TO service_role;

COMMIT;
