-- Vendor per-guest delivery scanning (owner 2026-06-28).
--
-- A vendor whose service is delivered per-guest (souvenir/favor vendor, caterer,
-- etc.) scans each guest's personal QR at the event to confirm they received the
-- service. OPERATIONAL ONLY: the vendor sees "delivered" + a count, never any
-- guest PII. Enablement is an EXPLICIT per-service toggle (not derived from the
-- pricing model). Generalizes the couple/coordinator souvenir station (#2361) to
-- the vendor side. Reuses the payments vendor resolver current_vendor_event_vendor_ids().
--
-- (Adversarial-review hardened, same session: confirm/undo also require the
-- toggle; the vendor SELECT policy is intentionally NOT created — the vendor
-- reads counts only through the DEFINER functions, so guest_id never sits behind
-- a vendor-readable policy; qr_token matched case-insensitively.)

-- 1. Per-service toggle. Lives on the vendor-OWNED service row (vendor_services)
--    so the vendor controls it via their own service editor; event_vendors
--    (the booking) is couple-write-only, so it can't host a vendor-set flag.
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS per_guest_delivery BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_services.per_guest_delivery IS
  'Vendor opt-in: this service is delivered per-guest, so its event bookings get a QR scan station to confirm each guest received it (owner 2026-06-28). Operational only — no guest PII surfaced to the vendor.';

-- 2. Per-guest delivery confirmations, keyed to a vendor BOOKING
--    (event_vendors.vendor_id is that table's PK). One row = delivered;
--    undo = DELETE. Mirrors guest_souvenir_claims but vendor-scoped.
CREATE TABLE IF NOT EXISTS public.event_service_deliveries (
  delivery_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL,
  event_vendor_id      UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  guest_id             UUID NOT NULL,
  delivered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  method               TEXT NOT NULL DEFAULT 'qr_scan'
                         CHECK (method IN ('qr_scan', 'manual')),
  UNIQUE (event_vendor_id, guest_id),
  FOREIGN KEY (event_id, guest_id)
    REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.event_service_deliveries IS
  'Per-guest delivery confirmations for a vendor booking (event_vendors). One row = this guest received the service. Vendor-scoped + operational-only (no PII surfaced).';

CREATE INDEX IF NOT EXISTS event_service_deliveries_booking_idx
  ON public.event_service_deliveries (event_vendor_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS event_service_deliveries_event_idx
  ON public.event_service_deliveries (event_id);

ALTER TABLE public.event_service_deliveries ENABLE ROW LEVEL SECURITY;

-- NO vendor SELECT policy on purpose (PII hardening). The vendor reads counts
-- ONLY through the DEFINER functions below, so guest_id / delivered_by_user_id
-- never sit behind a vendor-readable row policy. (Drop defends a prior apply.)
DROP POLICY IF EXISTS event_service_deliveries_vendor_read ON public.event_service_deliveries;

-- Couple + coordinator of the event read their own deliveries (progress view).
DROP POLICY IF EXISTS event_service_deliveries_member_read ON public.event_service_deliveries;
CREATE POLICY event_service_deliveries_member_read
  ON public.event_service_deliveries FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_service_deliveries.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
  );

-- 3. confirm/undo are SECURITY DEFINER so the vendor passes ONLY
--    (event_vendor_id, qr_token): the function gates on booking ownership AND
--    the per_guest_delivery toggle (JOIN vendor_services), resolves the guest by
--    token (case-insensitive), and writes the row. The vendor never needs — and
--    never gets — a direct read on guests (PII boundary) or a write policy on
--    the deliveries table. Returns operational data only (status + count).
CREATE OR REPLACE FUNCTION public.confirm_guest_delivery(
  p_event_vendor_id UUID,
  p_qr_token        TEXT,
  p_method          TEXT DEFAULT 'qr_scan'
)
RETURNS TABLE (result TEXT, total_delivered INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_guest_id UUID;
  v_method   TEXT := CASE WHEN p_method = 'manual' THEN 'manual' ELSE 'qr_scan' END;
BEGIN
  -- Caller must own this booking AND the service must be delivery-enabled.
  SELECT ev.event_id INTO v_event_id
  FROM public.event_vendors ev
  JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
  WHERE ev.vendor_id = p_event_vendor_id
    AND ev.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
    AND vs.per_guest_delivery = true;
  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT 'not_owner'::TEXT, 0;
    RETURN;
  END IF;

  -- Token must belong to a guest on that booking's event (case-insensitive).
  SELECT g.guest_id INTO v_guest_id
  FROM public.guests g
  WHERE lower(g.qr_token) = lower(btrim(p_qr_token))
    AND g.event_id = v_event_id
    AND g.deleted_at IS NULL;
  IF v_guest_id IS NULL THEN
    RETURN QUERY
      SELECT 'not_found'::TEXT,
             (SELECT count(*)::INT FROM public.event_service_deliveries d
              WHERE d.event_vendor_id = p_event_vendor_id);
    RETURN;
  END IF;

  INSERT INTO public.event_service_deliveries
    (event_id, event_vendor_id, guest_id, delivered_by_user_id, method)
  VALUES (v_event_id, p_event_vendor_id, v_guest_id, auth.uid(), v_method)
  ON CONFLICT (event_vendor_id, guest_id) DO NOTHING;

  RETURN QUERY
    SELECT CASE WHEN FOUND THEN 'delivered' ELSE 'already' END::TEXT,
           (SELECT count(*)::INT FROM public.event_service_deliveries d
            WHERE d.event_vendor_id = p_event_vendor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_guest_delivery(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.undo_guest_delivery(
  p_event_vendor_id UUID,
  p_qr_token        TEXT
)
RETURNS TABLE (result TEXT, total_delivered INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_guest_id UUID;
BEGIN
  SELECT ev.event_id INTO v_event_id
  FROM public.event_vendors ev
  JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
  WHERE ev.vendor_id = p_event_vendor_id
    AND ev.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
    AND vs.per_guest_delivery = true;
  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT 'not_owner'::TEXT, 0;
    RETURN;
  END IF;

  SELECT g.guest_id INTO v_guest_id
  FROM public.guests g
  WHERE lower(g.qr_token) = lower(btrim(p_qr_token)) AND g.event_id = v_event_id AND g.deleted_at IS NULL;

  IF v_guest_id IS NOT NULL THEN
    DELETE FROM public.event_service_deliveries d
    WHERE d.event_vendor_id = p_event_vendor_id AND d.guest_id = v_guest_id;
  END IF;

  RETURN QUERY
    SELECT 'undone'::TEXT,
           (SELECT count(*)::INT FROM public.event_service_deliveries d
            WHERE d.event_vendor_id = p_event_vendor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_guest_delivery(UUID, TEXT) TO authenticated;

-- 4. The vendor's delivery-enabled bookings (for the scan-station index).
--    DEFINER so the vendor never reads event_vendors / events directly; returns
--    only operational fields (event label + service title + running count).
CREATE OR REPLACE FUNCTION public.list_vendor_delivery_bookings()
RETURNS TABLE (event_vendor_id UUID, event_label TEXT, service_title TEXT, delivered INT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT ev.vendor_id,
         COALESCE(NULLIF(e.display_name, ''), 'Your event'),
         COALESCE(NULLIF(vs.title, ''), ev.category::text, 'Service'),
         (SELECT count(*)::INT FROM public.event_service_deliveries d WHERE d.event_vendor_id = ev.vendor_id)
  FROM public.event_vendors ev
  JOIN public.events e ON e.event_id = ev.event_id
  JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
  WHERE ev.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
    AND vs.per_guest_delivery = true
  ORDER BY e.event_date NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.list_vendor_delivery_bookings() TO authenticated;

-- 5. Carry per_guest_delivery through the guided-wizard atomic save (the wizard
--    create path posts to commitVendorService -> save_vendor_service, a column
--    whitelist that previously dropped the field). Re-defines the function from
--    20270209713470 verbatim + the one new column in both INSERT and UPDATE.
CREATE OR REPLACE FUNCTION public.save_vendor_service(
  p_vendor_profile_id uuid,
  p_service_id        uuid,
  p_fields            jsonb,
  p_links             jsonb,
  p_schedule          jsonb,
  p_publish           boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id uuid;
  v_perk       text;
BEGIN
  v_perk := NULLIF(btrim(COALESCE(p_fields->>'exclusive_perk_text', '')), '');

  IF p_publish AND v_perk IS NULL THEN
    RAISE EXCEPTION 'A Setnayan Exclusive perk is required to publish this service.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.vendor_services (
      vendor_profile_id, category, title, starting_price_php, added_pax_price_php,
      crew_size, crew_meal_required, branch_id, recommended_lead_time_months,
      last_minute_end_months, last_minute_surcharge_pct, daily_capacity,
      discount_type, discount_value, discount_expires_at, discount_conditions_md,
      exclusive_perk_text, primary_photo_r2_key, per_guest_delivery, is_active
    ) VALUES (
      p_vendor_profile_id,
      p_fields->>'category',
      NULLIF(p_fields->>'title', ''),
      (p_fields->>'starting_price_php')::int,
      (p_fields->>'added_pax_price_php')::int,
      (p_fields->>'crew_size')::int,
      COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      (p_fields->>'branch_id')::uuid,
      (p_fields->>'recommended_lead_time_months')::numeric,
      (p_fields->>'last_minute_end_months')::int,
      (p_fields->>'last_minute_surcharge_pct')::int,
      (p_fields->>'daily_capacity')::int,
      p_fields->>'discount_type',
      (p_fields->>'discount_value')::numeric,
      (p_fields->>'discount_expires_at')::timestamptz,
      p_fields->>'discount_conditions_md',
      v_perk,
      NULLIF(p_fields->>'primary_photo_r2_key', ''),
      COALESCE((p_fields->>'per_guest_delivery')::boolean, FALSE),
      p_publish
    )
    RETURNING vendor_service_id INTO v_service_id;
  ELSE
    UPDATE public.vendor_services SET
      title                        = NULLIF(p_fields->>'title', ''),
      starting_price_php           = (p_fields->>'starting_price_php')::int,
      added_pax_price_php          = (p_fields->>'added_pax_price_php')::int,
      crew_size                    = (p_fields->>'crew_size')::int,
      crew_meal_required           = COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      branch_id                    = (p_fields->>'branch_id')::uuid,
      recommended_lead_time_months = (p_fields->>'recommended_lead_time_months')::numeric,
      last_minute_end_months       = (p_fields->>'last_minute_end_months')::int,
      last_minute_surcharge_pct    = (p_fields->>'last_minute_surcharge_pct')::int,
      daily_capacity               = (p_fields->>'daily_capacity')::int,
      discount_type                = p_fields->>'discount_type',
      discount_value               = (p_fields->>'discount_value')::numeric,
      discount_expires_at          = (p_fields->>'discount_expires_at')::timestamptz,
      discount_conditions_md       = p_fields->>'discount_conditions_md',
      exclusive_perk_text          = v_perk,
      primary_photo_r2_key         = NULLIF(p_fields->>'primary_photo_r2_key', ''),
      per_guest_delivery           = COALESCE((p_fields->>'per_guest_delivery')::boolean, FALSE),
      is_active                    = p_publish,
      updated_at                   = NOW()
    WHERE vendor_service_id = p_service_id
      AND vendor_profile_id = p_vendor_profile_id
    RETURNING vendor_service_id INTO v_service_id;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  DELETE FROM public.vendor_service_links
    WHERE vendor_service_id = v_service_id
      AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_links
    (vendor_service_id, vendor_profile_id, linked_canonical_service, linked_label, display_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'linked_canonical_service',
         e->>'linked_label',
         COALESCE((e->>'display_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_links, '[]'::jsonb)) AS e;

  DELETE FROM public.vendor_service_payment_schedules
    WHERE vendor_service_id = v_service_id
      AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_payment_schedules
    (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days)
  SELECT v_service_id, p_vendor_profile_id,
         (e->>'seq')::int,
         e->>'label',
         e->>'amount_kind',
         (e->>'percent_bps')::int,
         (e->>'amount_centavos')::bigint,
         e->>'due_anchor',
         (e->>'due_offset_days')::int
  FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb)) AS e;

  RETURN v_service_id;
END;
$$;
