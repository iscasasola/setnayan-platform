-- hub_pro_parts_keep_the_old_cap
--
-- ⚖ EVENT HUB PRO PART-HOLDERS KEEP THEIR FULL PRO (owner, 2026-10-28, on PR #7005: "Keep their full Pro").
--
-- Parts that add up to the Full Pro price unlock everything (`hubOwnershipFrom`). Full Pro moved ₱5,000 → ₱6,590
-- (migration 20271293510457_one_price_app_store_equals_website.sql). Parts were sold 22–26 Oct 2026 under the
-- ₱5,000 cap and have been off sale since; an event whose parts reached ₱5,000 must not lose "everything" because
-- the price moved after it paid. New part totals (after the cutover) need the new price.
--
-- 🔑 A GRANDFATHER, NOT A DATA REWRITE. No order is touched. This returns the event's part lines bought BEFORE the
-- cutover, with each line's own status, plus the OLD cap they are measured against. The app decides — the same
-- status rule (`counts`) and part mapping (`hubPartOfPaidCode`) it uses for the live cap — so a refund still takes
-- it back, and a still-submitted order still owns nothing until approved.
--
--   • CAP:     ₱5,000 — the Full Pro price every part was sold under (migration 20271247699024). Typed HERE, in a
--              pipeline migration, because it is a frozen historical fact and never a live price.
--   • CUTOVER: 2026-10-28 16:00 UTC (29 Oct 00:00 PHT) — the day of the ruling. Parts have been refused at checkout
--              since 26 Oct, so every part line that exists was bought under the old cap.
--
-- Service role ONLY — exactly like `event_entitlement_facts`: the order rows are the couple's bill, and the app reads
-- an event's entitlements through the service-role entitlement client (`lib/event-entitlement-client.server.ts`)
-- after it has checked membership. Any other caller gets NULL, and no EXECUTE grant reaches anon or authenticated
-- (`exposure-freeze.db.test.ts`).

CREATE OR REPLACE FUNCTION public.event_hub_pro_legacy_part_lines(p_event_id UUID, p_codes TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_cutover CONSTANT TIMESTAMPTZ := '2026-10-28 16:00:00+00';
  c_cap     CONSTANT NUMERIC     := 5000;
BEGIN
  IF p_event_id IS NULL OR p_codes IS NULL THEN
    RETURN NULL;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'cap_php', c_cap,
    'cutover', c_cutover,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('service_key', l.code, 'status', l.status))
        FROM (
          SELECT o.service_key AS code, o.status::TEXT AS status
            FROM public.orders o
           WHERE o.event_id = p_event_id
             AND o.service_key = ANY (p_codes)
             AND o.created_at < c_cutover
          UNION ALL
          SELECT i.service_code, o.status::TEXT
            FROM public.onboarding_order_items i
            JOIN public.orders o ON o.order_id = i.order_id
           WHERE o.event_id = p_event_id
             AND i.service_code = ANY (p_codes)
             AND o.created_at < c_cutover
        ) l
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.event_hub_pro_legacy_part_lines(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_hub_pro_legacy_part_lines(UUID, TEXT[]) TO service_role;
