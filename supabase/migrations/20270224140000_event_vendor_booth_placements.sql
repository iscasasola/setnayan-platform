-- ============================================================================
-- 20270224140000_event_vendor_booth_placements.sql
--
-- Build #2 (vendor booths) — foundation. Where a vendor's booth sits in the
-- couple's 3D event scene. Sourced from the couple's OWN vendor registry
-- (public.event_vendors, iteration 0006) so EVERY vendor the couple has can be
-- placed for a complete floor plan (owner 2026-06-25: "list all the vendors for
-- the full floor plan"). The booth renders GENERIC here; the Pro/Enterprise
-- branded skin (logo + theme + promo) is a follow-up that resolves the
-- registry↔platform-vendor link first — deliberately NOT guessed in this table.
--
-- Couple-scoped exactly like event_vendors itself (current_couple_event_ids);
-- admin ops go through the service-role client (RLS-exempt). RLS at create time.
-- Idempotent (IF NOT EXISTS + DROP POLICY IF EXISTS) so a later db push is safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_vendor_booth_placements (
  placement_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  event_vendor_id uuid NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  -- Spatial position on the 2D canvas (percent), mirroring tables/floor objects
  -- so the 3D lab's pctToWorld places booths the same way it places tables.
  x_pct           numeric NOT NULL DEFAULT 50,
  y_pct           numeric NOT NULL DEFAULT 50,
  rotation_deg    numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One booth per vendor per event.
  UNIQUE (event_id, event_vendor_id)
);

CREATE INDEX IF NOT EXISTS event_vendor_booth_placements_event_id_idx
  ON public.event_vendor_booth_placements(event_id);

ALTER TABLE public.event_vendor_booth_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evbp_couple_read ON public.event_vendor_booth_placements;
CREATE POLICY evbp_couple_read
  ON public.event_vendor_booth_placements
  FOR SELECT
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS evbp_couple_write ON public.event_vendor_booth_placements;
CREATE POLICY evbp_couple_write
  ON public.event_vendor_booth_placements
  FOR ALL
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));
