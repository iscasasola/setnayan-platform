-- Prevent duplicate ACTIVE marketplace picks per event.
--
-- The native "Save Vendor" flow and the web explore-save both dedup with a
-- client-side check-then-insert (no DB unique existed). A race (or two surfaces
-- at once) could create two event_vendors rows for the same marketplace vendor
-- in one event. This adds the DB backstop: a partial unique index on
-- (event_id, marketplace_vendor_id) for active, non-archived rows — mirroring
-- the existing event_vendors_hard_single_lock_uniq archive-aware pattern.
--
-- Before adding the index, soft-archive any pre-existing active duplicate
-- (keep the lowest vendor_id active). On prod this resolved exactly one seed
-- artifact: the public sample event "Maria & Jose" had "Sulyap Studios"
-- inserted twice (identical created_at, source NULL). Reversible (clear
-- archived_at to undo) and lossless (the vendor stays active once).
--
-- Additive + idempotent. Already applied to prod via apply_migration on
-- 2026-06-25 (schema_migrations version 20260625050739); this file matches the
-- repo to the DB.

update public.event_vendors v
set archived_at = now()
where v.archived_at is null
  and v.marketplace_vendor_id is not null
  and exists (
    select 1 from public.event_vendors o
    where o.event_id = v.event_id
      and o.marketplace_vendor_id = v.marketplace_vendor_id
      and o.archived_at is null
      and o.vendor_id < v.vendor_id
  );

create unique index if not exists event_vendors_unique_marketplace_pick_per_event
  on public.event_vendors (event_id, marketplace_vendor_id)
  where marketplace_vendor_id is not null and archived_at is null;
