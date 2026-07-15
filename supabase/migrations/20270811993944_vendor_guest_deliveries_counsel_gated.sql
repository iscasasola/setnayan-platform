-- ============================================================================
-- 20270811993944_vendor_guest_deliveries_counsel_gated.sql
--
-- ⚠️  COUNSEL-GATED — DO NOT `supabase db push` UNTIL THE DPO/NPC RULING.  ⚠️
--
-- Per-guest vendor delivery tracker (owner override 2026-07-16, council §8) —
-- "if the service is pax-related, show which guests have NOT yet received their
-- product". The council CUT this: it creates a net-new vendor_profile_id ×
-- guest_id link = guest-PI-to-vendor exposure with no existing hook (only couple-
-- side guest_souvenir_claims / check-in exist). The owner overrode; same DPO/NPC
-- consent-chain ruling as vendor Papic capture GOVERNS GO-LIVE. Committed for
-- review, gated by VENDOR_GUEST_DELIVERY_ENABLED (defaults OFF), do not push
-- until counsel signs off.
--
-- A row = "vendor V handed their product to guest G at event E". The vendor
-- reads the couple's guest list for a booked event (already permitted for the
-- brief) and checks guests off; unchecked guests are "not yet received".
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_guest_deliveries (
  delivery_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The guest who received (couple's guest list row).
  guest_id          UUID NOT NULL,
  -- What was delivered (optional label — "plated main", "souvenir", …).
  item_label        TEXT CHECK (item_label IS NULL OR char_length(item_label) <= 120),
  delivered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Soft undo.
  voided_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, event_id, guest_id, item_label)
);

CREATE INDEX IF NOT EXISTS vendor_guest_deliveries_ve_idx
  ON public.vendor_guest_deliveries (vendor_profile_id, event_id)
  WHERE voided_at IS NULL;

COMMENT ON TABLE public.vendor_guest_deliveries IS
  'COUNSEL-GATED (DO NOT push until DPO/NPC ruling). Per-guest vendor delivery tracker — a vendor marks which guests received their product at a booked event; unchecked = not yet received. Net-new vendor×guest PI link, owner-overridden 2026-07-16, go-live gated on the DPO consent-chain ruling.';

-- RLS AT CREATE TIME. Vendor read/write their own deliveries on booked events.
ALTER TABLE public.vendor_guest_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_guest_deliveries_vendor_read ON public.vendor_guest_deliveries;
CREATE POLICY vendor_guest_deliveries_vendor_read
  ON public.vendor_guest_deliveries FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()) OR public.is_admin());

DROP POLICY IF EXISTS vendor_guest_deliveries_vendor_insert ON public.vendor_guest_deliveries;
CREATE POLICY vendor_guest_deliveries_vendor_insert
  ON public.vendor_guest_deliveries FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

DROP POLICY IF EXISTS vendor_guest_deliveries_vendor_update ON public.vendor_guest_deliveries;
CREATE POLICY vendor_guest_deliveries_vendor_update
  ON public.vendor_guest_deliveries FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Couple/host + admin: READ deliveries on their event (transparency into what
-- guests were served/handed).
DROP POLICY IF EXISTS vendor_guest_deliveries_couple_read ON public.vendor_guest_deliveries;
CREATE POLICY vendor_guest_deliveries_couple_read
  ON public.vendor_guest_deliveries FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()) OR public.is_admin());

COMMIT;
