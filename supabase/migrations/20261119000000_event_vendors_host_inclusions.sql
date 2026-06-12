-- Dual-path DIY parity (owner doctrine 2026-06-11 · corpus DECISION_LOG):
-- a host planning WITHOUT marketplace vendors can describe their own vendor's
-- order — what's included in the package + which other plan categories it
-- covers ("link other services to it"). Marketplace vendors keep their
-- vendor-authored sources (vendor_service_links / vendor_package_items);
-- these columns are the HOST-authored mirror for manual (off-platform) rows.
--
-- RLS: event_vendors' existing couple-own policies cover the new columns
-- (vendors never see the row — shortlist stays couple-only).

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS host_inclusions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS covers_plan_groups text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.event_vendors.host_inclusions IS
  'Host-authored "what''s included" lines for a manual (off-platform) vendor''s package (dual-path DIY parity, 2026-06-11).';
COMMENT ON COLUMN public.event_vendors.covers_plan_groups IS
  'Plan-group ids this vendor''s package also covers — host-authored "comes with" links for DIY vendors (dual-path DIY parity, 2026-06-11).';
