-- Hardening: bind a vendor payment to the SAME event as its vendor.
--
-- Defense-in-depth for the payments ledger (surfaced by the native app's
-- write-flow review, benefits web too): a composite (event_id, vendor_id) FK
-- makes it impossible to log a payment against a vendor that belongs to a
-- different event than the payment's event_id. The client already scopes the
-- vendor picker to the event's own vendors, so this is a backstop, not a fix
-- for a known break.
--
-- Additive + idempotent. vendor_id is already UNIQUE (PK), so the
-- (event_id, vendor_id) unique constraint cannot fail on existing rows.
-- Pre-flight on prod confirmed 0 cross-event payment rows before applying.
--
-- NOTE: already applied to prod via MCP apply_migration on 2026-06-25
-- (schema_migrations version 20260625050413). This file makes the repo match
-- the DB; the idempotent guards make a re-run a no-op.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_vendors_event_id_vendor_id_key') then
    alter table public.event_vendors
      add constraint event_vendors_event_id_vendor_id_key unique (event_id, vendor_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'event_vendor_payments_event_vendor_fk') then
    alter table public.event_vendor_payments
      add constraint event_vendor_payments_event_vendor_fk
      foreign key (event_id, vendor_id)
      references public.event_vendors (event_id, vendor_id) on delete cascade;
  end if;
end $$;
