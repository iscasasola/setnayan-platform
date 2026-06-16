-- migration: 20270108000100_inquiry_multi_service
-- Adds requested_service_ids UUID[] to event_vendors so the couple's
-- multi-service inquiry selection is persisted alongside the thread.
-- Best-effort column: IF NOT EXISTS lets this replay safely if the
-- column was applied manually on a prior deploy.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS requested_service_ids UUID[] NOT NULL DEFAULT '{}';

-- GIN index for array containment checks (e.g. vendor looking up which
-- events asked about a specific service_id).
CREATE INDEX IF NOT EXISTS event_vendors_requested_service_ids_gin
  ON public.event_vendors USING GIN (requested_service_ids);
